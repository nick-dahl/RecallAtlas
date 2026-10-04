import type { FeedbackView, QuestionView } from '@/lib/study/types';

export type ChoiceState = 'idle' | 'correct' | 'wrong' | 'dim';
type Choice = NonNullable<QuestionView['choices']>[number];

/** After feedback: the right answer (matched by name or flag art, since choices carry no keys), the learner's miss, the rest. */
export function choiceState(choice: Choice, feedback: FeedbackView | null, chosenId: string | null): ChoiceState {
  if (!feedback) return 'idle';
  const isAnswer = choice.label !== undefined ? choice.label === feedback.answer.name : choice.flag === feedback.answer.flag;
  if (isAnswer) return 'correct';
  return choice.id === chosenId ? 'wrong' : 'dim';
}
