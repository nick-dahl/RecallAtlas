# Recall Atlas — Plan 7: US Presidents data + engine (no UI)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Everything the US Presidents course needs below the UI: a reviewed data file of 45 presidents, public-domain portraits, the engine and service extensions (exact answers, distinct choices, sequence neighbours, slots, put-in-order answers), the `US_PRESIDENTS` course definition and its presenter, and tests proving placement, study and the exam work end to end.

**Architecture:** A hand-curated `scripts/presidents-data.ts` is compiled by the content build into `content/presidents.json` (validated). A separate, run-once script fetches each president's lead Wikipedia image, checks its Commons licence is public domain, crops it to 3:4 and commits `content/portraits/<key>.webp`. The engine gains general features (exact answer fields, distinct-label choices, a `sequence` distractor mode, order grading). The services record a *slot* for multi-number presidents and accept `order` answers. A `presidentsPresenter` renders views. The course is defined but **not registered** (so it stays off the dashboard) until Plan 8.

**Tech Stack:** TypeScript, Vitest, tsx, `sharp` (new devDependency, image processing at fetch time only), Wikipedia/Commons APIs (fetch script only).

**Spec:** `docs/superpowers/specs/2026-10-05-us-presidents-design.md`.

## Global Constraints

- 45 items, one per person; presidency numbers 1–47 covered exactly once (Cleveland 22+24, Trump 45+47).
- Typed names: unique surnames suffice; shared surnames (Adams, Harrison, Johnson, Roosevelt, Bush) never accept the bare surname.
- Start years: exact (no typo tolerance); multiple-choice options never repeat a year; a typed year is a mix-up only if it belongs to exactly one other president.
- Party: multiple choice only, distinct options from nearby presidents (2–4), never a mix-up; an option equal to any of the target's accepted parties is never offered as a distractor.
- Put in order: target + 3 nearest by number; never Cleveland with Benjamin Harrison, never Trump with Biden; graded all-or-nothing, credit to the target.
- Portraits: public domain only (checked from Commons metadata); fetched by a separate script, never at runtime or in `content:build`; sent to questions as data URIs with empty alt.
- No view contains item keys; spec §5.9 leak rules hold.
- Flags and Map behaviour unchanged; all existing tests pass.
- Course not added to `lib/content/registry.ts` in this plan.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; message via temp file + `git commit -F`.

## Review Focus

1. **Typing a shared surname alone** ("Adams", "Bush") must be wrong for both namesakes, with no mix-up recorded. Pinned in Task 3 (grading tests).
2. **A Cleveland question's number, gap and year options must agree** (all from the same slot). Pinned in Task 5 (slot consistency test).
3. **Shared start years** (Tyler/W. H. Harrison 1841; Garfield/Arthur 1881): typed "1841" is right for both, and multiple choice never shows 1841 twice or as a distractor for either. Pinned in Task 3.
4. **A forged order answer** (missing, duplicated or foreign ids) is rejected, not graded. Pinned in Task 5.
5. **Andrew Johnson's party question** never offers "Democratic". Pinned in Task 3.

---

## File map

| File | Responsibility |
|---|---|
| `scripts/presidents-data.ts` | The reviewed list: 45 presidents, eras, face look-alikes, order exclusions |
| `scripts/lib/build-presidents.ts` (+ test) | Validation and `PresidentRecord` output |
| `scripts/fetch-portraits.ts` | One-off: Wikipedia lead image → licence check → 3:4 webp + credits |
| `scripts/build-content.ts` | Writes `content/presidents.json` |
| `content/presidents.json`, `content/portraits/*.webp`, `content/portraits/CREDITS.md` | Generated, committed |
| `lib/content/types.ts` | `PresidentRecord` |
| `lib/engine/{types,grading,distractors,question,order}.ts` (+ tests) | Engine features |
| `lib/content/{president-prompts,us-presidents,portrait-art}.ts` (+ tests) | Course definition, portraits as data URIs |
| `lib/study/{types,validate,issue,present,presidents-presenter,presenters,test-helpers}.ts` (+ tests) | Slots, order answers, views |
| `components/session/question-stage.tsx`, places using `ItemView.flag` | Interim compatibility (real UI in Plan 8) |
| `lib/content/us-presidents.simulation.test.ts`, `lib/study/presidents-flow.int.test.ts` | Simulation and Supabase flow |

---

### Task 1: The president list and its build

**Files:** Create `scripts/presidents-data.ts`, `scripts/lib/build-presidents.ts`, `scripts/lib/build-presidents.test.ts`; modify `lib/content/types.ts`, `scripts/build-content.ts`; generate `content/presidents.json`.

