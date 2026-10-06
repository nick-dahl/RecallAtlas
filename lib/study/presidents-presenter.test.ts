import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seededRng, type QueueEntry, type QuestionRung } from '@/lib/engine';
import { NOW } from '@/lib/engine/test-fixtures';
import { US_PRESIDENTS } from '@/lib/content/us-presidents';
import { issueQuestion } from './issue';
import { ordinal, presidentsPresenter } from './presidents-presenter';
import { toQuestionView } from './present';
import type { PendingQuestion } from './types';

const course = US_PRESIDENTS;
const portrait = (key: string) => `portrait#${course.items.findIndex((i) => i.key === key)}`;
const presenter = presidentsPresenter(course, { portrait });
const session = { id: 'session-1', kind: 'study' as const, progress: { answered: 0, total: 20 } };
const NAMES = course.items.map((i) => i.name);
const KEYS = course.items.map((i) => i.key);

function issue(entry: QueueEntry, rung: QuestionRung, seed = 3): PendingQuestion {
  return issueQuestion({ entry, rung, course, confusions: [], rng: seededRng(seed), now: NOW, newId: randomUUID });
}
const view = (pending: PendingQuestion) => toQuestionView({ pending, session, course, presenter });
const prompt = (itemKey: string, promptType: string, rung: QuestionRung, seed = 3) => {
  const pending = issue({ kind: 'prompt', itemKey, promptType }, rung, seed);
  return { pending, view: view(pending) };
};
/** A pending question pinned to one of Cleveland's or Trump's numbers. */
const withSlot = (itemKey: string, promptType: string, rung: QuestionRung, slot: number) => {
  const pending = { ...issue({ kind: 'prompt', itemKey, promptType }, rung), slot };
  return { pending, view: view(pending) };
};

function namesOutsideLabels(v: object): string[] {
  const { choices, ...rest } = v as { choices?: { label?: string }[] };
  const json = JSON.stringify({ ...rest, choices: choices?.map((c) => ({ ...c, label: undefined })) });
  return NAMES.filter((n) => json.includes(n));
}
function expectNoKeys(v: object) {
  const json = JSON.stringify(v);
  for (const k of KEYS) expect(json).not.toContain(`"${k}"`);
  expect(json).not.toContain('itemKey');
}

