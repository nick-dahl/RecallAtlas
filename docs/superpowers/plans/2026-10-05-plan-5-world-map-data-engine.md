# Recall Atlas — Plan 5: World Map data + engine (no UI)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Everything the World Map course needs below the UI: country data with capitals and territories, generated map frames with server-side hit data, engine and service changes, a registered `WORLD_MAP` course, and tests proving a learner can place, study and sit the exam by clicking.

**Architecture:** The content build gains two outputs. `content/countries.json` gets capitals, neighbours, nearby countries and 11 territories. A new map build projects world-atlas 1:50m geometry into 19 fixed frames: id-free base SVGs in `public/maps/` and server-only hit data in `content/maps/`. A pure `lib/map` module hit-tests normalized clicks against that data. The services pick a frame when a question is issued, grade clicks against it, and a `mapPresenter` turns pending questions into views with opaque overlays.

**Tech Stack:** TypeScript, Vitest, tsx scripts, d3-geo 3, topojson-client 3, topojson-simplify 3, polylabel 2, world-atlas 2 (all devDependencies, build-time only).

**Spec:** `docs/superpowers/specs/2026-10-05-world-map-design.md` (including §3.1 territories and §11 implementation notes).

## Global Constraints

- Answers never leak: base SVGs carry no ids, titles, classes or names; question views carry no item keys; Name/Capital views carry no names except choice labels.
- Each base SVG ≤ 80 KB (`BASE_SVG_MAX_BYTES = 80 * 1024`).
- Frame viewBox width is 1000 units (`FRAME_WIDTH`).
- Click pad: 12 CSS px (`CLICK_PAD_PX`), converted to viewBox units via `renderedWidth`.
- `point` responses: finite, `0 ≤ x,y ≤ 1`, `100 ≤ width ≤ 4000`.
- World Flags behaviour and data are unchanged: 197 items, same names/aliases/groups/order; all existing tests pass.
- `lib/engine` and `lib/map` stay pure (no fs, no server-only imports). File reads live in `lib/map/load.ts` (server-only).
- Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; write the message to a temp file and use `git commit -F`.
- This is Next.js 16 (see AGENTS.md); this plan touches only `next.config.ts` on the Next side.

## Review Focus

