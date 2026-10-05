/**
 * One-off content step (`npm run content:portraits`): fetch each president's portrait from
 * Wikimedia Commons, refuse anything not public domain, crop to a 3:4 head-and-shoulders frame
 * and write content/portraits/<key>.webp plus credits. Never runs at request time or in
 * `content:build`; the committed files are the source of truth afterwards.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { isPublicDomain } from './lib/portrait-license';
import { PRESIDENTS, type PresidentEntry } from './presidents-data';

const USER_AGENT = 'RecallAtlas content build (nicholasryandahl@gmail.com)';
const OUT = path.join(process.cwd(), 'content', 'portraits');
export const PORTRAIT_SIZE = { width: 240, height: 320 };

async function api(host: string, params: Record<string, string>) {
  const url = `https://${host}/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`${host} ${res.status}`);
  return res.json();
}

const strip = (html?: string) => (html ?? '').replace(/<[^>]+>/g, '').trim();

async function leadImage(article: string): Promise<string> {
  const data = await api('en.wikipedia.org', { action: 'query', prop: 'pageimages', piprop: 'name', titles: article });
  const name = data.query.pages[0]?.pageimage;
  if (!name) throw new Error(`no lead image on ${article}`);
  return name;
}

async function fileInfo(file: string) {
  const data = await api('commons.wikimedia.org', {
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '900',
    titles: `File:${file}`,
  });
  const info = data.query.pages[0]?.imageinfo?.[0];
  if (!info) throw new Error(`File:${file} not found on Commons`);
  const meta = info.extmetadata ?? {};
  return {
    thumb: info.thumburl as string,
    page: info.descriptionurl as string,
    license: { LicenseShortName: meta.LicenseShortName?.value, License: meta.License?.value },
    artist: strip(meta.Artist?.value),
  };
}

async function fetchOne(p: PresidentEntry) {
  const file = p.commonsFile ?? (await leadImage(p.wikipedia));
  const info = await fileInfo(file);
  if (!isPublicDomain(info.license)) {
    throw new Error(`${file} is not public domain (${info.license.LicenseShortName ?? 'no licence'})`);
  }
  const res = await fetch(info.thumb, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const webp = await sharp(Buffer.from(await res.arrayBuffer()))
    .resize(PORTRAIT_SIZE.width, PORTRAIT_SIZE.height, { fit: 'cover', position: sharp.strategy.attention })
    .webp({ quality: 72 })
    .toBuffer();
  fs.writeFileSync(path.join(OUT, `${p.key}.webp`), webp);
  return { file, page: info.page, license: info.license.LicenseShortName ?? info.license.License, artist: info.artist };
}

async function main() {
  const only = process.argv.slice(2);
  fs.mkdirSync(OUT, { recursive: true });
  const sourcesPath = path.join(OUT, 'sources.json');
  const sources: Record<string, Awaited<ReturnType<typeof fetchOne>>> = fs.existsSync(sourcesPath)
    ? JSON.parse(fs.readFileSync(sourcesPath, 'utf8'))
    : {};
  const failures: string[] = [];
  for (const p of PRESIDENTS) {
    if (only.length && !only.includes(p.key)) continue;
    try {
      sources[p.key] = await fetchOne(p);
      console.log(`ok   ${p.key.padEnd(12)} ${sources[p.key].file} (${sources[p.key].license})`);
    } catch (err) {
      failures.push(`${p.key}: ${(err as Error).message}`);
      console.log(`FAIL ${p.key.padEnd(12)} ${(err as Error).message}`);
    }
  }
  const ordered = Object.fromEntries(PRESIDENTS.filter((p) => sources[p.key]).map((p) => [p.key, sources[p.key]]));
  fs.writeFileSync(sourcesPath, JSON.stringify(ordered, null, 2) + '\n');
  fs.writeFileSync(
    path.join(OUT, 'CREDITS.md'),
    '# Portrait credits\n\nAll portraits are public domain, from Wikimedia Commons, cropped and resized.\n\n' +
      PRESIDENTS.filter((p) => ordered[p.key])
        .map((p) => `- ${p.name}: [${ordered[p.key].file}](${ordered[p.key].page}), ${ordered[p.key].license}${ordered[p.key].artist ? `, by ${ordered[p.key].artist}` : ''}`)
        .join('\n') +
      '\n',
  );
  if (failures.length) {
    console.error(`\n${failures.length} portrait(s) failed; add a reviewed public-domain commonsFile override:\n${failures.join('\n')}`);
    process.exit(1);
  }
}

void main();
