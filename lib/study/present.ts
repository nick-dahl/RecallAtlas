import { getItem, type CourseDef, type Format, type PromptEntry } from '@/lib/engine';
import type { ItemView, PendingQuestion, QuestionView, SessionKind } from './types';

/** Course-specific rendering of items into browser-safe views (names + image data, never keys). */
export interface Presenter {
  prompt(entry: PromptEntry): QuestionView['prompt'];
  choice(itemKey: string, format: Format): { label?: string; flag?: string };
  item(itemKey: string): ItemView;
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
  const choices = pending.choices.length
    ? pending.choices.map((c) => ({ id: c.id, ...presenter.choice(c.itemKey, pending.format) }))
    : undefined;
  const { entry } = pending;

  if (entry.kind === 'intro') return { ...base, prompt: presenter.item(entry.itemKey) };
  if (entry.kind === 'contrast') {
    return {
      ...base,
      prompt: { name: getItem(course, entry.itemKey).name },
      pair: [presenter.item(entry.itemKey), presenter.item(entry.otherKey)],
      choices,
    };
  }
  return { ...base, prompt: presenter.prompt(entry), choices };
}
