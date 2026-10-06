import type { FeedbackView, QuestionView } from '@/lib/study/types';

export type ChoiceState = 'idle' | 'correct' | 'wrong' | 'dim';
type Choice = NonNullable<QuestionView['choices']>[number];

/**
 * After feedback: the right answer (matched by label, portrait or flag art, since choices carry
 * no keys), the learner's miss, the rest.
 */
export function choiceState(choice: Choice, feedback: FeedbackView | null, chosenId: string | null): ChoiceState {
  if (!feedback) return 'idle';
  const { name, capital, flag, portrait, party, startYears } = feedback.answer;
  let isAnswer: boolean;
  if (choice.label !== undefined) {
    // Labels are names, capitals, start years or parties, depending on the question.
    const { label } = choice;
    isAnswer = label === name || label === capital || label === party || (startYears?.includes(Number(label)) ?? false);
  } else if (choice.portrait !== undefined) {
    isAnswer = choice.portrait === portrait;
  } else {
    isAnswer = choice.flag !== undefined && choice.flag === flag;
  }
  if (isAnswer) return 'correct';
  return choice.id === chosenId ? 'wrong' : 'dim';
}
