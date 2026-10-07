import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seededRng, type QueueEntry, type QuestionRung } from '@/lib/engine';
import { NOW } from '@/lib/engine/test-fixtures';
import { WORLD_CAPITALS } from '@/lib/content/world-capitals';
import { gradeSubmission, issueQuestion } from './issue';
import { toQuestionView } from './present';
import { getMapSupport, getPresenter } from './presenters';
import type { PendingQuestion } from './types';

const course = WORLD_CAPITALS;
const presenter = getPresenter(course);
const maps = getMapSupport(course)!;
const session = { id: 'session-1', kind: 'study' as const, progress: { answered: 0, total: 20 } };
const NAMES = course.items.map((i) => i.name);
const KEYS = course.items.map((i) => i.key);
const capitalOf = (key: string) => course.items.find((i) => i.key === key)!.answers!.capital.text;

const issue = (entry: QueueEntry, rung: QuestionRung, seed = 3): PendingQuestion =>
  issueQuestion({ entry, rung, course, confusions: [], rng: seededRng(seed), now: NOW, newId: randomUUID, maps });
const view = (pending: PendingQuestion) => toQuestionView({ pending, session, course, presenter });
const ask = (itemKey: string, promptType: string, rung: QuestionRung) => {
  const pending = issue({ kind: 'prompt', itemKey, promptType }, rung);
  return { pending, view: view(pending) };
};

/** Text of a view outside choice labels (and, for capital → country, outside the asked capital). */
function textOutsideLabels(v: ReturnType<typeof view>): string {
  const { choices, prompt, ...rest } = v;
  const promptRest = { ...prompt, capital: undefined, question: undefined };
  return JSON.stringify({ ...rest, prompt: promptRest, choices: choices?.map((c) => ({ ...c, label: undefined })) });
}

describe('capitalsPresenter leak rules (every country × direction × level)', () => {
  it('country → capital names only the country, shows a locator map, and no capital outside choices', () => {
    for (const item of course.items) {
      for (const rung of [1, 2, 3] as const) {
        const { view: v } = ask(item.key, 'country_to_capital', rung);
        expect(v.prompt).toMatchObject({ name: item.name, question: `What's the capital of ${item.name}?`, asks: 'capital' });
        expect(v.map?.highlight).toBeTruthy();
        expect(v.map?.locator).toBe(true);
        // Where the capital shares the country's name (Luxembourg, Djibouti…), naming the country is unavoidable.
        if (capitalOf(item.key) !== item.name) expect(textOutsideLabels(v)).not.toContain(`"${capitalOf(item.key)}"`);
        for (const k of KEYS) expect(JSON.stringify(v)).not.toContain(`"${k}"`);
      }
    }
  });

  it('capital → country shows no map and no flag, and names no country outside choices and the capital itself', () => {
    for (const item of course.items) {
      for (const rung of [1, 2, 3] as const) {
        const { view: v } = ask(item.key, 'capital_to_country', rung);
        expect(v.prompt).toEqual({ capital: capitalOf(item.key), question: `${capitalOf(item.key)} is the capital of…?`, asks: 'country' });
        expect(v.map).toBeUndefined();
        expect(JSON.stringify(v)).not.toContain('data:image');
        const text = textOutsideLabels(v);
        expect(NAMES.filter((n) => text.includes(`"${n}"`))).toEqual([]);
        for (const k of KEYS) expect(JSON.stringify(v)).not.toContain(`"${k}"`);
      }
    }
  });

  it('labels country → capital choices with capitals and capital → country choices with countries', () => {
    expect(ask('PE', 'country_to_capital', 1).view.choices!.map((c) => c.label)).toContain('Lima');
    expect(ask('PE', 'capital_to_country', 1).view.choices!.map((c) => c.label)).toContain('Peru');
  });

  it('introduces a country with its flag, capital, note and locator map', () => {
    const v = view(issue({ kind: 'intro', itemKey: 'BO' }, 1));
    expect(v.prompt).toMatchObject({ name: 'Bolivia', capital: 'Sucre' });
    expect(v.prompt.flag).toMatch(/^data:/);
    expect(v.prompt.capitalNote).toMatch(/seat of government/);
    expect(v.map?.highlight).toBeTruthy();
  });

  it('shows the country on its map in feedback, for both directions', () => {
    for (const promptType of ['country_to_capital', 'capital_to_country']) {
      const { pending } = ask('PE', promptType, 3);
      const fb = presenter.feedbackMap!(pending, { correct: false, typo: false, answeredItemKey: 'CL' });
      expect(fb?.baseUrl).toBe('/maps/south-america.svg');
      expect(fb?.correct).toBeTruthy();
      expect(fb?.given).toBeTruthy();
    }
  });
});

describe('grading both directions', () => {
  const typed = (itemKey: string, promptType: string, text: string) =>
    gradeSubmission(ask(itemKey, promptType, 3).pending, { kind: 'typed', text }, course, maps);

  it('grades country → capital by capital, with other capitals as mix-ups', () => {
    expect(typed('PE', 'country_to_capital', 'lima').correct).toBe(true);
    expect(typed('PE', 'country_to_capital', 'Quito')).toEqual({ correct: false, typo: false, answeredItemKey: 'EC' });
  });

  it('grades capital → country by country name, with other countries as mix-ups', () => {
    expect(typed('PE', 'capital_to_country', 'Peru').correct).toBe(true);
    expect(typed('PE', 'capital_to_country', 'Chile')).toEqual({ correct: false, typo: false, answeredItemKey: 'CL' });
  });

  it('reads a typed name as a country, even when it is also a capital (Luxembourg)', () => {
    expect(typed('LU', 'capital_to_country', 'Luxembourg').correct).toBe(true);
    expect(typed('MC', 'capital_to_country', 'Luxembourg')).toEqual({ correct: false, typo: false, answeredItemKey: 'LU' });
  });
});
