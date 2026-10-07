import { pickDistractors } from './distractors';
import { acceptedAnswers, normalize } from './grading';
import { shuffle } from './random';
import { getItem } from './state';
import type { Confusion, CourseDef, PromptState, Question, QuestionRung, QueueEntry, Rng } from './types';

export function rungForState(state: PromptState): QuestionRung {
  if (state.phase === 'review') return 3;
  return Math.max(1, state.rung) as QuestionRung;
}

export function buildQuestion(args: {
  entry: QueueEntry;
  rung: QuestionRung;
  course: CourseDef;
  confusions: readonly Confusion[];
  rng: Rng;
  /** Restricts distractors (map questions: countries drawn in the frame). */
  eligible?: (key: string) => boolean;
}): Question {
  const { entry, rung, course, confusions, rng, eligible } = args;
  if (entry.kind === 'intro') return { entry, format: 'intro' };
  if (entry.kind === 'contrast') {
    return { entry, format: 'contrast', choiceKeys: shuffle([entry.itemKey, entry.otherKey], rng) };
  }

  const promptType = course.promptTypes.find((p) => p.id === entry.promptType);
  if (!promptType) throw new Error(`Unknown prompt type ${entry.promptType} in course ${course.slug}`);
  const spec = promptType.formats[rung];
  if (!spec.choices) return { entry, format: spec.format };

  const target = getItem(course, entry.itemKey);
  const field = promptType.answerField ?? 'name';
  const shared = promptType.sharedAnswer ? normalize(promptType.sharedAnswer) : null;
  const isShared = (key: string) => shared !== null && normalize(acceptedAnswers(getItem(course, key), field)[0] ?? '') === shared;
  const distractors = pickDistractors({
    target,
    items: course.items,
    count: spec.choices - 1,
    mode: spec.distractors ?? 'random',
    confusions,
    rng,
    eligible: shared ? (key) => !isShared(key) && (eligible?.(key) ?? true) : eligible,
    window: spec.window,
    exclusions: spec.format === 'order' ? course.orderExclusions : undefined,
    distinct: promptType.distinctChoices
      ? { label: (i) => acceptedAnswers(i, field)[0] ?? '', taken: acceptedAnswers(target, field) }
      : undefined,
  });
  if (shared && !isShared(target.key) && distractors.length > 0) {
    const sharers = course.items.filter((i) => isShared(i.key) && (eligible?.(i.key) ?? true));
    const others = course.items.length - sharers.length;
    const rate = Math.min(1, (distractors.length * sharers.length) / Math.max(1, others));
    if (sharers.length > 0 && rng() < rate) {
      distractors[distractors.length - 1] = sharers[Math.floor(rng() * sharers.length)].key;
    }
  }
  return { entry, format: spec.format, choiceKeys: shuffle([target.key, ...distractors], rng) };
}
