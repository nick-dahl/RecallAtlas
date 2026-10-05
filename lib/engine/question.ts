import { pickDistractors } from './distractors';
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
  const distractors = pickDistractors({
    target,
    items: course.items,
    count: spec.choices - 1,
    mode: spec.distractors ?? 'random',
    confusions,
    rng,
    eligible,
  });
  return { entry, format: spec.format, choiceKeys: shuffle([target.key, ...distractors], rng) };
}