**Interfaces:**
- `PRESIDENTS: PresidentEntry[]`, `ERAS: readonly string[]`, `FACE_LOOKALIKE_PAIRS: [string, string][]`, `ORDER_EXCLUSIONS: [string, string][]`.
- `buildPresidents(entries, eras, facePairs, exclusions) → PresidentRecord[]` (throws on any §3.6 violation; does **not** check portrait files, which Task 2 adds).
- `PresidentRecord { key; name; aliases: string[]; numbers: number[]; startYears: number[]; party: string; partyAliases: string[]; era: string; groupOrder: number; itemOrder: number; lookalikes: string[]; wikipedia: string; commonsFile?: string }`.

- [ ] **Step 1: The data.** `scripts/presidents-data.ts`:

```ts
export const ERAS = [
  'Founding era',
  'Jacksonian era',
  'Civil War era',
  'Gilded Age',
  'Progressive era & twenties',
  'Depression, war & postwar',
  'Late Cold War',
  'Modern era',
] as const;

export interface PresidentEntry {
  key: string;
  name: string;
  /** Accepted typed answers besides `name`. Never a bare shared surname. */
  aliases: string[];
  numbers: number[];
  startYears: number[];
  party: string;
  partyAliases?: string[];
  era: (typeof ERAS)[number];
  /** English Wikipedia article whose lead image is the portrait. */
  wikipedia: string;
  /** Overrides the lead image with a specific Commons file (e.g. when the lead image is not public domain). */
  commonsFile?: string;
}

const DR = 'Democratic-Republican';
const D = 'Democratic';
const R = 'Republican';

export const PRESIDENTS: PresidentEntry[] = [
  { key: 'washington', name: 'George Washington', aliases: ['Washington'], numbers: [1], startYears: [1789], party: 'No party', era: 'Founding era', wikipedia: 'George_Washington' },
  { key: 'j-adams', name: 'John Adams', aliases: [], numbers: [2], startYears: [1797], party: 'Federalist', era: 'Founding era', wikipedia: 'John_Adams' },
  { key: 'jefferson', name: 'Thomas Jefferson', aliases: ['Jefferson'], numbers: [3], startYears: [1801], party: DR, era: 'Founding era', wikipedia: 'Thomas_Jefferson' },
  { key: 'madison', name: 'James Madison', aliases: ['Madison'], numbers: [4], startYears: [1809], party: DR, era: 'Founding era', wikipedia: 'James_Madison' },
  { key: 'monroe', name: 'James Monroe', aliases: ['Monroe'], numbers: [5], startYears: [1817], party: DR, era: 'Founding era', wikipedia: 'James_Monroe' },
  { key: 'jq-adams', name: 'John Quincy Adams', aliases: ['J. Q. Adams', 'JQA', 'Quincy Adams'], numbers: [6], startYears: [1825], party: DR, partyAliases: ['National Republican'], era: 'Founding era', wikipedia: 'John_Quincy_Adams' },
  { key: 'jackson', name: 'Andrew Jackson', aliases: ['Jackson'], numbers: [7], startYears: [1829], party: D, era: 'Jacksonian era', wikipedia: 'Andrew_Jackson' },
  { key: 'van-buren', name: 'Martin Van Buren', aliases: ['Van Buren'], numbers: [8], startYears: [1837], party: D, era: 'Jacksonian era', wikipedia: 'Martin_Van_Buren' },
  { key: 'wh-harrison', name: 'William Henry Harrison', aliases: ['W. H. Harrison', 'William Harrison'], numbers: [9], startYears: [1841], party: 'Whig', era: 'Jacksonian era', wikipedia: 'William_Henry_Harrison' },
  { key: 'tyler', name: 'John Tyler', aliases: ['Tyler'], numbers: [10], startYears: [1841], party: 'Whig', era: 'Jacksonian era', wikipedia: 'John_Tyler' },
  { key: 'polk', name: 'James K. Polk', aliases: ['Polk', 'James Polk'], numbers: [11], startYears: [1845], party: D, era: 'Jacksonian era', wikipedia: 'James_K._Polk' },
  { key: 'taylor', name: 'Zachary Taylor', aliases: ['Taylor'], numbers: [12], startYears: [1849], party: 'Whig', era: 'Jacksonian era', wikipedia: 'Zachary_Taylor' },
  { key: 'fillmore', name: 'Millard Fillmore', aliases: ['Fillmore'], numbers: [13], startYears: [1850], party: 'Whig', era: 'Civil War era', wikipedia: 'Millard_Fillmore' },
  { key: 'pierce', name: 'Franklin Pierce', aliases: ['Pierce'], numbers: [14], startYears: [1853], party: D, era: 'Civil War era', wikipedia: 'Franklin_Pierce' },
  { key: 'buchanan', name: 'James Buchanan', aliases: ['Buchanan'], numbers: [15], startYears: [1857], party: D, era: 'Civil War era', wikipedia: 'James_Buchanan' },
  { key: 'lincoln', name: 'Abraham Lincoln', aliases: ['Lincoln'], numbers: [16], startYears: [1861], party: R, partyAliases: ['National Union'], era: 'Civil War era', wikipedia: 'Abraham_Lincoln' },
  { key: 'a-johnson', name: 'Andrew Johnson', aliases: [], numbers: [17], startYears: [1865], party: 'National Union', partyAliases: [D], era: 'Civil War era', wikipedia: 'Andrew_Johnson' },
  { key: 'grant', name: 'Ulysses S. Grant', aliases: ['Grant', 'Ulysses Grant'], numbers: [18], startYears: [1869], party: R, era: 'Civil War era', wikipedia: 'Ulysses_S._Grant' },
  { key: 'hayes', name: 'Rutherford B. Hayes', aliases: ['Hayes', 'Rutherford Hayes'], numbers: [19], startYears: [1877], party: R, era: 'Gilded Age', wikipedia: 'Rutherford_B._Hayes' },
  { key: 'garfield', name: 'James A. Garfield', aliases: ['Garfield', 'James Garfield'], numbers: [20], startYears: [1881], party: R, era: 'Gilded Age', wikipedia: 'James_A._Garfield' },
  { key: 'arthur', name: 'Chester A. Arthur', aliases: ['Arthur', 'Chester Arthur'], numbers: [21], startYears: [1881], party: R, era: 'Gilded Age', wikipedia: 'Chester_A._Arthur' },
  { key: 'cleveland', name: 'Grover Cleveland', aliases: ['Cleveland'], numbers: [22, 24], startYears: [1885, 1893], party: D, era: 'Gilded Age', wikipedia: 'Grover_Cleveland' },
  { key: 'b-harrison', name: 'Benjamin Harrison', aliases: ['Ben Harrison'], numbers: [23], startYears: [1889], party: R, era: 'Gilded Age', wikipedia: 'Benjamin_Harrison' },
  { key: 'mckinley', name: 'William McKinley', aliases: ['McKinley'], numbers: [25], startYears: [1897], party: R, era: 'Gilded Age', wikipedia: 'William_McKinley' },
  { key: 't-roosevelt', name: 'Theodore Roosevelt', aliases: ['Teddy Roosevelt', 'TR'], numbers: [26], startYears: [1901], party: R, era: 'Progressive era & twenties', wikipedia: 'Theodore_Roosevelt' },
  { key: 'taft', name: 'William Howard Taft', aliases: ['Taft'], numbers: [27], startYears: [1909], party: R, era: 'Progressive era & twenties', wikipedia: 'William_Howard_Taft' },
  { key: 'wilson', name: 'Woodrow Wilson', aliases: ['Wilson'], numbers: [28], startYears: [1913], party: D, era: 'Progressive era & twenties', wikipedia: 'Woodrow_Wilson' },
  { key: 'harding', name: 'Warren G. Harding', aliases: ['Harding', 'Warren Harding'], numbers: [29], startYears: [1921], party: R, era: 'Progressive era & twenties', wikipedia: 'Warren_G._Harding' },
  { key: 'coolidge', name: 'Calvin Coolidge', aliases: ['Coolidge'], numbers: [30], startYears: [1923], party: R, era: 'Progressive era & twenties', wikipedia: 'Calvin_Coolidge' },
  { key: 'hoover', name: 'Herbert Hoover', aliases: ['Hoover'], numbers: [31], startYears: [1929], party: R, era: 'Progressive era & twenties', wikipedia: 'Herbert_Hoover' },
  { key: 'f-roosevelt', name: 'Franklin D. Roosevelt', aliases: ['Franklin Roosevelt', 'FDR'], numbers: [32], startYears: [1933], party: D, era: 'Depression, war & postwar', wikipedia: 'Franklin_D._Roosevelt' },
  { key: 'truman', name: 'Harry S. Truman', aliases: ['Truman', 'Harry Truman'], numbers: [33], startYears: [1945], party: D, era: 'Depression, war & postwar', wikipedia: 'Harry_S._Truman' },
  { key: 'eisenhower', name: 'Dwight D. Eisenhower', aliases: ['Eisenhower', 'Dwight Eisenhower'], numbers: [34], startYears: [1953], party: R, era: 'Depression, war & postwar', wikipedia: 'Dwight_D._Eisenhower' },
  { key: 'kennedy', name: 'John F. Kennedy', aliases: ['Kennedy', 'John Kennedy', 'JFK'], numbers: [35], startYears: [1961], party: D, era: 'Depression, war & postwar', wikipedia: 'John_F._Kennedy' },
  { key: 'l-johnson', name: 'Lyndon B. Johnson', aliases: ['Lyndon Johnson', 'LBJ'], numbers: [36], startYears: [1963], party: D, era: 'Depression, war & postwar', wikipedia: 'Lyndon_B._Johnson' },
  { key: 'nixon', name: 'Richard Nixon', aliases: ['Nixon'], numbers: [37], startYears: [1969], party: R, era: 'Late Cold War', wikipedia: 'Richard_Nixon' },
  { key: 'ford', name: 'Gerald Ford', aliases: ['Ford'], numbers: [38], startYears: [1974], party: R, era: 'Late Cold War', wikipedia: 'Gerald_Ford' },
  { key: 'carter', name: 'Jimmy Carter', aliases: ['Carter'], numbers: [39], startYears: [1977], party: D, era: 'Late Cold War', wikipedia: 'Jimmy_Carter' },
  { key: 'reagan', name: 'Ronald Reagan', aliases: ['Reagan'], numbers: [40], startYears: [1981], party: R, era: 'Late Cold War', wikipedia: 'Ronald_Reagan' },
  { key: 'hw-bush', name: 'George H. W. Bush', aliases: ['H. W. Bush', 'Bush 41'], numbers: [41], startYears: [1989], party: R, era: 'Late Cold War', wikipedia: 'George_H._W._Bush' },
  { key: 'clinton', name: 'Bill Clinton', aliases: ['Clinton'], numbers: [42], startYears: [1993], party: D, era: 'Modern era', wikipedia: 'Bill_Clinton' },
  { key: 'gw-bush', name: 'George W. Bush', aliases: ['G. W. Bush', 'Bush 43'], numbers: [43], startYears: [2001], party: R, era: 'Modern era', wikipedia: 'George_W._Bush' },
  { key: 'obama', name: 'Barack Obama', aliases: ['Obama'], numbers: [44], startYears: [2009], party: D, era: 'Modern era', wikipedia: 'Barack_Obama' },
  { key: 'trump', name: 'Donald Trump', aliases: ['Trump'], numbers: [45, 47], startYears: [2017, 2025], party: R, era: 'Modern era', wikipedia: 'Donald_Trump' },
  { key: 'biden', name: 'Joe Biden', aliases: ['Biden'], numbers: [46], startYears: [2021], party: D, era: 'Modern era', wikipedia: 'Joe_Biden' },
];

/** Easily confused faces (seed confusions), each pair once. Era neighbours are added automatically. */
export const FACE_LOOKALIKE_PAIRS: [string, string][] = [
  ['arthur', 'hayes'], ['pierce', 'fillmore'], ['harding', 'coolidge'], ['b-harrison', 'hayes'],
  ['madison', 'monroe'], ['taft', 'mckinley'], ['hw-bush', 'gw-bush'], ['wh-harrison', 'tyler'],
];

/** Pairs never put in the same put-in-order question: no single chronological order exists. */
export const SHARED_SPAN_PAIRS: [string, string][] = [
  ['cleveland', 'b-harrison'],
  ['trump', 'biden'],
];
```

