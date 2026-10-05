'use client';

import { MapFrame } from '@/components/map/map-frame';
import { buttonClass } from '@/components/ui/button';
import { Flag } from '@/components/ui/flag';
import { Kbd } from '@/components/ui/kbd';
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
