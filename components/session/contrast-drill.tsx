'use client';

import { useState } from 'react';
import { buttonClass } from '@/components/ui/button';
import { Flag } from '@/components/ui/flag';
import { Kbd } from '@/components/ui/kbd';
import { choiceState } from './choice-state';
import { FlagChoice } from './flag-choice';
import type { RendererProps } from './types';
import { useHotkeys } from './use-hotkeys';

/** Two steps: study the labelled pair, then pick one with the labels hidden. */
export function ContrastDrill({ view, locked, feedback, chosenId, onAnswer }: RendererProps) {
  const [step, setStep] = useState<'study' | 'quiz'>('study');
  const choices = view.choices ?? [];
  const pick = (i: number) => {
    const c = choices[i];
    if (c && !locked) onAnswer({ kind: 'choice', choiceId: c.id }, c.id);
  };
  useHotkeys(step === 'study' ? { Enter: () => setStep('quiz') } : { '1': () => pick(0), '2': () => pick(1) }, !locked);

  if (step === 'study') {
    return (
      <div className="mx-auto max-w-xl space-y-8 text-center">
        <p className="font-mono text-xs uppercase tracking-[.2em] text-accent">Easy to mix up</p>
        <div className="grid grid-cols-2 gap-8">
          {(view.pair ?? []).map((p) => (
            <figure key={p.name} className="space-y-3">
              <Flag src={p.flag} alt={p.name} eager />
              <figcaption className="font-display text-2xl">{p.name}</figcaption>
            </figure>
          ))}
        </div>
        <button type="button" onClick={() => setStep('quiz')} className={buttonClass('primary')}>
          Got it <Kbd>↵</Kbd>
        </button>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div className="text-center">
        <p className="text-sm text-ink-soft">Which one is</p>
        <h2 className="font-display text-4xl tracking-tight">{view.prompt.name}?</h2>
      </div>
      <ol className="grid grid-cols-2 gap-8">
        {choices.map((c, i) => (
          <li key={c.id}>
            <FlagChoice
              id={c.id}
              flag={c.flag!}
              index={i}
              state={choiceState(c, feedback, chosenId)}
              disabled={locked}
              onPick={() => pick(i)}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
