import fs from 'node:fs';
import path from 'node:path';
import { optimize } from 'svgo';
import worldCountries from 'world-countries';
import { GROUP_ORDER } from './content-config';
import { buildCountries, type RawCountry } from './lib/build-countries';
import { buildMaps } from './lib/maps/build-maps';
import { buildPaintings } from './lib/build-paintings';
import { buildPresidents } from './lib/build-presidents';
import { ARTISTS, MOVEMENTS, PAINTINGS, SUBJECT_PAIRS } from './paintings-data';
import { AMBIGUOUS_NAMES, ERAS, FACE_LOOKALIKE_PAIRS, PRESIDENTS, SHARED_SPAN_PAIRS } from './presidents-data';

const root = process.cwd();
const { countries, warnings } = buildCountries(worldCountries as unknown as RawCountry[]);

for (const group of GROUP_ORDER) {
  if (!countries.some((c) => c.group === group)) throw new Error(`Group "${group}" has no countries`);
}

const flagSrc = path.join(root, 'node_modules', 'flag-icons', 'flags', '4x3');
const flagDest = path.join(root, 'content', 'flags');
fs.rmSync(path.join(root, 'public', 'flags'), { recursive: true, force: true });
fs.rmSync(flagDest, { recursive: true, force: true });
fs.mkdirSync(flagDest, { recursive: true });

let totalBytes = 0;
for (const c of countries) {
  const file = `${c.key.toLowerCase()}.svg`;
  const src = path.join(flagSrc, file);
  if (!fs.existsSync(src)) throw new Error(`Missing flag asset: ${src}`);
  const { data } = optimize(fs.readFileSync(src, 'utf8'), {
    multipass: true,
    plugins: ['preset-default', { name: 'removeAttrs', params: { attrs: 'svg:id' } }],
  });
  if (data.includes('flag-icons')) throw new Error(`Flag ${file} still contains identifying markup`);
  fs.writeFileSync(path.join(flagDest, file), data);
  totalBytes += Buffer.byteLength(data);
}

fs.writeFileSync(path.join(root, 'content', 'countries.json'), JSON.stringify(countries, null, 2) + '\n');

for (const w of warnings) console.warn(`warn: ${w}`);
console.log(
  `Wrote ${countries.length} countries to content/countries.json and ${countries.length} flags ` +
    `(${(totalBytes / 1024).toFixed(0)} KB) to content/flags/.`,
);

const maps = buildMaps(countries);
for (const w of maps.warnings) console.warn(`warn: ${w}`);
if (maps.errors.length > 0) {
  for (const e of maps.errors) console.error(`error: ${e}`);
  throw new Error(`Map validation failed (${maps.errors.length} errors); nothing written to content/maps or public/maps.`);
}

const svgDest = path.join(root, 'public', 'maps');
const hitDest = path.join(root, 'content', 'maps');
for (const dir of [svgDest, hitDest]) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}
const sizes: string[] = [];
for (const { def, svg, data } of maps.frames) {
  fs.writeFileSync(path.join(svgDest, `${def.id}.svg`), svg);
  fs.writeFileSync(path.join(hitDest, `${def.id}.hit.json`), JSON.stringify(data));
  sizes.push(`${def.id} ${(Buffer.byteLength(svg) / 1024).toFixed(0)} KB`);
}
fs.writeFileSync(path.join(hitDest, 'world-atlas.json'), JSON.stringify(maps.atlas));
console.log(`Wrote ${maps.frames.length} map frames (base SVG sizes: ${sizes.join(', ')}) and the world atlas.`);

// Portraits come from `npm run content:portraits` (committed); the build only checks they exist.
const presidents = buildPresidents(PRESIDENTS, ERAS, FACE_LOOKALIKE_PAIRS, SHARED_SPAN_PAIRS, {
  hasPortrait: (key) => fs.existsSync(path.join(root, 'content', 'portraits', `${key}.webp`)),
  ambiguous: AMBIGUOUS_NAMES,
});
fs.writeFileSync(
  path.join(root, 'content', 'presidents.json'),
  JSON.stringify({ presidents, orderExclusions: SHARED_SPAN_PAIRS, ambiguousAnswers: AMBIGUOUS_NAMES }, null, 2) + '\n',
);
console.log(`Wrote ${presidents.length} presidents to content/presidents.json.`);

// Painting images come from `npm run content:paintings` (committed); the build checks they exist and fit.
const paintingDir = path.join(root, 'content', 'paintings');
const fits = (file: string, budget: number) => {
  const full = path.join(paintingDir, file);
  return fs.existsSync(full) && fs.statSync(full).size <= budget;
};
const paintings = buildPaintings(PAINTINGS, {
  movements: MOVEMENTS,
  artists: ARTISTS,
  subjectPairs: SUBJECT_PAIRS,
  hasImage: (key) => fits(`${key}.webp`, 150 * 1024) && fits(`${key}-thumb.webp`, 30 * 1024),
});
fs.writeFileSync(path.join(root, 'content', 'paintings.json'), JSON.stringify({ paintings }, null, 2) + '\n');
console.log(`Wrote ${paintings.length} paintings to content/paintings.json.`);
