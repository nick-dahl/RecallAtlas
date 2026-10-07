import {
  acceptedAnswers,
  buildQuestion,
  getItem,
  gradeChoice,
  gradeOrder,
  gradeTyped,
  isTypedFormat,
  normalize,
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
    ...slotFor(getItem(course, entry.itemKey).sequence, rng),
  };
}

const CHOICE_FORMATS = new Set<PendingQuestion['format']>([
  'mc-text',
  'flag-grid',
  'image-grid',
  'gap-choice',
  'map-pick',
  'contrast',
]);

/** Two-position items (Cleveland, Trump) are asked about one position at a time, chosen now. */
function slotFor(sequence: number[] | undefined, rng: Rng): { slot?: number } {
  if (!sequence || sequence.length < 2) return {};
  return { slot: sequence[Math.floor(rng() * sequence.length)] };
}

/** The single grading entry point: validates the response against what was actually issued. */
export function gradeSubmission(
  pending: PendingQuestion,
  response: AnswerResponse,
  course: CourseDef,
  maps?: MapSupport,
): AnswerGrade {
  const { entry } = pending;
  const promptType = entry.kind === 'prompt' ? course.promptTypes.find((p) => p.id === entry.promptType) : undefined;
  const grade = gradeResponse(pending, response, course, maps);
  // Some prompts (party) never count a miss as mixing up two items.
  if (promptType?.recordsConfusions === false) return { ...grade, answeredItemKey: null };
  // Picking "Anonymous" for a named work blames no particular anonymous work.
  if (promptType?.ambiguous && grade.answeredItemKey) {
    const label = acceptedAnswers(getItem(course, grade.answeredItemKey), promptType.answerField ?? 'name')[0] ?? '';
    if (promptType.ambiguous.some((a) => normalize(a) === normalize(label))) return { ...grade, answeredItemKey: null };
  }
  return grade;
}

function gradeResponse(pending: PendingQuestion, response: AnswerResponse, course: CourseDef, maps?: MapSupport): AnswerGrade {
  const { entry } = pending;
  const target = entry.itemKey;
  switch (response.kind) {
    case 'dont-know':
      return { correct: false, typo: false, answeredItemKey: null };
    case 'typed': {
      if (!isTypedFormat(pending.format) || entry.kind !== 'prompt') throw new ServiceError('invalid_response');
      const promptType = course.promptTypes.find((p) => p.id === entry.promptType);
      const field = promptType?.answerField ?? 'name';
      return gradeTyped(response.text, getItem(course, target), course.items, field, {
        exact: promptType?.exactAnswer,
        ambiguous: promptType?.ambiguous ?? (field === 'name' ? course.ambiguousAnswers : undefined),
      });
    }
    case 'order': {
      if (pending.format !== 'order') throw new ServiceError('invalid_response');
      const keyOf = new Map(pending.choices.map((c) => [c.id, c.itemKey]));
      const ids = response.choiceIds;
      if (ids.length !== keyOf.size || new Set(ids).size !== ids.length || !ids.every((id) => keyOf.has(id))) {
        throw new ServiceError('invalid_response');
      }
      const correct = gradeOrder(ids.map((id) => keyOf.get(id)!), course);
      return { correct, typo: false, answeredItemKey: null };
    }
    case 'point':
      if (pending.format !== 'map-click' || !pending.frame || !maps) throw new ServiceError('invalid_response');
      return gradeClick(target, maps.load(pending.frame), response);
    case 'choice': {
      // A single pick only answers a question that offers one (not put-in-order or typing).
      if (!CHOICE_FORMATS.has(pending.format)) throw new ServiceError('invalid_response');
      const choice = pending.choices.find((c) => c.id === response.choiceId);
      if (!choice) throw new ServiceError('invalid_response');
      return gradeChoice(choice.itemKey, target);
    }
    default:
      throw new ServiceError('invalid_response');
  }
}
