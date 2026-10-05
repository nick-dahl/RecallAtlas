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
import { gradeClick } from '@/lib/map/hit-test';
import { shownIn, type MapSupport } from '@/lib/map/support';
import { ServiceError, type AnswerResponse, type PendingQuestion } from './types';

export function issueQuestion(args: {
  entry: QueueEntry;
  rung: QuestionRung;
  course: CourseDef;
  confusions: readonly Confusion[];
  rng: Rng;
  now: Date;
  newId: () => string;
  maps?: MapSupport;
}): PendingQuestion {
  const { entry, rung, course, confusions, rng, now, newId, maps } = args;
  const frame = maps?.frameFor(entry, rung);
  // Map candidates must be drawn on the map the learner sees.
  const eligible = frame ? shownIn(maps!.load(frame)) : undefined;
  const question = buildQuestion({ entry, rung, course, confusions, rng, eligible });
  return {
    questionId: newId(),
    entry,
    rung,
    format: question.format,
    choices: (question.choiceKeys ?? []).map((itemKey) => ({ id: newId(), itemKey })),
    issuedAt: now.toISOString(),
    ...(frame ? { frame } : {}),
  };
}

/** The single grading entry point: validates the response against what was actually issued. */
export function gradeSubmission(
  pending: PendingQuestion,
  response: AnswerResponse,
  course: CourseDef,
  maps?: MapSupport,
): AnswerGrade {
  const { entry } = pending;
  const target = entry.itemKey;
  switch (response.kind) {
    case 'dont-know':
      return { correct: false, typo: false, answeredItemKey: null };
    case 'typed': {
      if (pending.format !== 'typed' || entry.kind !== 'prompt') throw new ServiceError('invalid_response');
      const field = course.promptTypes.find((p) => p.id === entry.promptType)?.answerField ?? 'name';
      return gradeTyped(response.text, getItem(course, target), course.items, field);
    }
    case 'point':
      if (pending.format !== 'map-click' || !pending.frame || !maps) throw new ServiceError('invalid_response');
      return gradeClick(target, maps.load(pending.frame), response);
    case 'choice': {
      const choice = pending.choices.find((c) => c.id === response.choiceId);
      if (!choice) throw new ServiceError('invalid_response');
      return gradeChoice(choice.itemKey, target);
    }
    default:
      throw new ServiceError('invalid_response');
  }
}