1. **A click on a tiny enclave (San Marino inside Italy, Lesotho inside South Africa)** must grade as the enclave, and a click on Italy a few pixels away must not. Pinned by the hole/marker tests in Task 3 and the build validation in Task 4.
2. **A confusion recorded from a continent-frame click (a country outside the asked item's region)** must not produce a map-pick candidate or contrast drill whose outline isn't drawn. Pinned by the `eligible` distractor tests (Task 2) and the contrast-frame test (Task 6).
3. **A placed item (Find + Name graduated)** must still have its Capital introduced in study, and a restarted placement must not re-ask it. Pinned by the session/placement tests in Task 2.
4. **Forged `point` responses** (NaN, out of range, a point sent for a typed question, a typed answer sent for a click question) must be rejected as `invalid_response`. Pinned in Task 6.
5. **Territory capitals and odd world-countries spellings** ("Papeetē", "Washington D.C.") must be typeable in plain ASCII. Pinned by the capital tests in Task 1.

---

## File map

| File | Responsibility |
|---|---|
| `scripts/content-config.ts` | + `MAP_TERRITORIES` |
| `scripts/capital-overrides.ts` | Displayed capital, aliases and notes per key |
| `scripts/lib/build-countries.ts` | + territories, capitals, neighbours, nearby, latlng |
| `lib/content/types.ts` | `CountryRecord` new fields |
| `lib/content/world-flags.ts` | Filters out territories |
| `lib/engine/{types,grading,distractors,question,placement,session}.ts` | answerField, map formats, `local` mode + `eligible`, placementGraduates, partial new items |
| `lib/map/{types,frames,hit-test,support}.ts` | Pure map module |
| `lib/map/load.ts` | Server-only frame loader |
| `scripts/map-config.ts` | Feature mapping rules, sizes, colours |
| `scripts/lib/maps/build-maps.ts` | Projection, base SVGs, hit data, atlas, validation |
| `scripts/build-content.ts` | Writes the map outputs |
| `lib/content/{map-prompts,world-map}.ts`, `registry.ts` | `WORLD_MAP` |
| `lib/study/{types,validate,issue,turn,present,map-presenter,presenters,context}.ts` | Point responses, frames, map views |
| `lib/server/context.ts`, `next.config.ts` | Wiring and file tracing |

---

### Task 1: Country data — capitals, neighbours, nearby, territories

**Files:**
- Create: `scripts/capital-overrides.ts`
- Modify: `scripts/content-config.ts`, `scripts/lib/build-countries.ts`, `scripts/lib/build-countries.test.ts`, `lib/content/types.ts`, `lib/content/world-flags.ts`, `scripts/build-content.ts`
- Regenerate: `content/countries.json`, `content/flags/*`

**Interfaces:**
- Produces: `CountryRecord` with `territory: boolean; ccn3: string; capital: string; capitalAliases: string[]; capitalNote: string | null; neighbors: string[]; nearby: string[]; latlng: [number, number]`.
- Produces: `buildCountries(raw, lookalikePairs?, capitalOverrides?, territories?)`.

- [ ] **Step 1: Write failing tests** in `scripts/lib/build-countries.test.ts`:

```ts
it('adds the World Map territories, flagged as territories', () => {
  const territories = countries.filter((c) => c.territory).map((c) => c.key).sort();
  expect(territories).toEqual([...MAP_TERRITORIES].sort());
  expect(countries.filter((c) => !c.territory)).toHaveLength(197);
});

it('gives every record a capital, applying overrides and aliases', () => {
  for (const c of countries) expect(c.capital.length).toBeGreaterThan(0);
  expect(byKey.get('ZA')).toMatchObject({ capital: 'Pretoria' });
  expect(byKey.get('ZA')!.capitalAliases).toEqual(expect.arrayContaining(['Cape Town', 'Bloemfontein']));
  expect(byKey.get('NL')!.capitalAliases).not.toContain('The Hague');
  expect(byKey.get('IL')!.capitalNote).toMatch(/disputed/);
  expect(byKey.get('UA')!.capitalAliases).toContain('Kiev');
  expect(byKey.get('GL')!.capital).toBe('Nuuk');
  expect(byKey.get('PF')!.capital).toBe('Papeete');
});

it('never lets two records accept the same normalized capital', () => {
  const owner = new Map<string, string>();
  for (const c of countries) {
    for (const n of new Set([c.capital, ...c.capitalAliases].map(normalize))) {
      expect(owner.get(n) ?? c.key).toBe(c.key);
      owner.set(n, c.key);
    }
  }
});

it('derives neighbours from borders and six nearby records', () => {
  expect(byKey.get('BO')!.neighbors).toEqual(expect.arrayContaining(['PE', 'BR', 'AR', 'CL', 'PY']));
  expect(byKey.get('GF')!.neighbors).toEqual(expect.arrayContaining(['BR', 'SR']));
  for (const c of countries) {
    expect(c.nearby).toHaveLength(6);
    expect(c.nearby).not.toContain(c.key);
    for (const k of [...c.neighbors, ...c.nearby]) expect(byKey.has(k)).toBe(true);
  }
});
```

Also extend `fake()` with `cca3: 'AAA', ccn3: '999', capital: ['Aland City'], borders: [], latlng: [50, 10]`, give each fake distinct capitals where two are built together, and pass `{}` overrides and `[]` territories in the "drops aliases shared" test. Add validation tests:

```ts
it('throws when a record has no capital', () => {
  expect(() => buildCountries([fake({ capital: [] })], [], {}, [])).toThrow(/capital/);
});

it('throws when two records accept the same capital', () => {
  expect(() =>
    buildCountries(
      [fake({ cca2: 'AA' }), fake({ cca2: 'BB', name: { common: 'Bland', official: 'Bland' } })],
      [], {}, [],
    ),
  ).toThrow(/Aland City/);
});

it('throws on an override for an unknown key', () => {
  expect(() => buildCountries([fake({})], [], { ZZ: { capital: 'X' } }, [])).toThrow(/ZZ/);
});
```

- [ ] **Step 2: Run** `npx vitest run scripts/lib/build-countries.test.ts` — expect FAIL (fields missing).

- [ ] **Step 3: Implement.**

`scripts/content-config.ts` — add:

```ts
/** Dependent territories taught in World Map only; World Flags filters them out (spec §3.1). */
export const MAP_TERRITORIES = ['GL', 'BM', 'PR', 'AW', 'CW', 'GF', 'FK', 'FO', 'NC', 'PF', 'GU'];
```

`scripts/capital-overrides.ts`:

```ts
export interface CapitalOverride {
  /** Replaces world-countries `capital[0]` as the displayed capital. */
  capital?: string;
  /** Extra accepted answers (other official capitals, spellings). */
  aliases?: string[];
  note?: string;
}

/** Reviewed list; the content build validates every key and uniqueness (spec §3). */
export const CAPITAL_OVERRIDES: Record<string, CapitalOverride> = {
  ZA: { capital: 'Pretoria', aliases: ['Cape Town', 'Bloemfontein'], note: 'South Africa has three capitals: Pretoria (executive), Cape Town (legislative) and Bloemfontein (judicial).' },
  BO: { capital: 'Sucre', aliases: ['La Paz'], note: 'Sucre is the constitutional capital; La Paz is the seat of government.' },
  SZ: { capital: 'Mbabane', aliases: ['Lobamba'], note: 'Mbabane is the administrative capital; Lobamba is the royal and legislative capital.' },
  NL: { capital: 'Amsterdam', note: 'The Hague is the seat of government, not the capital.' },
  IL: { capital: 'Jerusalem', note: "Jerusalem's status is disputed; most embassies are in Tel Aviv." },
  PS: { capital: 'Ramallah', note: 'Ramallah is the administrative centre; East Jerusalem is the claimed capital.' },
  UA: { capital: 'Kyiv', aliases: ['Kiev'] },
  MN: { capital: 'Ulaanbaatar', aliases: ['Ulan Bator'] },
  US: { capital: 'Washington, D.C.', aliases: ['Washington', 'Washington DC'] },
  PF: { capital: 'Papeete' },
  GU: { capital: 'Hagåtña', aliases: ['Hagatna', 'Agana'] },
  GL: { capital: 'Nuuk', aliases: ['Godthåb'] },
  XK: { capital: 'Pristina', aliases: ['Prishtina'] },
  CH: { capital: 'Bern', aliases: ['Berne'], note: 'Officially the "federal city".' },
};
```

(Step 5 reviews the generated capitals and extends this list where world-countries is wrong or awkward.)

`lib/content/types.ts` — extend `CountryRecord`:

```ts
  /** Dependent territory: a World Map item, never a World Flags item. */
  territory: boolean;
  /** ISO 3166-1 numeric; matches world-atlas feature ids. */
  ccn3: string;
  capital: string;
  capitalAliases: string[];
  capitalNote: string | null;
  /** Land neighbours (world-countries borders), as keys of other records. */
  neighbors: string[];
  /** The 6 nearest other records by great-circle distance between `latlng`s. */
  nearby: string[];
  /** [lat, lng] */
  latlng: [number, number];
```

`scripts/lib/build-countries.ts`: extend `RawCountry` with `cca3: string; ccn3: string; capital: string[]; borders: string[]; latlng: [number, number]`; add params `capitalOverrides: Record<string, CapitalOverride> = CAPITAL_OVERRIDES, territories: readonly string[] = MAP_TERRITORIES`; select `c.unMember || EXTRA_KEYS.includes(c.cca2) || territories.includes(c.cca2)`; then, after aliases and before look-alikes:

```ts
  const keys = new Set(withAliases.map((c) => c.key));
  for (const k of Object.keys(capitalOverrides)) {
    if (!keys.has(k)) throw new Error(`Capital override for unknown key ${k}`);
  }
  const rawByKey = new Map(selected.map((c) => [c.cca2, c]));
  const keyByCca3 = new Map(selected.map((c) => [c.cca3, c.cca2]));

  const capitals = new Map<string, { capital: string; capitalAliases: string[]; capitalNote: string | null }>();
  const capitalOwner = new Map<string, string>();
  for (const c of withAliases) {
    const r = rawByKey.get(c.key)!;
    const o = capitalOverrides[c.key] ?? {};
    const capital = o.capital ?? r.capital[0];
    if (!capital) throw new Error(`${c.key} has no capital`);
    const seen = new Set([normalize(capital)]);
    const capitalAliases: string[] = [];
    for (const a of [...(r.capital[0] && r.capital[0] !== capital ? [r.capital[0]] : []), ...r.capital.slice(1), ...(o.aliases ?? [])]) {
      const n = normalize(a);
      if (!n || seen.has(n)) continue;
      seen.add(n);
      capitalAliases.push(a);
    }
    for (const n of seen) {
      const prev = capitalOwner.get(n);
      if (prev) throw new Error(`Capital spelling "${n}" accepted by both ${prev} and ${c.key}`);
      capitalOwner.set(n, c.key);
    }
    capitals.set(c.key, { capital, capitalAliases, capitalNote: o.note ?? null });
  }
```

Neighbours and nearby:

```ts
const EARTH_KM = 6371;
function distanceKm([lat1, lng1]: [number, number], [lat2, lng2]: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

  const neighbors = (k: string) =>
    [...new Set(rawByKey.get(k)!.borders.map((b) => keyByCca3.get(b)).filter((x): x is string => !!x))].sort();
  const nearby = (k: string) => {
    const here = rawByKey.get(k)!.latlng;
    return [...keys]
      .filter((o) => o !== k)
      .map((o) => ({ o, d: distanceKm(here, rawByKey.get(o)!.latlng) }))
      .sort((a, b) => a.d - b.d || a.o.localeCompare(b.o))
      .slice(0, 6)
      .map((x) => x.o);
  };
```

The record gains `territory: territories.includes(c.key)`, `ccn3`, the capital fields, `neighbors`, `nearby`, `latlng`. Note: `nearby` uses `keys`, which needs ≥ 7 records; with fewer it returns what exists (fakes), so the `toHaveLength(6)` test runs on real data only.

`lib/content/world-flags.ts`: `items: records.filter((c) => !c.territory).map(...)`.

- [ ] **Step 4: Rebuild content and run tests.** `npm run content:build`, then `npx vitest run scripts lib/content`. Expect PASS. `git diff content/countries.json` must show, for the 197 countries, only the added fields (no alias, name, group or order changes other than itemOrder shifts within groups that gained territories).

- [ ] **Step 5: Review capitals.** Print `key name → capital [aliases]` for all 208 (a one-off `npx tsx -e`). Add overrides for any missing, outdated or non-ASCII-hostile entries; rebuild; re-run tests.

- [ ] **Step 6: Commit** `feat(content): capitals, neighbours, nearby and World Map territories`.

---

### Task 2: Engine — answer fields, map formats, local distractors, placement subset

**Files:**
- Modify: `lib/engine/{types,grading,distractors,question,placement,session}.ts` + their tests, `lib/engine/test-fixtures.ts`, `lib/study/placement-service.ts`
- Create: `lib/content/map-prompts.ts`

**Interfaces:**
- Produces: `Format` += `'map-pick' | 'map-click'`; `DistractorMode` += `'local'`; `Item.answers?: Record<string, { text: string; aliases: string[] }>`; `PromptTypeDef.answerField?: string`; `CourseDef.placementGraduates?: string[]`.
- Produces: `gradeTyped(input, target, items, field = 'name')`; `pickDistractors({..., eligible?: (key: string) => boolean})`; `buildQuestion({..., eligible?})`; `applyPlacementAnswer({ course, states, itemKey, correct, now })`; `untouchedItemsInOrder(course, states)`.
- Produces: `MAP_PROMPT_TYPES`, `TEST_MAP_COURSE` (fixtures).

- [ ] **Step 1: Prompt types** — `lib/content/map-prompts.ts`:

```ts
import type { PromptTypeDef } from '@/lib/engine/types';

export const MAP_PROMPT_TYPES: PromptTypeDef[] = [
  {
    id: 'find',
    label: 'Find it',
    formats: {
      1: { format: 'map-pick', choices: 4, distractors: 'local' },
      2: { format: 'map-pick', choices: 6, distractors: 'hard' },
      3: { format: 'map-click' },
    },
  },
  {
    id: 'name',
    label: 'Name it',
    formats: {
      1: { format: 'mc-text', choices: 4, distractors: 'local' },
      2: { format: 'mc-text', choices: 6, distractors: 'hard' },
      3: { format: 'typed' },
    },
  },
  {
    id: 'capital',
    label: 'Capital',
    answerField: 'capital',
    formats: {
      1: { format: 'mc-text', choices: 4, distractors: 'local' },
      2: { format: 'mc-text', choices: 6, distractors: 'hard' },
      3: { format: 'typed' },
    },
  },
];
```

Fixture in `lib/engine/test-fixtures.ts`:

```ts
const CAPITALS: Record<string, [string, ...string[]]> = {
  US: ['Washington, D.C.', 'Washington'], EC: ['Quito'], CO: ['Bogotá'], VE: ['Caracas'], PE: ['Lima'],
  TD: ["N'Djamena"], RO: ['Bucharest'], NE: ['Niamey'], NG: ['Abuja'], CI: ['Yamoussoukro'], GM: ['Banjul'],
  IN: ['New Delhi'], IE: ['Dublin'], DM: ['Roseau'], DO: ['Santo Domingo'], LC: ['Castries'], MG: ['Antananarivo'],
};

export const TEST_MAP_COURSE: CourseDef = {
  slug: 'test-map',
  title: 'Test Map',
  placementPromptType: 'find',
  placementGraduates: ['find', 'name'],
  promptTypes: MAP_PROMPT_TYPES,
  items: ITEMS.map((i) => {
    const [text, ...aliases] = CAPITALS[i.key];
    return { ...i, answers: { capital: { text, aliases } } };
  }),
};
```

- [ ] **Step 2: Failing tests.**

`grading.test.ts`:

```ts
describe('gradeTyped with an answer field', () => {
  const items = TEST_MAP_COURSE.items;
  const item = (k: string) => items.find((i) => i.key === k)!;
  it('grades capitals, with aliases and accents', () => {
    expect(gradeTyped('Bogota', item('CO'), items, 'capital')).toMatchObject({ correct: true, typo: false });
    expect(gradeTyped('washington', item('US'), items, 'capital').correct).toBe(true);
    expect(gradeTyped('Colombia', item('CO'), items, 'capital').correct).toBe(false);
  });
  it('tolerates typos and transpositions', () => {
    expect(gradeTyped('Quitp', item('EC'), items, 'capital')).toMatchObject({ correct: true, typo: true });
  });
  it("records another item's capital as a confusion", () => {
    expect(gradeTyped('Lima', item('EC'), items, 'capital')).toEqual({ correct: false, typo: false, answeredItemKey: 'PE' });
  });
  it('defaults to names, so flags are unchanged', () => {
    expect(gradeTyped('Ecuador', item('EC'), items).correct).toBe(true);
    expect(gradeTyped('Quito', item('EC'), items).correct).toBe(false);
  });
});
```

`distractors.test.ts`:

```ts
it('local mode prefers the same group', () => {
  const d = pickDistractors({ target: fixtureItem('EC'), items: ITEMS, count: 3, mode: 'local', confusions: [], rng: seededRng(1) });
  expect(new Set(d)).toEqual(new Set(['CO', 'VE', 'PE']));
});
it('never picks an ineligible item, in any mode', () => {
  for (const mode of ['random', 'hard', 'local'] as const) {
    const d = pickDistractors({
      target: fixtureItem('EC'), items: ITEMS, count: 5, mode,
      confusions: [{ asked: 'EC', answered: 'IN', count: 3 }], rng: seededRng(2),
      eligible: (k) => ['CO', 'VE', 'PE', 'US'].includes(k),
    });
    expect(d.every((k) => ['CO', 'VE', 'PE', 'US'].includes(k))).toBe(true);
  }
});
```

`question.test.ts`:

```ts
it('builds map-pick with choices and map-click without', () => {
  const pick = buildQuestion({ entry: { kind: 'prompt', itemKey: 'EC', promptType: 'find' }, rung: 1, course: TEST_MAP_COURSE, confusions: [], rng: seededRng(1) });
  expect(pick.format).toBe('map-pick');
  expect(pick.choiceKeys).toHaveLength(4);
  const click = buildQuestion({ entry: { kind: 'prompt', itemKey: 'EC', promptType: 'find' }, rung: 3, course: TEST_MAP_COURSE, confusions: [], rng: seededRng(1) });
  expect(click).toEqual({ entry: click.entry, format: 'map-click' });
});
```

`placement.test.ts`:

```ts
it('graduates only placementGraduates prompts', () => {
  const states = applyPlacementAnswer({ course: TEST_MAP_COURSE, states: initialStates(TEST_MAP_COURSE), itemKey: 'EC', correct: true, now: NOW });
  const ec = states.filter((s) => s.itemKey === 'EC');
  expect(ec.find((s) => s.promptType === 'find')!.phase).toBe('review');
  expect(ec.find((s) => s.promptType === 'name')!.phase).toBe('review');
  expect(ec.find((s) => s.promptType === 'capital')!.phase).toBe('new');
});
it('does not re-queue a partially placed item', () => {
  const states = applyPlacementAnswer({ course: TEST_MAP_COURSE, states: initialStates(TEST_MAP_COURSE), itemKey: 'US', correct: true, now: NOW });
  expect(buildPlacementQueue(TEST_MAP_COURSE, states).queue.map((e) => e.itemKey)).not.toContain('US');
});
```

(Existing `applyPlacementAnswer` calls gain `course: TEST_COURSE`.)

`session.test.ts`:

```ts
it('introduces an item whose capital is still new after placement', () => {
  const states = applyPlacementAnswer({ course: TEST_MAP_COURSE, states: initialStates(TEST_MAP_COURSE), itemKey: 'US', correct: true, now: NOW });
  expect(newItemsInOrder(TEST_MAP_COURSE, states)[0].key).toBe('US');
  expect(nextEntry({ course: TEST_MAP_COURSE, states, session: startStudySession(), now: NOW })).toEqual({ kind: 'intro', itemKey: 'US' });
});
```

- [ ] **Step 3: Run** `npx vitest run lib/engine` — expect FAIL.

- [ ] **Step 4: Implement.**

`types.ts`: the type additions listed under Interfaces (FormatSpec's format union also gains `'map-pick' | 'map-click'`).

`grading.ts`:

```ts
/** Accepted spellings of `item` for an answer field ('name' = the item's name and aliases). */
function namesOf(item: Item, field = 'name'): string[] {
  const answer = field === 'name' ? { text: item.name, aliases: item.aliases } : item.answers?.[field];
  if (!answer) return [];
  return [answer.text, ...answer.aliases].map(normalize).filter(Boolean);
}
```

and thread `field` through `typoDistance` and `gradeTyped(input, target, allItems, field = 'name')`.

`distractors.ts`:

```ts
  const { target, items, count, mode, confusions, rng, eligible } = args;
  const pool = items.filter((i) => i.key !== target.key && (eligible?.(i.key) ?? true));
  ...
  const ordered =
    mode === 'hard'
      ? [...]
      : mode === 'local'
        ? [...shuffle(sameGroup, rng), ...shuffle(otherGroups, rng)].map((i) => i.key)
        : [...shuffle(otherGroups, rng), ...shuffle(sameGroup, rng)].map((i) => i.key);
```

`question.ts`: accept `eligible?: (key: string) => boolean` and pass it to `pickDistractors`.

`session.ts`:

```ts
/** Items with at least one prompt still new (e.g. a placed item's capital), in group then item order. */
export function newItemsInOrder(course: CourseDef, states: readonly PromptState[]): Item[] {
  const pending = new Set(states.filter((s) => s.phase === 'new').map((s) => s.itemKey));
  return inOrder(course.items.filter((i) => pending.has(i.key)));
}

/** Items whose prompts are all still new. */
export function untouchedItemsInOrder(course: CourseDef, states: readonly PromptState[]): Item[] {
  const started = new Set(states.filter((s) => s.phase !== 'new').map((s) => s.itemKey));
  return inOrder(course.items.filter((i) => !started.has(i.key)));
}

const inOrder = (items: Item[]) => [...items].sort((a, b) => a.groupOrder - b.groupOrder || a.itemOrder - b.itemOrder);
```

`placement.ts`: queue from `untouchedItemsInOrder`;

```ts
export function applyPlacementAnswer(args: { course: CourseDef; states: readonly PromptState[]; itemKey: string; correct: boolean; now: Date }): PromptState[] {
  const { course, states, itemKey, correct, now } = args;
  if (!correct) return [...states];
  const graduates = new Set(course.placementGraduates ?? course.promptTypes.map((p) => p.id));
  return states.map((s) =>
    s.itemKey === itemKey && s.phase === 'new' && graduates.has(s.promptType) ? graduate(s, now) : s,
  );
}
```

Export `untouchedItemsInOrder` from `index.ts`; pass `course` in `placement-service.ts`.

- [ ] **Step 5: Run** `npx vitest run` — all PASS (flags unchanged). `npm run typecheck`.
- [ ] **Step 6: Commit** `feat(engine): answer fields, map formats, local distractors, placement subset`.

---

### Task 3: `lib/map` — frames, hit-testing, click grading

**Files:**
- Create: `lib/map/types.ts`, `lib/map/frames.ts`, `lib/map/hit-test.ts`, `lib/map/hit-test.test.ts`, `lib/map/frames.test.ts`

**Interfaces:**
- Produces: `FrameData`, `CountryShape`, `MarkerShape`, `Extent`, `FrameDef`, `FRAMES`, `GROUP_FRAMES`, `FRAME_WIDTH = 1000`, `frameFor(item, promptType: string | null, rung): string`, `isFrameId(id): boolean`.
- Produces: `CLICK_PAD_PX = 12`, `pointInRings(rings, x, y)`, `hitTest(frame, nx, ny, renderedWidth): string | null`, `gradeClick(targetKey, frame, point: { x; y; width }): AnswerGrade`.

- [ ] **Step 1: Types** — `lib/map/types.ts`:

```ts
export interface MarkerShape { x: number; y: number; r: number }

/** One country in one frame, in viewBox units. Server-only data (content/maps/*.hit.json). */
export interface CountryShape {
  /** Projected rings, each flat [x0, y0, x1, y1, ...]. Even-odd across all rings (holes = enclaves). */
  rings: number[][];
  bbox: [number, number, number, number];
  /** SVG path data for overlays; marker countries also get a circle. */
  outline: string;
  /** Representative interior point (pole of inaccessibility of the largest ring). */
  label: [number, number];
  marker?: MarkerShape;
}

export interface FrameData {
  id: string;
  width: number;
  height: number;
  countries: Record<string, CountryShape>;
}
```

- [ ] **Step 2: Failing hit-test tests** — `lib/map/hit-test.test.ts` uses a synthetic 1000×500 frame: `A` a square 100–300 with a hole 180–220 that is `E` (enclave polygon, marker r 4 at 200,200), `B` adjacent 300–500, `C` a tiny island marker at (700,100) r 4 with a 2×2 polygon.

```ts
const sq = (x0: number, y0: number, x1: number, y1: number) => [x0, y0, x1, y0, x1, y1, x0, y1];
const shape = (rings: number[][], label: [number, number], marker?: MarkerShape): CountryShape => {
  const xs = rings.flatMap((r) => r.filter((_, i) => i % 2 === 0));
  const ys = rings.flatMap((r) => r.filter((_, i) => i % 2 === 1));
  return { rings, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], outline: 'M0,0Z', label, marker };
};
const FRAME: FrameData = {
  id: 'test', width: 1000, height: 500,
  countries: {
    A: shape([sq(100, 100, 300, 300), sq(195, 195, 205, 205)], [150, 150]),
    E: shape([sq(195, 195, 205, 205)], [200, 200], { x: 200, y: 200, r: 4 }),
    B: shape([sq(300, 100, 500, 300)], [400, 200]),
    C: shape([sq(699, 99, 701, 101)], [700, 100], { x: 700, y: 100, r: 4 }),
  },
};
const at = (x: number, y: number, w = 1000) => hitTest(FRAME, x / 1000, y / 500, w);

describe('hitTest', () => {
  it('finds the country under the point', () => {
    expect(at(150, 150)).toBe('A');
    expect(at(450, 250)).toBe('B');
  });
  it('returns null over the ocean', () => {
    expect(at(900, 450)).toBeNull();
  });
  it('treats an enclave as its own country, dot first', () => {
    expect(at(200, 200)).toBe('E');
    expect(at(203, 200)).toBe('E'); // inside the r=4 dot
  });
  it('does not let the pad swallow clicks on the surrounding country', () => {
    expect(at(212, 200)).toBe('A');
  });
  it('pads small countries by 12 CSS px, scaled by rendered width', () => {
    expect(at(712, 100, 1000)).toBe('C'); // 12 units away: within r + 12
    expect(at(720, 100, 1000)).toBeNull(); // 20 > 16
    expect(at(720, 100, 500)).toBe('C'); // pad = 24 units
    expect(at(712, 100, 4000)).toBeNull(); // pad = 3 units: 12 > 7
  });
  it('a point on a shared border resolves to exactly one side', () => {
    expect(['A', 'B']).toContain(at(300, 200));
  });
});

describe('gradeClick', () => {
  it('is correct on the target, a confusion on another country, plain wrong on the ocean', () => {
    expect(gradeClick('A', FRAME, { x: 0.15, y: 0.3, width: 1000 })).toEqual({ correct: true, typo: false, answeredItemKey: null });
    expect(gradeClick('A', FRAME, { x: 0.45, y: 0.5, width: 1000 })).toEqual({ correct: false, typo: false, answeredItemKey: 'B' });
    expect(gradeClick('A', FRAME, { x: 0.9, y: 0.9, width: 1000 })).toEqual({ correct: false, typo: false, answeredItemKey: null });
  });
});
```

`lib/map/frames.test.ts`:

```ts
it('maps every learning group to a region and a continent frame', () => {
  for (const g of GROUP_ORDER) {
    expect(isFrameId(GROUP_FRAMES[g].region)).toBe(true);
    expect(isFrameId(GROUP_FRAMES[g].continent)).toBe(true);
  }
});
it('uses the continent only for Find at recall', () => {
  const peru = fixtureItem('PE');
  expect(frameFor(peru, 'find', 3)).toBe('continent-south-america');
  expect(frameFor(peru, 'find', 2)).toBe('south-america');
  expect(frameFor(peru, 'capital', 3)).toBe('south-america');
  expect(frameFor(peru, null, 1)).toBe('south-america');
});
```

- [ ] **Step 3: Run** `npx vitest run lib/map` — FAIL.

- [ ] **Step 4: Implement** `lib/map/hit-test.ts`:

```ts
import type { AnswerGrade } from '@/lib/engine/types';
import type { CountryShape, FrameData } from './types';

/** Small countries accept clicks this many CSS pixels outside their dot (spec §6). */
export const CLICK_PAD_PX = 12;

export function pointInRings(rings: readonly number[][], x: number, y: number): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
      const xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

const inBbox = (s: CountryShape, x: number, y: number) =>
  x >= s.bbox[0] && x <= s.bbox[2] && y >= s.bbox[1] && y <= s.bbox[3];

function nearestMarker(frame: FrameData, x: number, y: number, pad: number): string | null {
  let best: { key: string; d: number } | null = null;
  for (const [key, s] of Object.entries(frame.countries)) {
    if (!s.marker) continue;
    const d = Math.hypot(s.marker.x - x, s.marker.y - y);
    if (d <= s.marker.r + pad && (!best || d < best.d)) best = { key, d };
  }
  return best?.key ?? null;
}

/**
 * The country at a normalized point ([0,1] of the frame's viewBox), or null (ocean, or land
 * that is not a course item). Order: inside a marker dot, inside a polygon, then the nearest
 * marker within the click pad.
 */
export function hitTest(frame: FrameData, nx: number, ny: number, renderedWidth: number): string | null {
  const x = nx * frame.width;
  const y = ny * frame.height;
  const dot = nearestMarker(frame, x, y, 0);
  if (dot) return dot;
  for (const [key, s] of Object.entries(frame.countries)) {
    if (inBbox(s, x, y) && pointInRings(s.rings, x, y)) return key;
  }
  return nearestMarker(frame, x, y, (CLICK_PAD_PX * frame.width) / renderedWidth);
}

export function gradeClick(targetKey: string, frame: FrameData, point: { x: number; y: number; width: number }): AnswerGrade {
  const hit = hitTest(frame, point.x, point.y, point.width);
  if (hit === targetKey) return { correct: true, typo: false, answeredItemKey: null };
  return { correct: false, typo: false, answeredItemKey: hit };
}
```

`lib/map/frames.ts`:

```ts
import type { Item, QuestionRung } from '@/lib/engine/types';

export const FRAME_WIDTH = 1000;
/** [west, south, east, north] in degrees; east may exceed 180 to cross the antimeridian. */
export type Extent = [number, number, number, number];
export interface FrameDef { id: string; kind: 'region' | 'continent'; extent: Extent }

export const FRAMES: FrameDef[] = [
  { id: 'western-northern-europe', kind: 'region', extent: [-25, 41, 32, 71.5] },
  { id: 'southern-europe-balkans', kind: 'region', extent: [-10, 34.5, 30, 48.5] },
  { id: 'central-eastern-europe', kind: 'region', extent: [5, 42, 60, 62] },
  { id: 'north-central-america', kind: 'region', extent: [-170, 6, -10, 84] },
  { id: 'caribbean', kind: 'region', extent: [-86, 9.5, -58.5, 27.5] },
  { id: 'south-america', kind: 'region', extent: [-82, -56, -34, 13] },
  { id: 'middle-east-central-asia', kind: 'region', extent: [25, 12, 88, 56] },
  { id: 'south-east-asia', kind: 'region', extent: [44, -2, 146, 54] },
  { id: 'southeast-asia', kind: 'region', extent: [92, -11.5, 142, 29] },
  { id: 'north-west-africa', kind: 'region', extent: [-26, 3, 39, 38] },
  { id: 'central-southern-africa', kind: 'region', extent: [4, -35.5, 33, 24] },
  { id: 'east-africa', kind: 'region', extent: [21, -27, 60, 18.5] },
  { id: 'oceania', kind: 'region', extent: [110, -48, 227, 22] },
  { id: 'continent-europe', kind: 'continent', extent: [-25, 34, 45, 71.5] },
  { id: 'continent-asia', kind: 'continent', extent: [25, -11.5, 150, 56] },
  { id: 'continent-africa', kind: 'continent', extent: [-26, -35.5, 60, 38] },
  { id: 'continent-north-america', kind: 'continent', extent: [-170, 6, -10, 84] },
  { id: 'continent-south-america', kind: 'continent', extent: [-82, -56, -34, 13] },
  { id: 'continent-oceania', kind: 'continent', extent: [110, -48, 227, 22] },
];

export const GROUP_FRAMES: Record<string, { region: string; continent: string }> = {
  'Western & Northern Europe': { region: 'western-northern-europe', continent: 'continent-europe' },
  'Southern Europe & Balkans': { region: 'southern-europe-balkans', continent: 'continent-europe' },
  'Central & Eastern Europe': { region: 'central-eastern-europe', continent: 'continent-europe' },
  'North & Central America': { region: 'north-central-america', continent: 'continent-north-america' },
  Caribbean: { region: 'caribbean', continent: 'continent-north-america' },
  'South America': { region: 'south-america', continent: 'continent-south-america' },
  'Middle East & Central Asia': { region: 'middle-east-central-asia', continent: 'continent-asia' },
  'South & East Asia': { region: 'south-east-asia', continent: 'continent-asia' },
  'Southeast Asia': { region: 'southeast-asia', continent: 'continent-asia' },
  'North & West Africa': { region: 'north-west-africa', continent: 'continent-africa' },
  'Central & Southern Africa': { region: 'central-southern-africa', continent: 'continent-africa' },
  'East Africa': { region: 'east-africa', continent: 'continent-africa' },
  Oceania: { region: 'oceania', continent: 'continent-oceania' },
};

const FRAME_IDS = new Set(FRAMES.map((f) => f.id));
export const isFrameId = (id: string) => FRAME_IDS.has(id);

export function groupFrames(item: Item): { region: string; continent: string } {
  const frames = GROUP_FRAMES[item.group];
  if (!frames) throw new Error(`No map frames for group "${item.group}" (${item.key})`);
  return frames;
}

/** Find at recall is asked on the continent; everything else on the item's region (spec §6). */
export function frameFor(item: Item, promptType: string | null, rung: QuestionRung): string {
  const { region, continent } = groupFrames(item);
  return promptType === 'find' && rung === 3 ? continent : region;
}
```

(Extents are first guesses; Task 4's validation is the judge, and adjusting an extent there is expected.)

- [ ] **Step 5: Run** `npx vitest run lib/map` — PASS.
- [ ] **Step 6: Commit** `feat(map): frames, hit-testing and click grading`.

---

### Task 4: Map geometry build + validation

**Files:**
- Create: `scripts/map-config.ts`, `scripts/lib/maps/build-maps.ts`, `scripts/types/polylabel.d.ts`, `lib/map/content.test.ts`
- Modify: `scripts/build-content.ts`
- Generate: `public/maps/<frame>.svg` (19), `content/maps/<frame>.hit.json` (19), `content/maps/world-atlas.json`

**Interfaces:**
- Consumes: `FRAMES`, `GROUP_FRAMES`, `FRAME_WIDTH`, `hitTest`, `FrameData` (Task 3); `CountryRecord` (Task 1).
- Produces: `buildMaps(records): { frames: { def: FrameDef; svg: string; data: FrameData }[]; atlas: AtlasData; errors: string[] }`; `AtlasData = { width; height; land: string; borders: string; countries: Record<string, { d: string; marker?: MarkerShape }> }` (exported from `lib/map/types.ts`).

- [ ] **Step 1: Config** — `scripts/map-config.ts`:

```ts
import type { Extent } from '../lib/map/frames';

/** world-atlas features with no ISO numeric id, by name. null = drawn, never clickable. */
export const FEATURE_NAME_KEYS: Record<string, string | null> = {
  Kosovo: 'XK',
  Somaliland: 'SO',
  'N. Cyprus': 'CY',
  'Indian Ocean Ter.': null,
  'Siachen Glacier': null,
};

/** Territories carved out of a parent's multipolygon: parts whose first vertex lies in `bbox`. */
export const SPLITS: { key: string; from: string; bbox: Extent }[] = [
  { key: 'GF', from: 'FR', bbox: [-55, 1.5, -51, 6.5] },
];

/** Course items missing from the 1:50m data: a marker at their world-countries latlng. */
export const MARKER_ONLY_KEYS = ['TV'];

/** A country whose largest part projects smaller than this (viewBox units) gets a marker. */
export const MARKER_BELOW = 8;
export const MARKER_R = 4;
/** Visvalingam threshold, in square viewBox units, per frame. */
export const SIMPLIFY_AREA = 0.6;
export const BASE_SVG_MAX_BYTES = 80 * 1024;

export const MAP_COLORS = { sea: '#d6e3e6', land: '#f5f0e3', coast: '#8f8775', border: '#b3a991' };
```

- [ ] **Step 2: Failing content test** — `lib/map/content.test.ts` (reads committed outputs; runs in the normal unit suite):

```ts
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import countries from '@/content/countries.json';
import type { CountryRecord } from '@/lib/content/types';
import { FRAMES, GROUP_FRAMES } from './frames';
import { hitTest } from './hit-test';
import type { FrameData } from './types';

const records = countries as CountryRecord[];
const frame = (id: string): FrameData =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content', 'maps', `${id}.hit.json`), 'utf8'));
const svg = (id: string) => fs.readFileSync(path.join(process.cwd(), 'public', 'maps', `${id}.svg`), 'utf8');

describe('committed map frames', () => {
  it.each(FRAMES.map((f) => f.id))('%s: base SVG is small and anonymous', (id) => {
    const s = svg(id);
    expect(Buffer.byteLength(s)).toBeLessThanOrEqual(80 * 1024);
    expect(s).not.toMatch(/\b(id|class|data-[\w-]+)=|<title|<text|<desc/);
    for (const r of records) expect(s).not.toContain(r.name);
  });

  it('every item hit-tests back to itself in its region and continent frames', () => {
    const failures: string[] = [];
    for (const r of records) {
      for (const id of Object.values(GROUP_FRAMES[r.group])) {
        const f = frame(id);
        const s = f.countries[r.key];
        if (!s) failures.push(`${r.key} missing from ${id}`);
        else if (hitTest(f, s.label[0] / f.width, s.label[1] / f.height, f.width) !== r.key) failures.push(`${r.key} label misses in ${id}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('never puts non-items in hit data', () => {
    const keys = new Set(records.map((r) => r.key));
    for (const f of FRAMES) for (const k of Object.keys(frame(f.id).countries)) expect(keys.has(k)).toBe(true);
  });
});
```

- [ ] **Step 3: Run** it — FAIL (no files).

- [ ] **Step 4: Implement** `scripts/lib/maps/build-maps.ts`. Outline (full code in the commit):
  1. Load `world-atlas/countries-50m.json`; `presimplify(topology, sphericalTriangleArea)` once.
  2. `keyOf(geometry)`: record by `ccn3 === id`, else `FEATURE_NAME_KEYS[name]`, else null (warn for unknown names). Records not in the course (EH, other territories) → null.
  3. Per frame: projection = `geoAzimuthalEqualArea().rotate([-lon0, -lat0]).fitWidth(FRAME_WIDTH, perimeter(extent))`; height = `ceil` of the perimeter's projected bottom; `clipExtent([[0,0],[W,H]])`. Simplify with `minWeight = SIMPLIFY_AREA / scale²` (steradians per square unit).
  4. Features → keyed MultiPolygons (merge parts with the same key; apply `SPLITS`). Land = `merge` of all geometries except Antarctica; borders = `mesh` where the two sides' keys (or names, for null keys) differ.
  5. For each key: project polygons through a custom stream sink into flat rings rounded to 0.1; drop empty; `bbox`; label = `polylabel` of the largest ring with every ring inside it as a hole; `marker` when the largest ring's bbox is under `MARKER_BELOW`; `outline` = `geoPath(projection).digits(1)` + circle path for markers. `MARKER_ONLY_KEYS` project their `latlng` and get only a marker.
  6. SVG: sea rect, land path (coast stroke), borders path, marker dots; `vector-effect="non-scaling-stroke"`; no ids.
  7. Atlas: `geoEqualEarth().fitWidth(1000, sphere)` with world-scale simplification; per key `d` (+ marker).
  8. Validation into `errors`: size, anonymity, every record present in its two frames, label hit-test round trip (same checks as the content test).

`scripts/build-content.ts` calls `buildMaps(countries)`, throws if `errors.length`, then writes `public/maps/*.svg`, `content/maps/*.hit.json` (compact JSON), `content/maps/world-atlas.json`, and logs sizes.

- [ ] **Step 5: Build and iterate.** `npm run content:build`. Fix failures by adjusting frame extents, `FEATURE_NAME_KEYS`, `MARKER_ONLY_KEYS` or `SIMPLIFY_AREA`. Open three SVGs (Caribbean, Europe continent, Oceania) and look at them.
- [ ] **Step 6: Run** `npx vitest run` and `npm run typecheck` — PASS.
- [ ] **Step 7: Commit** `feat(content): World Map frames, base maps and hit data`.

---

### Task 5: `WORLD_MAP` course

**Files:**
- Create: `lib/content/world-map.ts`, `lib/content/world-map.test.ts`
- Modify: `lib/content/registry.ts`, `lib/content/registry.test.ts`

**Interfaces:**
- Produces: `WORLD_MAP: CourseDef`, `capitalNote(key): string | null`.

- [ ] **Step 1: Failing tests:**

```ts
describe('WORLD_MAP', () => {
  it('has 208 items, three prompt types, placement on Find graduating Find + Name', () => {
    expect(WORLD_MAP.items).toHaveLength(208);
    expect(WORLD_MAP.promptTypes.map((p) => p.id)).toEqual(['find', 'name', 'capital']);
    expect(WORLD_MAP).toMatchObject({ placementPromptType: 'find', placementGraduates: ['find', 'name'] });
    expect(WORLD_MAP.items.map((i) => i.key)).toEqual(expect.arrayContaining(['GL', 'PR', 'GF']));
  });
  it('uses neighbours, then nearby, as look-alikes', () => {
    const bo = WORLD_MAP.items.find((i) => i.key === 'BO')!;
    expect(bo.lookalikes.slice(0, 5).sort()).toEqual(['AR', 'BR', 'CL', 'PE', 'PY']);
  });
  it('carries capitals as the capital answer', () => {
    expect(WORLD_MAP.items.find((i) => i.key === 'BO')!.answers!.capital).toEqual({ text: 'Sucre', aliases: ['La Paz'] });
    expect(capitalNote('BO')).toMatch(/seat of government/);
  });
  it('is registered', () => {
    expect(getCourse('world-map')).toBe(WORLD_MAP);
  });
});
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement:**

```ts
import countries from '@/content/countries.json';
import type { CourseDef } from '@/lib/engine/types';
import { MAP_PROMPT_TYPES } from './map-prompts';
import type { CountryRecord } from './types';

const records = countries as CountryRecord[];
const notes = new Map(records.map((c) => [c.key, c.capitalNote]));

export const WORLD_MAP: CourseDef = {
  slug: 'world-map',
  title: 'World Map',
  placementPromptType: 'find',
  placementGraduates: ['find', 'name'],
  promptTypes: MAP_PROMPT_TYPES,
  items: records.map((c) => ({
    key: c.key,
    name: c.name,
    aliases: c.aliases,
    group: c.group,
    groupOrder: c.groupOrder,
    itemOrder: c.itemOrder,
    lookalikes: [...new Set([...c.neighbors, ...c.nearby])],
    answers: { capital: { text: c.capital, aliases: c.capitalAliases } },
  })),
};

export const capitalNote = (key: string): string | null => notes.get(key) ?? null;
```

Register in `registry.ts`. **Step 4:** run tests — PASS. **Step 5: Commit** `feat(content): register the World Map course`.

---

### Task 6: Services — point answers, frames, map presenter

**Files:**
- Create: `lib/map/support.ts`, `lib/map/load.ts`, `lib/study/map-presenter.ts`, `lib/study/map-presenter.test.ts`
- Modify: `lib/study/{types,validate,issue,turn,present,presenters,context,placement-service,study-service,exam-service,test-helpers}.ts` + tests, `lib/server/context.ts`, `next.config.ts`

**Interfaces:**
- Produces: `AnswerResponse` += `{ kind: 'point'; x: number; y: number; width: number }`; `PendingQuestion.frame?: string`; `MapView = { baseUrl: string; width: number; height: number; highlight?: string; candidates?: { id: string; d: string; labelX: number; labelY: number }[] }`; `QuestionView.map?: MapView`; `QuestionView.prompt.question?: string`; `ItemView.capital?: string; capitalNote?: string`; `FeedbackView.map?: { baseUrl; width; height; correct: string; given?: string }`.
- Produces: `MapSupport { frameFor(entry: QueueEntry, rung: QuestionRung): string | undefined; load(id: string): FrameData }`, `mapSupport(course, load)`, `loadFrame(id)`, `ServiceContext.maps?: MapSupport`, `getMapSupport(course)`.
- Produces: `Presenter.choice(itemKey, format, promptType?)`, optional `Presenter.map?(pending)`, `Presenter.feedbackMap?(pending, grade)`.
- Produces: `gradeSubmission(pending, response, course, maps?)`, `issueQuestion({..., maps?})`.

- [ ] **Step 1: Failing tests.**

`validate.test.ts`:

```ts
it('accepts a well-formed point', () => {
  expect(parseSubmission({ ...ids, response: { kind: 'point', x: 0.5, y: 0, width: 800 } }).response).toEqual({ kind: 'point', x: 0.5, y: 0, width: 800 });
});
it.each([
  { x: Number.NaN, y: 0.5, width: 800 },
  { x: 1.01, y: 0.5, width: 800 },
  { x: 0.5, y: -0.1, width: 800 },
  { x: 0.5, y: 0.5, width: 99 },
  { x: 0.5, y: 0.5, width: 4001 },
  { x: '0.5', y: 0.5, width: 800 },
])('rejects a malformed point %o', (p) => {
  expect(() => parseSubmission({ ...ids, response: { kind: 'point', ...p } })).toThrow('invalid_response');
});
```

`issue.test.ts` (with a synthetic `MapSupport` over a fixture frame containing EC, CO, VE, PE, US):

```ts
it('records the frame and keeps map-pick distractors inside it', () => {
  const p = issueQuestion({ entry: { kind: 'prompt', itemKey: 'EC', promptType: 'find' }, rung: 2, course: TEST_MAP_COURSE,
    confusions: [{ asked: 'EC', answered: 'IN', count: 5 }], rng: seededRng(1), now: NOW, newId: randomUUID, maps: FIXTURE_MAPS });
  expect(p.frame).toBe('south-america');
  expect(p.choices.map((c) => c.itemKey).every((k) => ['EC', 'CO', 'VE', 'PE', 'US'].includes(k))).toBe(true);
});
it('grades a click against the issued frame', () => { /* EC label → correct; CO label → confusion CO; ocean → wrong null */ });
it('rejects a point for a typed question and typed text for a click question', () => { /* invalid_response */ });
it('grades a typed capital via the answer field', () => {
  const p = issueQuestion({ entry: { kind: 'prompt', itemKey: 'EC', promptType: 'capital' }, rung: 3, course: TEST_MAP_COURSE, confusions: [], rng: seededRng(1), now: NOW, newId: randomUUID });
  expect(gradeSubmission(p, { kind: 'typed', text: 'quito' }, TEST_MAP_COURSE).correct).toBe(true);
});
```

`map-presenter.test.ts` — leak rules over `TEST_MAP_COURSE` and the fixture maps:

```ts
it('Find shows only the target name, numbered candidates with no labels', ...);   // map-pick
it('Find at recall shows the continent base map and no overlays', ...);          // map-click
it('Name and Capital show a highlight and no names except choice labels', ...);   // mc-text: labels are capitals for capital
it('typed recall shows no names at all', ...);
it('never includes item keys', ...);                                              // expectNoKeys over every view
it('feedback outlines the correct and the clicked country', ...);
it('a contrast drill uses a frame that contains both countries', ...);
```

Plus one test over real data: `getPresenter(WORLD_MAP)` view for a Capital question on BO contains neither "Bolivia" nor "BO" outside choice labels.

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.**

`lib/map/support.ts`:

```ts
import { getItem, type CourseDef, type QueueEntry, type QuestionRung } from '@/lib/engine';
import { frameFor, groupFrames } from './frames';
import type { FrameData } from './types';