(The spec calls these "order exclusions"; the constant is `SHARED_SPAN_PAIRS` and the course field `orderExclusions`.)

- [ ] **Step 2: Failing tests** `scripts/lib/build-presidents.test.ts`:

```ts
const records = buildPresidents(PRESIDENTS, ERAS, FACE_LOOKALIKE_PAIRS, SHARED_SPAN_PAIRS);
const byKey = new Map(records.map((r) => [r.key, r]));

it('has 45 presidents covering presidencies 1–47 exactly once', () => {
  expect(records).toHaveLength(45);
  expect(records.flatMap((r) => r.numbers).sort((a, b) => a - b)).toEqual(Array.from({ length: 47 }, (_, i) => i + 1));
});
it('orders items chronologically within 8 eras of 5–6', () => { ... groupOrder 1..8, itemOrder by first number, sizes 5–6 });
it('never accepts a bare shared surname', () => {
  for (const s of ['adams', 'harrison', 'johnson', 'roosevelt', 'bush'])
    for (const r of records) expect([r.name, ...r.aliases].map(normalize)).not.toContain(s);
});
it('has no typed name accepted by two presidents', ...);
it('lists era neighbours first, then face look-alikes, as look-alikes', () => {
  expect(byKey.get('polk')!.lookalikes.slice(0, 2).sort()).toEqual(['taylor', 'tyler']);
  expect(byKey.get('arthur')!.lookalikes).toContain('hayes');
});
it('keeps the party rulings', () => { washington 'No party'; tyler 'Whig'; a-johnson 'National Union' + ['Democratic']; lincoln partyAliases ['National Union'] });
it('matches the committed content/presidents.json', ...);
// validation
it('throws on a gap or duplicate in the numbers', ...);
it('throws on a typed name shared by two presidents', ...);
it('throws on an unknown look-alike or exclusion key', ...);
it('does not require start years to be unique (1841 twice)', ...);
```

