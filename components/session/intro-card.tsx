'use client';

import { MapFrame } from '@/components/map/map-frame';
import { buttonClass } from '@/components/ui/button';
import { Flag } from '@/components/ui/flag';
import { Kbd } from '@/components/ui/kbd';
import { Portrait } from '@/components/ui/portrait';
import { presidentFacts } from '@/lib/ui/president-facts';
import type { RendererProps } from './types';
import { useHotkeys } from './use-hotkeys';

/** Meet a new flag, or a new country on its region map (ungraded). */
export function IntroCard({ view, locked, onAnswer }: RendererProps) {
  useHotkeys({ Enter: () => !locked && onAnswer({ kind: 'ack' }) }, !locked);
  const { prompt } = view;
  const gotIt = (
    <button type="button" disabled={locked} onClick={() => onAnswer({ kind: 'ack' })} className={buttonClass('primary')}>
      Got it <Kbd>↵</Kbd>
    </button>
  );

  if (prompt.portrait && prompt.numbers && prompt.startYears && prompt.party) {
    const facts = presidentFacts({ numbers: prompt.numbers, startYears: prompt.startYears, party: prompt.party });
    return (
      <div className="mx-auto grid w-full max-w-2xl items-center gap-8 sm:grid-cols-[13rem_minmax(0,1fr)]">
        <div className="mx-auto w-44 sm:w-full">
          <Portrait src={prompt.portrait} alt={prompt.name} eager />
        </div>
        <div className="space-y-4 text-center sm:text-left">
          <p className="font-mono text-xs uppercase tracking-[.2em] text-accent">New president</p>
          <h2 className="font-display text-4xl tracking-tight">{prompt.name}</h2>
          <dl className="mx-auto grid w-fit grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-left text-sm sm:mx-0">
            <dt className="text-ink-soft">President</dt>
            <dd className="font-semibold">{facts.numbers}</dd>
            <dt className="text-ink-soft">Took office</dt>
            <dd className="font-semibold">{facts.years}</dd>
            <dt className="text-ink-soft">Party</dt>
            <dd className="font-semibold">{facts.party}</dd>
          </dl>
          {gotIt}
        </div>
      </div>
    );
  }

  if (view.map) {
    return (
      <div className="mx-auto grid w-full items-center gap-8 md:grid-cols-[minmax(0,1fr)_15rem]">
        <MapFrame map={view.map} maxHeight="60vh" highlight={view.map.highlight} />
        <div className="space-y-4 text-center md:text-left">
          <p className="font-mono text-xs uppercase tracking-[.2em] text-accent">New country</p>
          <div className="mx-auto w-20 md:mx-0">
            <Flag src={prompt.flag!} alt={`Flag of ${prompt.name}`} eager />
          </div>
          <h2 className="font-display text-4xl tracking-tight">{prompt.name}</h2>
          {prompt.capital && (
            <p>
              <span className="text-ink-soft">Capital</span> <span className="font-semibold">{prompt.capital}</span>
            </p>
          )}
          {prompt.capitalNote && <p className="text-sm text-ink-soft">{prompt.capitalNote}</p>}
          {gotIt}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm space-y-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[.2em] text-accent">New flag</p>
      <Flag src={prompt.flag!} alt={prompt.name} eager />
      <h2 className="font-display text-4xl tracking-tight">{prompt.name}</h2>
      {gotIt}
    </div>
  );
}