describe('ordinal', () => {
  it.each([
    [1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'], [13, '13th'],
    [21, '21st'], [22, '22nd'], [23, '23rd'], [44, '44th'], [47, '47th'],
  ])('%i → %s', (n, s) => expect(ordinal(n)).toBe(s));
});

describe('presidentsPresenter', () => {
  it('asks Number → Name with no name outside the choices', () => {
    for (const rung of [1, 2, 3] as const) {
      const { view: v } = prompt('lincoln', 'number_to_name', rung);
      expect(v.prompt.question).toBe('Who was the 16th president?');
      expect(namesOutsideLabels(v)).toEqual([]);
      expectNoKeys(v);
    }
  });

  it('keeps a Cleveland question consistent with its slot: number, gap and year', () => {
    expect(withSlot('cleveland', 'number_to_name', 1, 22).view.prompt.question).toBe('Who was the 22nd president?');
    expect(withSlot('cleveland', 'number_to_name', 1, 24).view.prompt.question).toBe('Who was the 24th president?');
    expect(withSlot('cleveland', 'sequence', 3, 22).view.prompt.gap).toEqual({ before: 'Chester A. Arthur', after: 'Benjamin Harrison' });
    expect(withSlot('cleveland', 'sequence', 3, 24).view.prompt.gap).toEqual({ before: 'Benjamin Harrison', after: 'William McKinley' });
    const year22 = withSlot('cleveland', 'start_year', 1, 22);
    const year24 = withSlot('cleveland', 'start_year', 1, 24);
    const label = (p: ReturnType<typeof withSlot>) =>
      p.view.choices!.find((c) => c.id === p.pending.choices.find((ch) => ch.itemKey === 'cleveland')!.id)!.label;
    expect(label(year22)).toBe('1885');
    expect(label(year24)).toBe('1893');
  });

  it('shows the ends of the list, and both of Trump’s positions', () => {
    expect(prompt('washington', 'sequence', 3).view.prompt.gap).toEqual({ after: 'John Adams' });
    expect(withSlot('trump', 'sequence', 3, 47).view.prompt.gap).toEqual({ before: 'Joe Biden' });
    expect(withSlot('trump', 'sequence', 3, 45).view.prompt.gap).toEqual({ before: 'Barack Obama', after: 'Joe Biden' });
  });

  it('shows a portrait for Portrait → Name and names nobody outside the choices', () => {
    for (const rung of [1, 2, 3] as const) {
      const { view: v } = prompt('arthur', 'portrait_to_name', rung);
      expect(v.prompt).toEqual({ portrait: portrait('arthur'), question: 'Who is this?', asks: 'president' });
      expect(namesOutsideLabels(v)).toEqual([]);
      expectNoKeys(v);
    }
  });

  it('offers unlabelled portraits for Name → Portrait', () => {
    const { view: v } = prompt('arthur', 'name_to_portrait', 3);
    expect(v.format).toBe('image-grid');
    expect(v.prompt).toEqual({ name: 'Chester A. Arthur', question: 'Which one is Chester A. Arthur?' });
    expect(v.choices).toHaveLength(8);
    expect(v.choices!.every((c) => c.portrait && !c.label)).toBe(true);
    expect(namesOutsideLabels(v)).toEqual(['Chester A. Arthur']);
  });

  it('names only the target in start-year and party questions, with years and parties as labels', () => {
    const year = prompt('polk', 'start_year', 1).view;
    expect(year.prompt).toEqual({ name: 'James K. Polk', question: 'When did James K. Polk take office?', asks: 'year' });
    expect(year.choices!.map((c) => c.label)).toContain('1845');
    expect(namesOutsideLabels(year)).toEqual(['James K. Polk']);
    const party = prompt('polk', 'party', 1).view;
    expect(party.prompt.question).toBe('Which party was James K. Polk?');
    expect(party.choices!.map((c) => c.label)).toContain('Democratic');
    expect(namesOutsideLabels(party)).toEqual(['James K. Polk']);
  });

  it('puts four names in order with no numbers or years, and gives the right order in feedback', () => {
    const { pending, view: v } = prompt('fillmore', 'sequence', 2);
    expect(v.format).toBe('order');
    expect(v.prompt.question).toBe('Put these in order, earliest first');
    expect(v.choices).toHaveLength(4);
    // Ids are random UUIDs (a segment like 1847 would match), so check the visible text only.
    const text = JSON.stringify({ prompt: v.prompt, labels: v.choices!.map((c) => c.label) });
    expect(text).not.toMatch(/\b1[789]\d\d\b|\b20\d\d\b|\d+(st|nd|rd|th)\b/);
    expectNoKeys(v);
    const extra = presenter.feedbackExtra!(pending, { correct: false, typo: false, answeredItemKey: null });
    const firsts = extra.order!.map((n) => course.items.find((i) => i.name === n)!.sequence![0]);
    expect(firsts).toEqual([...firsts].sort((a, b) => a - b));
  });

  it('introduces a president with portrait, numbers, years and party', () => {
    const v = view(issue({ kind: 'intro', itemKey: 'cleveland' }, 1));
    expect(v.prompt).toMatchObject({
      name: 'Grover Cleveland',
      portrait: portrait('cleveland'),
      numbers: [22, 24],
      startYears: [1885, 1893],
      party: 'Democratic',
    });
  });
});

describe('presidentsPresenter answer hints', () => {
  it.each([
    ['number_to_name', 3, 'president'],
    ['portrait_to_name', 3, 'president'],
    ['sequence', 3, 'president'],
    ['sequence', 1, 'president'],
    ['start_year', 1, 'year'],
    ['start_year', 3, 'year'],
    ['party', 1, 'party'],
  ] as const)('%s at level %i asks for a %s', (promptType, rung, asks) => {
    expect(prompt('polk', promptType, rung).view.prompt.asks).toBe(asks);
  });
});
