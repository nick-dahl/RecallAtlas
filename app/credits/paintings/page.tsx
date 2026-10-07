import type { Metadata } from 'next';
import sources from '@/content/paintings/sources.json';
import { SiteHeader } from '@/components/site-header';
import { GREAT_PAINTINGS, paintingRecord } from '@/lib/content/great-paintings';
import type { PaintingSource } from '@/lib/content/types';

export const metadata: Metadata = { title: 'Painting image credits' };

const SOURCES = sources as Record<string, PaintingSource>;

/** Public credits for every painting image (attribution licences require it). Needs no sign-in. */
export default function PaintingCreditsPage() {
  const records = GREAT_PAINTINGS.items.map((i) => paintingRecord(i.key)).sort((a, b) => a.fame - b.fame);
  return (
    <>
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-3xl space-y-6 px-6 pb-24">
        <h1 className="font-display text-4xl tracking-tight">Painting image credits</h1>
        <p className="text-ink-soft">
          Paintings are public domain. Photographs of works in place are used under the licence shown, with credit.
          Images are resized, and a few show a detail.
        </p>
        <ol className="space-y-2 text-sm">
          {records.map((r) => {
            const s = SOURCES[r.key];
            return (
              <li key={r.key}>
                <span className="italic">{r.title}</span>, {r.artist}:{' '}
                {s ? (
                  <>
                    <a href={s.page} className="break-all underline" rel="noopener noreferrer">
                      {s.file}
                    </a>
                    , {s.license}
                    {s.author ? `, photo by ${s.author}` : ''}
                  </>
                ) : (
                  'source not recorded'
                )}
              </li>
            );
          })}
        </ol>
      </main>
    </>
  );
}
