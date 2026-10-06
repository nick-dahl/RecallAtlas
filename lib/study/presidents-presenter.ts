export { ordinal } from '@/lib/ui/president-facts';
import { acceptedAnswers, getItem, type CourseDef, type Item } from '@/lib/engine';
import { ordinal } from '@/lib/ui/president-facts';
import type { Presenter } from './present';
import type { PendingQuestion } from './types';

/**
 * US Presidents views (spec §5.8). Leak rules (§5.9): Portrait → Name and Number → Name name nobody
 * outside choice labels; start-year and party questions name only the target; gaps name only the
 * neighbours; put-in-order shows names without numbers or years. A two-term president's question
 * follows `pending.slot` everywhere (number, gap, year label).
 */
export function presidentsPresenter(course: CourseDef, deps: { portrait: (key: string) => string }): Presenter {
  const { portrait } = deps;
  const item = (key: string) => getItem(course, key);
  const name = (key: string) => item(key).name;
  const byNumber = new Map<number, Item>();
  for (const i of course.items) for (const n of i.sequence ?? []) byNumber.set(n, i);

  /** The position a question is about: its slot for the target, else the first. */
  const positionOf = (key: string, pending?: PendingQuestion) =>
    pending?.slot !== undefined && pending.entry.itemKey === key ? pending.slot : item(key).sequence![0];
  const yearAt = (key: string, position: number) => {
    const years = acceptedAnswers(item(key), 'startYear');
    return years[item(key).sequence!.indexOf(position)] ?? years[0];
  };

  return {
    prompt(entry, pending) {
      const key = entry.itemKey;
      switch (entry.promptType) {
        case 'number_to_name':
          return { question: `Who was the ${ordinal(positionOf(key, pending))} president?` };
        case 'portrait_to_name':
          return { portrait: portrait(key), question: 'Who is this?' };
        case 'name_to_portrait':
          return { name: name(key), question: `Which one is ${name(key)}?` };
        case 'start_year':
          return { name: name(key), question: `When did ${name(key)} take office?`, asks: 'year' };
        case 'party':
          return { name: name(key), question: `Which party was ${name(key)}?` };
        default: {
          if (pending?.format === 'order') return { question: 'Put these in order, earliest first' };
          const n = positionOf(key, pending);
          const before = byNumber.get(n - 1);
          const after = byNumber.get(n + 1);
          return {
            question: 'Who fills the gap?',
            gap: { ...(before ? { before: before.name } : {}), ...(after ? { after: after.name } : {}) },
          };
        }
      }
    },

    choice(key, format, promptType, pending) {
      if (format === 'image-grid') return { portrait: portrait(key) };
      if (format === 'contrast') return { label: name(key), portrait: portrait(key) };
      if (promptType === 'start_year') return { label: yearAt(key, positionOf(key, pending)) };
      if (promptType === 'party') return { label: item(key).answers!.party.text };
      return { label: name(key) };
    },

    item(key) {
      const i = item(key);
      return {
        name: i.name,
        portrait: portrait(key),
        numbers: i.sequence,
        startYears: acceptedAnswers(i, 'startYear').map(Number),
        party: i.answers!.party.text,
      };
    },

    feedbackExtra(pending) {
      if (pending.format !== 'order') return {};
      const order = pending.choices
        .map((c) => item(c.itemKey))
        .sort((a, b) => a.sequence![0] - b.sequence![0])
        .map((i) => i.name);
      return { order };
    },
  };
}
