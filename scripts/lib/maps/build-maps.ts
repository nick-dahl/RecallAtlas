import fs from 'node:fs';
import path from 'node:path';
import {
  geoAzimuthalEqualArea,
  geoCentroid,
  geoEqualEarth,
  geoPath,
  geoStream,
  type GeoProjection,
  type GeoStream,
} from 'd3-geo';
import type { Feature, Geometry, MultiPoint, MultiPolygon, Position } from 'geojson';
import polylabel from 'polylabel';
import { feature, merge, mesh } from 'topojson-client';
import { presimplify, simplify, sphericalTriangleArea } from 'topojson-simplify';
import type { GeometryCollection, GeometryObject, Topology } from 'topojson-specification';
import type { CountryRecord } from '../../../lib/content/types';
import { FRAME_WIDTH, FRAMES, GROUP_FRAMES, type Extent, type FrameDef } from '../../../lib/map/frames';
import { hitTest, pointInRings } from '../../../lib/map/hit-test';
import type { AtlasData, CountryShape, FrameData, MarkerShape } from '../../../lib/map/types';
import {
  ANTARCTICA_ID,
  ATLAS_EXTENT,
  ATLAS_MARKER_R,
  ATLAS_SIMPLIFY_AREA,
  BASE_SVG_MAX_BYTES,
  FEATURE_NAME_KEYS,
  MAP_COLORS,
  MARKER_BELOW,
  MARKER_ONLY_KEYS,
  MARKER_OUTLINE_PAD,
  MARKER_R,
  SIMPLIFY_AREA,
  SLIVER_MAX_AREA,
  SPLITS,
} from '../../map-config';

type CountryProps = { name: string };
type WorldTopology = Topology<{ countries: GeometryCollection<CountryProps> }>;
type CountryObject = GeometryObject;

const nameOf = (g: CountryObject) => (g.properties as Partial<CountryProps> | undefined)?.name ?? '';

export interface BuiltFrame {
  def: FrameDef;
  svg: string;
  data: FrameData;
}

const round = (v: number) => Math.round(v * 10) / 10;

function loadTopology(): WorldTopology {
  const file = path.join(process.cwd(), 'node_modules', 'world-atlas', 'countries-50m.json');
  return JSON.parse(fs.readFileSync(file, 'utf8')) as WorldTopology;
}

/** Points along an extent's edges, so a fitted projection shows the whole box. */
function perimeter([w, s, e, n]: Extent): MultiPoint {
  const pts: Position[] = [];
  for (let x = w; x < e; x += 1) pts.push([x, s], [x, n]);
  for (let y = s; y < n; y += 1) pts.push([w, y], [e, y]);
  pts.push([e, s], [e, n]);
  return { type: 'MultiPoint', coordinates: pts };
}

/** Fits `projection` to the extent at FRAME_WIDTH and clips it to the resulting viewBox. */
function fit(projection: GeoProjection, extent: Extent): { projection: GeoProjection; height: number } {
  const outline = perimeter(extent);
  projection.fitWidth(FRAME_WIDTH, outline);
  const height = Math.ceil(geoPath(projection).bounds(outline)[1][1]);
  projection.clipExtent([
    [0, 0],
    [FRAME_WIDTH, height],
  ]);
  return { projection, height };
}

function frameProjection(def: FrameDef) {
  const [w, s, e, n] = def.extent;
  return fit(geoAzimuthalEqualArea().rotate([-(w + e) / 2, -(s + n) / 2]), def.extent);
}

function polygonsOf(g: Geometry | null): Position[][][] {
  if (!g) return [];
  if (g.type === 'Polygon') return [g.coordinates];
  if (g.type === 'MultiPolygon') return g.coordinates;
  return [];
}

const inExtent = ([lng, lat]: Position, [w, s, e, n]: Extent) => lng >= w && lng <= e && lat >= s && lat <= n;

/** Course key of a world-atlas feature, or null for land that is never an answer. */
function keyResolver(records: readonly CountryRecord[], warnings: string[]) {
  const byCcn3 = new Map(records.filter((r) => r.ccn3).map((r) => [r.ccn3, r.key]));
  return (g: CountryObject): string | null => {
    const id = g.id === undefined ? undefined : String(g.id);
    if (id !== undefined && byCcn3.has(id)) return byCcn3.get(id)!;
    const name = nameOf(g);
    if (Object.hasOwn(FEATURE_NAME_KEYS, name)) return FEATURE_NAME_KEYS[name];
    if (id === undefined) warnings.push(`world-atlas feature "${name}" has no id and no mapping rule`);
    return null;
  };
}

/** Projects a geometry through the (clipping) projection into flat rings rounded to 0.1. */
function projectRings(projection: GeoProjection, geometry: Geometry): number[][] {
  const rings: number[][] = [];
  let ring: number[] | null = null;
  const sink: GeoStream = {
    point(x, y) {
      ring?.push(round(x), round(y));
    },
    lineStart() {
      ring = [];
    },
    lineEnd() {
      if (ring && ring.length >= 6) rings.push(ring);
      ring = null;
    },
    polygonStart() {},
    polygonEnd() {},
    sphere() {},
  };
  geoStream(geometry, projection.stream(sink));
  return rings;
}

