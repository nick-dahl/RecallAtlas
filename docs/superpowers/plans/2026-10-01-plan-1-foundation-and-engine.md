# Recall Atlas — Plan 1: Foundation, Content Pipeline & Adaptive Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Next.js app, generate World Flags content from open data, and build the complete adaptive learning engine as a pure, fully tested TypeScript module.

**Architecture:** `lib/engine/` is framework-free: plain data in, plain data out, with `now` and `rng` injected so every rule is deterministic and unit-testable. `scripts/` turns `world-countries` + `flag-icons` into committed `content/countries.json` and `public/flags/*.svg`. `lib/content/` turns that JSON into a `CourseDef` the engine consumes. No database, auth or UI in this plan.

**Tech Stack:** Next.js 16, TypeScript (strict), Tailwind, Vitest 5, ts-fsrs 5, tsx, world-countries 5, flag-icons 7.

**Spec:** `docs/superpowers/specs/2026-10-01-recall-atlas-design.md`

**Plan series:**
- **Plan 1 (this):** foundation, content, engine.
- **Plan 2:** Supabase schema + RLS, auth, server actions wiring the engine to persistence (written after Plan 1 lands).
- **Plan 3:** UI (dashboard, course home, players, exercise renderers), e2e, Vercel deploy.

**Conventions:**
- Work in `C:\Users\nickd\dev\recall-atlas`. Commands are written for PowerShell; all `npm`/`npx`/`git` commands also work in bash.
- Tests are colocated: `foo.ts` ↔ `foo.test.ts`.
- Engine files never import React, Next or Supabase, and never call `Date.now()` / `Math.random()` directly.

---

## File map

| File | Responsibility |
|---|---|
| `vitest.config.mts` | Test runner config, `@/` alias |
| `lib/engine/types.ts` | All shared engine types |
| `lib/engine/config.ts` | Every tunable constant |
| `lib/engine/random.ts` | Seeded RNG, `shuffle`, `randInt` |
| `lib/engine/state.ts` | Prompt-state constructors, keys, lookups |
| `lib/engine/grading.ts` | `normalize`, `levenshtein`, `gradeTyped`, `gradeChoice` |
| `lib/engine/ladder.ts` | Rung transitions in the learning phase |
| `lib/engine/scheduler.ts` | ts-fsrs wrapper: graduate, review, due, retrievability |
| `lib/engine/confusion.ts` | Confusion pair bookkeeping |
| `lib/engine/distractors.ts` | Choosing wrong options for MC / flag grids |
| `lib/engine/question.ts` | Turning a queue entry into a renderable `Question` |
| `lib/engine/session.ts` | Dynamic study-session picker |
| `lib/engine/answer.ts` | Applying intro / answer / contrast results in a study session |
| `lib/engine/queue.ts` | Fixed-queue sessions (placement, exam) |
| `lib/engine/placement.ts` | Placement sweep |
| `lib/engine/exam.ts` | Exam readiness, building, scoring |
| `lib/engine/progress.ts` | Enrollment status, readiness, retention health, tile states |
| `lib/engine/index.ts` | Public barrel |
| `lib/engine/test-fixtures.ts` | 17-item test course + time helpers (tests only) |
| `lib/engine/simulation.test.ts` | Multi-week learner simulation |
| `lib/content/types.ts` | `CountryRecord` (shape of `content/countries.json`) |
| `lib/content/flag-prompts.ts` | World Flags prompt types and rung formats |
| `lib/content/world-flags.ts` | World Flags `CourseDef` |
| `lib/content/registry.ts` | `getCourse(slug)` |
| `scripts/content-config.ts` | Country set, region groups, alias overrides, flag look-alikes |
| `scripts/lib/build-countries.ts` | Pure transform: raw countries → `CountryRecord[]` + validation |
| `scripts/build-content.ts` | CLI: writes `content/countries.json`, copies flag SVGs |

---

### Task 1: Scaffold the project

**Files:**
- Create: Next.js scaffold (via CLI), `vitest.config.mts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Generate the Next.js app into the existing repo**

The repo already contains `.git` and `docs/`; `create-next-app` allows both.

```powershell
cd C:\Users\nickd\dev\recall-atlas
npx create-next-app@16 . --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes
```

Expected: ends with `Success! Created recall-atlas`. `app/`, `package.json`, `tsconfig.json` now exist. If it prompts for anything else, accept the default.

- [ ] **Step 2: Install engine and tooling dependencies**

```powershell
npm install ts-fsrs@^5.4.2
npm install -D vitest@^5.0.3 tsx world-countries@^5.1.0 flag-icons@^7.5.0
```

Expected: both commands finish without `ERR!`.

- [ ] **Step 3: Add Vitest config**

Create `vitest.config.mts`:

```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': root } },
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
  },
});
```

- [ ] **Step 4: Add npm scripts**

In `package.json`, add these entries to `"scripts"` (keep the generated `dev`, `build`, `start`, `lint`):

```json
"test": "vitest run --passWithNoTests",
"test:watch": "vitest",
"typecheck": "tsc --noEmit",
"content:build": "tsx scripts/build-content.ts"
```

- [ ] **Step 5: Verify the toolchain**

```powershell
npm test
npm run typecheck
npm run build
```

Expected: `npm test` prints `No test files found, exiting with code 0`; typecheck exits 0; build ends with the route table and no errors.

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "chore: scaffold Next.js app with Vitest and engine deps"
```

---

### Task 2: Engine types, config, and seeded randomness

**Files:**
- Create: `lib/engine/types.ts`, `lib/engine/config.ts`, `lib/engine/random.ts`
- Test: `lib/engine/random.test.ts`

- [ ] **Step 1: Create the shared types**

Create `lib/engine/types.ts`:

```ts
import type { Card } from 'ts-fsrs';

export type Phase = 'new' | 'learning' | 'review';
/** 0 = Introduce, 1 = Recognize, 2 = Discriminate, 3 = Recall */
export type Rung = 0 | 1 | 2 | 3;
/** Rungs that produce a graded question. */
export type QuestionRung = 1 | 2 | 3;
export type Format = 'intro' | 'mc-text' | 'flag-grid' | 'typed' | 'contrast';
export type DistractorMode = 'random' | 'hard';
/** Returns a float in [0, 1). Injected so the engine stays deterministic in tests. */
export type Rng = () => number;

export interface Item {
  key: string;
  name: string;
  aliases: string[];
  group: string;
  groupOrder: number;
  itemOrder: number;
  /** Keys of statically similar items (seed confusions). */
  lookalikes: string[];
}

export interface FormatSpec {
  format: 'mc-text' | 'flag-grid' | 'typed';
  /** Total options shown, including the correct one. Omitted for typed. */
  choices?: number;
  distractors?: DistractorMode;
}

export interface PromptTypeDef {
  id: string;
  label: string;
  formats: Record<QuestionRung, FormatSpec>;
}

export interface CourseDef {
  slug: string;
  title: string;
  placementPromptType: string;
  promptTypes: PromptTypeDef[];
  items: Item[];
}

export interface PromptState {
  itemKey: string;
  promptType: string;
  phase: Phase;
  rung: Rung;
  /** Consecutive correct answers at the current rung. */
  streak: number;
  /** FSRS card; null until the prompt first graduates. */
  fsrs: Card | null;
}

export interface Confusion {
  asked: string;
  answered: string;
  count: number;
}

export type QueueEntry =
  | { kind: 'intro'; itemKey: string }
  | { kind: 'prompt'; itemKey: string; promptType: string }
  | { kind: 'contrast'; itemKey: string; otherKey: string };

export type PromptEntry = Extract<QueueEntry, { kind: 'prompt' }>;

export interface Question {
  entry: QueueEntry;
  format: Format;
  /** Item keys to show as options (already shuffled). Absent for intro/typed. */
  choiceKeys?: string[];
}

export interface AnswerGrade {
  correct: boolean;
  /** True when accepted only thanks to typo tolerance. */
  typo: boolean;
  /** For wrong answers: the other item the user's answer resolved to, if any. */
  answeredItemKey: string | null;
}
```

- [ ] **Step 2: Create the tunable config**

Create `lib/engine/config.ts`:

```ts
export const ENGINE_CONFIG = {
  /** Graded answers per study session. */
  sessionSize: 20,
  maxNewItemsPerSession: 5,
  /** New items are only introduced while fewer than this many prompts are in learning. */
  maxLearningPrompts: 15,
  /** The last N distinct items served are ineligible for the next pick. */
  cooldownItems: 3,
  /** Consecutive correct answers needed to leave each rung. */
  climbStreak: { 1: 1, 2: 2, 3: 1 } as Record<1 | 2 | 3, number>,
  /** Rung a prompt returns to after forgetting it in review. */
  lapseRung: 2 as const,
  /** Confusion count at which a contrast drill is queued. */
  contrastThreshold: 2,
  desiredRetention: 0.9,
  retentionNudgeBelow: 0.9,
  /** FSRS stability (days) at which an item counts as "strong" on the mastery grid. */
  strongStabilityDays: 21,
  typoShortMax: 1,
  typoLongMax: 2,
  typoLongMinLength: 8,
} as const;
```

- [ ] **Step 3: Write the failing random tests**

Create `lib/engine/random.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { randInt, seededRng, shuffle } from './random';

describe('seededRng', () => {
  it('is deterministic for the same seed', () => {
    const a = seededRng(42);
    const b = seededRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('differs across seeds and stays in [0, 1)', () => {
    const a = seededRng(1);
    const b = seededRng(2);
    expect(a()).not.toEqual(b());
    const r = seededRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('randInt', () => {
  it('stays within inclusive bounds and hits both ends', () => {
    const r = seededRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(randInt(r, 3, 5));
    expect([...seen].sort()).toEqual([3, 4, 5]);
  });
});

describe('shuffle', () => {
  it('returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffle(input, seededRng(9));
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(input);
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npx vitest run lib/engine/random.test.ts`
Expected: FAIL — `Failed to resolve import "./random"`.

- [ ] **Step 5: Implement**

Create `lib/engine/random.ts`:

```ts
import type { Rng } from './types';

/** mulberry32: small, fast, good-enough PRNG for deterministic tests. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run lib/engine/random.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```powershell
git add lib/engine
git commit -m "feat(engine): add core types, config, and seeded RNG"
```

---

### Task 3: Flag prompt types, state helpers, and test fixtures

**Files:**
- Create: `lib/content/flag-prompts.ts`, `lib/engine/state.ts`, `lib/engine/test-fixtures.ts`
- Test: `lib/engine/state.test.ts`

- [ ] **Step 1: Define the World Flags prompt types**

Create `lib/content/flag-prompts.ts`:

```ts
import type { PromptTypeDef } from '@/lib/engine/types';

export const FLAG_PROMPT_TYPES: PromptTypeDef[] = [
  {
    id: 'flag_to_name',
    label: 'Flag → Name',
    formats: {
      1: { format: 'mc-text', choices: 4, distractors: 'random' },
      2: { format: 'mc-text', choices: 6, distractors: 'hard' },
      3: { format: 'typed' },
    },
  },
  {
    id: 'name_to_flag',
    label: 'Name → Flag',
    formats: {
      1: { format: 'flag-grid', choices: 4, distractors: 'random' },
      2: { format: 'flag-grid', choices: 6, distractors: 'hard' },
      3: { format: 'flag-grid', choices: 8, distractors: 'hard' },
    },
  },
];
```

- [ ] **Step 2: Create test fixtures**

Create `lib/engine/test-fixtures.ts`:

```ts
import { FLAG_PROMPT_TYPES } from '@/lib/content/flag-prompts';
import type { CourseDef, Item } from './types';

function item(
  key: string,
  name: string,
  aliases: string[],
  group: string,
  groupOrder: number,
  itemOrder: number,
  lookalikes: string[] = [],
): Item {
  return { key, name, aliases, group, groupOrder, itemOrder, lookalikes };
}

export const ITEMS: Item[] = [
  item('US', 'United States', ['USA', 'United States of America'], 'North & Central America', 1, 1),
  item('EC', 'Ecuador', [], 'South America', 2, 1, ['CO', 'VE']),
  item('CO', 'Colombia', [], 'South America', 2, 2, ['EC', 'VE']),
  item('VE', 'Venezuela', [], 'South America', 2, 3, ['CO', 'EC']),
  item('PE', 'Peru', [], 'South America', 2, 4),
  item('TD', 'Chad', [], 'Central & Southern Africa', 3, 1, ['RO']),
  item('RO', 'Romania', [], 'Southern & Eastern Europe', 4, 1, ['TD']),
  item('NE', 'Niger', [], 'North & West Africa', 5, 1, ['IN']),
  item('NG', 'Nigeria', [], 'North & West Africa', 5, 2),
  item('CI', 'Ivory Coast', ["Côte d'Ivoire"], 'North & West Africa', 5, 3, ['IE']),
  item('GM', 'Gambia', ['The Gambia'], 'North & West Africa', 5, 4),
  item('IN', 'India', [], 'South & East Asia', 6, 1, ['NE']),
  item('IE', 'Ireland', [], 'Western & Northern Europe', 7, 1, ['CI']),
  item('DM', 'Dominica', [], 'Caribbean', 8, 1),
  item('DO', 'Dominican Republic', [], 'Caribbean', 8, 2),
  item('LC', 'Saint Lucia', [], 'Caribbean', 8, 3),
  item('MG', 'Madagascar', [], 'East Africa', 9, 1),
];

