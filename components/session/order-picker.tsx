'use client';

import { useEffect, useRef, useState } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { ordinal } from '@/lib/ui/president-facts';
import { isComplete, pick, positionOf, startOrder, undo } from './order-state';
import type { RendererProps } from './types';
import { useHotkeys } from './use-hotkeys';

/**
 * Put in order: tap (or press 1–4) the presidents earliest first; Backspace undoes. Submits once,
 * when the last card is placed. Feedback shows each card's right position.
 */
export function OrderPicker({ view, locked, feedback, onAnswer }: RendererProps) {
  const choices = view.choices ?? [];
  const [state, setState] = useState(() => startOrder(choices.length));
  const submitted = useRef(false);

  useEffect(() => {
    if (!isComplete(state) || submitted.current) return;
    submitted.current = true;
    onAnswer({ kind: 'order', choiceIds: state.picks });
  }, [state, onAnswer]);

  const place = (id: string) => {
    if (!locked) setState((s) => pick(s, id));
  };
  useHotkeys(
    {
      ...Object.fromEntries(choices.map((c, i) => [String(i + 1), () => place(c.id)])),
      Backspace: () => !locked && setState(undo),
    },
    !locked,
  );

  const rightPosition = (label: string | undefined) => (label ? (feedback?.order?.indexOf(label) ?? -1) + 1 : 0);
  return (
    <div className="space-y-8">
      <div className="space-y-1 text-center">
        <h2 className="font-display text-3xl tracking-tight md:text-4xl">{view.prompt.question}</h2>
        <p className="text-sm text-ink-soft">Tap them earliest first. Backspace undoes.</p>
      </div>
      <ol className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
        {choices.map((c, i) => {
          const placed = positionOf(state, c.id);
          const right = rightPosition(c.label);
          const tone = !feedback
            ? placed
              ? 'bg-accent/10 ring-2 ring-accent'
              : 'bg-raised ring-1 ring-rule motion-safe:hover:-translate-y-0.5 hover:ring-ink-soft'
            : placed === right
              ? 'bg-good-soft ring-2 ring-good'
              : 'bg-bad-soft ring-2 ring-bad';
          return (
            <li key={c.id}>
              <button
                type="button"
                data-choice-id={c.id}
                disabled={locked || placed !== null}
                onClick={() => place(c.id)}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left font-medium transition duration-150 disabled:cursor-default ${tone}`}
              >
                <Kbd>{i + 1}</Kbd>
                <span className="flex-1">{c.label}</span>
                {placed !== null && (
                  <span className="rounded-full bg-ink px-2 py-0.5 font-mono text-xs text-paper">{ordinal(placed)}</span>
                )}
                {feedback && placed !== right && right > 0 && (
                  <span className="font-mono text-xs text-bad">should be {ordinal(right)}</span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
