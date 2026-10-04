'use client';

import { choiceState } from './choice-state';
import { FlagChoice } from './flag-choice';
import { Prompt } from './prompt';
import type { RendererProps } from './types';
import { useHotkeys } from './use-hotkeys';

/** Name → Flag: pick the flag from a grid of 4–8. */
export function FlagGrid({ view, locked, feedback, chosenId, onAnswer }: RendererProps) {
  const choices = view.choices ?? [];
  const pick = (i: number) => {
    const c = choices[i];
    if (c && !locked) onAnswer({ kind: 'choice', choiceId: c.id }, c.id);
  };
  useHotkeys(Object.fromEntries(choices.map((_, i) => [String(i + 1), () => pick(i)])), !locked);

  return (
    <div className="space-y-10">
      <Prompt view={view} />
      <ol className="mx-auto grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
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