export interface MapSupport {
  /** The frame a question is asked on, chosen at issue time; undefined = no map. */
  frameFor(entry: QueueEntry, rung: QuestionRung): string | undefined;
  load(frameId: string): FrameData;
}

export function mapSupport(course: CourseDef, load: (frameId: string) => FrameData): MapSupport {
  return {
    load,
    frameFor(entry, rung) {
      const item = getItem(course, entry.itemKey);
      if (entry.kind !== 'contrast') return frameFor(item, entry.kind === 'prompt' ? entry.promptType : null, rung);
      // A confusion can span regions (a continent-frame click): use the first frame showing both.
      const other = getItem(course, entry.otherKey);
      const candidates = [...Object.values(groupFrames(item)), ...Object.values(groupFrames(other))];
      return candidates.find((id) => {
        const { countries } = load(id);
        return Object.hasOwn(countries, item.key) && Object.hasOwn(countries, other.key);
      });
    },
  };
}
```

`lib/map/load.ts`:

```ts
import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { isFrameId } from './frames';
import type { FrameData } from './types';

const DIR = path.join(process.cwd(), 'content', 'maps');
const cache = new Map<string, FrameData>();

/** Server-only hit data for a frame (content/maps/<id>.hit.json), cached per process. */
export function loadFrame(id: string): FrameData {
  if (!isFrameId(id)) throw new Error(`Unknown map frame ${id}`);
  let frame = cache.get(id);
  if (!frame) {
    frame = JSON.parse(fs.readFileSync(path.join(DIR, `${id}.hit.json`), 'utf8')) as FrameData;
    cache.set(id, frame);
  }
  return frame;
}
```

`validate.ts` — new case:

```ts
    case 'point': {
      const unit = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
      const { x, y, width } = value;
      return unit(x) && unit(y) && typeof width === 'number' && Number.isFinite(width) && width >= MIN_MAP_WIDTH && width <= MAX_MAP_WIDTH
        ? { kind: 'point', x, y, width }
        : invalid();
    }