- [ ] **Step 3: Implement** `buildPresidents`: validate (numbers 1..N once; at least one number, start year, party; era known; typed names unique after `normalize`; known keys in pairs), compute `groupOrder` (era index + 1) and `itemOrder` (rank by first number within era), `lookalikes` = era neighbours sorted by number distance (all presidents within ±3 numbers, nearest first) then face pairs, deduped, never self. Add `PresidentRecord` to `lib/content/types.ts`. `build-content.ts` writes `content/presidents.json`.
- [ ] **Step 4:** `npm run content:build`; `npx vitest run scripts` → PASS. Commit `feat(content): the reviewed US presidents list`.

---

### Task 2: Portraits

**Files:** Create `scripts/fetch-portraits.ts`, `lib/content/portrait-art.ts` (+ test), `content/portraits/*.webp`, `content/portraits/CREDITS.md`, `content/portraits/sources.json`; modify `package.json` (`content:portraits`, devDependency `sharp`), `next.config.ts` (trace `content/portraits`), `scripts/lib/build-presidents.ts` (portrait file check, via an injected `hasPortrait`).

**Interfaces:** `portraitDataUri(key: string): string` (server-side, cached, like `flagDataUri`).

- [ ] **Step 1:** `npm install -D sharp`.
- [ ] **Step 2: Fetch script.** For each entry (sequential, polite `User-Agent: RecallAtlas content build (nicholasryandahl@gmail.com)`):
  1. File: `commonsFile` if set, else the article's lead image (`action=query&prop=pageimages&piprop=name&titles=<wikipedia>` on en.wikipedia.org).
  2. Metadata: `commons.wikimedia.org` `prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=900&titles=File:<name>`. Accept only if `LicenseShortName` or `License` matches public domain (`/^(pd|public domain)/i` or `cc0`); otherwise collect a failure naming the president and file.
  3. Download the 900-px thumbnail, then `sharp(buf).resize(240, 320, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 72 })` → `content/portraits/<key>.webp`.
  4. Write `sources.json` (`key → { file, page, license, artist }`) and `CREDITS.md`.
  5. Exit non-zero listing every failure; a failure is fixed by adding a reviewed `commonsFile` override in the data, not by relaxing the licence check.
