import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seededRng, type QueueEntry } from '@/lib/engine';
import { NOW, TEST_COURSE } from '@/lib/engine/test-fixtures';
import { WORLD_FLAGS } from '@/lib/content/world-flags';
import { issueQuestion } from './issue';
import { flagPresenter, toQuestionView } from './present';
import { getPresenter } from './presenters';

const fakeFlag = (key: string) => `flag#${TEST_COURSE.items.findIndex((i) => i.key === key)}`;
const presenter = flagPresenter(TEST_COURSE, fakeFlag);
const session = { id: 'session-1', kind: 'study' as const, progress: { answered: 3, total: 20 } };

function view(entry: QueueEntry, rung: 1 | 2 | 3, course = TEST_COURSE, p = presenter) {
  const pending = issueQuestion({ entry, rung, course, confusions: [], rng: seededRng(3), now: NOW, newId: randomUUID });
  return { pending, view: toQuestionView({ pending, session, course, presenter: p }) };
}

/** No string anywhere in the view may equal an item key. */
function expectNoKeys(value: unknown, keys: Set<string>) {
  const json = JSON.stringify(value);
  for (const key of keys) expect(json).not.toContain(`"${key}"`);
  expect(json).not.toContain('itemKey');
}
const KEYS = new Set(TEST_COURSE.items.map((i) => i.key));

describe('toQuestionView', () => {
  it('shows a flag for Flag → Name and names as choices', () => {
    const { view: v } = view({ kind: 'prompt', itemKey: 'EC', promptType: 'flag_to_name' }, 1);
    expect(v).toMatchObject({ sessionId: 'session-1', sessionKind: 'study', format: 'mc-text', progress: { answered: 3, total: 20 } });
    expect(v.prompt).toEqual({ flag: fakeFlag('EC') });
    expect(v.choices).toHaveLength(4);
    expect(v.choices!.map((c) => c.label)).toContain('Ecuador');
    expectNoKeys(v, KEYS);
  });

  it('shows a name for Name → Flag and flags as choices', () => {
    const { view: v } = view({ kind: 'prompt', itemKey: 'TD', promptType: 'name_to_flag' }, 3);
    expect(v.prompt).toEqual({ name: 'Chad' });
    expect(v.choices).toHaveLength(8);
    expect(v.choices!.every((c) => c.flag && !c.label)).toBe(true);
    expectNoKeys(v, KEYS);
  });

  it('shows name and flag for an intro card, with no choices', () => {
    const { view: v } = view({ kind: 'intro', itemKey: 'EC' }, 1);
    expect(v).toMatchObject({ format: 'intro', prompt: { name: 'Ecuador', flag: fakeFlag('EC') } });
    expect(v.choices).toBeUndefined();
  });

  it('shows a labelled pair and flag choices for a contrast drill', () => {
    const { view: v } = view({ kind: 'contrast', itemKey: 'TD', otherKey: 'RO' }, 1);
    expect(v.format).toBe('contrast');
    expect(v.prompt).toEqual({ name: 'Chad' });
    expect(v.pair).toEqual([
      { name: 'Chad', flag: fakeFlag('TD') },
      { name: 'Romania', flag: fakeFlag('RO') },
    ]);
    expect(v.choices).toHaveLength(2);
    expectNoKeys(v, KEYS);
  });

  it('with real World Flags art, carries no identifying markup', () => {
    const real = getPresenter(WORLD_FLAGS);
    const { view: v } = view({ kind: 'prompt', itemKey: 'EC', promptType: 'name_to_flag' }, 3, WORLD_FLAGS, real);
    const json = JSON.stringify(v);
    expect(json).not.toContain('flag-icons');
    expect(json).not.toContain('/flags/');
    expectNoKeys(v, new Set(WORLD_FLAGS.items.map((i) => i.key)));
  });
});
