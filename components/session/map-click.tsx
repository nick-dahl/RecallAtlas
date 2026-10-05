'use client';

import { useState } from 'react';
import { MapFrame } from '@/components/map/map-frame';
import { Kbd } from '@/components/ui/kbd';
import type { RendererProps } from './types';
import { useHotkeys } from './use-hotkeys';

/** Find it at recall: click the country on the continent map. Esc = "I don't know". */
export function MapClick({ view, locked, feedback, onAnswer }: RendererProps) {
  const [mark, setMark] = useState<{ x: number; y: number } | null>(null);
  useHotkeys({ Escape: () => !locked && onAnswer({ kind: 'dont-know' }) }, !locked);

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <p className="text-sm text-ink-soft">Click on</p>
        <h2 className="font-display text-4xl tracking-tight md:text-5xl">{view.prompt.name}</h2>
      </div>
      <MapFrame
        map={view.map!}
        mark={mark ?? undefined}
        correct={feedback?.map?.correct}
        given={feedback?.map?.given}
        disabled={locked}
        autoFocus
        onPoint={(point) => {
          setMark({ x: point.x, y: point.y });
          onAnswer({ kind: 'point', ...point });
        }}
      />
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-soft">
        <span className="flex items-center gap-1.5">
          Click, or move with <Kbd>←</Kbd>
          <Kbd>→</Kbd>
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> and press <Kbd>↵</Kbd>
        </span>
        <button
          type="button"
          disabled={locked}
          onClick={() => onAnswer({ kind: 'dont-know' })}
          className="flex items-center gap-2 hover:text-ink disabled:opacity-50"
        >
          I don’t know <Kbd>Esc</Kbd>
        </button>
      </div>
    </div>
  );
}