- [ ] **Step 3:** Run `npm run content:portraits`; fix failures with `commonsFile` overrides (public-domain official photographs for photo-era presidents). Build a contact sheet (scratch HTML of all 45, numbered) and check every crop by eye: face visible, not cut off, consistent framing. Re-crop individual files with a per-entry `crop` hint if needed (`position: 'north'`), recorded in the data.
- [ ] **Step 4: Tests.** `portrait-art.test.ts`: every president has a portrait file under 30 KB; `portraitDataUri` returns `data:image/webp;base64,…`; no data URI contains the president's name or key. `buildPresidents` now fails on a missing portrait (test with an injected `hasPortrait`).
- [ ] **Step 5:** Commit `feat(content): public-domain portraits for every president`.

---

### Task 3: Engine — exact answers, distinct choices, sequence neighbours, order grading

**Files:** Modify `lib/engine/{types,grading,distractors,question,index}.ts` and tests; create `lib/engine/order.ts` (+ test); add `TEST_SEQ_COURSE` to `lib/engine/test-fixtures.ts`.

**Interfaces:**
- `Format` += `'image-grid' | 'gap-choice' | 'gap-typed' | 'order'`; `FormatSpec.format` likewise; `FormatSpec.window?: number`.
- `DistractorMode` += `'sequence'`.
- `Item.sequence?: number[]`.
- `PromptTypeDef.exactAnswer?: boolean`, `distinctChoices?: boolean`, `recordsConfusions?: boolean` (default true).
- `CourseDef.orderExclusions?: [string, string][]`.
- `acceptedAnswers(item, field): string[]` (exported from grading; display values, first = displayed).
- `gradeTyped(input, target, items, field = 'name', opts: { exact?: boolean } = {})`.
- `pickDistractors({ …, distinct?: { label: (i: Item) => string; taken: string[] }, window?: number, exclusions?: [string, string][] })`.
- `gradeOrder(keys: string[], course: CourseDef): boolean`.
- `isTypedFormat(format): boolean` (`typed` | `gap-typed`).

