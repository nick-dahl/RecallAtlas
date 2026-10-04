'use client';

import { Flag } from '@/components/ui/flag';
import { Kbd } from '@/components/ui/kbd';
import type { ChoiceState } from './choice-state';

const STATE: Record<ChoiceState, string> = {
  idle: 'motion-safe:hover:-translate-y-1',
  correct: 'ring-4 ring-good ring-offset-4 ring-offset-paper animate-pop',
  wrong: 'ring-4 ring-bad ring-offset-4 ring-offset-paper animate-shake',
  dim: 'opacity-35',
};

export function FlagChoice({
  id,
  flag,
  index,
  state,
  disabled,
  onPick,
}: {
  id: string;
  flag: string;
  index: number;
  state: ChoiceState;
  disabled: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      data-choice-id={id}
      aria-label={`Option ${index + 1}`}
      disabled={disabled}
      onClick={onPick}
      className={`relative block w-full rounded-md transition duration-150 ${STATE[state]}`}
    >
      <Flag src={flag} eager />
      <span className="absolute -left-2 -top-2">
        <Kbd>{index + 1}</Kbd>
      </span>
    </button>
  );
}