function ringArea(r: number[]): number {
  let a = 0;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) a += (r[j] + r[i]) * (r[j + 1] - r[i + 1]);
  return Math.abs(a / 2);
}

function ringBbox(rings: number[][]): [number, number, number, number] {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const r of rings) {
    for (let i = 0; i < r.length; i += 2) {
      x0 = Math.min(x0, r[i]);
      x1 = Math.max(x1, r[i]);
      y0 = Math.min(y0, r[i + 1]);
      y1 = Math.max(y1, r[i + 1]);
    }
  }
  return [x0, y0, x1, y1];
}

const toPoints = (r: number[]) => Array.from({ length: r.length / 2 }, (_, i) => [r[2 * i], r[2 * i + 1]]);

/** Pole of inaccessibility of the largest ring, treating rings inside it as holes. */
function labelPoint(rings: number[][]): { label: [number, number]; largest: number[] } {
  const largest = rings.reduce((best, r) => (ringArea(r) > ringArea(best) ? r : best));
  const holes = rings.filter((r) => r !== largest && pointInRings([largest], r[0], r[1]));
  const p = polylabel([toPoints(largest), ...holes.map(toPoints)], 0.2);
  return { label: [round(p[0]), round(p[1])], largest };
}

const circlePath = (x: number, y: number, r: number) =>
  `M${round(x - r)},${round(y)}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`;

/** Every course key's geometry (lon/lat) in a simplified topology, plus land and borders. */
function keyedGeometry(topo: WorldTopology, keyOf: (g: CountryObject) => string | null) {
  const objects = topo.objects.countries.geometries;
  const polygons = new Map<string, Position[][][]>();
  for (const obj of objects) {
    const key = keyOf(obj);
    if (!key) continue;
    const parts = polygonsOf((feature(topo, obj) as Feature).geometry);
    for (const part of parts) {
      const split = SPLITS.find((s) => s.from === key && inExtent(part[0][0], s.bbox));
      const target = split?.key ?? key;
      polygons.set(target, [...(polygons.get(target) ?? []), part]);
    }
  }
  const geometries = new Map<string, MultiPolygon>(
    [...polygons].map(([k, coordinates]) => [k, { type: 'MultiPolygon', coordinates }]),
  );
  const land = merge(
    topo,
    objects.filter((o) => String(o.id) !== ANTARCTICA_ID) as Parameters<typeof merge>[1],
  );
  const side = (g: CountryObject) => keyOf(g) ?? `feature:${nameOf(g)}`;
  const borders = mesh(topo, topo.objects.countries, (a, b) => a !== b && side(a) !== side(b));
  return { geometries, land, borders };
}

/** Simplifies so dropped detail is under `area` square units at this projection's scale. */
function simplifyFor(pre: WorldTopology, projection: GeoProjection, area: number): WorldTopology {
  return simplify(pre, area / projection.scale() ** 2);
}

function buildFrame(
  def: FrameDef,
  pre: WorldTopology,
  records: readonly CountryRecord[],
  keyOf: (g: CountryObject) => string | null,
): BuiltFrame {
  const { projection, height } = frameProjection(def);
  const unclipped = frameProjection(def).projection.clipExtent(null);
  const { geometries, land, borders } = keyedGeometry(simplifyFor(pre, projection, SIMPLIFY_AREA), keyOf);
  const path = geoPath(projection).digits(1);
  const fullArea = geoPath(unclipped);
  const countries: Record<string, CountryShape> = {};

  const pointMarker = (key: string, lngLat: [number, number]) => {
    const p = projection(lngLat);
    if (!p || p[0] < 0 || p[0] > FRAME_WIDTH || p[1] < 0 || p[1] > height) return;
    const [x, y] = [round(p[0]), round(p[1])];
    countries[key] = {
      rings: [],
      bbox: [x, y, x, y],
      outline: circlePath(x, y, MARKER_R + MARKER_OUTLINE_PAD),
      label: [x, y],
      marker: { x, y, r: MARKER_R },
    };
  };

  for (const [key, geometry] of geometries) {
    const rings = projectRings(projection, geometry);
    if (rings.length === 0) {
      // Tiny islands can simplify away entirely; keep them as a marker at their centroid.
      pointMarker(key, geoCentroid(geometry) as [number, number]);
      continue;
    }
    const { label, largest } = labelPoint(rings);
    const visible = path.area(geometry);
    const sliver = visible < fullArea.area(geometry) / 2 && visible < SLIVER_MAX_AREA;
    const [lx0, ly0, lx1, ly1] = ringBbox([largest]);
    const small = !sliver && Math.max(lx1 - lx0, ly1 - ly0) < MARKER_BELOW;
    const marker: MarkerShape | undefined = small ? { x: label[0], y: label[1], r: MARKER_R } : undefined;
    countries[key] = {
      rings,
      bbox: ringBbox(rings),
      outline: (path(geometry) ?? '') + (marker ? circlePath(marker.x, marker.y, MARKER_R + MARKER_OUTLINE_PAD) : ''),
      label,
      ...(marker ? { marker } : {}),
      ...(sliver ? { sliver: true as const } : {}),
    };
  }

  for (const key of MARKER_ONLY_KEYS) {
    const record = records.find((r) => r.key === key);
    if (!record) throw new Error(`MARKER_ONLY_KEYS references unknown key ${key}`);
    pointMarker(key, [record.latlng[1], record.latlng[0]]);
  }

  const markers = Object.values(countries).flatMap((s) => (s.marker ? [s.marker] : []));
  const stroke = 'stroke-width="0.75" stroke-linejoin="round" vector-effect="non-scaling-stroke"';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FRAME_WIDTH} ${height}">` +
    `<rect width="${FRAME_WIDTH}" height="${height}" fill="${MAP_COLORS.sea}"/>` +
    `<path d="${path(land) ?? ''}" fill="${MAP_COLORS.land}" stroke="${MAP_COLORS.coast}" ${stroke}/>` +
    `<path d="${path(borders) ?? ''}" fill="none" stroke="${MAP_COLORS.border}" ${stroke}/>` +
    `<g fill="${MAP_COLORS.land}" stroke="${MAP_COLORS.coast}" ${stroke}>` +
    markers.map((m) => `<circle cx="${m.x}" cy="${m.y}" r="${m.r}"/>`).join('') +
    `</g></svg>`;

  return { def, svg, data: { id: def.id, width: FRAME_WIDTH, height, countries } };
}