- [ ] **Step 1: Fixture** `TEST_SEQ_COURSE`: 8 synthetic items `s1…s8` in two groups, `sequence` `[1]…[8]` with `s3` = `[3, 5]` (a two-term item) and `s4` = `[4]`, `orderExclusions: [['s3', 's4']]`, answers `year` (s1 '1801', s2 '1810', s3 '1820'/'1830', s4 '1825', s6 '1840', s7 '1840', s8 '1850') and `party` (A, B, A, C, B, A, …, s8 party 'B' with alias 'C'), prompt types mirroring the presidents' (`exactAnswer` on year; `distinctChoices` + `recordsConfusions: false` on party).
- [ ] **Step 2: Failing tests.**
  - `grading.test.ts`: exact mode accepts '1820' and '1830' for s3 and rejects '1802' for s1 (would be a typo otherwise); typed '1840' for s1 (shared by s6, s7) → wrong, no mix-up; typed '1810' for s1 → mix-up with s2. Bare shared surname: with two items named 'John Adams'/'John Quincy Adams' (aliases as in the data), "Adams" → wrong, `answeredItemKey: null`; "JQA" → correct; "John Adams" for JQA → mix-up with John Adams.
  - `distractors.test.ts`: `sequence` mode returns nearest by number, ties broken by lower number, skipping exclusions involving the target or another chosen key; respects `window`; `distinct` never yields a label in `taken` nor two equal labels (party for s8 never offers 'B' or 'C').
  - `order.test.ts`: `gradeOrder` true only for ascending first numbers; throws for an item without `sequence`.
  - `question.test.ts`: order format picks target + 3 via `sequence` (exclusions honoured); party question has 2–4 options with distinct labels; year question never repeats a year.
- [ ] **Step 3: Implement.**

`grading.ts`:

```ts
/** Display values of an answer field, the displayed one first ('name' = name + aliases). */
export function acceptedAnswers(item: Item, field: string): string[] {
  const a = field === 'name' ? { text: item.name, aliases: item.aliases } : item.answers?.[field];
  return a ? [a.text, ...a.aliases] : [];
}
const namesOf = (item: Item, field: string) => acceptedAnswers(item, field).map(normalize).filter(Boolean);

export function gradeTyped(input, target, allItems, field = 'name', opts: { exact?: boolean } = {}): AnswerGrade {
  const n = normalize(input);
  if (!n) return wrong();
  if (namesOf(target, field).includes(n)) return { correct: true, typo: false, answeredItemKey: null };
  const others = allItems.filter((i) => i.key !== target.key);
  const exactOthers = others.filter((i) => namesOf(i, field).includes(n));
  if (opts.exact) return wrong(exactOthers.length === 1 ? exactOthers[0].key : null);
  if (exactOthers.length > 0) return wrong(exactOthers[0].key);
  // …existing typo logic unchanged
}
```

`distractors.ts` — a `sequence` ordering and two filters:

```ts
const distanceTo = (a: Item, b: Item) =>
  Math.min(...(a.sequence ?? []).flatMap((x) => (b.sequence ?? []).map((y) => Math.abs(x - y))));

// mode === 'sequence': items with a sequence, within `window` if set, nearest first (ties: lower number)
// Falls back to 'local' ordering for items without `sequence`.

// After ordering, a greedy pass keeps a candidate only if
//  - with `distinct`: its normalized label is not in `taken` and not already chosen;
//  - with `exclusions`: it forms no excluded pair with the target or an already chosen key.
```

`order.ts`:

```ts
export function gradeOrder(keys: readonly string[], course: CourseDef): boolean {
  const firsts = keys.map((k) => {
    const seq = getItem(course, k).sequence;
    if (!seq?.length) throw new Error(`Item ${k} has no sequence`);
    return seq[0];
  });
  return firsts.every((n, i) => i === 0 || n > firsts[i - 1]);
}
```

`question.ts`: pass `distinct` (when `promptType.distinctChoices`: `label = (i) => acceptedAnswers(i, field)[0]`, `taken = acceptedAnswers(target, field)`), `window: spec.window`, `exclusions: course.orderExclusions` (for `sequence` mode). `isTypedFormat` exported from `types.ts`.

