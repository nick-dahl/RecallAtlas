import {
  buildQuestion,
  getItem,
  gradeChoice,
  gradeTyped,
  type AnswerGrade,
  type Confusion,
  type CourseDef,
  type QuestionRung,
  type QueueEntry,
  type Rng,
} from '@/lib/engine';
import { ServiceError, type AnswerResponse, type PendingQuestion } from './types';

export function issueQuestion(args: {
  entry: QueueEntry;
  rung: QuestionRung;
  course: CourseDef;
  confusions: readonly Confusion[];
  rng: Rng;
  now: Date;
  newId: () => string;
}): PendingQuestion {
  const { entry, rung, course, confusions, rng, now, newId } = args;
  const question = buildQuestion({ entry, rung, course, confusions, rng });
  return {
    questionId: newId(),
    entry,
    rung,
    format: question.format,
    choices: (question.choiceKeys ?? []).map((itemKey) => ({ id: newId(), itemKey })),
    issuedAt: now.toISOString(),
  };
}

/** The single grading entry point: validates the response against what was actually issued. */
export function gradeSubmission(pending: PendingQuestion, response: AnswerResponse, course: CourseDef): AnswerGrade {
  const target = pending.entry.itemKey;
  switch (response.kind) {
    case 'dont-know':
      return { correct: false, typo: false, answeredItemKey: null };
    case 'typed':
      if (pending.format !== 'typed') throw new ServiceError('invalid_response');
      return gradeTyped(response.text, getItem(course, target), course.items);
    case 'choice': {
      const choice = pending.choices.find((c) => c.id === response.choiceId);
      if (!choice) throw new ServiceError('invalid_response');
      return gradeChoice(choice.itemKey, target);
    }
    default:
      throw new ServiceError('invalid_response');
  }
}
