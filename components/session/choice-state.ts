import type { FeedbackView, QuestionView } from '@/lib/study/types';

export type ChoiceState = 'idle' | 'correct' | 'wrong' | 'dim';
type Choice = NonNullable<QuestionView['choices']>[number];

/**
 * After feedback: the right answer, the learner's miss, the rest. The server names the right
 * option by id (`answerChoiceId`); matching by label, portrait or flag art is only the fallback
 * for feedback without it, and knows nothing of newer kinds of option (paintings, artists).
 */
export function choiceState(choice: Choice, feedback: FeedbackView | null, chosenId: string | null): ChoiceState {
  if (!feedback) return 'idle';
  if (feedback.answerChoiceId !== undefined) {
    if (choice.id === feedback.answerChoiceId) return 'correct';
    return choice.id === chosenId ? 'wrong' : 'dim';
  }
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