- [ ] **Step 4:** `npx vitest run lib/engine` and the full suite → PASS (Flags/Map unchanged). Commit `feat(engine): exact answers, distinct choices, sequence neighbours, order grading`.

---

### Task 4: `US_PRESIDENTS` course

**Files:** Create `lib/content/president-prompts.ts`, `lib/content/us-presidents.ts`, `lib/content/us-presidents.test.ts`.

**Interfaces:** `PRESIDENT_PROMPT_TYPES`, `US_PRESIDENTS: CourseDef` (slug `us-presidents`, title `US Presidents`), `presidentRecord(key): PresidentRecord`.

- [ ] **Step 1: Prompt types.**

```ts
export const PRESIDENT_PROMPT_TYPES: PromptTypeDef[] = [
  { id: 'number_to_name', label: 'Number → Name', formats: {
      1: { format: 'mc-text', choices: 4, distractors: 'local' },
      2: { format: 'mc-text', choices: 6, distractors: 'hard' },
      3: { format: 'typed' } } },
  { id: 'portrait_to_name', label: 'Portrait → Name', formats: {
      1: { format: 'mc-text', choices: 4, distractors: 'local' },
      2: { format: 'mc-text', choices: 6, distractors: 'hard' },
      3: { format: 'typed' } } },
  { id: 'name_to_portrait', label: 'Name → Portrait', formats: {
      1: { format: 'image-grid', choices: 4, distractors: 'local' },
      2: { format: 'image-grid', choices: 6, distractors: 'hard' },
      3: { format: 'image-grid', choices: 8, distractors: 'hard' } } },
  { id: 'start_year', label: 'Start year', answerField: 'startYear', exactAnswer: true, distinctChoices: true, formats: {
      1: { format: 'mc-text', choices: 4, distractors: 'local' },
      2: { format: 'mc-text', choices: 6, distractors: 'hard' },
      3: { format: 'typed' } } },
  { id: 'party', label: 'Party', answerField: 'party', distinctChoices: true, recordsConfusions: false, formats: {
      1: { format: 'mc-text', choices: 4, distractors: 'sequence', window: 6 },
      2: { format: 'mc-text', choices: 4, distractors: 'sequence', window: 6 },
      3: { format: 'mc-text', choices: 4, distractors: 'sequence', window: 6 } } },
  { id: 'sequence', label: 'Sequence', formats: {
      1: { format: 'gap-choice', choices: 4, distractors: 'local' },
      2: { format: 'order', choices: 4, distractors: 'sequence' },
      3: { format: 'gap-typed' } } },
];
```

- [ ] **Step 2: Course.** Items from `content/presidents.json`: `group` = era, `groupOrder`, `itemOrder`, `lookalikes`, `sequence: numbers`, `answers: { startYear: { text: String(startYears[0]), aliases: startYears.slice(1).map(String) }, party: { text: party, aliases: partyAliases } }`. `placementPromptType: 'number_to_name'`, `placementGraduates: ['number_to_name', 'sequence']`, `orderExclusions: SHARED_SPAN_PAIRS` (from the JSON, so runtime code never imports `scripts/`).
- [ ] **Step 3: Tests.** 45 items, 6 prompt types; placement settings; Cleveland has `sequence [22, 24]` and years 1885/1893; Johnson's party aliases; `getCourse('us-presidents')` is **null** (not registered yet).
- [ ] **Step 4:** Commit `feat(content): the US Presidents course definition`.

---

### Task 5: Services — slots, order answers, the presenter

**Files:** Modify `lib/study/{types,validate,issue,present,presenters,turn,test-helpers}.ts` (+ tests); create `lib/study/presidents-presenter.ts` (+ test); interim compatibility in `components/session/question-stage.tsx` and every `ItemView.flag` use (`feedback-panel`, `end-screen`, `contrast-drill`, `app/courses/[slug]/page.tsx`) via a new `lib/ui/item-image.ts` (`itemImage(view) = view.flag ?? view.portrait ?? ''`).

