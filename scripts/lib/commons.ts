/** Wikipedia / Wikimedia Commons lookups shared by the one-off image fetch scripts. */
import type { LicenseMeta } from './portrait-license';

export const USER_AGENT = 'RecallAtlas content build (nicholasryandahl@gmail.com)';

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A MediaWiki API call, paced and retried with backoff when rate-limited (429). */
async function api(host: string, params: Record<string, string>) {
  const url = `https://${host}/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  for (let attempt = 0; ; attempt++) {
    await pause(250);
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (res.ok) return res.json();
    if (res.status !== 429 || attempt === 5) throw new Error(`${host} ${res.status}`);
    await pause(2000 * 2 ** attempt);
  }
}

/** The top English Wikipedia search hit for `query`, or null. */
export async function searchArticle(query: string): Promise<string | null> {
  const data = await api('en.wikipedia.org', { action: 'query', list: 'search', srsearch: query, srlimit: '1' });
  return data.query.search[0]?.title ?? null;
}

/** Commons file names (no "File:" prefix) matching `query`, best first. */
export async function searchFiles(query: string, limit = 5): Promise<string[]> {
  const data = await api('commons.wikimedia.org', { action: 'query', list: 'search', srsearch: `${query} filetype:bitmap`, srnamespace: '6', srlimit: String(limit) });
  return data.query.search.map((r: { title: string }) => r.title.replace(/^File:/, ''));
}

const strip = (html?: string) => (html ?? '').replace(/<[^>]+>/g, '').trim();

/** The file name of an English Wikipedia article's lead image. */
export async function leadImage(article: string): Promise<string> {
  const data = await api('en.wikipedia.org', { action: 'query', prop: 'pageimages', piprop: 'name', titles: article, redirects: '1' });
  const name = data.query.pages[0]?.pageimage;
  if (!name) throw new Error(`no lead image on ${article}`);
  return name;
}

/** A Commons file's scaled URL (`width` px wide), page, licence and author. */
export async function fileInfo(file: string, width = 900) {
  const data = await api('commons.wikimedia.org', {
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: String(width),
    titles: `File:${file}`,
  });
  const info = data.query.pages[0]?.imageinfo?.[0];
  if (!info) throw new Error(`File:${file} not found on Commons`);
  const meta = info.extmetadata ?? {};
  const license: LicenseMeta = { LicenseShortName: meta.LicenseShortName?.value, License: meta.License?.value };
  return { thumb: info.thumburl as string, page: info.descriptionurl as string, license, artist: strip(meta.Artist?.value) };
}
