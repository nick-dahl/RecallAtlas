'use client';

import { choiceState } from './choice-state';
import { ImageChoice } from './image-choice';
import { Prompt } from './prompt';
import type { RendererProps } from './types';
import { useHotkeys } from './use-hotkeys';

/** Name → Flag and Name → Portrait: pick the picture from a grid of 4–8 (keys 1–8). */
export function ImageGrid({ view, locked, feedback, chosenId, onAnswer }: RendererProps) {
  const choices = view.choices ?? [];
  const portraits = choices.some((c) => c.portrait);
  const pick = (i: number) => {
    const c = choices[i];
    if (c && !locked) onAnswer({ kind: 'choice', choiceId: c.id }, c.id);
  };
  useHotkeys(Object.fromEntries(choices.map((_, i) => [String(i + 1), () => pick(i)])), !locked);

  return (
    <div className="space-y-10">
      <Prompt view={view} feedback={feedback} />
      <ol
        className={`mx-auto grid gap-6 ${portraits ? 'max-w-2xl grid-cols-2 sm:grid-cols-4' : 'max-w-3xl grid-cols-2 sm:grid-cols-4'}`}
      >
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
    </div>
  );
}