export const TEST_COURSE: CourseDef = {
  slug: 'test-flags',
  title: 'Test Flags',
  placementPromptType: 'flag_to_name',
  promptTypes: FLAG_PROMPT_TYPES,
  items: ITEMS,
};

export function fixtureItem(key: string): Item {
  const found = ITEMS.find((i) => i.key === key);
  if (!found) throw new Error(`No fixture item ${key}`);
  return found;
}

export const NOW = new Date('2026-10-01T12:00:00Z');

/** NOW shifted by whole days plus optional hours. */
export function days(n: number, hours = 0): Date {
  return new Date(NOW.getTime() + n * 86_400_000 + hours * 3_600_000);
}
```

- [ ] **Step 3: Write the failing state tests**

Create `lib/engine/state.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getItem, indexStates, initialStates, newPromptState, stateKey } from './state';
import { TEST_COURSE } from './test-fixtures';

describe('state helpers', () => {
  it('newPromptState starts new at rung 0 with no FSRS card', () => {
    expect(newPromptState('EC', 'flag_to_name')).toEqual({
      itemKey: 'EC',
      promptType: 'flag_to_name',
      phase: 'new',
      rung: 0,
      streak: 0,
      fsrs: null,
    });
  });

  it('initialStates creates one state per item × prompt type', () => {
    const states = initialStates(TEST_COURSE);
    expect(states).toHaveLength(TEST_COURSE.items.length * 2);
    expect(states.every((s) => s.phase === 'new')).toBe(true);
  });

  it('stateKey and indexStates round-trip', () => {
    const states = initialStates(TEST_COURSE);
    const idx = indexStates(states);
    expect(idx.get(stateKey('TD', 'name_to_flag'))?.itemKey).toBe('TD');
  });

  it('getItem throws for unknown keys', () => {
    expect(getItem(TEST_COURSE, 'EC').name).toBe('Ecuador');
    expect(() => getItem(TEST_COURSE, 'ZZ')).toThrow(/ZZ/);
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npx vitest run lib/engine/state.test.ts`
Expected: FAIL — `Failed to resolve import "./state"`.

- [ ] **Step 5: Implement**

Create `lib/engine/state.ts`:

```ts
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
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run lib/engine/state.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```powershell
git add lib/content lib/engine
git commit -m "feat(engine): add flag prompt types, state helpers, test fixtures"
```

---

### Task 4: Answer grading

**Files:**
- Create: `lib/engine/grading.ts`
- Test: `lib/engine/grading.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/engine/grading.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { gradeChoice, gradeTyped, levenshtein, normalize } from './grading';
import { fixtureItem, ITEMS } from './test-fixtures';

describe('normalize', () => {
  it.each([
    ['Côte d’Ivoire', 'cote divoire'],
    ["Côte d'Ivoire", 'cote divoire'],
    ['  The   Gambia ', 'gambia'],
    ['St. Lucia', 'saint lucia'],
    ['Guinea-Bissau', 'guinea bissau'],
    ['Bosnia & Herzegovina', 'bosnia and herzegovina'],
    ['São Tomé and Príncipe', 'sao tome and principe'],
  ])('%s → %s', (input, expected) => {
    expect(normalize(input)).toBe(expected);
  });
});

describe('levenshtein', () => {
  it('computes edit distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('peru', 'peru')).toBe(0);
  });
});

const grade = (input: string, key: string) => gradeTyped(input, fixtureItem(key), ITEMS);

describe('gradeTyped', () => {
  it('accepts exact names and aliases, case/diacritics-insensitive', () => {
    expect(grade('ecuador', 'EC')).toEqual({ correct: true, typo: false, answeredItemKey: null });
    expect(grade('USA', 'US')).toEqual({ correct: true, typo: false, answeredItemKey: null });
    expect(grade('cote divoire', 'CI')).toEqual({ correct: true, typo: false, answeredItemKey: null });
    expect(grade('St Lucia', 'LC')).toEqual({ correct: true, typo: false, answeredItemKey: null });
    expect(grade('the gambia', 'GM')).toEqual({ correct: true, typo: false, answeredItemKey: null });
  });

  it('accepts small typos and flags them', () => {
    expect(grade('Equador', 'EC')).toEqual({ correct: true, typo: true, answeredItemKey: null });
    expect(grade('Madagaskr', 'MG')).toEqual({ correct: true, typo: true, answeredItemKey: null });
    expect(grade('Nigerria', 'NG')).toEqual({ correct: true, typo: true, answeredItemKey: null });
  });

  it('rejects typos beyond tolerance', () => {
    expect(grade('Pary', 'PE')).toEqual({ correct: false, typo: false, answeredItemKey: null });
  });

  it('never accepts another item; reports it as the confusion', () => {
    expect(grade('Niger', 'NG')).toEqual({ correct: false, typo: false, answeredItemKey: 'NE' });
    expect(grade('Dominica', 'DO')).toEqual({ correct: false, typo: false, answeredItemKey: 'DM' });
    expect(grade('Romania', 'TD')).toEqual({ correct: false, typo: false, answeredItemKey: 'RO' });
  });

  it('lets another item win a typo tie', () => {
    // "nigera" is 1 edit from both "nigeria" and "niger"
    expect(grade('Nigera', 'NG')).toEqual({ correct: false, typo: false, answeredItemKey: 'NE' });
  });

  it('treats empty or unknown input as wrong with no confusion', () => {
    expect(grade('   ', 'EC')).toEqual({ correct: false, typo: false, answeredItemKey: null });
    expect(grade('xyzzy', 'EC')).toEqual({ correct: false, typo: false, answeredItemKey: null });
  });
});

describe('gradeChoice', () => {
  it('grades multiple-choice picks', () => {
    expect(gradeChoice('EC', 'EC')).toEqual({ correct: true, typo: false, answeredItemKey: null });
    expect(gradeChoice('CO', 'EC')).toEqual({ correct: false, typo: false, answeredItemKey: 'CO' });
    expect(gradeChoice(null, 'EC')).toEqual({ correct: false, typo: false, answeredItemKey: null });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/engine/grading.test.ts`
Expected: FAIL — `Failed to resolve import "./grading"`.

- [ ] **Step 3: Implement**

Create `lib/engine/grading.ts`:

```ts
import { ENGINE_CONFIG } from './config';
import type { AnswerGrade, Item } from './types';

export function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the /, '')
    .replace(/\bst\b/g, 'saint');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

function tolerance(normalizedName: string): number {
  return normalizedName.length < ENGINE_CONFIG.typoLongMinLength
    ? ENGINE_CONFIG.typoShortMax
    : ENGINE_CONFIG.typoLongMax;
}

function namesOf(item: Item): string[] {
  return [item.name, ...item.aliases].map(normalize).filter(Boolean);
}

/** Smallest edit distance to any of the item's names that is within tolerance, else null. */
function typoDistance(input: string, item: Item): number | null {
  let best: number | null = null;
  for (const name of namesOf(item)) {
    const d = levenshtein(input, name);
    if (d <= tolerance(name) && (best === null || d < best)) best = d;
  }
  return best;
}

const WRONG: AnswerGrade = { correct: false, typo: false, answeredItemKey: null };

export function gradeTyped(input: string, target: Item, allItems: readonly Item[]): AnswerGrade {
  const n = normalize(input);
  if (!n) return WRONG;
  if (namesOf(target).includes(n)) return { correct: true, typo: false, answeredItemKey: null };

  const others = allItems.filter((i) => i.key !== target.key);
  const exactOther = others.find((i) => namesOf(i).includes(n));
  if (exactOther) return { ...WRONG, answeredItemKey: exactOther.key };

  const targetDistance = typoDistance(n, target);
  let closestOther: { key: string; d: number } | null = null;
  for (const other of others) {
    const d = typoDistance(n, other);
    if (d !== null && (closestOther === null || d < closestOther.d)) closestOther = { key: other.key, d };
  }

  // Another item within tolerance wins ties (spec §6.9).
  if (targetDistance !== null && (closestOther === null || targetDistance < closestOther.d)) {
    return { correct: true, typo: true, answeredItemKey: null };
  }
  if (closestOther) return { ...WRONG, answeredItemKey: closestOther.key };
  return WRONG;
}

export function gradeChoice(choiceKey: string | null, targetKey: string): AnswerGrade {
  if (choiceKey === null) return WRONG;
  if (choiceKey === targetKey) return { correct: true, typo: false, answeredItemKey: null };
  return { ...WRONG, answeredItemKey: choiceKey };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/engine/grading.test.ts`
Expected: PASS (all normalize cases, levenshtein, 6 gradeTyped tests, gradeChoice).

- [ ] **Step 5: Commit**

```powershell
git add lib/engine
git commit -m "feat(engine): add typo-tolerant answer grading"
```

---

### Task 5: Difficulty ladder

**Files:**
- Create: `lib/engine/ladder.ts`
- Test: `lib/engine/ladder.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/engine/ladder.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyLearningAnswer, introduce } from './ladder';
import { newPromptState } from './state';
import type { PromptState, Rung } from './types';

const learning = (rung: Rung, streak = 0): PromptState => ({
  ...newPromptState('EC', 'flag_to_name'),
  phase: 'learning',
  rung,
  streak,
});

describe('introduce', () => {
  it('moves a new prompt to learning at rung 1', () => {
    expect(introduce(newPromptState('EC', 'flag_to_name'))).toMatchObject({ phase: 'learning', rung: 1, streak: 0 });
  });

  it('leaves non-new prompts untouched', () => {
    const s = learning(2, 1);
    expect(introduce(s)).toBe(s);
  });
});

describe('applyLearningAnswer', () => {
  it('climbs from rung 1 after one correct', () => {
    expect(applyLearningAnswer(learning(1), true)).toEqual({ state: learning(2, 0), outcome: 'climbed' });
  });

  it('needs two consecutive correct at rung 2', () => {
    const first = applyLearningAnswer(learning(2), true);
    expect(first).toEqual({ state: learning(2, 1), outcome: 'held' });
    expect(applyLearningAnswer(first.state, true)).toEqual({ state: learning(3, 0), outcome: 'climbed' });
  });

  it('signals graduation after a correct recall at rung 3', () => {
    expect(applyLearningAnswer(learning(3), true)).toEqual({ state: learning(3, 0), outcome: 'graduate' });
  });

  it('drops one rung and resets the streak on a miss', () => {
    expect(applyLearningAnswer(learning(3), false)).toEqual({ state: learning(2, 0), outcome: 'dropped' });
    expect(applyLearningAnswer(learning(2, 1), false)).toEqual({ state: learning(1, 0), outcome: 'dropped' });
  });

  it('never drops below rung 1', () => {
    expect(applyLearningAnswer(learning(1), false).state.rung).toBe(1);
  });

  it('rejects prompts that are not in learning', () => {
    expect(() => applyLearningAnswer(newPromptState('EC', 'flag_to_name'), true)).toThrow(/learning/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/engine/ladder.test.ts`
Expected: FAIL — `Failed to resolve import "./ladder"`.

- [ ] **Step 3: Implement**

Create `lib/engine/ladder.ts`:

```ts
import { ENGINE_CONFIG } from './config';
import type { PromptState, Rung } from './types';

export type LadderOutcome = 'climbed' | 'held' | 'dropped' | 'graduate';

export function introduce(state: PromptState): PromptState {
  if (state.phase !== 'new') return state;
  return { ...state, phase: 'learning', rung: 1, streak: 0 };
}

export function applyLearningAnswer(
  state: PromptState,
  correct: boolean,
): { state: PromptState; outcome: LadderOutcome } {
  if (state.phase !== 'learning') {
    throw new Error(`applyLearningAnswer expects a learning prompt, got ${state.phase} (${state.itemKey}:${state.promptType})`);
  }
  const rung = Math.max(1, state.rung) as 1 | 2 | 3;

  if (!correct) {
    return { state: { ...state, rung: Math.max(1, rung - 1) as Rung, streak: 0 }, outcome: 'dropped' };
  }

  const streak = state.streak + 1;
  if (streak < ENGINE_CONFIG.climbStreak[rung]) {
    return { state: { ...state, rung, streak }, outcome: 'held' };
  }
  if (rung === 3) {
    return { state: { ...state, rung, streak: 0 }, outcome: 'graduate' };
  }
  return { state: { ...state, rung: (rung + 1) as Rung, streak: 0 }, outcome: 'climbed' };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/engine/ladder.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```powershell
git add lib/engine
git commit -m "feat(engine): add difficulty ladder transitions"
```

---

### Task 6: FSRS scheduler wrapper

**Files:**
- Create: `lib/engine/scheduler.ts`
- Test: `lib/engine/scheduler.test.ts`

Background: with `enable_short_term: false` and fuzz off, ts-fsrs 5.4 schedules a first *Good* about 3 days out. Tests assert ranges, not exact days, so parameter updates don't break them.

- [ ] **Step 1: Write the failing tests**

Create `lib/engine/scheduler.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyReview, graduate, isDue, retrievability } from './scheduler';
import { newPromptState } from './state';
import { days, NOW } from './test-fixtures';
import type { PromptState } from './types';

const DAY = 86_400_000;
const learningRung3: PromptState = { ...newPromptState('EC', 'flag_to_name'), phase: 'learning', rung: 3 };

describe('graduate', () => {
  it('moves the prompt into review with a first interval of 1–7 days', () => {
    const s = graduate(learningRung3, NOW);
    expect(s.phase).toBe('review');
    expect(s.rung).toBe(3);
    expect(s.fsrs).not.toBeNull();
    const interval = s.fsrs!.due.getTime() - NOW.getTime();
    expect(interval).toBeGreaterThanOrEqual(1 * DAY);
    expect(interval).toBeLessThanOrEqual(7 * DAY);
  });
});

describe('isDue', () => {
  it('is false right after graduation and true once the due date arrives', () => {
    const s = graduate(learningRung3, NOW);
    expect(isDue(s, NOW)).toBe(false);
    expect(isDue(s, s.fsrs!.due)).toBe(true);
  });

  it('is false for prompts not in review', () => {
    expect(isDue(learningRung3, days(100))).toBe(false);
  });
});

describe('applyReview', () => {
  it('grows the interval on a good review', () => {
    const g = graduate(learningRung3, NOW);
    const firstInterval = g.fsrs!.due.getTime() - NOW.getTime();
    const reviewedAt = g.fsrs!.due;
    const r = applyReview(g, 'good', reviewedAt);
    expect(r.phase).toBe('review');
    expect(r.fsrs!.due.getTime() - reviewedAt.getTime()).toBeGreaterThan(firstInterval);
  });

  it('schedules hard sooner than good', () => {
    const g = graduate(learningRung3, NOW);
    const at = g.fsrs!.due;
    expect(applyReview(g, 'hard', at).fsrs!.due.getTime()).toBeLessThan(applyReview(g, 'good', at).fsrs!.due.getTime());
  });

  it('lapses back to learning at rung 2 on again', () => {
    const g = graduate(learningRung3, NOW);
    const r = applyReview(g, 'again', g.fsrs!.due);
    expect(r).toMatchObject({ phase: 'learning', rung: 2, streak: 0 });
    expect(r.fsrs!.lapses).toBe(1);
  });

  it('rejects prompts not in review', () => {
    expect(() => applyReview(learningRung3, 'good', NOW)).toThrow(/review/);
  });
});

describe('retrievability', () => {
  it('is 0 for unlearned prompts, ~1 just after graduation, and decays', () => {
    expect(retrievability(learningRung3, NOW)).toBe(0);
    const g = graduate(learningRung3, NOW);
    expect(retrievability(g, NOW)).toBeCloseTo(1, 2);
    const atDue = retrievability(g, g.fsrs!.due);
    expect(atDue).toBeLessThan(0.95);
    expect(atDue).toBeGreaterThan(0.8);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/engine/scheduler.test.ts`
Expected: FAIL — `Failed to resolve import "./scheduler"`.

- [ ] **Step 3: Implement**

Create `lib/engine/scheduler.ts`:

```ts
import { createEmptyCard, fsrs, generatorParameters, Rating } from 'ts-fsrs';
import { ENGINE_CONFIG } from './config';
import type { PromptState } from './types';

const scheduler = fsrs(
  generatorParameters({
    request_retention: ENGINE_CONFIG.desiredRetention,
    enable_short_term: false, // the ladder replaces FSRS learning steps
    enable_fuzz: false, // deterministic; revisit when real users arrive
  }),
);

export type ReviewGrade = 'good' | 'hard' | 'again';

const RATING: Record<ReviewGrade, Rating.Good | Rating.Hard | Rating.Again> = {
  good: Rating.Good,
  hard: Rating.Hard,
  again: Rating.Again,
};

/** Learning → review. Reuses the existing card after a lapse so FSRS history is kept. */
export function graduate(state: PromptState, now: Date): PromptState {
  const card = state.fsrs ?? createEmptyCard(now);
  return {
    ...state,
    phase: 'review',
    rung: 3,
    streak: 0,
    fsrs: scheduler.next(card, now, Rating.Good).card,
  };
}

export function applyReview(state: PromptState, grade: ReviewGrade, now: Date): PromptState {
  if (state.phase !== 'review' || !state.fsrs) {
    throw new Error(`applyReview expects a review prompt, got ${state.phase} (${state.itemKey}:${state.promptType})`);
  }
  const card = scheduler.next(state.fsrs, now, RATING[grade]).card;
  if (grade === 'again') {
    return { ...state, phase: 'learning', rung: ENGINE_CONFIG.lapseRung, streak: 0, fsrs: card };
  }
  return { ...state, fsrs: card };
}

export function isDue(state: PromptState, now: Date): boolean {
  return state.phase === 'review' && state.fsrs !== null && state.fsrs.due.getTime() <= now.getTime();
}

/** Predicted probability of recall now; 0 for prompts not in review. */
export function retrievability(state: PromptState, now: Date): number {
  if (state.phase !== 'review' || !state.fsrs) return 0;
  return scheduler.get_retrievability(state.fsrs, now, false);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/engine/scheduler.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```powershell
git add lib/engine
git commit -m "feat(engine): wrap ts-fsrs for graduation, reviews, and lapses"
```

---

### Task 7: Confusions and distractor selection

**Files:**
- Create: `lib/engine/confusion.ts`, `lib/engine/distractors.ts`
- Test: `lib/engine/confusion.test.ts`, `lib/engine/distractors.test.ts`

- [ ] **Step 1: Write the failing confusion tests**

Create `lib/engine/confusion.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { confusedWith, recordConfusion, shouldInjectContrast, topConfusions } from './confusion';
import type { Confusion } from './types';

describe('recordConfusion', () => {
  it('adds a new pair with count 1', () => {
    expect(recordConfusion([], 'TD', 'RO')).toEqual({ confusions: [{ asked: 'TD', answered: 'RO', count: 1 }], count: 1 });
  });

  it('increments an existing pair without mutating input', () => {
    const list: Confusion[] = [{ asked: 'TD', answered: 'RO', count: 1 }];
    const r = recordConfusion(list, 'TD', 'RO');
    expect(r.count).toBe(2);
    expect(r.confusions).toEqual([{ asked: 'TD', answered: 'RO', count: 2 }]);
    expect(list[0].count).toBe(1);
  });
});

describe('shouldInjectContrast', () => {
  it('triggers from the threshold upward', () => {
    expect(shouldInjectContrast(1)).toBe(false);
    expect(shouldInjectContrast(2)).toBe(true);
    expect(shouldInjectContrast(5)).toBe(true);
  });
});

const sample: Confusion[] = [
  { asked: 'TD', answered: 'RO', count: 2 },
  { asked: 'RO', answered: 'TD', count: 2 },
  { asked: 'EC', answered: 'CO', count: 3 },
  { asked: 'EC', answered: 'VE', count: 1 },
];

describe('confusedWith', () => {
  it('returns partners in both directions, most confused first', () => {
    expect(confusedWith(sample, 'EC')).toEqual(['CO', 'VE']);
    expect(confusedWith(sample, 'RO')).toEqual(['TD']);
    expect(confusedWith(sample, 'US')).toEqual([]);
  });
});

describe('topConfusions', () => {
  it('merges directions into unordered pairs and sorts by count', () => {
    expect(topConfusions(sample, 2)).toEqual([
      { a: 'RO', b: 'TD', count: 4 },
      { a: 'CO', b: 'EC', count: 3 },
    ]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/engine/confusion.test.ts`
Expected: FAIL — `Failed to resolve import "./confusion"`.

- [ ] **Step 3: Implement confusion**

Create `lib/engine/confusion.ts`:

```ts
import { ENGINE_CONFIG } from './config';
import type { Confusion } from './types';

export function recordConfusion(
  list: readonly Confusion[],
  asked: string,
  answered: string,
): { confusions: Confusion[]; count: number } {
  const idx = list.findIndex((c) => c.asked === asked && c.answered === answered);
  if (idx === -1) return { confusions: [...list, { asked, answered, count: 1 }], count: 1 };
  const updated = { ...list[idx], count: list[idx].count + 1 };
  return { confusions: list.map((c, i) => (i === idx ? updated : c)), count: updated.count };
}

export function shouldInjectContrast(count: number): boolean {
  return count >= ENGINE_CONFIG.contrastThreshold;
}

/** Items confused with `itemKey` in either direction, most confused first. */
export function confusedWith(list: readonly Confusion[], itemKey: string): string[] {
  const totals = new Map<string, number>();
  for (const c of list) {
    const partner = c.asked === itemKey ? c.answered : c.answered === itemKey ? c.asked : null;
    if (partner) totals.set(partner, (totals.get(partner) ?? 0) + c.count);
  }
  return [...totals.entries()].sort((x, y) => y[1] - x[1]).map(([k]) => k);
}

export function topConfusions(
  list: readonly Confusion[],
  limit: number,
): { a: string; b: string; count: number }[] {
  const pairs = new Map<string, { a: string; b: string; count: number }>();
  for (const c of list) {
    const [a, b] = [c.asked, c.answered].sort();
    const key = `${a}|${b}`;
    const existing = pairs.get(key);
    pairs.set(key, { a, b, count: (existing?.count ?? 0) + c.count });
  }
  return [...pairs.values()].sort((x, y) => y.count - x.count).slice(0, limit);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/engine/confusion.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Write the failing distractor tests**

Create `lib/engine/distractors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pickDistractors } from './distractors';
import { seededRng } from './random';
import { fixtureItem, ITEMS } from './test-fixtures';

describe('pickDistractors', () => {
  it('hard mode puts personal confusions first, then static lookalikes', () => {
    const picks = pickDistractors({
      target: fixtureItem('EC'),
      items: ITEMS,
      count: 3,
      mode: 'hard',
      confusions: [{ asked: 'EC', answered: 'PE', count: 2 }],
      rng: seededRng(1),
    });
    expect(picks).toEqual(['PE', 'CO', 'VE']);
  });

  it('random mode prefers items from other groups', () => {
    const southAmerica = new Set(['EC', 'CO', 'VE', 'PE']);
    const picks = pickDistractors({
      target: fixtureItem('EC'),
      items: ITEMS,
      count: 5,
      mode: 'random',
      confusions: [],
      rng: seededRng(2),
    });
    expect(picks).toHaveLength(5);
    expect(picks.some((k) => southAmerica.has(k))).toBe(false);
  });

  it('never includes the target, never repeats, and caps at pool size', () => {
    for (const mode of ['hard', 'random'] as const) {
      const picks = pickDistractors({
        target: fixtureItem('TD'),
        items: ITEMS,
        count: 50,
        mode,
        confusions: [],
        rng: seededRng(3),
      });
      expect(picks).toHaveLength(ITEMS.length - 1);
      expect(new Set(picks).size).toBe(picks.length);
      expect(picks).not.toContain('TD');
    }
  });

  it('is deterministic for a given seed', () => {
    const args = { target: fixtureItem('US'), items: ITEMS, count: 4, mode: 'random' as const, confusions: [] };
    expect(pickDistractors({ ...args, rng: seededRng(5) })).toEqual(pickDistractors({ ...args, rng: seededRng(5) }));
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run lib/engine/distractors.test.ts`
Expected: FAIL — `Failed to resolve import "./distractors"`.

- [ ] **Step 7: Implement distractors**

Create `lib/engine/distractors.ts`:

```ts
import { confusedWith } from './confusion';
import { shuffle } from './random';
import type { Confusion, DistractorMode, Item, Rng } from './types';

export function pickDistractors(args: {
  target: Item;
  items: readonly Item[];
  count: number;
  mode: DistractorMode;
  confusions: readonly Confusion[];
  rng: Rng;
}): string[] {
  const { target, items, count, mode, confusions, rng } = args;
  const pool = items.filter((i) => i.key !== target.key);
  const valid = new Set(pool.map((i) => i.key));
  const sameGroup = pool.filter((i) => i.group === target.group);
  const otherGroups = pool.filter((i) => i.group !== target.group);

  const ordered =
    mode === 'hard'
      ? [
          ...confusedWith(confusions, target.key),
          ...target.lookalikes,
          ...shuffle(sameGroup, rng).map((i) => i.key),
          ...shuffle(pool, rng).map((i) => i.key),
        ]
      : [...shuffle(otherGroups, rng), ...shuffle(sameGroup, rng)].map((i) => i.key);

  return [...new Set(ordered.filter((k) => valid.has(k)))].slice(0, count);
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `npx vitest run lib/engine/distractors.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

```powershell
git add lib/engine
git commit -m "feat(engine): track confusion pairs and pick smart distractors"
```

---

### Task 8: Question builder

**Files:**
- Create: `lib/engine/question.ts`
- Test: `lib/engine/question.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/engine/question.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildQuestion, rungForState } from './question';
import { seededRng } from './random';
import { newPromptState } from './state';
import { TEST_COURSE } from './test-fixtures';

const base = { course: TEST_COURSE, confusions: [], rng: seededRng(11) };

describe('buildQuestion', () => {
  it('builds an intro card', () => {
    expect(buildQuestion({ ...base, entry: { kind: 'intro', itemKey: 'EC' }, rung: 1 })).toEqual({
      entry: { kind: 'intro', itemKey: 'EC' },
      format: 'intro',
    });
  });

  it('builds a contrast drill with both items as choices', () => {
    const q = buildQuestion({ ...base, entry: { kind: 'contrast', itemKey: 'TD', otherKey: 'RO' }, rung: 1 });
    expect(q.format).toBe('contrast');
    expect([...q.choiceKeys!].sort()).toEqual(['RO', 'TD']);
  });

  it('builds a 4-option text MC at rung 1 for flag_to_name', () => {
    const q = buildQuestion({ ...base, entry: { kind: 'prompt', itemKey: 'EC', promptType: 'flag_to_name' }, rung: 1 });
    expect(q.format).toBe('mc-text');
    expect(q.choiceKeys).toHaveLength(4);
    expect(q.choiceKeys).toContain('EC');
  });

  it('builds a typed question at rung 3 for flag_to_name', () => {
    const q = buildQuestion({ ...base, entry: { kind: 'prompt', itemKey: 'EC', promptType: 'flag_to_name' }, rung: 3 });
    expect(q).toEqual({ entry: { kind: 'prompt', itemKey: 'EC', promptType: 'flag_to_name' }, format: 'typed' });
  });

  it('builds an 8-flag grid with look-alikes at rung 3 for name_to_flag', () => {
    const q = buildQuestion({ ...base, entry: { kind: 'prompt', itemKey: 'TD', promptType: 'name_to_flag' }, rung: 3 });
    expect(q.format).toBe('flag-grid');
    expect(q.choiceKeys).toHaveLength(8);
    expect(q.choiceKeys).toEqual(expect.arrayContaining(['TD', 'RO']));
  });

  it('throws for an unknown prompt type', () => {
    expect(() =>
      buildQuestion({ ...base, entry: { kind: 'prompt', itemKey: 'EC', promptType: 'nope' }, rung: 1 }),
    ).toThrow(/nope/);
  });
});

describe('rungForState', () => {
  it('uses recall for reviews and the current rung (min 1) otherwise', () => {
    const s = newPromptState('EC', 'flag_to_name');
    expect(rungForState(s)).toBe(1);
    expect(rungForState({ ...s, phase: 'learning', rung: 2 })).toBe(2);
    expect(rungForState({ ...s, phase: 'review', rung: 3 })).toBe(3);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/engine/question.test.ts`
Expected: FAIL — `Failed to resolve import "./question"`.

- [ ] **Step 3: Implement**

Create `lib/engine/question.ts`:

```ts
import { pickDistractors } from './distractors';
import { shuffle } from './random';
import { getItem } from './state';
import type { Confusion, CourseDef, PromptState, Question, QuestionRung, QueueEntry, Rng } from './types';

export function rungForState(state: PromptState): QuestionRung {
  if (state.phase === 'review') return 3;
  return Math.max(1, state.rung) as QuestionRung;
}

export function buildQuestion(args: {
  entry: QueueEntry;
  rung: QuestionRung;
  course: CourseDef;
  confusions: readonly Confusion[];
  rng: Rng;
}): Question {
  const { entry, rung, course, confusions, rng } = args;
  if (entry.kind === 'intro') return { entry, format: 'intro' };
  if (entry.kind === 'contrast') {
    return { entry, format: 'contrast', choiceKeys: shuffle([entry.itemKey, entry.otherKey], rng) };
  }

  const promptType = course.promptTypes.find((p) => p.id === entry.promptType);
  if (!promptType) throw new Error(`Unknown prompt type ${entry.promptType} in course ${course.slug}`);
  const spec = promptType.formats[rung];
  if (!spec.choices) return { entry, format: spec.format };

  const target = getItem(course, entry.itemKey);
  const distractors = pickDistractors({
    target,
    items: course.items,
    count: spec.choices - 1,
    mode: spec.distractors ?? 'random',
    confusions,
    rng,
  });
  return { entry, format: spec.format, choiceKeys: shuffle([target.key, ...distractors], rng) };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/engine/question.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```powershell
git add lib/engine
git commit -m "feat(engine): build renderable questions per rung and format"
```

---

### Task 9: Dynamic study-session picker

**Files:**
- Create: `lib/engine/session.ts`
- Test: `lib/engine/session.test.ts`

Behavior (spec §6.4): pending contrast → due reviews → learning (missed first, then least recently asked, then lowest rung) → introduce a new item → relaxed learning → `null`. The last 3 distinct items served are on cooldown.

- [ ] **Step 1: Write the failing tests**

Create `lib/engine/session.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { introduce } from './ladder';
import { graduate } from './scheduler';
import {
  canIntroduce,
  isSessionComplete,
  nextEntry,
  queueContrast,
  recordContrastServed,
  recordIntroServed,
  recordPromptAnswered,
  startStudySession,
} from './session';
import { initialStates, stateKey } from './state';
import { days, NOW, TEST_COURSE } from './test-fixtures';
import type { PromptState } from './types';

const course = TEST_COURSE;

function update(states: PromptState[], keys: string[], fn: (s: PromptState) => PromptState): PromptState[] {
  const set = new Set(keys);
  return states.map((s) => (set.has(s.itemKey) ? fn(s) : s));
}
const toLearning = (s: PromptState) => introduce(s);
const toReviewLongAgo = (s: PromptState) => graduate({ ...introduce(s), rung: 3 }, days(-30));
const toReviewJustNow = (s: PromptState) => graduate({ ...introduce(s), rung: 3 }, NOW);

describe('nextEntry', () => {
  it('starts a fresh course by introducing the first item in group order', () => {
    const states = initialStates(course);
    expect(nextEntry({ course, states, session: startStudySession(), now: NOW })).toEqual({ kind: 'intro', itemKey: 'US' });
  });

  it('introduces cooldown+1 items before asking the first one', () => {
    let states = initialStates(course);
    let session = startStudySession();
    const served: string[] = [];
    for (let i = 0; i < 10; i++) {
      const e = nextEntry({ course, states, session, now: NOW })!;
      if (e.kind !== 'intro') {
        served.push(`ask:${e.itemKey}`);
        break;
      }
      served.push(`intro:${e.itemKey}`);
      states = update(states, [e.itemKey], toLearning);
      session = recordIntroServed(session, e.itemKey);
    }
    expect(served).toEqual(['intro:US', 'intro:EC', 'intro:CO', 'intro:VE', 'ask:US']);
  });

  it('serves due reviews before learning prompts', () => {
    let states = initialStates(course);
    states = update(states, ['EC'], toLearning);
    states = update(states, ['TD'], toReviewLongAgo);
    const e = nextEntry({ course, states, session: startStudySession(), now: NOW });
    expect(e).toMatchObject({ kind: 'prompt', itemKey: 'TD' });
  });

  it('prefers a prompt that was just missed once it is off cooldown', () => {
    let states = initialStates(course);
    states = update(states, ['US', 'EC', 'CO', 'VE', 'PE'], toLearning);
    let session = startStudySession();
    session = recordPromptAnswered(session, { kind: 'prompt', itemKey: 'PE', promptType: 'flag_to_name' }, false);
    for (const k of ['US', 'EC', 'CO']) {
      session = recordPromptAnswered(session, { kind: 'prompt', itemKey: k, promptType: 'flag_to_name' }, true);
    }
    expect(nextEntry({ course, states, session, now: NOW })).toEqual({
      kind: 'prompt',
      itemKey: 'PE',
      promptType: 'flag_to_name',
    });
  });

  it('never serves an item on cooldown when something else is eligible', () => {
    let states = initialStates(course);
    states = update(states, ['US', 'EC', 'CO', 'VE'], toLearning);
    let session = startStudySession();
    session = recordPromptAnswered(session, { kind: 'prompt', itemKey: 'US', promptType: 'flag_to_name' }, true);
    const e = nextEntry({ course, states, session, now: NOW });
    expect(e?.itemKey).not.toBe('US');
  });

  it('serves a pending contrast drill first', () => {
    const session = queueContrast(startStudySession(), { kind: 'contrast', itemKey: 'TD', otherKey: 'RO' });
    expect(nextEntry({ course, states: initialStates(course), session, now: NOW })).toEqual({
      kind: 'contrast',
      itemKey: 'TD',
      otherKey: 'RO',
    });
    expect(recordContrastServed(session).pending).toEqual([]);
  });

  it('returns null when nothing is due, learning, or new', () => {
    const states = initialStates(course).map(toReviewJustNow);
    expect(nextEntry({ course, states, session: startStudySession(), now: NOW })).toBeNull();
  });

  it('practice-ahead mode serves not-yet-due reviews', () => {
    const states = initialStates(course).map(toReviewJustNow);
    const e = nextEntry({ course, states, session: startStudySession({ mode: 'practice-ahead' }), now: days(1) });
    expect(e?.kind).toBe('prompt');
  });
});

describe('canIntroduce', () => {
  it('allows introductions in a fresh session', () => {
    expect(canIntroduce(course, initialStates(course), startStudySession())).toBe(true);
  });

  it('blocks when too many prompts are in learning', () => {
    const states = update(initialStates(course), ['US', 'EC', 'CO', 'VE', 'PE', 'TD', 'RO', 'NE'], toLearning);
    expect(states.filter((s) => s.phase === 'learning')).toHaveLength(16);
    expect(canIntroduce(course, states, startStudySession())).toBe(false);
  });

  it('blocks after the per-session new-item cap', () => {
    let session = startStudySession();
    for (const k of ['US', 'EC', 'CO', 'VE', 'PE']) session = recordIntroServed(session, k);
    expect(canIntroduce(course, initialStates(course), session)).toBe(false);
  });

  it('blocks when too few answers remain to ask the new prompts', () => {
    let session = startStudySession({ size: 3 });
    session = recordPromptAnswered(session, { kind: 'prompt', itemKey: 'US', promptType: 'flag_to_name' }, true);
    session = recordPromptAnswered(session, { kind: 'prompt', itemKey: 'US', promptType: 'name_to_flag' }, true);
    expect(canIntroduce(course, initialStates(course), session)).toBe(false);
  });
});

describe('session bookkeeping', () => {
  it('completes after `size` graded answers', () => {
    let session = startStudySession({ size: 2 });
    expect(isSessionComplete(session)).toBe(false);
    session = recordPromptAnswered(session, { kind: 'prompt', itemKey: 'US', promptType: 'flag_to_name' }, true);
    session = recordPromptAnswered(session, { kind: 'prompt', itemKey: 'EC', promptType: 'flag_to_name' }, true);
    expect(isSessionComplete(session)).toBe(true);
  });

  it('tracks last-asked turn and missed flag per prompt', () => {
    const s = recordPromptAnswered(startStudySession(), { kind: 'prompt', itemKey: 'EC', promptType: 'flag_to_name' }, false);
    expect(s.lastAsked[stateKey('EC', 'flag_to_name')]).toBe(0);
    expect(s.lastMissed[stateKey('EC', 'flag_to_name')]).toBe(true);
    expect(s.recentItems).toEqual(['EC']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/engine/session.test.ts`
Expected: FAIL — `Failed to resolve import "./session"`.

- [ ] **Step 3: Implement**

Create `lib/engine/session.ts`:

```ts
import { ENGINE_CONFIG } from './config';
import { isDue, retrievability } from './scheduler';
import { stateKey } from './state';
import type { CourseDef, Item, PromptEntry, PromptState, QueueEntry } from './types';

export type StudyMode = 'normal' | 'practice-ahead';

/** JSON-serializable so it can be stored server-side between answers. */
export interface StudySession {
  mode: StudyMode;
  size: number;
  /** Graded prompt answers so far (intros and contrast drills excluded). */
  answered: number;
  /** Every served entry increments the turn. */
  turn: number;
  /** Most recent first; at most `cooldownItems` distinct item keys. */
  recentItems: string[];
  lastAsked: Record<string, number>;
  lastMissed: Record<string, boolean>;
  newItemsIntroduced: number;
  pending: QueueEntry[];
}

export function startStudySession(opts: { size?: number; mode?: StudyMode } = {}): StudySession {
  return {
    mode: opts.mode ?? 'normal',
    size: opts.size ?? ENGINE_CONFIG.sessionSize,
    answered: 0,
    turn: 0,
    recentItems: [],
    lastAsked: {},
    lastMissed: {},
    newItemsIntroduced: 0,
    pending: [],
  };
}

export function isSessionComplete(session: StudySession): boolean {
  return session.pending.length === 0 && session.answered >= session.size;
}

/** Items whose prompts are all still new, in group order then item order. */
export function newItemsInOrder(course: CourseDef, states: readonly PromptState[]): Item[] {
  const started = new Set(states.filter((s) => s.phase !== 'new').map((s) => s.itemKey));
  return course.items
    .filter((i) => !started.has(i.key))
    .sort((a, b) => a.groupOrder - b.groupOrder || a.itemOrder - b.itemOrder);
}

export function canIntroduce(course: CourseDef, states: readonly PromptState[], session: StudySession): boolean {
  const learningCount = states.filter((s) => s.phase === 'learning').length;
  const remaining = session.size - session.answered;
  return (
    session.newItemsIntroduced < ENGINE_CONFIG.maxNewItemsPerSession &&
    learningCount < ENGINE_CONFIG.maxLearningPrompts &&
    remaining >= course.promptTypes.length
  );
}

const toEntry = (s: PromptState): PromptEntry => ({ kind: 'prompt', itemKey: s.itemKey, promptType: s.promptType });

function pickLearning(pool: PromptState[], session: StudySession): PromptState | undefined {
  const missed = (s: PromptState) => (session.lastMissed[stateKey(s.itemKey, s.promptType)] ? 0 : 1);
  const asked = (s: PromptState) => session.lastAsked[stateKey(s.itemKey, s.promptType)] ?? -1;
  return [...pool].sort((a, b) => missed(a) - missed(b) || asked(a) - asked(b) || a.rung - b.rung)[0];
}

export function nextEntry(args: {
  course: CourseDef;
  states: readonly PromptState[];
  session: StudySession;
  now: Date;
}): QueueEntry | null {
  const { course, states, session, now } = args;
  if (session.pending.length > 0) return session.pending[0];
  if (isSessionComplete(session)) return null;

  const recent = new Set(session.recentItems);
  const offCooldown = (s: PromptState) => !recent.has(s.itemKey);

  const reviewable = (s: PromptState) =>
    session.mode === 'practice-ahead' ? s.phase === 'review' : isDue(s, now);
  const reviews = states
    .filter((s) => reviewable(s) && offCooldown(s))
    .sort((a, b) => retrievability(a, now) - retrievability(b, now));
  if (reviews.length > 0) return toEntry(reviews[0]);

  const learning = states.filter((s) => s.phase === 'learning');
  const fresh = pickLearning(learning.filter(offCooldown), session);
  if (fresh) return toEntry(fresh);

  if (canIntroduce(course, states, session)) {
    const item = newItemsInOrder(course, states)[0];
    if (item) return { kind: 'intro', itemKey: item.key };
  }

  const lastItem = session.recentItems[0];
  const relaxed = pickLearning(learning.filter((s) => s.itemKey !== lastItem), session);
  return relaxed ? toEntry(relaxed) : null;
}

function pushRecent(recent: string[], itemKey: string): string[] {
  return [itemKey, ...recent.filter((k) => k !== itemKey)].slice(0, ENGINE_CONFIG.cooldownItems);
}

export function recordIntroServed(session: StudySession, itemKey: string): StudySession {
  return {
    ...session,
    turn: session.turn + 1,
    recentItems: pushRecent(session.recentItems, itemKey),
    newItemsIntroduced: session.newItemsIntroduced + 1,
  };
}

export function recordPromptAnswered(session: StudySession, entry: PromptEntry, correct: boolean): StudySession {
  const key = stateKey(entry.itemKey, entry.promptType);
  return {
    ...session,
    answered: session.answered + 1,
    turn: session.turn + 1,
    recentItems: pushRecent(session.recentItems, entry.itemKey),
    lastAsked: { ...session.lastAsked, [key]: session.turn },
    lastMissed: { ...session.lastMissed, [key]: !correct },
  };
}

export function queueContrast(session: StudySession, entry: Extract<QueueEntry, { kind: 'contrast' }>): StudySession {
  return { ...session, pending: [...session.pending, entry] };
}

export function recordContrastServed(session: StudySession): StudySession {
  return { ...session, turn: session.turn + 1, pending: session.pending.slice(1) };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/engine/session.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```powershell
git add lib/engine
git commit -m "feat(engine): add dynamic study-session picker with cooldown"
```

---

### Task 10: Applying study answers

**Files:**
- Create: `lib/engine/answer.ts`
- Test: `lib/engine/answer.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/engine/answer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyContrast, applyIntro, applyStudyAnswer } from './answer';
import { graduate } from './scheduler';
import { queueContrast, startStudySession } from './session';
import { initialStates, newPromptState } from './state';
import { NOW } from './test-fixtures';
import type { AnswerGrade, Confusion, PromptState, Rung } from './types';

const RIGHT: AnswerGrade = { correct: true, typo: false, answeredItemKey: null };
const TYPO: AnswerGrade = { correct: true, typo: true, answeredItemKey: null };
const WRONG_RO: AnswerGrade = { correct: false, typo: false, answeredItemKey: 'RO' };

const learning = (rung: Rung, streak = 0): PromptState => ({
  ...newPromptState('TD', 'flag_to_name'),
  phase: 'learning',
  rung,
  streak,
});
const review = (): PromptState => graduate(learning(3), NOW);

function answer(state: PromptState, grade: AnswerGrade, confusions: Confusion[] = [], now = NOW) {
  return applyStudyAnswer({ session: startStudySession(), state, confusions, grade, now });
}

describe('applyStudyAnswer', () => {
  it('climbs the ladder in learning', () => {
    const r = answer(learning(1), RIGHT);
    expect(r.outcome).toBe('climbed');
    expect(r.state.rung).toBe(2);
    expect(r.session.answered).toBe(1);
  });

  it('graduates into review after a correct recall', () => {
    const r = answer(learning(3), RIGHT);
    expect(r.outcome).toBe('graduated');
    expect(r.state.phase).toBe('review');
    expect(r.state.fsrs).not.toBeNull();
  });

  it('reviews: correct → reviewed; typo schedules sooner than clean', () => {
    const s = review();
    const at = s.fsrs!.due;
    const clean = answer(s, RIGHT, [], at);
    const typo = answer(s, TYPO, [], at);
    expect(clean.outcome).toBe('reviewed');
    expect(typo.state.fsrs!.due.getTime()).toBeLessThan(clean.state.fsrs!.due.getTime());
  });

  it('reviews: wrong → lapsed back to learning rung 2', () => {
    const r = answer(review(), WRONG_RO);
    expect(r.outcome).toBe('lapsed');
    expect(r.state).toMatchObject({ phase: 'learning', rung: 2 });
  });

  it('records a confusion on the first miss without queueing a drill', () => {
    const r = answer(learning(2), WRONG_RO);
    expect(r.confusions).toEqual([{ asked: 'TD', answered: 'RO', count: 1 }]);
    expect(r.contrastQueued).toBe(false);
    expect(r.session.pending).toEqual([]);
  });

  it('queues a contrast drill when the pair reaches the threshold', () => {
    const r = answer(learning(2), WRONG_RO, [{ asked: 'TD', answered: 'RO', count: 1 }]);
    expect(r.contrastQueued).toBe(true);
    expect(r.session.pending).toEqual([{ kind: 'contrast', itemKey: 'TD', otherKey: 'RO' }]);
  });

  it('does not record a confusion for "I don\'t know"', () => {
    const r = answer(learning(2), { correct: false, typo: false, answeredItemKey: null });
    expect(r.confusions).toEqual([]);
  });
});

describe('applyIntro', () => {
  it('introduces every prompt of the item and counts the intro', () => {
    const states = initialStates({
      slug: 't',
      title: 't',
      placementPromptType: 'flag_to_name',
      promptTypes: [
        { id: 'flag_to_name', label: '', formats: { 1: { format: 'typed' }, 2: { format: 'typed' }, 3: { format: 'typed' } } },
        { id: 'name_to_flag', label: '', formats: { 1: { format: 'typed' }, 2: { format: 'typed' }, 3: { format: 'typed' } } },
      ],
      items: [{ key: 'TD', name: 'Chad', aliases: [], group: 'g', groupOrder: 1, itemOrder: 1, lookalikes: [] }],
    });
    const r = applyIntro({ session: startStudySession(), itemKey: 'TD', states });
    expect(r.states.every((s) => s.phase === 'learning' && s.rung === 1)).toBe(true);
    expect(r.session.newItemsIntroduced).toBe(1);
    expect(r.session.answered).toBe(0);
  });
});

describe('applyContrast', () => {
  it('pops the pending drill without counting an answer', () => {
    const session = queueContrast(startStudySession(), { kind: 'contrast', itemKey: 'TD', otherKey: 'RO' });
    const next = applyContrast(session);
    expect(next.pending).toEqual([]);
    expect(next.answered).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/engine/answer.test.ts`
Expected: FAIL — `Failed to resolve import "./answer"`.

- [ ] **Step 3: Implement**

Create `lib/engine/answer.ts`:

```ts
import { recordConfusion, shouldInjectContrast } from './confusion';
import { applyLearningAnswer, introduce } from './ladder';
import { applyReview, graduate, type ReviewGrade } from './scheduler';
import {
  queueContrast,
  recordContrastServed,
  recordIntroServed,
  recordPromptAnswered,
  type StudySession,
} from './session';
import type { AnswerGrade, Confusion, PromptEntry, PromptState } from './types';

export type StudyOutcome = 'climbed' | 'held' | 'dropped' | 'graduated' | 'reviewed' | 'lapsed';

export function reviewGradeFor(grade: AnswerGrade): ReviewGrade {
  if (!grade.correct) return 'again';
  return grade.typo ? 'hard' : 'good';
}

export function applyStudyAnswer(args: {
  session: StudySession;
  state: PromptState;
  confusions: readonly Confusion[];
  grade: AnswerGrade;
  now: Date;
}): {
  session: StudySession;
  state: PromptState;
  confusions: Confusion[];
  outcome: StudyOutcome;
  contrastQueued: boolean;
} {
  const { grade, now } = args;
  const entry: PromptEntry = { kind: 'prompt', itemKey: args.state.itemKey, promptType: args.state.promptType };

  let state: PromptState;
  let outcome: StudyOutcome;
  if (args.state.phase === 'review') {
    state = applyReview(args.state, reviewGradeFor(grade), now);
    outcome = grade.correct ? 'reviewed' : 'lapsed';
  } else {
    const r = applyLearningAnswer(args.state, grade.correct);
    if (r.outcome === 'graduate') {
      state = graduate(r.state, now);
      outcome = 'graduated';
    } else {
      state = r.state;
      outcome = r.outcome;
    }
  }

  let session = recordPromptAnswered(args.session, entry, grade.correct);
  let confusions = [...args.confusions];
  let contrastQueued = false;
  if (!grade.correct && grade.answeredItemKey && grade.answeredItemKey !== entry.itemKey) {
    const rec = recordConfusion(confusions, entry.itemKey, grade.answeredItemKey);
    confusions = rec.confusions;
    if (shouldInjectContrast(rec.count)) {
      session = queueContrast(session, { kind: 'contrast', itemKey: entry.itemKey, otherKey: grade.answeredItemKey });
      contrastQueued = true;
    }
  }

  return { session, state, confusions, outcome, contrastQueued };
}

/** Marks the intro card as seen: every prompt of the item enters learning at rung 1. */
export function applyIntro(args: {
  session: StudySession;
  itemKey: string;
  states: readonly PromptState[];
}): { session: StudySession; states: PromptState[] } {
  return {
    session: recordIntroServed(args.session, args.itemKey),
    states: args.states.map((s) => (s.itemKey === args.itemKey ? introduce(s) : s)),
  };
}

/** Contrast drills are logged by the caller but never move the ladder. */
export function applyContrast(session: StudySession): StudySession {
  return recordContrastServed(session);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/engine/answer.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```powershell
git add lib/engine
git commit -m "feat(engine): apply study answers, intros, and contrast drills"
```

---

### Task 11: Fixed queues and the placement sweep

**Files:**
- Create: `lib/engine/queue.ts`, `lib/engine/placement.ts`
- Test: `lib/engine/placement.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/engine/placement.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { introduce } from './ladder';
import { applyPlacementAnswer, buildPlacementQueue } from './placement';
import { advance, currentEntry, isQueueComplete } from './queue';
import { initialStates } from './state';
import { NOW, TEST_COURSE } from './test-fixtures';

describe('buildPlacementQueue', () => {
  it('asks every all-new item once, typed flag_to_name, in group order', () => {
    const q = buildPlacementQueue(TEST_COURSE, initialStates(TEST_COURSE));
    expect(q.queue).toHaveLength(TEST_COURSE.items.length);
    expect(q.queue[0]).toEqual({ kind: 'prompt', itemKey: 'US', promptType: 'flag_to_name' });
    expect(q.queue.slice(1, 5).map((e) => e.itemKey)).toEqual(['EC', 'CO', 'VE', 'PE']);
  });

  it('skips items already started', () => {
    const states = initialStates(TEST_COURSE).map((s) => (s.itemKey === 'US' ? introduce(s) : s));
    const q = buildPlacementQueue(TEST_COURSE, states);
    expect(q.queue.map((e) => e.itemKey)).not.toContain('US');
  });
});

describe('queue helpers', () => {
  it('walks the queue to completion', () => {
    let q = buildPlacementQueue(TEST_COURSE, initialStates(TEST_COURSE));
    expect(currentEntry(q)?.itemKey).toBe('US');
    for (let i = 0; i < TEST_COURSE.items.length; i++) q = advance(q);
    expect(isQueueComplete(q)).toBe(true);
    expect(currentEntry(q)).toBeNull();
  });
});

describe('applyPlacementAnswer', () => {
  it('graduates both prompts of a correctly named item', () => {
    const states = applyPlacementAnswer({ states: initialStates(TEST_COURSE), itemKey: 'US', correct: true, now: NOW });
    const us = states.filter((s) => s.itemKey === 'US');
    expect(us).toHaveLength(2);
    expect(us.every((s) => s.phase === 'review' && s.fsrs !== null)).toBe(true);
    expect(states.filter((s) => s.itemKey !== 'US').every((s) => s.phase === 'new')).toBe(true);
  });

  it('leaves the item new when missed', () => {
    const before = initialStates(TEST_COURSE);
    const after = applyPlacementAnswer({ states: before, itemKey: 'EC', correct: false, now: NOW });
    expect(after).toEqual(before);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/engine/placement.test.ts`
Expected: FAIL — `Failed to resolve import "./placement"`.

- [ ] **Step 3: Implement the queue helpers**

Create `lib/engine/queue.ts`:

```ts
import type { QueueEntry } from './types';

/** A fixed, pre-built sequence (placement sweep, final exam). JSON-serializable. */
export interface QueueSession {
  queue: QueueEntry[];
  position: number;
}

export function currentEntry(q: QueueSession): QueueEntry | null {
  return q.queue[q.position] ?? null;
}

export function advance(q: QueueSession): QueueSession {
  return { ...q, position: q.position + 1 };
}

export function isQueueComplete(q: QueueSession): boolean {
  return q.position >= q.queue.length;
}
```

- [ ] **Step 4: Implement placement**

Create `lib/engine/placement.ts`:

```ts
import { graduate } from './scheduler';
import { newItemsInOrder } from './session';
import type { QueueSession } from './queue';
import type { CourseDef, PromptState } from './types';

export function buildPlacementQueue(course: CourseDef, states: readonly PromptState[]): QueueSession {
  return {
    queue: newItemsInOrder(course, states).map((item) => ({
      kind: 'prompt' as const,
      itemKey: item.key,
      promptType: course.placementPromptType,
    })),
    position: 0,
  };
}

/** A correct placement answer fast-tracks every prompt of the item straight into review. */
export function applyPlacementAnswer(args: {
  states: readonly PromptState[];
  itemKey: string;
  correct: boolean;
  now: Date;
}): PromptState[] {
  const { states, itemKey, correct, now } = args;
  if (!correct) return [...states];
  return states.map((s) => (s.itemKey === itemKey && s.phase === 'new' ? graduate(s, now) : s));
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run lib/engine/placement.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```powershell
git add lib/engine
git commit -m "feat(engine): add fixed queues and placement sweep"
```

---

### Task 12: Final exam

**Files:**
- Create: `lib/engine/exam.ts`
- Test: `lib/engine/exam.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/engine/exam.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyExamAnswer, buildExamQueue, isExamReady, scoreExam } from './exam';
import { introduce } from './ladder';
import { seededRng } from './random';
import { graduate } from './scheduler';
import { initialStates } from './state';
import { NOW, TEST_COURSE } from './test-fixtures';
import type { PromptState } from './types';

const allReview = (): PromptState[] =>
  initialStates(TEST_COURSE).map((s) => graduate({ ...introduce(s), rung: 3 }, NOW));

describe('isExamReady', () => {
  it('requires every prompt in review', () => {
    expect(isExamReady(TEST_COURSE, allReview())).toBe(true);
    const oneLearning = allReview().map((s, i) => (i === 0 ? { ...s, phase: 'learning' as const } : s));
    expect(isExamReady(TEST_COURSE, oneLearning)).toBe(false);
  });

  it('is false when states are missing', () => {
    expect(isExamReady(TEST_COURSE, allReview().slice(1))).toBe(false);
  });
});

describe('buildExamQueue', () => {
  it('asks each item exactly once with a valid prompt type', () => {
    const q = buildExamQueue(TEST_COURSE, seededRng(4));
    expect(q.position).toBe(0);
    expect(q.queue.map((e) => e.itemKey).sort()).toEqual(TEST_COURSE.items.map((i) => i.key).sort());
    for (const e of q.queue) {
      expect(e.kind).toBe('prompt');
      if (e.kind === 'prompt') expect(['flag_to_name', 'name_to_flag']).toContain(e.promptType);
    }
  });
});

describe('applyExamAnswer', () => {
  it('counts as a review: wrong lapses, right stays in review', () => {
    const s = allReview()[0];
    expect(applyExamAnswer(s, { correct: true, typo: false, answeredItemKey: null }, NOW).phase).toBe('review');
    expect(applyExamAnswer(s, { correct: false, typo: false, answeredItemKey: null }, NOW)).toMatchObject({
      phase: 'learning',
      rung: 2,
    });
  });

  it('leaves non-review prompts unchanged', () => {
    const s = initialStates(TEST_COURSE)[0];
    expect(applyExamAnswer(s, { correct: true, typo: false, answeredItemKey: null }, NOW)).toBe(s);
  });
});

describe('scoreExam', () => {
  it('passes only at 100% with every question answered', () => {
    expect(scoreExam([{ itemKey: 'A', correct: true }, { itemKey: 'B', correct: true }], 2)).toEqual({
      score: 2,
      total: 2,
      passed: true,
      missed: [],
    });
    expect(scoreExam([{ itemKey: 'A', correct: true }, { itemKey: 'B', correct: false }], 2)).toEqual({
      score: 1,
      total: 2,
      passed: false,
      missed: ['B'],
    });
    expect(scoreExam([{ itemKey: 'A', correct: true }], 2).passed).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/engine/exam.test.ts`
Expected: FAIL — `Failed to resolve import "./exam"`.

- [ ] **Step 3: Implement**

Create `lib/engine/exam.ts`:

```ts
import { reviewGradeFor } from './answer';
import type { QueueSession } from './queue';
import { shuffle } from './random';
import { applyReview } from './scheduler';
import { indexStates, stateKey } from './state';
import type { AnswerGrade, CourseDef, PromptState, Rng } from './types';

export function isExamReady(course: CourseDef, states: readonly PromptState[]): boolean {
  const idx = indexStates(states);
  return course.items.every((item) =>
    course.promptTypes.every((pt) => idx.get(stateKey(item.key, pt.id))?.phase === 'review'),
  );
}

/** Every item once, random prompt direction, shuffled. Always asked at Recall (rung 3). */
export function buildExamQueue(course: CourseDef, rng: Rng): QueueSession {
  const entries = course.items.map((item) => ({
    kind: 'prompt' as const,
    itemKey: item.key,
    promptType: course.promptTypes[Math.floor(rng() * course.promptTypes.length)].id,
  }));
  return { queue: shuffle(entries, rng), position: 0 };
}

/** Exam answers count as FSRS reviews; a miss lapses the prompt back into learning. */
export function applyExamAnswer(state: PromptState, grade: AnswerGrade, now: Date): PromptState {
  if (state.phase !== 'review') return state;
  return applyReview(state, reviewGradeFor(grade), now);
}

export function scoreExam(
  results: readonly { itemKey: string; correct: boolean }[],
  total: number,
): { score: number; total: number; passed: boolean; missed: string[] } {
  const score = results.filter((r) => r.correct).length;
  return {
    score,
    total,
    passed: results.length === total && score === total,
    missed: results.filter((r) => !r.correct).map((r) => r.itemKey),
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/engine/exam.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```powershell
git add lib/engine
git commit -m "feat(engine): add exam readiness, building, and scoring"
```

---

### Task 13: Progress and status

**Files:**
- Create: `lib/engine/progress.ts`
- Test: `lib/engine/progress.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/engine/progress.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { introduce } from './ladder';
import {
  deriveStatus,
  dueCount,
  itemTileState,
  needsReviewNudge,
  readiness,
  retentionHealth,
} from './progress';
import { applyReview, graduate } from './scheduler';
import { initialStates } from './state';
import { days, NOW, TEST_COURSE } from './test-fixtures';
import type { PromptState } from './types';

const grad = (s: PromptState, at = NOW) => graduate({ ...introduce(s), rung: 3 }, at);
const allReview = () => initialStates(TEST_COURSE).map((s) => grad(s));

describe('deriveStatus', () => {
  it('walks placement → learning → exam_ready → passed', () => {
    const fresh = initialStates(TEST_COURSE);
    expect(deriveStatus({ course: TEST_COURSE, states: fresh, placementCompleted: false, passedAt: null })).toBe('placement');
    expect(deriveStatus({ course: TEST_COURSE, states: fresh, placementCompleted: true, passedAt: null })).toBe('learning');
    expect(deriveStatus({ course: TEST_COURSE, states: allReview(), placementCompleted: true, passedAt: null })).toBe('exam_ready');
    expect(deriveStatus({ course: TEST_COURSE, states: fresh, placementCompleted: true, passedAt: NOW })).toBe('passed');
  });
});

describe('readiness', () => {
  it('counts graduated prompts over total prompts', () => {
    const states = initialStates(TEST_COURSE).map((s, i) => (i < 4 ? grad(s) : s));
    expect(readiness(TEST_COURSE, states)).toEqual({ graduated: 4, total: TEST_COURSE.items.length * 2 });
  });
});

describe('retentionHealth', () => {
  it('is ~1 right after graduating everything and falls over time', () => {
    const states = allReview();
    expect(retentionHealth(states, NOW)).toBeCloseTo(1, 2);
    expect(retentionHealth(states, days(60))).toBeLessThan(0.9);
    expect(needsReviewNudge(retentionHealth(states, days(60)))).toBe(true);
    expect(needsReviewNudge(retentionHealth(states, NOW))).toBe(false);
  });

  it('is 0 for no states', () => {
    expect(retentionHealth([], NOW)).toBe(0);
  });
});

describe('dueCount', () => {
  it('counts review prompts due now', () => {
    const states = allReview();
    expect(dueCount(states, NOW)).toBe(0);
    expect(dueCount(states, days(30))).toBe(states.length);
  });
});

describe('itemTileState', () => {
  const [a, b] = initialStates(TEST_COURSE).slice(0, 2);
  it('maps prompt states to a mastery-grid tile', () => {
    expect(itemTileState([a, b])).toBe('new');
    expect(itemTileState([introduce(a), { ...introduce(b), rung: 2 }])).toBe('learning-1');
    expect(itemTileState([grad(a), grad(b)])).toBe('review');
  });

  it('marks high-stability items as strong', () => {
    let s1 = grad(a, days(-200));
    let s2 = grad(b, days(-200));
    for (let i = 0; i < 4; i++) {
      s1 = applyReview(s1, 'good', s1.fsrs!.due);
      s2 = applyReview(s2, 'good', s2.fsrs!.due);
    }
    expect(s1.fsrs!.stability).toBeGreaterThanOrEqual(21);
    expect(itemTileState([s1, s2])).toBe('strong');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/engine/progress.test.ts`
Expected: FAIL — `Failed to resolve import "./progress"`.

- [ ] **Step 3: Implement**

Create `lib/engine/progress.ts`:

```ts
import { ENGINE_CONFIG } from './config';
import { isExamReady } from './exam';
import { isDue, retrievability } from './scheduler';
import type { CourseDef, PromptState } from './types';

export type EnrollmentStatus = 'placement' | 'learning' | 'exam_ready' | 'passed';
export type TileState = 'new' | 'learning-1' | 'learning-2' | 'learning-3' | 'review' | 'strong';

export function deriveStatus(args: {
  course: CourseDef;
  states: readonly PromptState[];
  placementCompleted: boolean;
  passedAt: Date | null;
}): EnrollmentStatus {
  const { course, states, placementCompleted, passedAt } = args;
  if (passedAt) return 'passed';
  if (isExamReady(course, states)) return 'exam_ready';
  if (!placementCompleted && states.every((s) => s.phase === 'new')) return 'placement';
  return 'learning';
}

export function readiness(course: CourseDef, states: readonly PromptState[]): { graduated: number; total: number } {
  return {
    graduated: states.filter((s) => s.phase === 'review').length,
    total: course.items.length * course.promptTypes.length,
  };
}

/** Mean predicted recall across all prompts (unlearned prompts count as 0). */
export function retentionHealth(states: readonly PromptState[], now: Date): number {
  if (states.length === 0) return 0;
  return states.reduce((sum, s) => sum + retrievability(s, now), 0) / states.length;
}

export function needsReviewNudge(health: number): boolean {
  return health < ENGINE_CONFIG.retentionNudgeBelow;
}

export function dueCount(states: readonly PromptState[], now: Date): number {
  return states.filter((s) => isDue(s, now)).length;
}

/** Collapses an item's prompt states into one mastery-grid tile. */
export function itemTileState(itemStates: readonly PromptState[]): TileState {
  const learning = itemStates.filter((s) => s.phase === 'learning');
  if (learning.length > 0) {
    const lowest = Math.max(1, Math.min(...learning.map((s) => s.rung)));
    return `learning-${lowest}` as TileState;
  }
  if (itemStates.length > 0 && itemStates.every((s) => s.phase === 'review')) {
    const minStability = Math.min(...itemStates.map((s) => s.fsrs?.stability ?? 0));
    return minStability >= ENGINE_CONFIG.strongStabilityDays ? 'strong' : 'review';
  }
  return 'new';
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/engine/progress.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```powershell
git add lib/engine
git commit -m "feat(engine): add enrollment status, readiness, retention health, tiles"
```

---

### Task 14: Public barrel and learner simulation

**Files:**
- Create: `lib/engine/index.ts`, `lib/engine/simulation.test.ts`

This is the end-to-end proof of the core promise: known items fade, missed items recur, confusions trigger drills, and a diligent learner reaches the exam.

- [ ] **Step 1: Create the barrel**

Create `lib/engine/index.ts`:

```ts
export * from './types';
export { ENGINE_CONFIG } from './config';
export { seededRng, shuffle, randInt } from './random';
export { newPromptState, initialStates, hydrateStates, stateKey, indexStates, getItem } from './state';
export { normalize, editDistance, gradeTyped, gradeChoice } from './grading';
export { introduce, applyLearningAnswer, type LadderOutcome } from './ladder';
export { graduate, applyReview, isDue, retrievability, type ReviewGrade } from './scheduler';
export { recordConfusion, shouldInjectContrast, confusedWith, topConfusions } from './confusion';
export { pickDistractors } from './distractors';
export { buildQuestion, rungForState } from './question';
export {
  startStudySession,
  isSessionComplete,
  nextEntry,
  canIntroduce,
  newItemsInOrder,
  type StudySession,
  type StudyMode,
} from './session';
export { applyStudyAnswer, applyIntro, applyContrast, reviewGradeFor, type StudyOutcome } from './answer';
export { currentEntry, advance, isQueueComplete, type QueueSession } from './queue';
export { buildPlacementQueue, applyPlacementAnswer } from './placement';
export { isExamReady, buildExamQueue, applyExamAnswer, scoreExam } from './exam';
export {
  deriveStatus,
  readiness,
  retentionHealth,
  needsReviewNudge,
  dueCount,
  itemTileState,
  type EnrollmentStatus,
  type TileState,
} from './progress';
```

- [ ] **Step 2: Write the simulation test**

Create `lib/engine/simulation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  applyContrast,
  applyIntro,
  applyStudyAnswer,
  initialStates,
  isExamReady,
  isSessionComplete,
  nextEntry,
  startStudySession,
  stateKey,
  type AnswerGrade,
  type Confusion,
  type PromptState,
} from './index';
import { days, TEST_COURSE } from './test-fixtures';

/**
 * Learner who knows every flag except Ecuador, which they mistake for
 * Colombia the first 4 times they're asked. Two sessions per day.
 */
function simulate(totalDays: number) {
  let states: PromptState[] = initialStates(TEST_COURSE);
  let confusions: Confusion[] = [];
  let ecuadorMissesLeft = 4;
  const asksByDay: string[][] = [];
  const contrasts: string[] = [];

  for (let day = 0; day < totalDays; day++) {
    asksByDay[day] = [];
    for (const hour of [0, 8]) {
      const now = days(day, hour);
      let session = startStudySession();
      for (let guard = 0; guard < 500; guard++) {
        const entry = nextEntry({ course: TEST_COURSE, states, session, now });
        if (!entry) break;
        if (entry.kind === 'intro') {
          ({ session, states } = applyIntro({ session, itemKey: entry.itemKey, states }));
          continue;
        }
        if (entry.kind === 'contrast') {
          contrasts.push(`${entry.itemKey}>${entry.otherKey}`);
          session = applyContrast(session);
          continue;
        }
        asksByDay[day].push(entry.itemKey);
        const wrong = entry.itemKey === 'EC' && ecuadorMissesLeft > 0;
        if (wrong) ecuadorMissesLeft--;
        const grade: AnswerGrade = wrong
          ? { correct: false, typo: false, answeredItemKey: 'CO' }
          : { correct: true, typo: false, answeredItemKey: null };
        const key = stateKey(entry.itemKey, entry.promptType);
        const current = states.find((s) => stateKey(s.itemKey, s.promptType) === key)!;
        const r = applyStudyAnswer({ session, state: current, confusions, grade, now });
        session = r.session;
        confusions = r.confusions;
        states = states.map((s) => (stateKey(s.itemKey, s.promptType) === key ? r.state : s));
        if (isSessionComplete(session)) break;
      }
    }
  }
  return { states, confusions, asksByDay, contrasts };
}

describe('learner simulation', () => {
  const result = simulate(30);
  const total = (key: string) => result.asksByDay.flat().filter((k) => k === key).length;

  it('asks the missed item more often than a known one', () => {
    expect(total('EC')).toBeGreaterThan(total('US'));
  });

  it('records the Ecuador→Colombia confusion and runs a contrast drill', () => {
    expect(result.confusions).toContainEqual({ asked: 'EC', answered: 'CO', count: 4 });
    expect(result.contrasts).toContain('EC>CO');
  });

  it('lets a known item fade: US is rarely asked in the last 10 days', () => {
    const lateAsks = result.asksByDay.slice(20).flat().filter((k) => k === 'US').length;
    expect(lateAsks).toBeLessThanOrEqual(2);
  });

  it('gets a diligent learner to exam-ready within 30 days', () => {
    expect(isExamReady(TEST_COURSE, result.states)).toBe(true);
  });
});
```

- [ ] **Step 3: Run the simulation**

Run: `npx vitest run lib/engine/simulation.test.ts`
Expected: PASS (4 tests). All engine modules already exist, so this should pass on the first run. If an assertion fails, **do not loosen it**: print `result.asksByDay` and debug the engine with superpowers:systematic-debugging. A failure here means the engine misses its core promise.

- [ ] **Step 4: Run the whole engine suite and typecheck**

```powershell
npx vitest run lib/engine
npm run typecheck
```

Expected: all engine tests pass; typecheck exits 0.

- [ ] **Step 5: Commit**

```powershell
git add lib/engine
git commit -m "test(engine): add public barrel and multi-week learner simulation"
```

---

### Task 15: Content pipeline (countries + flags)

**Files:**
- Create: `lib/content/types.ts`, `scripts/content-config.ts`, `scripts/lib/build-countries.ts`, `scripts/build-content.ts`
- Test: `scripts/lib/build-countries.test.ts`
- Generated (committed): `content/countries.json`, `public/flags/*.svg`

- [ ] **Step 1: Define the content record type**

Create `lib/content/types.ts`:

```ts
/** One entry in content/countries.json, shared by World Flags and (later) World Map. */
export interface CountryRecord {
  key: string; // ISO 3166-1 alpha-2, e.g. "EC"
  name: string;
  aliases: string[];
  region: string;
  subregion: string;
  group: string;
  groupOrder: number;
  itemOrder: number;
  flag: string; // public path, e.g. "/flags/ec.svg"
  flagLookalikes: string[];
}
```

- [ ] **Step 2: Create the content config**

Create `scripts/content-config.ts`:

```ts
/** Non-UN-member countries included in the course (spec §2). */
export const EXTRA_KEYS = ['VA', 'PS', 'TW', 'XK'];

/** Learning chunks, in introduction order. */
export const GROUP_ORDER = [
  'Western & Northern Europe',
  'Southern & Eastern Europe',
  'North & Central America',
  'Caribbean',
  'South America',
  'Middle East & Central Asia',
  'South & East Asia',
  'Southeast Asia',
  'North & West Africa',
  'Central & Southern Africa',
  'East Africa',
  'Oceania',
] as const;

export const SUBREGION_GROUPS: Record<string, (typeof GROUP_ORDER)[number]> = {
  'Western Europe': 'Western & Northern Europe',
  'Northern Europe': 'Western & Northern Europe',
  'Southern Europe': 'Southern & Eastern Europe',
  'Central Europe': 'Southern & Eastern Europe',
  'Eastern Europe': 'Southern & Eastern Europe',
  'Southeast Europe': 'Southern & Eastern Europe',
  'North America': 'North & Central America',
  'Central America': 'North & Central America',
  Caribbean: 'Caribbean',
  'South America': 'South America',
  'Western Asia': 'Middle East & Central Asia',
  'Central Asia': 'Middle East & Central Asia',
  'Southern Asia': 'South & East Asia',
  'Eastern Asia': 'South & East Asia',
  'South-Eastern Asia': 'Southeast Asia',
  'Northern Africa': 'North & West Africa',
  'Western Africa': 'North & West Africa',
  'Middle Africa': 'Central & Southern Africa',
  'Southern Africa': 'Central & Southern Africa',
  'Eastern Africa': 'East Africa',
  'Australia and New Zealand': 'Oceania',
  Melanesia: 'Oceania',
  Micronesia: 'Oceania',
  Polynesia: 'Oceania',
};

/** Aliases of 3 characters or fewer are dropped unless whitelisted (avoids "IN", "NE"…). */
export const SHORT_ALIAS_WHITELIST = ['USA', 'UK', 'UAE', 'DRC', 'CAR'];

export const EXTRA_ALIASES: Record<string, string[]> = {
  US: ['America', 'United States of America', 'USA'],
  GB: ['Britain', 'Great Britain', 'UK'],
  CD: ['DRC', 'Congo Kinshasa', 'Democratic Republic of the Congo'],
  CG: ['Congo', 'Congo Brazzaville'],
  KP: ['North Korea'],
  KR: ['South Korea'],
  CZ: ['Czech Republic'],
  MM: ['Burma'],
  CV: ['Cabo Verde'],
  TL: ['East Timor'],
  SZ: ['Swaziland'],
  MK: ['Macedonia'],
  VA: ['Vatican', 'Holy See'],
  FM: ['Federated States of Micronesia'],
  AE: ['UAE'],
  CF: ['CAR'],
  BS: ['The Bahamas'],
  GM: ['The Gambia'],
  ST: ['Sao Tome'],
  TW: ['Republic of China'],
  LA: ['Laos'],
  RU: ['Russian Federation'],
  VN: ['Viet Nam'],
  TR: ['Turkey', 'Türkiye'],
  CI: ["Côte d'Ivoire"],
};

/** Statically similar flags (seed confusions). Symmetric; each pair listed once. */
export const FLAG_LOOKALIKE_PAIRS: [string, string][] = [
  ['TD', 'RO'], ['TD', 'AD'], ['TD', 'MD'], ['RO', 'AD'], ['RO', 'MD'], ['AD', 'MD'],
  ['ID', 'MC'], ['ID', 'PL'], ['MC', 'PL'],
  ['NL', 'LU'], ['NL', 'FR'], ['NL', 'RU'],
  ['AU', 'NZ'],
  ['IE', 'CI'], ['IE', 'IT'], ['IT', 'MX'],
  ['NE', 'IN'],
  ['SN', 'ML'], ['ML', 'GN'], ['SN', 'CM'],
  ['CO', 'EC'], ['CO', 'VE'], ['EC', 'VE'],
  ['SI', 'SK'], ['SI', 'RU'], ['SK', 'RU'], ['RS', 'RU'],
  ['NO', 'IS'], ['SE', 'FI'], ['DK', 'NO'],
  ['HN', 'NI'], ['HN', 'SV'], ['NI', 'SV'], ['GT', 'SV'],
  ['QA', 'BH'], ['AE', 'KW'], ['JO', 'PS'], ['SD', 'PS'],
  ['EG', 'IQ'], ['IQ', 'SY'], ['SY', 'YE'], ['EG', 'YE'],
  ['BO', 'GH'], ['BO', 'LT'], ['GH', 'LT'],
  ['LR', 'US'], ['MY', 'US'], ['LR', 'MY'],
  ['HT', 'LI'], ['BE', 'DE'], ['XK', 'BA'],
];
```

- [ ] **Step 3: Write the failing build tests**

Create `scripts/lib/build-countries.test.ts`:

```ts
import worldCountries from 'world-countries';
import { describe, expect, it } from 'vitest';
import { GROUP_ORDER, SHORT_ALIAS_WHITELIST } from '../content-config';
import { buildCountries, type RawCountry } from './build-countries';

const raw = worldCountries as unknown as RawCountry[];
const { countries } = buildCountries(raw);
const byKey = new Map(countries.map((c) => [c.key, c]));

describe('buildCountries (real data)', () => {
  it('selects 193 UN members plus VA, PS, TW, XK', () => {
    expect(countries).toHaveLength(197);
    for (const k of ['VA', 'PS', 'TW', 'XK', 'US', 'EC']) expect(byKey.has(k)).toBe(true);
  });

  it('keeps useful aliases and drops short codes', () => {
    expect(byKey.get('US')!.aliases).toContain('USA');
    expect(byKey.get('CZ')!.aliases).toContain('Czech Republic');
    expect(byKey.get('CI')!.aliases).toContain("Côte d'Ivoire");
    for (const c of countries) {
      for (const a of c.aliases) {
        if (a.length <= 3) expect(SHORT_ALIAS_WHITELIST).toContain(a);
      }
    }
  });

  it('assigns every country to a known, non-empty group with sequential item order', () => {
    for (const g of GROUP_ORDER) {
      const members = countries.filter((c) => c.group === g);
      expect(members.length).toBeGreaterThan(0);
      expect(members.map((c) => c.itemOrder)).toEqual(members.map((_, i) => i + 1));
      expect(new Set(members.map((c) => c.groupOrder))).toEqual(new Set([GROUP_ORDER.indexOf(g) + 1]));
    }
  });

  it('makes flag look-alikes symmetric and valid', () => {
    for (const c of countries) {
      for (const other of c.flagLookalikes) {
        expect(byKey.get(other)?.flagLookalikes).toContain(c.key);
      }
    }
    expect(byKey.get('TD')!.flagLookalikes).toContain('RO');
  });

  it('points each country at its flag path', () => {
    expect(byKey.get('EC')!.flag).toBe('/flags/ec.svg');
  });
});

const fake = (over: Partial<RawCountry>): RawCountry => ({
  cca2: 'AA',
  unMember: true,
  region: 'Europe',
  subregion: 'Western Europe',
  name: { common: 'Aland', official: 'Republic of Aland' },
  altSpellings: [],
  ...over,
});

describe('buildCountries (validation)', () => {
  it('throws on an unmapped subregion', () => {
    expect(() => buildCountries([fake({ subregion: 'Atlantis' })])).toThrow(/Atlantis/);
  });

  it('throws on duplicate primary names', () => {
    expect(() => buildCountries([fake({ cca2: 'AA' }), fake({ cca2: 'BB' })])).toThrow(/Duplicate/);
  });

  it('drops aliases shared by two countries, with a warning', () => {
    const r = buildCountries([
      fake({ cca2: 'AA', name: { common: 'Aland', official: 'Aland' }, altSpellings: ['Shared Name'] }),
      fake({ cca2: 'BB', name: { common: 'Bland', official: 'Bland' }, altSpellings: ['Shared Name'] }),
    ]);
    expect(r.countries.flatMap((c) => c.aliases)).not.toContain('Shared Name');
    expect(r.warnings.join('\n')).toMatch(/Shared Name/);
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npx vitest run scripts/lib/build-countries.test.ts`
Expected: FAIL — `Failed to resolve import "./build-countries"`.

- [ ] **Step 5: Implement the transform**

Create `scripts/lib/build-countries.ts`:

```ts
import type { CountryRecord } from '../../lib/content/types';
import { normalize } from '../../lib/engine/grading';
import {
  EXTRA_ALIASES,
  EXTRA_KEYS,
  FLAG_LOOKALIKE_PAIRS,
  GROUP_ORDER,
  SHORT_ALIAS_WHITELIST,
  SUBREGION_GROUPS,
} from '../content-config';

/** The subset of world-countries fields we rely on. */
export interface RawCountry {
  cca2: string;
  unMember: boolean;
  region: string;
  subregion: string;
  name: { common: string; official: string };
  altSpellings: string[];
}

export function buildCountries(raw: readonly RawCountry[]): { countries: CountryRecord[]; warnings: string[] } {
  const warnings: string[] = [];
  const selected = raw.filter((c) => c.unMember || EXTRA_KEYS.includes(c.cca2));

  const base = selected.map((c) => {
    const group = SUBREGION_GROUPS[c.subregion];
    if (!group) throw new Error(`No group mapping for subregion "${c.subregion}" (${c.cca2})`);
    const candidates = [c.name.official, ...c.altSpellings, ...(EXTRA_ALIASES[c.cca2] ?? [])];
    return {
      key: c.cca2,
      name: c.name.common,
      candidates: candidates.filter((a) => a.length > 3 || SHORT_ALIAS_WHITELIST.includes(a)),
      region: c.region,
      subregion: c.subregion,
      group,
    };
  });

  const primaryOwner = new Map<string, string>();
  for (const c of base) {
    const n = normalize(c.name);
    const prev = primaryOwner.get(n);
    if (prev) throw new Error(`Duplicate primary name "${c.name}" for ${prev} and ${c.key}`);
    primaryOwner.set(n, c.key);
  }

  const aliasOwners = new Map<string, Set<string>>();
  for (const c of base) {
    for (const a of c.candidates) {
      const n = normalize(a);
      if (!n) continue;
      if (!aliasOwners.has(n)) aliasOwners.set(n, new Set());
      aliasOwners.get(n)!.add(c.key);
    }
  }

  const withAliases = base.map((c) => {
    const seen = new Set([normalize(c.name)]);
    const aliases: string[] = [];
    for (const a of c.candidates) {
      const n = normalize(a);
      if (!n || seen.has(n)) continue;
      const primary = primaryOwner.get(n);
      if (primary && primary !== c.key) {
        warnings.push(`Dropped alias "${a}" from ${c.key}: it is ${primary}'s name`);
        continue;
      }
      if ((aliasOwners.get(n)?.size ?? 0) > 1) {
        warnings.push(`Dropped ambiguous alias "${a}" from ${c.key}`);
        continue;
      }
      seen.add(n);
      aliases.push(a);
    }
    return { ...c, aliases };
  });

  const keys = new Set(withAliases.map((c) => c.key));
  const lookalikes = new Map<string, Set<string>>();
  for (const [a, b] of FLAG_LOOKALIKE_PAIRS) {
    for (const k of [a, b]) {
      if (!keys.has(k)) throw new Error(`Flag look-alike pair references unknown key ${k}`);
    }
    if (!lookalikes.has(a)) lookalikes.set(a, new Set());
    if (!lookalikes.has(b)) lookalikes.set(b, new Set());
    lookalikes.get(a)!.add(b);
    lookalikes.get(b)!.add(a);
  }

  const groupIndex = (g: string) => GROUP_ORDER.indexOf(g as (typeof GROUP_ORDER)[number]);
  const sorted = [...withAliases].sort(
    (x, y) => groupIndex(x.group) - groupIndex(y.group) || x.name.localeCompare(y.name, 'en'),
  );

  const counters = new Map<string, number>();
  const countries: CountryRecord[] = sorted.map((c) => {
    const itemOrder = (counters.get(c.group) ?? 0) + 1;
    counters.set(c.group, itemOrder);
    return {
      key: c.key,
      name: c.name,
      aliases: c.aliases,
      region: c.region,
      subregion: c.subregion,
      group: c.group,
      groupOrder: groupIndex(c.group) + 1,
      itemOrder,
      flag: `/flags/${c.key.toLowerCase()}.svg`,
      flagLookalikes: [...(lookalikes.get(c.key) ?? [])].sort(),
    };
  });

  return { countries, warnings };
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run scripts/lib/build-countries.test.ts`
Expected: PASS (8 tests). If the count test fails because world-countries changed membership data, inspect the difference before changing `EXTRA_KEYS`. Don't just update the expected number.

- [ ] **Step 7: Create the CLI**

Create `scripts/build-content.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import worldCountries from 'world-countries';
import { buildCountries, type RawCountry } from './lib/build-countries';

const root = process.cwd();
const { countries, warnings } = buildCountries(worldCountries as unknown as RawCountry[]);

const flagSrc = path.join(root, 'node_modules', 'flag-icons', 'flags', '4x3');
const flagDest = path.join(root, 'public', 'flags');
fs.rmSync(flagDest, { recursive: true, force: true });
fs.mkdirSync(flagDest, { recursive: true });
for (const c of countries) {
  const file = `${c.key.toLowerCase()}.svg`;
  const src = path.join(flagSrc, file);
  if (!fs.existsSync(src)) throw new Error(`Missing flag asset: ${src}`);
  fs.copyFileSync(src, path.join(flagDest, file));
}

fs.mkdirSync(path.join(root, 'content'), { recursive: true });
fs.writeFileSync(path.join(root, 'content', 'countries.json'), JSON.stringify(countries, null, 2) + '\n');

for (const w of warnings) console.warn(`warn: ${w}`);
console.log(`Wrote ${countries.length} countries to content/countries.json and their flags to public/flags/.`);
```

- [ ] **Step 8: Generate the content**

Run: `npm run content:build`
Expected: possibly some `warn: Dropped …` lines, then `Wrote 197 countries to content/countries.json and their flags to public/flags/.` Check that `public/flags/` holds 197 `.svg` files:

```powershell
(Get-ChildItem public/flags -Filter *.svg).Count
```

Expected: `197`.

- [ ] **Step 9: Spot-check the warnings**

Read the `warn:` lines. Each dropped alias should be genuinely ambiguous (shared by two countries) or another country's name. If a clearly useful alias was dropped (e.g. "Congo" from CG), give it to one country in `EXTRA_ALIASES` and remove it from the other's `altSpellings` via a new `REMOVED_ALIASES` map. Only do this if it actually happens.

- [ ] **Step 10: Commit**

```powershell
git add lib/content scripts content public/flags package.json
git commit -m "feat(content): generate 197-country dataset and flag assets"
```

---

### Task 16: World Flags course definition and registry

**Files:**
- Create: `lib/content/world-flags.ts`, `lib/content/registry.ts`
- Test: `lib/content/world-flags.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/content/world-flags.test.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalize } from '@/lib/engine/grading';
import { getCourse } from './registry';
import { flagPath, WORLD_FLAGS } from './world-flags';

describe('WORLD_FLAGS', () => {
  it('has 197 items and two prompt types', () => {
    expect(WORLD_FLAGS.items).toHaveLength(197);
    expect(WORLD_FLAGS.promptTypes.map((p) => p.id)).toEqual(['flag_to_name', 'name_to_flag']);
    expect(WORLD_FLAGS.placementPromptType).toBe('flag_to_name');
  });

  it('has a flag file for every item', () => {
    for (const item of WORLD_FLAGS.items) {
      expect(fs.existsSync(path.join(process.cwd(), 'public', flagPath(item.key)))).toBe(true);
    }
  });

  it('only references existing items as look-alikes', () => {
    const keys = new Set(WORLD_FLAGS.items.map((i) => i.key));
    for (const item of WORLD_FLAGS.items) for (const k of item.lookalikes) expect(keys.has(k)).toBe(true);
  });

  it('has no two items whose names or aliases normalize identically', () => {
    const owner = new Map<string, string>();
    for (const item of WORLD_FLAGS.items) {
      for (const n of new Set([item.name, ...item.aliases].map(normalize))) {
        expect(owner.get(n) ?? item.key).toBe(item.key);
        owner.set(n, item.key);
      }
    }
  });
});

describe('registry', () => {
  it('looks up courses by slug', () => {
    expect(getCourse('world-flags')).toBe(WORLD_FLAGS);
    expect(getCourse('nope')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/content/world-flags.test.ts`
Expected: FAIL — `Failed to resolve import "./registry"`.

- [ ] **Step 3: Implement the course and registry**

Create `lib/content/world-flags.ts`:

```ts
import countries from '@/content/countries.json';
import type { CourseDef } from '@/lib/engine/types';
import { FLAG_PROMPT_TYPES } from './flag-prompts';
import type { CountryRecord } from './types';

const records = countries as CountryRecord[];

export const WORLD_FLAGS: CourseDef = {
  slug: 'world-flags',
  title: 'World Flags',
  placementPromptType: 'flag_to_name',
  promptTypes: FLAG_PROMPT_TYPES,
  items: records.map((c) => ({
    key: c.key,
    name: c.name,
    aliases: c.aliases,
    group: c.group,
    groupOrder: c.groupOrder,
    itemOrder: c.itemOrder,
    lookalikes: c.flagLookalikes,
  })),
};

export function flagPath(itemKey: string): string {
  return `/flags/${itemKey.toLowerCase()}.svg`;
}
```

Create `lib/content/registry.ts`:

```ts
import type { CourseDef } from '@/lib/engine/types';
import { WORLD_FLAGS } from './world-flags';

const COURSES: Record<string, CourseDef> = {
  [WORLD_FLAGS.slug]: WORLD_FLAGS,
};

export function getCourse(slug: string): CourseDef | null {
  return COURSES[slug] ?? null;
}

export function listCourses(): CourseDef[] {
  return Object.values(COURSES);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/content/world-flags.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```powershell
git add lib/content
git commit -m "feat(content): add World Flags course definition and registry"
```

---

### Task 17: Full verification

- [ ] **Step 1: Run every check**

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: all test files pass (about 100 tests), typecheck exits 0, lint reports no errors, and the build succeeds. Fix any lint errors in the new files. Don't disable rules.

- [ ] **Step 2: Confirm engine purity**

Use the Grep tool (or `git grep`) on `lib/engine` for `from 'react'`, `from 'next`, `supabase`, `Date.now(`, `Math.random(`.
Expected: no matches outside `*.test.ts` and `test-fixtures.ts`.

- [ ] **Step 3: Commit any fixes**

```powershell
git add -A
git commit -m "chore: plan 1 verification fixes"
```

Skip this step if there's nothing to commit.

---

## Notes for Plan 2 (persistence)

- `PromptState.fsrs` holds `Date` objects. When storing it as `jsonb` (or as columns), deserialize `due` and `last_review` back to `Date` before calling the engine. Add a `toEngineState`/`fromEngineState` mapper with a round-trip test. The test must exercise `isDue`: it calls `due.getTime()` and throws on string dates, whereas `applyReview`/`retrievability` silently tolerate strings, so they would hide the bug.
- **Hard requirement: never leak the answer to the browser.** `Question.entry.itemKey` is the answer, and `choiceKeys` are raw ISO codes. The server must send a DTO with opaque per-question choice ids (a server-side map from choice id to item key). Flag images must not reveal the key: `/flags/ec.svg` names the answer to a flag→name question. Use inline SVG or per-question tokens.
- **Hard requirement: persist the issued question.** Save the built `Question` (format + choiceKeys) with the pending session state and grade against it, rather than rebuilding it (a rebuild draws different random choices). Reject submitted choices that weren't offered.
- Sort `topConfusions`/`confusedWith` ties by key (or load rows in a stable order) so "top confusions" doesn't reshuffle between page loads.
- Placement resume: store the placement `QueueSession` and resume it as-is (don't rebuild). Items that entered learning in the meantime are no-ops when answered correctly (`applyPlacementAnswer` only graduates `new` prompts). Set `placement_completed_at` when the queue finishes or the user skips; `deriveStatus` stays `placement` until then.
- Exam caller must always build questions at rung 3 (`buildQuestion({ rung: 3 })`), never via `rungForState`, which returns 2 for a lapsed prompt.
- (Plan 3) `public/flags` is 1.6 MB (rs.svg alone is 182 KB). Run svgo in `content:build` or preload per group so 8-flag grids stay fast.
- (Plan 3 UI) When `nextEntry` returns null with prompts still in learning (e.g. a single straggler prompt, which can't be re-asked back to back), end the session with a "Nothing left to practice right now, come back later" message rather than "All caught up".
- Progress/mastery views should read `fsrs.stability` directly for lapsed prompts. `retrievability()` returns 0 for anything not in review, which would make lapsed items look completely unlearned.
- `StudySession` and `QueueSession` are plain JSON and are stored as-is in `sessions.state`.
- The server picks a fresh RNG per request (e.g. `seededRng(crypto.getRandomValues(...)[0])`); the engine never calls `Math.random`.
- No Docker is installed locally. Plan 2 needs either Docker Desktop (for `supabase start`) or a hosted Supabase dev project for integration tests. That needs a decision before Plan 2.
