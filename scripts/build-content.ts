import fs from 'node:fs';
import path from 'node:path';
import worldCountries from 'world-countries';
import { GROUP_ORDER } from './content-config';
import { buildCountries, type RawCountry } from './lib/build-countries';

const root = process.cwd();
const { countries, warnings } = buildCountries(worldCountries as unknown as RawCountry[]);

for (const g of GROUP_ORDER) {
  if (!countries.some((c) => c.group === g)) throw new Error(`Group "${g}" has no countries`);
}

const flagSrc = path.join(root, 'node_modules', 'flag-icons', 'flags', '4x3');
const flagDest = path.join(root, 'public', 'flags');
fs.rmSync(flagDest, { recursive: true, force: true });
fs.mkdirSync(flagDest, { recursive: true });
for (const c of countries) {
  const file = `${c.key.toLowerCase()}.svg`;
  const src = path.join(flagSrc, file);
  if (!fs.existsSync(src)) throw new Error(`Missing flag asset: ${src}`);
  fs.copyFileSync(src, path.join(flagDest, file));
}

fs.mkdirSync(path.join(root, 'content'), { recursive: true });
fs.writeFileSync(path.join(root, 'content', 'countries.json'), JSON.stringify(countries, null, 2) + '\n');

for (const w of warnings) console.warn(`warn: ${w}`);
console.log(`Wrote ${countries.length} countries to content/countries.json and their flags to public/flags/.`);
