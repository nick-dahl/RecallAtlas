import fs from 'node:fs';
import path from 'node:path';
import { optimize } from 'svgo';
import worldCountries from 'world-countries';
import { GROUP_ORDER } from './content-config';
import { buildCountries, type RawCountry } from './lib/build-countries';

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