```

with `MIN_MAP_WIDTH = 100`, `MAX_MAP_WIDTH = 4000`.

`issue.ts`:

```ts
export function issueQuestion(args: { ...; maps?: MapSupport }): PendingQuestion {
  const { entry, rung, course, confusions, rng, now, newId, maps } = args;
  const frame = maps?.frameFor(entry, rung);
  const shown = frame ? maps!.load(frame).countries : undefined;
  const question = buildQuestion({ entry, rung, course, confusions, rng, eligible: shown ? (k) => Object.hasOwn(shown, k) : undefined });
  return {
    questionId: newId(), entry, rung, format: question.format,
    choices: (question.choiceKeys ?? []).map((itemKey) => ({ id: newId(), itemKey })),
    issuedAt: now.toISOString(),
    ...(frame ? { frame } : {}),
  };
}

export function gradeSubmission(pending: PendingQuestion, response: AnswerResponse, course: CourseDef, maps?: MapSupport): AnswerGrade {
  const { entry } = pending;
  const target = entry.itemKey;
  switch (response.kind) {
    case 'dont-know':
      return { correct: false, typo: false, answeredItemKey: null };
    case 'typed': {
      if (pending.format !== 'typed' || entry.kind !== 'prompt') throw new ServiceError('invalid_response');
      const field = course.promptTypes.find((p) => p.id === entry.promptType)?.answerField ?? 'name';
      return gradeTyped(response.text, getItem(course, target), course.items, field);
    }
    case 'point':
      if (pending.format !== 'map-click' || !pending.frame || !maps) throw new ServiceError('invalid_response');
      return gradeClick(target, maps.load(pending.frame), response);
    case 'choice': ...unchanged
  }
}
```

`turn.ts`: `issue()` passes `maps: ctx.maps`; `feedbackFor` adds `...(map ? { map } : {})` from `ctx.presenter.feedbackMap?.(pending, grade)`; a `grade(ctx, pending, response)` helper wraps `gradeSubmission(pending, response, ctx.course, ctx.maps)` and the three services use it.

`present.ts`: `choice(key, format, promptType?)`; `toQuestionView` passes the prompt type and adds `map` when `presenter.map?.(pending)` returns one.

`lib/study/map-presenter.ts`:

```ts
import { getItem, type AnswerGrade, type CourseDef } from '@/lib/engine';
import type { MapSupport } from '@/lib/map/support';
import type { Presenter } from './present';
import type { FeedbackView, MapView, PendingQuestion } from './types';