function buildAtlas(pre: WorldTopology, keyOf: (g: CountryObject) => string | null, records: readonly CountryRecord[]): AtlasData {
  const { projection, height } = fit(geoEqualEarth(), ATLAS_EXTENT);
  const { geometries, land, borders } = keyedGeometry(simplifyFor(pre, projection, ATLAS_SIMPLIFY_AREA), keyOf);
  const path = geoPath(projection).digits(1);
  const countries: AtlasData['countries'] = {};
  for (const [key, geometry] of geometries) {
    const rings = projectRings(projection, geometry);
    if (rings.length === 0) continue;
    const { label, largest } = labelPoint(rings);
    const [x0, y0, x1, y1] = ringBbox([largest]);
    const small = Math.max(x1 - x0, y1 - y0) < MARKER_BELOW;
    countries[key] = { d: path(geometry) ?? '', ...(small ? { marker: { x: label[0], y: label[1], r: ATLAS_MARKER_R } } : {}) };
  }
  for (const key of MARKER_ONLY_KEYS) {
    const [lat, lng] = records.find((r) => r.key === key)!.latlng;
    const [x, y] = projection([lng, lat])!.map(round);
    countries[key] = { d: '', marker: { x, y, r: ATLAS_MARKER_R } };
  }
  return { width: FRAME_WIDTH, height, land: path(land) ?? '', borders: path(borders) ?? '', countries };
}

/** Checks the map spec §3 rules; returns human-readable failures. */
export function validateMaps(frames: readonly BuiltFrame[], records: readonly CountryRecord[], atlas: AtlasData): string[] {
  const errors: string[] = [];
  const byId = new Map(frames.map((f) => [f.def.id, f]));
  for (const { def, svg } of frames) {
    const bytes = Buffer.byteLength(svg);
    if (bytes > BASE_SVG_MAX_BYTES) errors.push(`${def.id}.svg is ${(bytes / 1024).toFixed(1)} KB (max 80 KB)`);
    if (/\b(id|class|data-[\w-]+)=|<title|<text|<desc/.test(svg)) errors.push(`${def.id}.svg contains identifying markup`);
    for (const r of records) if (svg.includes(r.name)) errors.push(`${def.id}.svg contains the name ${r.name}`);
  }
  for (const r of records) {
    const frameIds = GROUP_FRAMES[r.group];
    if (!frameIds) {
      errors.push(`${r.key}: no frames for group ${r.group}`);
      continue;
    }
    for (const id of [frameIds.region, frameIds.continent]) {
      const frame = byId.get(id)!.data;
      const s = frame.countries[r.key];
      if (!s) errors.push(`${r.key} (${r.name}) is not drawn in ${id}`);
      else if (s.sliver) errors.push(`${r.key} (${r.name}) is only a sliver in ${id}`);
      else if (hitTest(frame, s.label[0] / frame.width, s.label[1] / frame.height, frame.width) !== r.key) {
        errors.push(`${r.key} (${r.name}): its interior point does not hit-test back in ${id}`);
      }
    }
    if (!atlas.countries[r.key]) errors.push(`${r.key} is missing from the atlas`);
  }
  return errors;
}

export function buildMaps(records: readonly CountryRecord[]): {
  frames: BuiltFrame[];
  atlas: AtlasData;
  errors: string[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const pre = presimplify(loadTopology(), sphericalTriangleArea);
  const keyOf = keyResolver(records, warnings);
  const frames = FRAMES.map((def) => buildFrame(def, pre, records, keyOf));
  const atlas = buildAtlas(pre, keyOf, records);
  return { frames, atlas, errors: validateMaps(frames, records, atlas), warnings: [...new Set(warnings)] };
}
