/**
 * One-off content step (`npm run content:paintings [keys…]`): fetch each painting from Wikimedia
 * Commons, refuse anything not public domain (or, for works photographed in place, CC BY / BY-SA
 * with an author to credit), and write content/paintings/<key>.webp (≤ 900 px, ≤ 150 KB) and
 * <key>-thumb.webp (≤ 320 px, ≤ 30 KB), never cropped except for an explicit detail. Also writes
 * sources.json, CREDITS.md and a contact sheet for checking every image by eye. Never runs at
 * request time or in `content:build`; the committed files are the source of truth afterwards.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import type { PaintingSource } from '../lib/content/types';
import { fileInfo, leadImage, searchArticle, searchFiles, USER_AGENT } from './lib/commons';
import { isAttribution, isPublicDomain } from './lib/portrait-license';
import { PAINTINGS, type PaintingEntry } from './paintings-data';

const OUT = path.join(process.cwd(), 'content', 'paintings');
const LARGE = 900;
const THUMB = 320;
const BUDGET = { large: 150 * 1024, thumb: 30 * 1024 };

async function encode(input: Buffer, crop: PaintingEntry['crop'], size: number, budget: number): Promise<Buffer> {
  let img = sharp(input);
  if (crop) {
    const { width = 0, height = 0 } = await img.metadata();
    img = img.extract({
      left: Math.round(crop.left * width),
      top: Math.round(crop.top * height),
      width: Math.round(crop.width * width),
      height: Math.round(crop.height * height),
    });
  }
  for (const quality of [78, 70, 62, 54, 46]) {
    const out = await img.clone().resize(size, size, { fit: 'inside', withoutEnlargement: true }).webp({ quality }).toBuffer();
    if (out.length <= budget) return out;
  }
  throw new Error(`cannot fit ${size}px under ${budget} bytes`);
}

const surname = (artist: string) => (artist === 'Anonymous' ? '' : artist.split(' ').at(-1)!);
type Info = Awaited<ReturnType<typeof fileInfo>>;

/** Whether a file's licence is allowed for this painting (spec §3.4). */
function allowed(p: PaintingEntry, info: Info): 'pd' | 'attributed' | null {
  if (isPublicDomain(info.license)) return 'pd';
  if (p.inSitu && isAttribution(info.license) && info.artist) return 'attributed';
  return null;
}

/**
 * Candidate files, best first: the reviewed `commonsFile`; the lead image of the named article;
 * of the top article search hit; then Commons search hits. Every pick is checked by eye on the
 * contact sheet, since a public-domain image of the wrong subject would pass the licence gate.
 */
async function* candidates(p: PaintingEntry): AsyncGenerator<{ file: string; via: string }> {
  if (p.commonsFile) {
    yield { file: p.commonsFile, via: 'commonsFile' };
    return;
  }
  const lead = async (article: string | null) => (article ? leadImage(article).catch(() => null) : null);
  const named = await lead(p.wikipedia);
  if (named) yield { file: named, via: `article ${p.wikipedia}` };
  const hit = await searchArticle(`"${p.title}" ${surname(p.artist)} painting`);
  const searched = hit && hit.replace(/ /g, '_') !== p.wikipedia ? await lead(hit) : null;
  if (searched && searched !== named) yield { file: searched, via: `search ${hit}` };
  for (const file of await searchFiles(`${p.title} ${surname(p.artist)}`)) yield { file, via: 'commons search' };
}

async function fetchOne(p: PaintingEntry): Promise<PaintingSource & { via: string }> {
  const refused: string[] = [];
  let pick: { file: string; via: string; info: Info; kind: 'pd' | 'attributed' } | null = null;
  for await (const c of candidates(p)) {
    const info = await fileInfo(c.file, 1800).catch(() => null);
    const kind = info && allowed(p, info);
    if (info && kind) {
      pick = { ...c, info, kind };
      break;
    }
    refused.push(`${c.file} (${info?.license.LicenseShortName ?? 'not found'})`);
  }
  if (!pick) throw new Error(`no allowed image; refused: ${refused.join('; ') || 'nothing found'}`);
  const { file, info, via } = pick;
  const attributed = pick.kind === 'attributed';
  const res = await fetch(info.thumb, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const input = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(OUT, `${p.key}.webp`), await encode(input, p.crop, LARGE, BUDGET.large));
  fs.writeFileSync(path.join(OUT, `${p.key}-thumb.webp`), await encode(input, p.crop, THUMB, BUDGET.thumb));
  return {
    file,
    page: info.page,
    license: info.license.LicenseShortName ?? info.license.License ?? '',
    ...(attributed ? { author: info.artist } : {}),
    via,
  };
}

function contactSheet(sources: Record<string, PaintingSource>): string {
  const cells = [...PAINTINGS]
    .sort((a, b) => a.fame - b.fame)
    .map((p) => {
      const src = path.join(OUT, `${p.key}-thumb.webp`).replace(/\\/g, '/');
      return `<figure><img src="file:///${src}" alt=""><figcaption>${p.fame}. ${p.title}<br><small>${p.artist}${sources[p.key] ? '' : ' — MISSING'}</small></figcaption></figure>`;
    });
  return `<!doctype html><meta charset="utf-8"><style>body{font:12px sans-serif;display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}img{max-width:160px;max-height:160px}figure{margin:0}</style>${cells.join('')}`;
}

async function main() {
  const only = process.argv.slice(2);
  fs.mkdirSync(OUT, { recursive: true });
  const sourcesPath = path.join(OUT, 'sources.json');
  const sources: Record<string, PaintingSource> = fs.existsSync(sourcesPath) ? JSON.parse(fs.readFileSync(sourcesPath, 'utf8')) : {};
  const failures: string[] = [];
  for (const p of PAINTINGS) {
    if (only.length && !only.includes(p.key)) continue;
    try {
      const { via, ...source } = await fetchOne(p);
      sources[p.key] = source;
      console.log(`ok   ${p.key.padEnd(34)} ${source.file} (${source.license}) via ${via}`);
    } catch (err) {
      failures.push(`${p.key}: ${(err as Error).message}`);
      console.log(`FAIL ${p.key.padEnd(34)} ${(err as Error).message}`);
    }
  }
  const ordered = [...PAINTINGS].sort((a, b) => a.fame - b.fame).filter((p) => sources[p.key]);
  fs.writeFileSync(sourcesPath, JSON.stringify(Object.fromEntries(ordered.map((p) => [p.key, sources[p.key]])), null, 2) + '\n');
  fs.writeFileSync(
    path.join(OUT, 'CREDITS.md'),
    '# Painting image credits\n\nPaintings are public domain. Photographs of works in place are used under the licence shown, with credit. Images are resized, and a few show a detail.\n\n' +
      ordered
        .map((p) => {
          const s = sources[p.key];
          return `- *${p.title}*, ${p.artist}: [${s.file}](${s.page}), ${s.license}${s.author ? `, photo by ${s.author}` : ''}`;
        })
        .join('\n') +
      '\n',
  );
  const sheet = path.join(os.tmpdir(), 'paintings-contact-sheet.html');
  fs.writeFileSync(sheet, contactSheet(sources));
  console.log(`\nContact sheet: ${sheet}`);
  if (failures.length) {
    console.error(`\n${failures.length} painting(s) failed; fix the article or add a reviewed commonsFile:\n${failures.join('\n')}`);
    process.exit(1);
  }
}

void main();