export function mapPresenter(
  course: CourseDef,
  deps: { flag: (key: string) => string; capitalNote: (key: string) => string | null; maps: MapSupport },
): Presenter {
  const { flag, capitalNote, maps } = deps;
  const name = (key: string) => getItem(course, key).name;
  const capital = (key: string) => getItem(course, key).answers?.capital?.text;
  const base = (frame: string): MapView => {
    const { width, height } = maps.load(frame);
    return { baseUrl: `/maps/${frame}.svg`, width, height };
  };
  const shape = (frame: string, key: string) => maps.load(frame).countries[key];

  return {
    prompt: (entry) =>
      entry.promptType === 'find'
        ? { name: name(entry.itemKey) }
        : { question: entry.promptType === 'capital' ? "What's its capital?" : 'Which country is this?' },
    choice: (key, format, promptType) => {
      if (format === 'map-pick') return {};
      return { label: promptType === 'capital' ? capital(key) : name(key) };
    },
    item: (key) => {
      const note = capitalNote(key);
      return { name: name(key), flag: flag(key), capital: capital(key), ...(note ? { capitalNote: note } : {}) };
    },
    map(pending: PendingQuestion) {
      const { frame, entry } = pending;
      if (!frame) return undefined;
      if (pending.format === 'map-click') return base(frame);
      if (pending.format === 'map-pick' || entry.kind === 'contrast') {
        return {
          ...base(frame),
          candidates: pending.choices.map((c) => {
            const s = shape(frame, c.itemKey);
            return { id: c.id, d: s.outline, labelX: s.label[0], labelY: s.label[1] };
          }),
        };
      }
      return { ...base(frame), highlight: shape(frame, entry.itemKey).outline };
    },
    feedbackMap(pending: PendingQuestion, grade: AnswerGrade): FeedbackView['map'] {
      if (!pending.frame) return undefined;
      const given = grade.answeredItemKey ? shape(pending.frame, grade.answeredItemKey)?.outline : undefined;
      return { ...base(pending.frame), correct: shape(pending.frame, pending.entry.itemKey).outline, ...(given ? { given } : {}) };
    },
  };
}
```

`presenters.ts`: `case 'world-map': return mapPresenter(course, { flag: flagDataUri, capitalNote, maps: getMapSupport(course)! });` and `export function getMapSupport(course) { return course.slug === WORLD_MAP.slug ? mapSupport(course, loadFrame) : undefined; }`. `ServiceContext.maps?: MapSupport`; `createServiceContext` sets `maps: getMapSupport(course)`. `next.config.ts` traces `./content/maps/**/*`.

`test-helpers.ts`: `testContext` accepts `maps`; `correctResponse(pending, course, maps?)` answers typed prompts with the prompt's answer field and map-click with the target's label point normalized.

- [ ] **Step 4: Run** `npx vitest run` and `npm run typecheck`, `npm run lint` — PASS.
- [ ] **Step 5: Commit** `feat(study): point answers, map frames and the map presenter`.

---

### Task 7: Simulation and Supabase flow

**Files:**
- Create: `lib/content/world-map.simulation.test.ts`, `lib/study/map-flow.int.test.ts`

- [ ] **Step 1: Simulation** (unit suite): a perfect learner on `WORLD_MAP` finishes placement (every item correct), then studies two 20-answer sessions a day. Every first Capital answer for `BO` is "Lima" twice (confusion with PE).

```ts
it('graduates Find + Name in placement and leaves every Capital new', ...);
it('introduces capitals of placed items and never re-asks placement prompts as new', ...);
it('records the BO→PE capital confusion and queues a contrast drill', ...);
it('has most capitals in review after 30 days', () => expect(capitalsInReview).toBeGreaterThanOrEqual(150));
```

(Calibrate the 150 against an actual run and record the observed number in the test comment.)

- [ ] **Step 2: Integration** (`npm run test:integration`, hosted dev DB): enroll in `world-map`; placement by clicking each target's label point with `getMapSupport`; one deliberate wrong click (a neighbour) records a confusion; status is `learning` with `readiness.graduated === 2 × 208 − 2`… then seed the remaining prompts to `review` via the admin client and sit the exam with correct clicks and typed answers; expect `passed`.
- [ ] **Step 3: Run** both suites — PASS.
- [ ] **Step 4: Commit** `test(map): learner simulation and Supabase flow for World Map`.

---

### Task 8: Verification and hand-off

- [ ] `npm test`, `npm run typecheck`, `npm run lint`, `npm run test:integration`, `npm run build` — all green.
- [ ] Note for Plan 6 (UI): the dashboard lists every registered course, so the World Map card appears as soon as this merges; Plan 6 must land the renderers (`map-pick`, `map-click`, `Prompt` with `view.map`, feedback outlines, mastery map) before it ships.
