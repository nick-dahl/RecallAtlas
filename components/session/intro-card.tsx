'use client';

import { buttonClass } from '@/components/ui/button';
import { Flag } from '@/components/ui/flag';
import { Kbd } from '@/components/ui/kbd';
import type { RendererProps } from './types';
import { useHotkeys } from './use-hotkeys';

/** Meet a new flag (ungraded). */
export function IntroCard({ view, locked, onAnswer }: RendererProps) {
  useHotkeys({ Enter: () => !locked && onAnswer({ kind: 'ack' }) }, !locked);
  return (
    <div className="mx-auto w-full max-w-sm space-y-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[.2em] text-accent">New flag</p>
      <Flag src={view.prompt.flag!} alt={view.prompt.name} eager />
      <h2 className="font-display text-4xl tracking-tight">{view.prompt.name}</h2>
      <button type="button" disabled={locked} onClick={() => onAnswer({ kind: 'ack' })} className={buttonClass('primary')}>
        Got it <Kbd>↵</Kbd>
      </button>
    </div>
  );
}
