import type { Extent } from '../lib/map/frames';

/**
 * world-atlas (Natural Earth 1:50m) features with no ISO numeric id, by feature name.
 * null = drawn as land but never clickable. Breakaway regions merge into their UN parent.
 */
export const FEATURE_NAME_KEYS: Record<string, string | null> = {
  Kosovo: 'XK',
  Somaliland: 'SO',
  'N. Cyprus': 'CY',
  'Indian Ocean Ter.': null,
  'Siachen Glacier': null,
};

/** world-atlas id of Antarctica, left out of every map. */
export const ANTARCTICA_ID = '010';

/** Territories carved out of a parent's multipolygon: parts whose first vertex lies in `bbox`. */
export const SPLITS: { key: string; from: string; bbox: Extent }[] = [
  { key: 'GF', from: 'FR', bbox: [-55, 1.5, -51, 6.5] },
];

/** Course items missing from the 1:50m data: a marker at their world-countries latlng. */
export const MARKER_ONLY_KEYS = ['TV'];

/** A country whose largest part projects smaller than this (viewBox units) gets a marker. */
export const MARKER_BELOW = 8;
/** Marker dot radius, in viewBox units. */
export const MARKER_R = 4;
/** Extra radius of the ring drawn around a marker country's overlay outline. */
export const MARKER_OUTLINE_PAD = 3;

/**
 * A country cut by the frame edge is a "sliver" (clickable, never a distractor) when less than
 * half of it is visible and what is visible is smaller than this many square viewBox units.
 */
export const SLIVER_MAX_AREA = 2000;

/** Visvalingam threshold, in square viewBox units, applied per frame. */
export const SIMPLIFY_AREA = 0.8;
export const BASE_SVG_MAX_BYTES = 80 * 1024;

/** The course-home atlas: Equal Earth, cropped above Antarctica. */
export const ATLAS_EXTENT: Extent = [-180, -58, 180, 84];
export const ATLAS_SIMPLIFY_AREA = 0.3;
export const ATLAS_MARKER_R = 2.5;

export const MAP_COLORS = { sea: '#d6e3e6', land: '#f5f0e3', coast: '#8f8775', border: '#b3a991' };
