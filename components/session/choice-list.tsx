'use client';

import { Kbd } from '@/components/ui/kbd';
import { choiceState, type ChoiceState } from './choice-state';
import { Prompt } from './prompt';
import type { RendererProps } from './types';
import { useHotkeys } from './use-hotkeys';

const STATE: Record<ChoiceState, string> = {
  idle: 'bg-raised ring-1 ring-rule motion-safe:hover:-translate-y-0.5 hover:ring-ink-soft',
  correct: 'bg-good-soft ring-2 ring-good animate-pop',
  wrong: 'bg-bad-soft ring-2 ring-bad animate-shake',
  dim: 'bg-raised ring-1 ring-rule opacity-40',
};

/** Flag → Name multiple choice (text options). */
export function ChoiceList({ view, locked, feedback, chosenId, onAnswer }: RendererProps) {
  const choices = view.choices ?? [];
  const pick = (i: number) => {
    const c = choices[i];
    if (c && !locked) onAnswer({ kind: 'choice', choiceId: c.id }, c.id);
  };
  useHotkeys(Object.fromEntries(choices.map((_, i) => [String(i + 1), () => pick(i)])), !locked);

  return (
    <div className="space-y-8">
      <Prompt view={view} />
      <ol className="mx-auto grid max-w-2xl gap-3 sm:grid-cols-2">
        {choices.map((c, i) => (
          <li key={c.id}>
            <button
              type="button"
              data-choice-id={c.id}
              disabled={locked}
              onClick={() => pick(i)}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left font-medium transition duration-150 ${STATE[choiceState(c, feedback, chosenId)]}`}
            >
              <Kbd>{i + 1}</Kbd>
              <span>{c.label}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
