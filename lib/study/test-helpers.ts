import { randomUUID } from 'node:crypto';
import { getItem, graduate, initialStates, introduce, isTypedFormat, seededRng, type CourseDef } from '@/lib/engine';
import { NOW, TEST_COURSE, TEST_MAP_COURSE } from '@/lib/engine/test-fixtures';
import { MemoryStore } from '@/lib/db/memory-store';
import type { UserStore } from '@/lib/db/store';
import type { MapSupport } from '@/lib/map/support';
import type { CountryShape, FrameData } from '@/lib/map/types';
import type { ServiceContext } from './context';
import { mapPresenter } from './map-presenter';
import { flagPresenter } from './present';
import type { AnswerResponse, PendingQuestion } from './types';

export const fakeFlag = (key: string) => `flag#${TEST_COURSE.items.findIndex((i) => i.key === key)}`;

export function testContext(
  store: UserStore,
  opts: { now?: Date; seed?: number; course?: CourseDef; maps?: MapSupport } = {},
): ServiceContext {
  const course = opts.course ?? TEST_COURSE;
  const { maps } = opts;
  return {
    store,
    course,
    presenter: maps ? mapPresenter(course, { flag: fakeFlag, maps }) : flagPresenter(course, fakeFlag),
    ...(maps ? { maps } : {}),
    now: opts.now ?? NOW,
    rng: seededRng(opts.seed ?? 1),
    newId: randomUUID,
  };
}

/** Keys left out of the fixture region frame, so eligibility can be tested. */
export const OFF_REGION_KEYS = ['IN', 'MG'];

/**
 * A synthetic two-frame map for TEST_MAP_COURSE: every item is a 60×60 square on a 1000×500
 * grid. `fx-continent` (Find at recall) shows all of them; `fx-region` all but OFF_REGION_KEYS.
 */
export function fixtureMaps(course: CourseDef = TEST_MAP_COURSE): MapSupport {
  const shapes: Record<string, CountryShape> = Object.fromEntries(
    course.items.map((item, i) => {
      const x = 20 + (i % 10) * 90;
      const y = 20 + Math.floor(i / 10) * 90;
      const shape: CountryShape = {
        rings: [[x, y, x + 60, y, x + 60, y + 60, x, y + 60]],
        bbox: [x, y, x + 60, y + 60],
        outline: `M${x},${y}h60v60h-60Z`,
        label: [x + 30, y + 30],
      };
      return [item.key, shape];
    }),
  );
  const region = Object.fromEntries(Object.entries(shapes).filter(([k]) => !OFF_REGION_KEYS.includes(k)));
  const frames: Record<string, FrameData> = {
    'fx-region': { id: 'fx-region', width: 1000, height: 500, countries: region },
    'fx-continent': { id: 'fx-continent', width: 1000, height: 500, countries: shapes },
  };
  return {
    load: (id) => frames[id],
    // Like the real build, an item's own questions always use a frame that draws it.
    frameFor: (entry, rung) =>
      (entry.kind === 'prompt' && entry.promptType === 'find' && rung === 3) || OFF_REGION_KEYS.includes(entry.itemKey)
        ? 'fx-continent'
        : 'fx-region',
  };
}

/** A click on the middle of `key` in the pending question's frame. */
export function clickOn(pending: PendingQuestion, maps: MapSupport, key: string): AnswerResponse {
  const frame = maps.load(pending.frame!);
  const [x, y] = frame.countries[key].label;
  return { kind: 'point', x: x / frame.width, y: y / frame.height, width: frame.width };
}

/** A MemoryStore whose clock can be moved, plus an enrollment for `course`. */
export async function enrolledStore(opts: { placementDone?: boolean; course?: CourseDef } = {}) {
  const slug = (opts.course ?? TEST_COURSE).slug;
  let clock = NOW;
  const store = new MemoryStore(() => clock);
  await store.enroll(slug);
  if (opts.placementDone) await store.setPlacementCompleted(slug, NOW);
  return { store, setClock: (d: Date) => (clock = d) };
}

export function allGraduated(course: CourseDef = TEST_COURSE, at = NOW) {
  return initialStates(course).map((s) => graduate({ ...introduce(s), rung: 3 }, at));
}

/** Reads the server-side pending question (tests only; the browser never sees this). */
export async function pendingFor(store: UserStore, slug = TEST_COURSE.slug): Promise<PendingQuestion> {
  const active = await store.getActiveSession(slug);
  if (!active?.pendingQuestion) throw new Error('No pending question');
  return active.pendingQuestion;
}

export function correctResponse(pending: PendingQuestion, course: CourseDef = TEST_COURSE, maps?: MapSupport): AnswerResponse {
  const { entry } = pending;
  if (entry.kind === 'intro') return { kind: 'ack' };
  if (pending.format === 'map-click') {
    if (!maps) throw new Error('correctResponse needs maps for a map-click question');
    return clickOn(pending, maps, entry.itemKey);
  }
  if (pending.format === 'order') {
    const first = (key: string) => getItem(course, key).sequence![0];
    const sorted = [...pending.choices].sort((a, b) => first(a.itemKey) - first(b.itemKey));
    return { kind: 'order', choiceIds: sorted.map((c) => c.id) };
  }
  if (isTypedFormat(pending.format)) {
    const promptType = entry.kind === 'prompt' ? entry.promptType : undefined;
    const field = course.promptTypes.find((p) => p.id === promptType)?.answerField ?? 'name';
    const item = getItem(course, entry.itemKey);
    return { kind: 'typed', text: field === 'name' ? item.name : item.answers![field].text };
  }
  return { kind: 'choice', choiceId: pending.choices.find((c) => c.itemKey === entry.itemKey)!.id };
}

export function wrongChoice(pending: PendingQuestion): { kind: 'choice'; choiceId: string; itemKey: string } {
  const other = pending.choices.find((c) => c.itemKey !== pending.entry.itemKey)!;
  return { kind: 'choice', choiceId: other.id, itemKey: other.itemKey };
}
