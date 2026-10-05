import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seededRng, type QueueEntry, type QuestionRung } from '@/lib/engine';
import { NOW, TEST_MAP_COURSE } from '@/lib/engine/test-fixtures';
import { WORLD_MAP } from '@/lib/content/world-map';
import { issueQuestion } from './issue';
import { mapPresenter } from './map-presenter';
import { toQuestionView } from './present';
import { getMapSupport, getPresenter } from './presenters';
import { fakeFlag, fixtureMaps } from './test-helpers';

const maps = fixtureMaps();
const presenter = mapPresenter(TEST_MAP_COURSE, { flag: fakeFlag, capitalNote: (k) => (k === 'EC' ? 'A note.' : null), maps });
const session = { id: 'session-1', kind: 'study' as const, progress: { answered: 0, total: 20 } };
const NAMES = TEST_MAP_COURSE.items.map((i) => i.name);
const KEYS = TEST_MAP_COURSE.items.map((i) => i.key);

function view(entry: QueueEntry, rung: QuestionRung, course = TEST_MAP_COURSE, p = presenter, m = maps) {
  const pending = issueQuestion({ entry, rung, course, confusions: [], rng: seededRng(5), now: NOW, newId: randomUUID, maps: m });
  return { pending, view: toQuestionView({ pending, session, course, presenter: p }) };
}

/** Names that appear anywhere in the view, outside of choice labels. */
function namesOutsideLabels(v: object, names: readonly string[]): string[] {
  const { choices, ...rest } = v as { choices?: { label?: string }[] };
  const json = JSON.stringify({ ...rest, choices: choices?.map((c) => ({ ...c, label: undefined })) });
  return names.filter((n) => json.includes(n));
}

function expectNoKeys(v: object, keys: readonly string[]) {
  const json = JSON.stringify(v);
  for (const k of keys) expect(json).not.toContain(`"${k}"`);
  expect(json).not.toContain('itemKey');
}

const find = (rung: QuestionRung) => view({ kind: 'prompt', itemKey: 'EC', promptType: 'find' }, rung);

describe('mapPresenter', () => {
  it('Find shows only the target name and unlabelled candidates on the region map', () => {
    const { view: v } = find(2);
    expect(v.format).toBe('map-pick');
    expect(v.prompt).toEqual({ name: 'Ecuador' });
    expect(v.map).toMatchObject({ baseUrl: '/maps/fx-region.svg', width: 1000, height: 500 });
    expect(v.map!.candidates).toHaveLength(6);
    expect(v.map!.candidates!.map((c) => c.id).sort()).toEqual(v.choices!.map((c) => c.id).sort());
    expect(v.choices!.every((c) => !c.label && !c.flag)).toBe(true);
    expect(v.map!.highlight).toBeUndefined();
    expect(namesOutsideLabels(v, NAMES)).toEqual(['Ecuador']);
    expectNoKeys(v, KEYS);
  });

  it('Find at recall shows the continent base map and no overlays', () => {
    const { view: v } = find(3);
    expect(v.format).toBe('map-click');
    expect(v.map).toEqual({ baseUrl: '/maps/fx-continent.svg', width: 1000, height: 500 });
    expect(v.choices).toBeUndefined();
    expect(namesOutsideLabels(v, NAMES)).toEqual(['Ecuador']);
  });

  it.each(['name', 'capital'])('%s shows a highlight and names no country outside choice labels', (promptType) => {
    for (const rung of [1, 2, 3] as const) {
      const { view: v } = view({ kind: 'prompt', itemKey: 'EC', promptType }, rung);
      expect(v.map!.highlight).toBe(maps.load('fx-region').countries.EC.outline);
      expect(v.prompt.question).toBe(promptType === 'capital' ? "What's its capital?" : 'Which country is this?');
      expect(v.prompt.name).toBeUndefined();
      expect(namesOutsideLabels(v, NAMES)).toEqual([]);
      expectNoKeys(v, KEYS);
    }
  });

  it('labels Capital choices with capitals and Name choices with names', () => {
    const capital = view({ kind: 'prompt', itemKey: 'EC', promptType: 'capital' }, 1).view;
    expect(capital.choices!.map((c) => c.label)).toContain('Quito');
    expect(capital.choices!.map((c) => c.label)).not.toContain('Ecuador');
    const name = view({ kind: 'prompt', itemKey: 'EC', promptType: 'name' }, 1).view;
    expect(name.choices!.map((c) => c.label)).toContain('Ecuador');
  });

  it('typed recall shows no names at all', () => {
    const { view: v } = view({ kind: 'prompt', itemKey: 'EC', promptType: 'capital' }, 3);
    expect(v.format).toBe('typed');
    expect(v.choices).toBeUndefined();
    expect(NAMES.filter((n) => JSON.stringify(v).includes(n))).toEqual([]);
  });

  it('introduces an item with its name, flag, capital, note and highlight', () => {
    const { view: v } = view({ kind: 'intro', itemKey: 'EC' }, 1);
    expect(v.prompt).toEqual({ name: 'Ecuador', flag: fakeFlag('EC'), capital: 'Quito', capitalNote: 'A note.' });
    expect(v.map!.highlight).toBeDefined();
  });

  it('outlines the correct and the clicked country in feedback', () => {
    const { pending } = find(3);
    const fb = presenter.feedbackMap!(pending, { correct: false, typo: false, answeredItemKey: 'CO' });
    expect(fb).toMatchObject({ baseUrl: '/maps/fx-continent.svg' });
    expect(fb!.correct).not.toEqual(fb!.given);
    expect(presenter.feedbackMap!(pending, { correct: false, typo: false, answeredItemKey: null })!.given).toBeUndefined();
  });
});

describe('mapPresenter with real World Map data', () => {
  const real = getPresenter(WORLD_MAP);
  const realMaps = getMapSupport(WORLD_MAP)!;
  const names = WORLD_MAP.items.map((i) => i.name);
  const keys = WORLD_MAP.items.map((i) => i.key);

  it('asks for the capital of Bolivia without naming Bolivia or leaking keys', () => {
    const { pending, view: v } = view({ kind: 'prompt', itemKey: 'BO', promptType: 'capital' }, 2, WORLD_MAP, real, realMaps);
    expect(pending.frame).toBe('south-america');
    expect(v.map!.baseUrl).toBe('/maps/south-america.svg');
    expect(v.choices!.map((c) => c.label)).toContain('Sucre');
    expect(namesOutsideLabels(v, names)).toEqual([]);
    expectNoKeys(v, keys);
  });

  it('keeps map-pick candidates inside the region frame', () => {
    const { pending } = view({ kind: 'prompt', itemKey: 'FR', promptType: 'find' }, 2, WORLD_MAP, real, realMaps);
    const shown = realMaps.load(pending.frame!).countries;
    for (const c of pending.choices) {
      expect(shown[c.itemKey]).toBeDefined();
      expect(shown[c.itemKey].sliver).toBeUndefined();
    }
  });
});
