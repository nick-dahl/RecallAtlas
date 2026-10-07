'use client';

import { useState } from 'react';
import { candidateState } from '@/components/map/geometry';
import { MapFrame } from '@/components/map/map-frame';
import { buttonClass } from '@/components/ui/button';
import { ItemImage } from '@/components/ui/item-image';
import { Kbd } from '@/components/ui/kbd';
import { CHOICE_STATE } from './choice-list';
import { choiceState } from './choice-state';
import { ImageChoice } from './image-choice';
import type { RendererProps } from './types';
import { useHotkeys } from './use-hotkeys';

/**
 * Two steps: study the labelled pair, then pick one with the labels hidden. On a map course the
 * pair is two outlines on one map (labelled, then numbered); without a shared map it uses flags.
 * A capitals pair shows each country's capital, and the quiz asks for the capital by name.
 */
export function ContrastDrill({ view, locked, feedback, chosenId, onAnswer }: RendererProps) {
  const [step, setStep] = useState<'study' | 'quiz'>('study');
  const choices = view.choices ?? [];
  const pick = (i: number) => {
    const c = choices[i];
    if (c && !locked) onAnswer({ kind: 'choice', choiceId: c.id }, c.id);
  };
  useHotkeys(step === 'study' ? { Enter: () => setStep('quiz') } : { '1': () => pick(0), '2': () => pick(1) }, !locked);

  const map = view.map;
  const byCapital = (view.pair ?? []).some((p) => p.capital);
  const labelOf = (id: string) => choices.find((c) => c.id === id)?.label ?? '';
  const mapCandidates = (study: boolean) =>
    (map?.candidates ?? []).map((c) => ({
      ...c,
      badge: study ? labelOf(c.id) : String(choices.findIndex((ch) => ch.id === c.id) + 1),
      state: study ? ('idle' as const) : candidateState(c.d, c.id, feedback, chosenId),
    }));

  if (step === 'study') {
    return (
      <div className="mx-auto max-w-3xl space-y-8 text-center">
        <p className="font-mono text-xs uppercase tracking-[.2em] text-accent">Easy to mix up</p>
        {map ? (
          <MapFrame map={map} maxHeight="56vh" candidates={mapCandidates(true)} disabled />
        ) : (
          <div className="mx-auto grid max-w-xl grid-cols-2 gap-8">
            {(view.pair ?? []).map((p) => (
              <figure key={p.name} className="space-y-3">
                <ItemImage item={p} labelled eager />
                <figcaption>
                  <span className="block font-display text-2xl">{p.name}</span>
                  {p.capital && <span className="block text-ink-soft">Capital: {p.capital}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
        <button type="button" onClick={() => setStep('quiz')} className={buttonClass('primary')}>
          Got it <Kbd>↵</Kbd>
        </button>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="text-center">
        <p className="text-sm text-ink-soft">{byCapital ? "What's the capital of" : 'Which one is'}</p>
        <h2 className="font-display text-4xl tracking-tight">{view.prompt.name}?</h2>
      </div>
      {byCapital ? (
        <ol className="mx-auto grid max-w-xl grid-cols-2 gap-3">
          {choices.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                data-choice-id={c.id}
                disabled={locked}
                onClick={() => pick(i)}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left font-medium transition duration-150 ${CHOICE_STATE[choiceState(c, feedback, chosenId)]}`}
              >
                <Kbd>{i + 1}</Kbd>
                <span>{c.label}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : map ? (
        <MapFrame
          map={map}
          maxHeight="56vh"
          candidates={mapCandidates(false)}
          disabled={locked}
          onCandidate={(id) => pick(choices.findIndex((c) => c.id === id))}
        />
      ) : (
        <ol className="mx-auto grid max-w-xl grid-cols-2 gap-8">
          {choices.map((c, i) => (
            <li key={c.id}>
              <ImageChoice
                id={c.id}
                image={{ flag: c.flag, portrait: c.portrait }}
                index={i}
                state={choiceState(c, feedback, chosenId)}
                disabled={locked}
                onPick={() => pick(i)}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
