import { getItem, type AnswerGrade, type CourseDef, type Format, type PromptEntry } from '@/lib/engine';
import type { FeedbackView, ItemView, MapView, PendingQuestion, QuestionView, SessionKind } from './types';

/** Course-specific rendering of items into browser-safe views (names + image data, never keys). */
export interface Presenter {
  prompt(entry: PromptEntry): QuestionView['prompt'];
  /** `promptType` is absent for contrast drills. */
  choice(itemKey: string, format: Format, promptType?: string): { label?: string; flag?: string };
  item(itemKey: string): ItemView;
  /** Map courses: the map shown with a question, if any. */
  map?(pending: PendingQuestion): MapView | undefined;
  /** Map courses: outlines for the feedback panel. */
  feedbackMap?(pending: PendingQuestion, grade: AnswerGrade): FeedbackView['map'];
}

export function flagPresenter(course: CourseDef, flag: (itemKey: string) => string): Presenter {
  const name = (key: string) => getItem(course, key).name;
  return {
    prompt: (entry) => (entry.promptType === 'flag_to_name' ? { flag: flag(entry.itemKey) } : { name: name(entry.itemKey) }),
    choice: (key, format) => (format === 'mc-text' ? { label: name(key) } : { flag: flag(key) }),
    item: (key) => ({ name: name(key), flag: flag(key) }),
  };
}

export function toQuestionView(args: {
  pending: PendingQuestion;
  session: { id: string; kind: SessionKind; progress: { answered: number; total: number } };
  course: CourseDef;
  presenter: Presenter;
}): QuestionView {
  const { pending, session, course, presenter } = args;
  const base = {
    sessionId: session.id,
    questionId: pending.questionId,
    sessionKind: session.kind,
    format: pending.format,
    progress: session.progress,
  };
  const { entry } = pending;
  const promptType = entry.kind === 'prompt' ? entry.promptType : undefined;
  const choices = pending.choices.length
    ? pending.choices.map((c) => ({ id: c.id, ...presenter.choice(c.itemKey, pending.format, promptType) }))
    : undefined;
  const map = presenter.map?.(pending);
  const withMap = map ? { map } : {};

  if (entry.kind === 'intro') return { ...base, prompt: presenter.item(entry.itemKey), ...withMap };
  if (entry.kind === 'contrast') {
    return {
      ...base,
      prompt: { name: getItem(course, entry.itemKey).name },
      pair: [presenter.item(entry.itemKey), presenter.item(entry.otherKey)],
      choices,
      ...withMap,
    };
  }
  return { ...base, prompt: presenter.prompt(entry), choices, ...withMap };
}
