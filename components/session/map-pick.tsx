'use client';

import { candidateState } from '@/components/map/geometry';
import { MapFrame } from '@/components/map/map-frame';
import { Kbd } from '@/components/ui/kbd';
import type { RendererProps } from './types';
import { useHotkeys } from './use-hotkeys';

/** Find it, rungs 1–2: pick the right one of 4–6 outlined countries. */
export function MapPick({ view, locked, feedback, chosenId, onAnswer }: RendererProps) {
  const candidates = view.map?.candidates ?? [];
  const pick = (id: string) => {
    if (!locked) onAnswer({ kind: 'choice', choiceId: id }, id);
  };
  useHotkeys(Object.fromEntries(candidates.map((c, i) => [String(i + 1), () => pick(c.id)])), !locked);

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <p className="text-sm text-ink-soft">Which one is</p>
        <h2 className="font-display text-4xl tracking-tight md:text-5xl">{view.prompt.name}?</h2>
      </div>
      <MapFrame
        map={view.map!}
        candidates={candidates.map((c, i) => ({
          ...c,
          badge: String(i + 1),
          state: candidateState(c.d, c.id, feedback, chosenId),
        }))}
        disabled={locked}
        onCandidate={pick}
      />
      <p className="flex items-center justify-center gap-1.5 text-xs text-ink-soft">
        Click a shape or press <Kbd>1</Kbd>–<Kbd>{candidates.length}</Kbd>
      </p>
    </div>
  );
}
