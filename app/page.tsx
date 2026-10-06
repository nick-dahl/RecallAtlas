import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { buttonClass } from '@/components/ui/button';
import { MapFrame } from '@/components/map/map-frame';
import { Flag } from '@/components/ui/flag';
import { loadFrame } from '@/lib/map/load';
import { getUserId } from '@/lib/supabase/server';

/** The hero's map plate: South America with Bolivia hatched (a reference view, not a question). */
const SHOWCASE_FRAME = 'south-america';
const SHOWCASE_COUNTRY = 'BO';
/** Flag stamps overlapping the plate; the grayscale one hints at the album filling in. */
const SHOWCASE_FLAGS = ['PE', 'BO', 'NP'];

export default async function Home({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  // If Supabase falls back to the Site URL (e.g. a redirect URL that isn't allow-listed),
  // the PKCE code lands here. Hand it to the callback instead of stranding the user.
  const { code } = await searchParams;
  if (code) redirect(`/auth/callback?code=${encodeURIComponent(code)}&next=%2Fdashboard`);
  if (await getUserId()) redirect('/dashboard');
  const frame = loadFrame(SHOWCASE_FRAME);
  return (
    <>
      <SiteHeader signedIn={false} />
      <main className="relative z-10 mx-auto grid max-w-5xl gap-14 px-6 pb-24 pt-8 md:grid-cols-[1.1fr_.9fr] md:items-center md:pt-16">
        <div className="animate-rise space-y-6">
          <p className="font-mono text-xs uppercase tracking-[.2em] text-ink-soft">Flags · maps · capitals · presidents</p>
          <h1 className="font-display text-5xl leading-[1.02] tracking-tight md:text-6xl">
            Learn the world.
            <br />
            <span className="text-accent">Keep</span> it.
          </h1>
          <p className="max-w-md text-lg text-ink-soft">
            Every flag, every country on the map, and its capital. Recall Atlas spends your time on what you mix
            up (Chad or Romania? Peru or Bolivia?) and quietly retires what you already know.
          </p>
          <Link href="/login" className={buttonClass('primary', 'px-7 py-3 text-base')}>
            Start learning
          </Link>
        </div>
        <div className="relative mx-auto w-full max-w-sm pb-10 pl-10" aria-hidden>
          <div className="animate-rise rotate-2" style={{ animationDelay: '120ms' }}>
            <MapFrame
              map={{ baseUrl: `/maps/${SHOWCASE_FRAME}.svg`, width: frame.width, height: frame.height }}
              maxHeight="58vh"
              highlight={frame.countries[SHOWCASE_COUNTRY].outline}
            />
          </div>
          <div className="absolute bottom-0 left-0 flex -rotate-6 gap-3">
            {SHOWCASE_FLAGS.map((key, i) => (
              <div
                key={key}
                className="animate-rise w-20 md:w-24"
                style={{ animationDelay: `${300 + i * 80}ms`, filter: i === 2 ? 'grayscale(1)' : undefined }}
              >
                <Flag src={`/api/flag-art/${key}`} eager />
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
