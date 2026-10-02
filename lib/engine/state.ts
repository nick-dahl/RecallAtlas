import type { CourseDef, Item, PromptState } from './types';

export function newPromptState(itemKey: string, promptType: string): PromptState {
  return { itemKey, promptType, phase: 'new', rung: 0, streak: 0, fsrs: null };
}

export function initialStates(course: CourseDef): PromptState[] {
  return course.items.flatMap((item) =>
    course.promptTypes.map((pt) => newPromptState(item.key, pt.id)),
  );
}

export function stateKey(itemKey: string, promptType: string): string {
  return `${itemKey}:${promptType}`;
}

export function indexStates(states: readonly PromptState[]): Map<string, PromptState> {
  return new Map(states.map((s) => [stateKey(s.itemKey, s.promptType), s]));
}

export function getItem(course: CourseDef, key: string): Item {
  const item = course.items.find((i) => i.key === key);
  if (!item) throw new Error(`Unknown item ${key} in course ${course.slug}`);
  return item;
}