**Interfaces:**
- `PendingQuestion.slot?: number`.
- `AnswerResponse` += `{ kind: 'order'; choiceIds: string[] }`.
- `QuestionView.prompt` += `portrait?: string; gap?: { before?: string; after?: string }`; `asks` += `'year'`.
- `QuestionView.choices[]` += `portrait?: string`.
- `ItemView`: `flag` becomes optional; += `portrait?`, `numbers?: number[]`, `startYears?: number[]`, `party?: string`.
- `FeedbackView.order?: string[]` (names, correct order).
- `Presenter.choice(itemKey, format, promptType?, pending?)`; optional `Presenter.feedbackExtra?(pending, grade): Partial<FeedbackView>` (the map presenter's `feedbackMap` moves under it as `{ map }`).
- `presidentsPresenter(course, { portrait: (key) => string })`.

- [ ] **Step 1: Failing tests.**
  - `validate.test.ts`: order accepted with 2–8 unique UUIDs; rejected when empty, duplicated, too long, or not UUIDs.
  - `issue.test.ts` (on `TEST_SEQ_COURSE` and on `US_PRESIDENTS`):
    - a slot is recorded only for multi-number items, and is one of their numbers;
    - order grading: the issued choice ids in chronological order → correct; any other order → wrong, `answeredItemKey: null`; a missing, duplicated or foreign id → `invalid_response`; an order answer to a non-order question → `invalid_response`;
    - `gap-typed` accepts typed names; `typed` year exact;
    - party misses have `answeredItemKey: null`.
  - `presidents-presenter.test.ts`:
    - number → name: "Who was the 16th president?" (ordinals 1st, 2nd, 3rd, 11th–13th, 21st, 22nd);
    - Cleveland slot consistency: the number, the gap's neighbours (22: `Chester A. Arthur → ? → Benjamin Harrison`; 24: `Benjamin Harrison → ? → William McKinley`) and the year label (1885 / 1893) all follow `pending.slot`;
    - the ends of the list: `? → John Adams`, `Joe Biden → ?` (Trump at 47) and `Barack Obama → ? → Joe Biden` (Trump at 45);
    - portrait → name contains a portrait and no name outside choice labels; name → portrait choices are portraits with no labels;
    - start year and party questions name only the target; put-in-order names the four, with no numbers or years;
    - no view contains an item key; `feedbackExtra` returns the chronological order for order questions.
- [ ] **Step 2: Implement.**
  - `issueQuestion`: after building, `slot` = for items with `sequence.length > 1`, `sequence[Math.floor(rng() * length)]`.
  - `gradeSubmission`:
    - `typed` allowed for `isTypedFormat`; passes `{ exact: promptType.exactAnswer }`;
    - new `order` case: ids must be exactly the issued ids (same set, same length), mapped to keys → `gradeOrder`;
    - finally, when `promptType.recordsConfusions === false`, set `answeredItemKey: null`.
  - `presidentsPresenter`: prompts and labels per spec §5.8; neighbours via a number → item map; the year label of the target uses `pending.slot`; `feedbackExtra` = `{ order }` for order questions (names sorted by first number).
  - `presenters.ts`: `case 'us-presidents'` with `portraitDataUri`.
  - Interim UI: `question-stage` maps `image-grid → FlagGrid`, `gap-choice → ChoiceList`, `gap-typed → TypedAnswer`, `order → ChoiceList` (placeholder; Plan 8 replaces). `itemImage` at each `ItemView.flag` use.
- [ ] **Step 3:** `npm test`, `npm run typecheck`, `npm run lint` → PASS. Commit `feat(study): slots, order answers and the presidents presenter`.

---

### Task 6: Simulation and Supabase flow

**Files:** Create `lib/content/us-presidents.simulation.test.ts`, `lib/study/presidents-flow.int.test.ts`; extend `test-helpers.correctResponse` (order → issued ids sorted chronologically; typed → the prompt's answer field, the slot's year for start year).

- [ ] **Step 1: Simulation** (30 days, two 20-answer sessions a day, perfect placement): placement graduates exactly `number_to_name` and `sequence` for all 45; every other prompt is introduced in study; a learner who answers Polk's start year as 1849 twice records a Polk → Taylor mix-up and gets a contrast drill; party misses never record mix-ups; record the observed number of prompts in review at day 30 in the assertion comment.
- [ ] **Step 2: Integration** (hosted dev DB, throwaway user): enroll; placement fully correct by typing (`placement_complete`, readiness `2 × 45`); seed every prompt to review; a 45-question exam answered correctly (including order and typed-year questions if drawn) → passed; a Practice ahead check of 20 with no repeats.
- [ ] **Step 3:** Run both; commit `test(presidents): learner simulation and Supabase flow`.

---

### Task 7: Verification and hand-off

- [ ] `npm test`, `npm run typecheck`, `npm run lint`, `npm run test:integration`, `npm run build`, existing e2e suite (`npx playwright test`) — all green.
- [ ] Notes for Plan 8 (UI): the six formats' renderers (portrait frame, image grid, gap chain, tap-in-order, year input), timeline course home, registering the course, dashboard card and blurb, landing eyebrow, e2e.
