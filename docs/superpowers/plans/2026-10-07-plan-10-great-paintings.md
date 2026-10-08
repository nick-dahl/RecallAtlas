# Great Paintings Implementation Plan (Plan 10)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Great Paintings course: about 246 public-domain paintings, quizzed image → title, image → artist, title → image and image → movement, with a gallery-wall course home.

**Architecture:**
- **Content:** a reviewed data file (`scripts/paintings-data.ts`) is validated and expanded by `scripts/lib/build-paintings.ts` into `content/paintings.json`. A one-off fetch script writes two webp sizes per painting plus credits into `content/paintings/`.
- **Engine:** gains five small opt-in features:
  - forgiving leading articles;
  - look-alike-aware mix-up resolution;
  - per-prompt ambiguous answers;
  - a balanced "shared answer" option (for "Anonymous");
  - a placement head start.
- **Course code:** a paintings presenter, a painting frame component, the gallery wall, a rank-addressed image route and a credits page. All follow the US Presidents course's patterns.

**Tech Stack:** Next.js 16 App Router, React 19.2, Tailwind v4, TypeScript, Vitest, Playwright, Supabase, sharp (already a dev dependency, used by `fetch-portraits.ts`).

**Spec:** `docs/superpowers/specs/2026-10-07-great-paintings-design.md`. Approved painting list: `docs/superpowers/specs/2026-10-07-great-paintings-list.md`.

## Global Constraints

- **Next.js:** before writing any Next.js code (routes, pages), read the relevant guide in `node_modules/next/dist/docs/` (AGENTS.md). Follow existing patterns: `params` is a `Promise`.
- **Prettier:** do not run it. The project has none, and it reformats files.
- **Commits:** messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Write each message to a temp file and run `git commit -F`.
- **Copyright:** works published before 1931 only.
  - **Licences:** images must be public domain or CC0. CC BY or CC BY-SA is allowed only for works marked `inSitu` (caves, frescoes, murals photographed in place), and the photographer is credited.
  - **No source:** a work with no allowed source is dropped, and the drop is recorded as a `Ruling:` line.
- **Images:**
  - **Sizes:** a large image of at most 900 px on the long side and **≤ 150 KB**, plus a thumbnail of at most 320 px on the long side and **≤ 30 KB**. Both are webp.
  - **Cropping:** never cropped, except for an explicit `crop` (a detail).
- **Limits:** at most 4 works per named artist, at most 8 anonymous works, and at least 6 works per movement.
- **Inside questions:**
  - Images are data URIs with `alt=""`.
  - No view contains an item key or an image file name.
  - Reference views address images by fame rank (`/api/painting-art/17`), never by key.
- **Course facts:**
  - **Identity:** slug `great-paintings`, title `Great Paintings`.
  - **Blurb:** `"{N} of the world's great paintings: title, artist and movement"`, where N is the item count.
  - **Answers:** "Anonymous" and "Unknown" are correct only for anonymous works, and are never recorded as a mix-up elsewhere.
- **Placement:**
  - **Prompt:** typed `image_to_title`.
  - **Fast-track:** a correct answer graduates `image_to_title` and `title_to_image`.
  - **The other prompts:** they stay new, then are introduced by an intro card at level 2 (`placementHeadStart: 2`).

## Review Focus

1. **Typed titles with punctuation, accents or articles** ("Dejeuner sur l herbe", "bal du moulin de la galette", "A Bar at the Folies Bergere") are accepted. Covered by Task 6's grading test.
2. **A first name alone** ("Vincent", "Pieter") is wrong. It records no mix-up, and an artist sharing that first name is never blamed. Covered by Task 6's grading test.
3. **Near-twin titles in one title → image grid.** When the *Judith* pair or the two *Last Supper*s appear together, only the exact target is correct. Covered by Task 6's grading test.
4. **The gallery wall never names an unintroduced painting** in text, `alt`, `title` attributes or URLs. Covered by Task 8's unit test and Task 9's e2e test.
5. **Placing many paintings correctly never floods learning.** The number of learning prompts stays within `ENGINE_CONFIG.maxLearningPrompts` plus one item's prompts. Covered by Task 9's simulation.

---

## File structure

| File | Responsibility |
|---|---|
| `lib/engine/grading.ts` (modify) | Leading "a/an" ignored. An exact answer shared by several other items resolves to a look-alike or to nobody |
| `lib/engine/types.ts` (modify) | `PromptTypeDef.ambiguous`, `PromptTypeDef.sharedAnswer`, `CourseDef.placementHeadStart` |
| `lib/engine/question.ts` (modify) | Shared-answer decoy balancing |
| `lib/engine/ladder.ts`, `lib/engine/answer.ts` (modify) | `introduce(state, rung)`, `applyIntro({ rung })` |
| `lib/study/issue.ts` (modify) | Per-prompt ambiguous answers, for typing and picking |
| `lib/study/study-service.ts` (modify) | Head-start rung on intro |
| `scripts/paintings-data.ts` (create) | The reviewed list: movements, artists, paintings, subject pairs |
| `scripts/lib/build-paintings.ts` (+ test) | Validation (spec §3.6) and derivation (rooms, neighbours, look-alikes) |
| `scripts/lib/portrait-license.ts` (modify) | `isAttribution()` for CC BY / CC BY-SA |
| `scripts/fetch-paintings.ts` (create) | One-off image fetch, two sizes, `sources.json`, `CREDITS.md`, contact sheet |
| `scripts/build-content.ts` (modify) | Writes `content/paintings.json` and checks images and budgets |
| `lib/content/types.ts` (modify) | `PaintingRecord`, `PaintingSource` |
| `lib/content/painting-prompts.ts` (create) | The 4 prompt types |
| `lib/content/great-paintings.ts` (+ test) | `GREAT_PAINTINGS`, `paintingRecord`, `paintingByRank`, `PAINTING_ROOMS` |
| `lib/content/painting-art.ts` (create) | `paintingDataUri(key, size)` |
| `lib/study/paintings-presenter.ts` (+ test) | Views and leak rules |
| `lib/study/types.ts` (modify) | `painting`, `detail`, `artist`, `year`, `movement`, `museum` fields; new `asks` values |
| `components/ui/painting.tsx` (create) | Uncropped painting on a mat, with a "Detail" badge |
| `components/ui/item-image.tsx`, `lib/ui/item-image.ts` (modify) | Painting kind |
| `components/session/*` (modify) | Prompt, image grid and choice, intro, feedback, typed input, contrast drill |
| `components/paintings/gallery-wall.tsx`, `lib/ui/gallery.ts` (+ test) | Course home |
| `app/api/painting-art/[rank]/route.ts` (create) | Reference images by rank |
| `app/courses/[slug]/painting/[rank]/page.tsx` (create) | Enlarged reference view |
| `app/credits/paintings/page.tsx` (create) | Public credits page |
| `lib/content/registry.ts`, `lib/ui/copy.ts`, `lib/study/presenters.ts`, `app/courses/[slug]/page.tsx` (modify) | Wiring |
| Tests | `great-paintings.simulation.test.ts`, `paintings-flow.int.test.ts`, `e2e/great-paintings.spec.ts` |

---

### Task 1: Forgiving articles, look-alike mix-ups, per-prompt ambiguous answers

**Files:**
- Modify: `lib/engine/grading.ts`, `lib/engine/types.ts`, `lib/study/issue.ts`
- Test: `lib/engine/grading.test.ts` (append), `lib/study/issue.test.ts` (append)

**Interfaces:**
- Produces:
  - `normalize()` also drops a leading `a ` or `an `.
  - `gradeTyped` resolves an exact answer belonging to several other items to the target's first look-alike among them, else to `null`.
  - `PromptTypeDef.ambiguous?: string[]`: typed or picked answers that are never right unless they are the target's own, and never recorded as a mix-up.

- [ ] **Step 1: Write the failing tests** (append to `lib/engine/grading.test.ts`)

```ts
describe('paintings-style grading', () => {
  const art = (key: string, title: string, artist: string, lookalikes: string[] = []): Item => ({
    key, name: title, aliases: [], group: 'g', groupOrder: 1, itemOrder: 1, lookalikes,
    answers: { artist: { text: artist, aliases: artist === 'Anonymous' ? ['Unknown'] : [] } },
  });
  const items = [
    art('milkmaid', 'The Milkmaid', 'Johannes Vermeer', ['courtyard']),
    art('courtyard', 'The Courtyard of a House in Delft', 'Pieter de Hooch'),
    art('night-watch', 'The Night Watch', 'Rembrandt'),
    art('tulp', 'The Anatomy Lesson of Dr Nicolaes Tulp', 'Rembrandt'),
    art('wilton', 'The Wilton Diptych', 'Anonymous'),
    art('kells', 'Chi Rho page, Book of Kells', 'Anonymous'),
    art('bar', 'A Bar at the Folies-Bergère', 'Édouard Manet'),
  ];
  const get = (k: string) => items.find((i) => i.key === k)!;

  it('ignores a leading "A" or "An" as well as "The"', () => {
    expect(normalize('A Bar at the Folies-Bergère')).toBe(normalize('Bar at the Folies Bergere'));
    expect(normalize('An Old Man and His Grandson')).toBe('old man and his grandson');
    expect(gradeTyped('bar at the folies bergere', get('bar'), items).correct).toBe(true);
  });

  it("blames another artist's answer on their only work", () => {
    expect(gradeTyped('Pieter de Hooch', get('night-watch'), items, 'artist')).toMatchObject({ correct: false, answeredItemKey: 'courtyard' });
  });

  it('blames an artist with several works on a look-alike of the target, else on nobody', () => {
    const withLookalike = { ...get('milkmaid'), lookalikes: ['tulp'] };
    expect(gradeTyped('Rembrandt', withLookalike, items, 'artist').answeredItemKey).toBe('tulp');
    expect(gradeTyped('Rembrandt', get('milkmaid'), items, 'artist').answeredItemKey).toBeNull();
  });

  it('accepts Anonymous and Unknown for anonymous works, and blames nobody elsewhere', () => {
    const ambiguous = ['Anonymous', 'Unknown'];
    expect(gradeTyped('anonymous', get('wilton'), items, 'artist', { ambiguous }).correct).toBe(true);
    expect(gradeTyped('Unknown', get('kells'), items, 'artist', { ambiguous }).correct).toBe(true);
    expect(gradeTyped('Anonymous', get('bar'), items, 'artist', { ambiguous })).toEqual({ correct: false, typo: false, answeredItemKey: null });
  });
});
```

Add `normalize` and `Item` to that file's imports if they are missing.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run lib/engine/grading.test.ts`
Expected: FAIL. "A Bar…" doesn't normalise, and "Rembrandt" blames `night-watch`.

- [ ] **Step 3: Implement in `lib/engine/grading.ts`**

In `normalize`, replace `.replace(/^the /, '')` with:

```ts
    .replace(/^(the|an|a) /, '')
```

In `gradeTyped`, replace the two lines after `const exactOthers = ...`:

```ts
  if (opts.exact) return wrong(exactOthers.length === 1 ? exactOthers[0].key : null);
  if (exactOthers.length > 0) return wrong(exactOthers[0].key);
```

with:

```ts
  if (exactOthers.length > 0) return wrong(blameFor(exactOthers, target, opts.exact));
```

and add, above `gradeTyped`:

```ts
/**
 * Who an exact wrong answer is a mix-up with. It's the answer's only owner if there's one;
 * otherwise (an artist with several works) a look-alike of the target among them; otherwise
 * nobody. Exact-match fields (years) never guess between owners.
 */
function blameFor(owners: readonly Item[], target: Item, exact?: boolean): string | null {
  if (owners.length === 1) return owners[0].key;
  if (exact) return null;
  return target.lookalikes.find((k) => owners.some((o) => o.key === k)) ?? null;
}
```

- [ ] **Step 4: Run the grading tests, then the whole suite**

Run: `npx vitest run lib/engine/grading.test.ts`
Expected: PASS.

Run: `npm test`
Expected: PASS. If an existing test relied on "first owner" blame for a shared exact answer, read it first: change the test only if the old behaviour was incidental. If you change it, record a `Ruling:` line.

- [ ] **Step 5: Write the failing test for per-prompt ambiguous answers** (append to `lib/study/issue.test.ts`)

```ts
describe('per-prompt ambiguous answers', () => {
  const course: CourseDef = {
    slug: 'test-art', title: 'Art', placementPromptType: 'artist',
    promptTypes: [{ id: 'artist', label: 'Artist', answerField: 'artist', distinctChoices: true, ambiguous: ['Anonymous', 'Unknown'],
      formats: { 1: { format: 'mc-text', choices: 2, distractors: 'random' }, 2: { format: 'mc-text', choices: 2, distractors: 'random' }, 3: { format: 'typed' } } }],
    items: [
      { key: 'bar', name: 'A Bar at the Folies-Bergère', aliases: [], group: 'g', groupOrder: 1, itemOrder: 1, lookalikes: [], answers: { artist: { text: 'Édouard Manet', aliases: ['Manet'] } } },
      { key: 'wilton', name: 'The Wilton Diptych', aliases: [], group: 'g', groupOrder: 1, itemOrder: 2, lookalikes: [], answers: { artist: { text: 'Anonymous', aliases: ['Unknown'] } } },
    ],
  };
  const pending = (format: 'typed' | 'mc-text'): PendingQuestion => ({
    questionId: 'q', entry: { kind: 'prompt', itemKey: 'bar', promptType: 'artist' }, rung: format === 'typed' ? 3 : 1, format,
    choices: format === 'typed' ? [] : [{ id: 'c1', itemKey: 'bar' }, { id: 'c2', itemKey: 'wilton' }], issuedAt: new Date(0).toISOString(),
  });

  it('typing Anonymous for a named work is wrong and blames nobody', () => {
    expect(gradeSubmission(pending('typed'), { kind: 'typed', text: 'Anonymous' }, course)).toEqual({ correct: false, typo: false, answeredItemKey: null });
  });

  it('picking Anonymous for a named work is wrong and blames nobody', () => {
    expect(gradeSubmission(pending('mc-text'), { kind: 'choice', choiceId: 'c2' }, course)).toEqual({ correct: false, typo: false, answeredItemKey: null });
  });
});
```

Import `CourseDef` and `PendingQuestion` if they aren't already.

- [ ] **Step 6: Run the test and confirm it fails**

Run: `npx vitest run lib/study/issue.test.ts`
Expected: FAIL. `ambiguous` isn't a known property (type error), and the pick blames `wilton`.

- [ ] **Step 7: Implement**

In `lib/engine/types.ts`, add to `PromptTypeDef` after `recordsConfusions`:

```ts
  /** Answers that name no item in particular ("Anonymous"): right only for an item that has them, never a mix-up. */
  ambiguous?: string[];
```

In `lib/study/issue.ts`, in the `'typed'` case, change the `ambiguous:` line to:

```ts
        ambiguous: promptType?.ambiguous ?? (field === 'name' ? course.ambiguousAnswers : undefined),
```

In `gradeSubmission`, replace its body after `const grade = …` with:

```ts
  if (promptType?.recordsConfusions === false) return { ...grade, answeredItemKey: null };
  // Picking "Anonymous" for a named work blames no particular anonymous work.
  if (promptType?.ambiguous && grade.answeredItemKey) {
    const label = acceptedAnswers(getItem(course, grade.answeredItemKey), promptType.answerField ?? 'name')[0] ?? '';
    if (promptType.ambiguous.some((a) => normalize(a) === normalize(label))) return { ...grade, answeredItemKey: null };
  }
  return grade;
```

Add `acceptedAnswers` and `normalize` to the `@/lib/engine` import. Check that they are exported from `lib/engine/index.ts`, and add them there if not.

- [ ] **Step 8: Run the test, then the whole suite**

Run: `npx vitest run lib/study/issue.test.ts && npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/engine lib/study/issue.ts lib/study/issue.test.ts
git commit -F <msg>   # "feat(engine): forgiving articles, look-alike mix-ups, per-prompt ambiguous answers"
```

---

### Task 2: Balanced shared answer and placement head start

**Files:**
- Modify: `lib/engine/types.ts`, `lib/engine/question.ts`, `lib/engine/ladder.ts`, `lib/engine/answer.ts`, `lib/study/study-service.ts`
- Test: `lib/engine/question.test.ts` (append), `lib/study/study-service.test.ts` (append)

**Interfaces:**
- Produces:
  - **`PromptTypeDef.sharedAnswer?: string`:** an answer several items share ("Anonymous"). It appears as a wrong option just often enough that, over the course, an option carrying it is right about 1 time in N for N options.
  - **`CourseDef.placementHeadStart?: 2`:** when an item is introduced and some of its prompts are already graduated (by placement), its remaining prompts start learning at that level.
  - **`introduce(state, rung = 1)`.**
  - **`applyIntro({ session, itemKey, states, rung? })`.**

- [ ] **Step 1: Write the failing test** (append to `lib/engine/question.test.ts`)

```ts
describe('shared answers (Anonymous) are balanced', () => {
  const N = 40;
  const ANON = 4;
  const items: Item[] = Array.from({ length: N }, (_, i) => ({
    key: `p${i}`, name: `Painting ${i}`, aliases: [], group: `g${i % 4}`, groupOrder: 1, itemOrder: i, lookalikes: [],
    answers: { artist: { text: i < ANON ? 'Anonymous' : `Artist ${i}`, aliases: [] } },
  }));
  const course: CourseDef = {
    slug: 'test-shared', title: 'Shared', placementPromptType: 'artist', items,
    promptTypes: [{ id: 'artist', label: 'Artist', answerField: 'artist', distinctChoices: true, sharedAnswer: 'Anonymous',
      formats: { 1: { format: 'mc-text', choices: 4, distractors: 'local' }, 2: { format: 'mc-text', choices: 6, distractors: 'hard' }, 3: { format: 'typed' } } }],
  };
  const isAnon = (k: string) => Number(k.slice(1)) < ANON;

  it('shows Anonymous on named works often enough that it is right about 1 time in 4', () => {
    let shownOnNamed = 0;
    let named = 0;
    for (let seed = 0; seed < 200; seed++) {
      for (const item of items.filter((i) => !isAnon(i.key))) {
        const q = buildQuestion({ entry: { kind: 'prompt', itemKey: item.key, promptType: 'artist' }, rung: 1, course, confusions: [], rng: seededRng(seed) });
        const anons = q.choiceKeys!.filter(isAnon).length;
        expect(anons).toBeLessThanOrEqual(1);
        shownOnNamed += anons;
        named++;
      }
    }
    // Expected rate q = (4 - 1) × 4 / 36 = 1/3 per named question, so P(right | shown) = 4 / (4 + 36q) = 1/4.
    expect(shownOnNamed / named).toBeGreaterThan(0.29);
    expect(shownOnNamed / named).toBeLessThan(0.38);
  });

  it('never shows a second Anonymous on an anonymous work', () => {
    for (let seed = 0; seed < 50; seed++) {
      const q = buildQuestion({ entry: { kind: 'prompt', itemKey: 'p0', promptType: 'artist' }, rung: 2, course, confusions: [], rng: seededRng(seed) });
      expect(q.choiceKeys!.filter(isAnon)).toEqual(['p0']);
    }
  });
});
```

Import `Item`, `CourseDef` and `seededRng` if missing.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run lib/engine/question.test.ts`
Expected: FAIL. `sharedAnswer` is unknown, and the rate is far below 0.29: with `local` mode, anonymous works only show inside their own groups.

- [ ] **Step 3: Implement**

In `lib/engine/types.ts`, add to `PromptTypeDef`:

```ts
  /**
   * An answer several items share ("Anonymous"). Kept out of the ordinary draw, then shown as a
   * wrong option at a rate that makes an option carrying it right about 1 time in N.
   */
  sharedAnswer?: string;
```

In `lib/engine/question.ts`, add the import `import { acceptedAnswers, normalize } from './grading';`, which replaces the existing `acceptedAnswers` import. Then change the distractor block:

```ts
  const target = getItem(course, entry.itemKey);
  const field = promptType.answerField ?? 'name';
  const shared = promptType.sharedAnswer ? normalize(promptType.sharedAnswer) : null;
  const isShared = (key: string) => shared !== null && normalize(acceptedAnswers(getItem(course, key), field)[0] ?? '') === shared;
  const distractors = pickDistractors({
    target,
    items: course.items,
    count: spec.choices - 1,
    mode: spec.distractors ?? 'random',
    confusions,
    rng,
    eligible: shared ? (key) => !isShared(key) && (eligible?.(key) ?? true) : eligible,
    window: spec.window,
    exclusions: spec.format === 'order' ? course.orderExclusions : undefined,
    distinct: promptType.distinctChoices
      ? { label: (i) => acceptedAnswers(i, field)[0] ?? '', taken: acceptedAnswers(target, field) }
      : undefined,
  });
  if (shared && !isShared(target.key) && distractors.length > 0) {
    const sharers = course.items.filter((i) => isShared(i.key) && (eligible?.(i.key) ?? true));
    const others = course.items.length - sharers.length;
    const rate = Math.min(1, (distractors.length * sharers.length) / Math.max(1, others));
    if (sharers.length > 0 && rng() < rate) {
      distractors[distractors.length - 1] = sharers[Math.floor(rng() * sharers.length)].key;
    }
  }
  return { entry, format: spec.format, choiceKeys: shuffle([target.key, ...distractors], rng) };
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run lib/engine/question.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing head-start test** (append to `lib/study/study-service.test.ts`)

```ts
describe('placement head start', () => {
  it('introduces a placed item’s remaining prompts at level 2, through the intro card', async () => {
    const [first, ...rest] = TEST_COURSE.promptTypes.map((p) => p.id);
    const course = { ...TEST_COURSE, placementGraduates: [first], placementHeadStart: 2 as const };
    const { store } = await enrolledStore({ placementDone: true, course });
    const placed = applyPlacementAnswer({ course, states: initialStates(course), itemKey: course.items[0].key, correct: true, now: NOW });
    store.seedPromptStates(course.slug, placed.filter((s) => s.itemKey === course.items[0].key));
    const ctx = testContext(store, { course });

    const turn = await startStudy(ctx);
    expect(turn.next).toMatchObject({ format: 'intro' });
    await submitStudyAnswer(ctx, { sessionId: turn.next!.sessionId, questionId: turn.next!.questionId, response: { kind: 'ack' } });

    const states = (await store.getPromptStates(course.slug)).filter((s) => s.itemKey === course.items[0].key);
    for (const id of rest) expect(states.find((s) => s.promptType === id)).toMatchObject({ phase: 'learning', rung: 2 });
    expect(states.find((s) => s.promptType === first)).toMatchObject({ phase: 'review' });
  });

  it('leaves courses without it introducing at level 1', async () => {
    const { store } = await enrolledStore({ placementDone: true });
    const ctx = testContext(store);
    const turn = await startStudy(ctx);
    await submitStudyAnswer(ctx, { sessionId: turn.next!.sessionId, questionId: turn.next!.questionId, response: { kind: 'ack' } });
    const states = await store.getPromptStates(SLUG);
    expect(states.filter((s) => s.phase === 'learning').every((s) => s.rung === 1)).toBe(true);
  });
});
```

Import `applyPlacementAnswer` and `initialStates` from `@/lib/engine`, and `NOW` from `@/lib/engine/test-fixtures`. If `seedPromptStates` replaces rather than merges, seed the item's states only, as shown; the other items stay new by hydration.

- [ ] **Step 6: Run the test and confirm it fails**

Run: `npx vitest run lib/study/study-service.test.ts`
Expected: FAIL. `placementHeadStart` is unknown, and the remaining prompts get `rung: 1`.

- [ ] **Step 7: Implement**

In `lib/engine/types.ts`, add to `CourseDef`:

```ts
  /** When an item partly fast-tracked by placement is introduced, its other prompts start at this level. */
  placementHeadStart?: 2;
```

In `lib/engine/ladder.ts`:

```ts
export function introduce(state: PromptState, rung: 1 | 2 = 1): PromptState {
  if (state.phase !== 'new') return state;
  return { ...state, phase: 'learning', rung, streak: 0 };
}
```

In `lib/engine/answer.ts`, change `applyIntro`:

```ts
export function applyIntro(args: {
  session: StudySession;
  itemKey: string;
  states: readonly PromptState[];
  /** Level the item's new prompts start at (placement head start); default 1. */
  rung?: 1 | 2;
}): { session: StudySession; states: PromptState[] } {
  return {
    session: recordIntroServed(args.session, args.itemKey),
    states: args.states.map((s) => (s.itemKey === args.itemKey ? introduce(s, args.rung) : s)),
  };
}
```

In `lib/study/study-service.ts`, in the `entry.kind === 'intro'` branch:

```ts
    // An item placement partly fast-tracked (some prompts already reviewed) starts the rest higher.
    const partlyPlaced = states.some((s) => s.itemKey === entry.itemKey && s.phase !== 'new');
    const rung = ctx.course.placementHeadStart && partlyPlaced ? ctx.course.placementHeadStart : 1;
    const result = applyIntro({ session, itemKey: entry.itemKey, states, rung });
```

- [ ] **Step 8: Run the tests, then the whole suite**

Run: `npx vitest run lib/study/study-service.test.ts && npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

Message: `feat(engine): balanced shared answers and placement head start`.

---

### Task 3: The painting data and its validation

**Files:**
- Create: `scripts/paintings-data.ts`, `scripts/lib/build-paintings.ts`, `scripts/lib/build-paintings.test.ts`
- Modify: `lib/content/types.ts`

**Interfaces:**
- Produces:
  - `MOVEMENTS: { name: string; neighbour: number }[]`, in room (course-home) order.
  - `ARTISTS: Record<string, string[]>`: each artist's display name mapped to their accepted short forms.
  - `PAINTINGS: PaintingEntry[]`.
  - `SUBJECT_PAIRS: [string, string][]`.
  - `AMBIGUOUS_ARTIST_ANSWERS = ['Anonymous', 'Unknown']`.
  - `buildPaintings(entries, opts): PaintingRecord[]`.

- [ ] **Step 1: Write the record types** (append to `lib/content/types.ts`)

```ts
export interface PaintingRecord {
  key: string;
  title: string;
  titleAliases: string[];
  artist: string;
  artistAliases: string[];
  /** Display text, e.g. "c. 1503–1519". */
  year: string;
  movement: string;
  /** Boundary movements never offered as wrong answers. */
  alsoMovements: string[];
  museum: string;
  /** 1 = introduced first. Also the reference-view address (/api/painting-art/<fame>). */
  fame: number;
  /** Index of the movement in room order (course home). */
  room: number;
  /** Movement position for "neighbouring movement" distractors. */
  neighbour: number;
  /** Same-artist works, then subject look-alikes. */
  lookalikes: string[];
  detail: boolean;
}

export interface PaintingSource {
  file: string;
  page: string;
  license: string;
  author?: string;
}
```

- [ ] **Step 2: Write the failing validation tests** (`scripts/lib/build-paintings.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { buildPaintings } from './build-paintings';
import type { PaintingEntry } from '../paintings-data';

const MOVES = [{ name: 'Baroque', neighbour: 7 }, { name: 'Dutch Golden Age', neighbour: 8 }];
const ARTISTS = { Rembrandt: [], 'Johannes Vermeer': ['Vermeer'], Anonymous: ['Unknown'] };
const e = (over: Partial<PaintingEntry>): PaintingEntry => ({
  key: 'night-watch', title: 'The Night Watch', artist: 'Rembrandt', year: '1642', movement: 'Dutch Golden Age',
  museum: 'Rijksmuseum, Amsterdam', fame: 1, wikipedia: 'The_Night_Watch', ...over,
});
const build = (entries: PaintingEntry[], extra: Partial<Parameters<typeof buildPaintings>[1]> = {}) =>
  buildPaintings(entries, { movements: MOVES, artists: ARTISTS, subjectPairs: [], minPerMovement: 1, ...extra });

describe('buildPaintings', () => {
  it('derives room, neighbour, artist aliases and same-artist look-alikes', () => {
    const [nw, tulp] = build([e({}), e({ key: 'tulp', title: 'The Anatomy Lesson of Dr Nicolaes Tulp', fame: 2 })]);
    expect(nw).toMatchObject({ room: 1, neighbour: 8, artistAliases: [], lookalikes: ['tulp'], detail: false });
    expect(tulp.lookalikes).toEqual(['night-watch']);
  });

  it('rejects duplicate titles, also through aliases and leading articles', () => {
    expect(() => build([e({}), e({ key: 'x', title: 'Night Watch', fame: 2 })])).toThrow(/title/i);
    expect(() => build([e({}), e({ key: 'x', title: 'Other', titleAliases: ['the night watch'], fame: 2 })])).toThrow(/title/i);
  });

  it('enforces the caps: 4 per named artist, 8 anonymous, a minimum per movement', () => {
    const five = Array.from({ length: 5 }, (_, i) => e({ key: `r${i}`, title: `R ${i}`, fame: i + 1 }));
    expect(() => build(five)).toThrow(/Rembrandt.*5/);
    const nine = Array.from({ length: 9 }, (_, i) => e({ key: `a${i}`, title: `A ${i}`, artist: 'Anonymous', fame: i + 1 }));
    expect(() => build(nine)).toThrow(/anonymous/i);
    expect(() => build([e({})], { minPerMovement: 2 })).toThrow(/Baroque|Dutch/);
  });

  it('rejects unknown movements and artists, a boundary movement equal to its own, and works after 1930', () => {
    expect(() => build([e({ movement: 'Pop Art' })])).toThrow(/movement/);
    expect(() => build([e({ artist: 'Picasso' })])).toThrow(/artist/);
    expect(() => build([e({ alsoMovements: ['Dutch Golden Age'] })])).toThrow(/boundary/);
    expect(() => build([e({ year: '1931' })])).toThrow(/1930/);
  });

  it('rejects fame ranks that are not exactly 1..N', () => {
    expect(() => build([e({}), e({ key: 'x', title: 'X', fame: 3 })])).toThrow(/fame/);
  });

  it('checks images when asked, and adds subject pairs as look-alikes', () => {
    expect(() => build([e({})], { hasImage: () => false })).toThrow(/image/);
    const [a, b] = build([e({}), e({ key: 'milk', title: 'The Milkmaid', artist: 'Johannes Vermeer', fame: 2 })], { subjectPairs: [['night-watch', 'milk']] });
    expect(a.lookalikes).toEqual(['milk']);
    expect(b.lookalikes).toEqual(['night-watch']);
  });
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `npx vitest run scripts/lib/build-paintings.test.ts`
Expected: FAIL. The module isn't found.

- [ ] **Step 4: Write `scripts/paintings-data.ts`**

The shape is below, with real entries. **Transcribe every row of the approved list** into `PAINTINGS`. Key the `fame` field to the list's Rank column, and move to the next artist and room only when the current one is complete.

```ts
/** The reviewed Great Paintings list (docs/superpowers/specs/2026-10-07-great-paintings-list.md). */

/** Room order on the course home. `neighbour` orders movements for "neighbouring movement" options;
 * non-Western traditions sit apart (100+) so they neighbour each other, not a European century. */
export const MOVEMENTS = [
  { name: 'Ancient & Medieval', neighbour: 0 },
  { name: 'Gothic & Proto-Renaissance', neighbour: 1 },
  { name: 'Early Renaissance', neighbour: 2 },
  { name: 'Northern Renaissance', neighbour: 3 },
  { name: 'Chinese & Korean painting', neighbour: 101 },
  { name: 'High Renaissance', neighbour: 4 },
  { name: 'Venetian Renaissance', neighbour: 5 },
  { name: 'Persian & Mughal miniature', neighbour: 103 },
  { name: 'Mannerism', neighbour: 6 },
  { name: 'Japanese painting & ukiyo-e', neighbour: 102 },
  { name: 'Baroque', neighbour: 7 },
  { name: 'Dutch Golden Age', neighbour: 8 },
  { name: 'Rococo', neighbour: 9 },
  { name: 'Neoclassicism', neighbour: 10 },
  { name: 'Romanticism', neighbour: 11 },
  { name: 'Realism', neighbour: 12 },
  { name: 'Pre-Raphaelite', neighbour: 13 },
  { name: 'Impressionism', neighbour: 14 },
  { name: 'Post-Impressionism', neighbour: 15 },
  { name: 'Symbolism & Art Nouveau', neighbour: 16 },
  { name: 'Fauvism', neighbour: 17 },
  { name: 'Expressionism', neighbour: 18 },
  { name: 'Cubism & Futurism', neighbour: 19 },
  { name: 'Abstraction', neighbour: 20 },
] as const;

export type MovementName = (typeof MOVEMENTS)[number]['name'];

export interface PaintingEntry {
  key: string;
  title: string;
  /** Accepted typed titles: English, original-language and short forms. Never another painting's title. */
  titleAliases?: string[];
  /** A key of ARTISTS. */
  artist: string;
  year: string;
  movement: MovementName | string;
  alsoMovements?: string[];
  museum: string;
  fame: number;
  /** English Wikipedia article whose lead image is the painting. */
  wikipedia: string;
  /** A specific Commons file, when the lead image is wrong (a photo of the room, a frame, a print). */
  commonsFile?: string;
  /** A detail crop, as fractions of the full image. */
  crop?: { left: number; top: number; width: number; height: number };
  /** Photographed in place (cave, fresco, mural): CC BY / CC BY-SA allowed with credit. */
  inSitu?: true;
}

/** Display name → accepted short forms. A surname is listed only when it is unique in the set. */
export const ARTISTS: Record<string, string[]> = {
  Anonymous: ['Unknown', 'Anon'],
  'Leonardo da Vinci': ['Leonardo', 'da Vinci', 'Da Vinci'],
  Michelangelo: ['Michelangelo Buonarroti', 'Buonarroti'],
  Raphael: ['Raffaello', 'Raffaello Sanzio', 'Sanzio'],
  Titian: ['Tiziano', 'Tiziano Vecellio', 'Vecellio'],
  Rembrandt: ['Rembrandt van Rijn', 'van Rijn'],
  'Johannes Vermeer': ['Vermeer', 'Jan Vermeer'],
  'Vincent van Gogh': ['van Gogh', 'Gogh', 'Vincent van Gogh'],
  'Pieter Bruegel the Elder': ['Bruegel', 'Brueghel', 'Pieter Bruegel', 'Breughel'],
  'Hans Holbein the Younger': ['Holbein', 'Hans Holbein'],
  'Katsushika Hokusai': ['Hokusai'],
  // …every artist in the list. Rules:
  //  - full display name as the key, exactly as in the list;
  //  - the bare surname as an alias when no other artist in the set shares it;
  //  - conventional single names (Giotto, Caravaggio, Titian, Raphael, Rembrandt, Michelangelo, Leonardo);
  //  - for East Asian names, the art name alone (Hokusai, Hiroshige, Utamaro, Sesshū → "Sesshu" too);
  //  - never a first name alone ("Vincent", "Pieter").
};

export const AMBIGUOUS_ARTIST_ANSWERS = ['Anonymous', 'Unknown', 'Anon'];

export const PAINTINGS: PaintingEntry[] = [
  { key: 'mona-lisa', title: 'Mona Lisa', titleAliases: ['La Gioconda', 'La Joconde', 'Monna Lisa'], artist: 'Leonardo da Vinci', year: 'c. 1503–1519', movement: 'High Renaissance', museum: 'Louvre, Paris', fame: 1, wikipedia: 'Mona_Lisa' },
  { key: 'starry-night', title: 'The Starry Night', titleAliases: ['Starry Night', 'De sterrennacht'], artist: 'Vincent van Gogh', year: '1889', movement: 'Post-Impressionism', museum: 'Museum of Modern Art, New York', fame: 2, wikipedia: 'The_Starry_Night' },
  { key: 'creation-of-adam', title: 'The Creation of Adam', artist: 'Michelangelo', year: 'c. 1512', movement: 'High Renaissance', museum: 'Sistine Chapel, Vatican', fame: 7, wikipedia: 'The_Creation_of_Adam', inSitu: true },
  { key: 'judith-caravaggio', title: 'Judith Beheading Holofernes', artist: 'Caravaggio', year: 'c. 1599', movement: 'Baroque', museum: 'Palazzo Barberini, Rome', fame: 83, wikipedia: 'Judith_Beheading_Holofernes_(Caravaggio)' },
  { key: 'judith-gentileschi', title: 'Judith Slaying Holofernes', artist: 'Artemisia Gentileschi', year: 'c. 1620', movement: 'Baroque', museum: 'Uffizi, Florence', fame: 105, wikipedia: 'Judith_Slaying_Holofernes_(Artemisia_Gentileschi,_Florence)' },
  { key: 'olympia', title: 'Olympia', artist: 'Édouard Manet', year: '1863', movement: 'Realism', alsoMovements: ['Impressionism'], museum: "Musée d'Orsay, Paris", fame: 29, wikipedia: 'Olympia_(Manet)' },
  { key: 'lascaux', title: 'Hall of the Bulls, Lascaux', titleAliases: ['Lascaux', 'Hall of the Bulls', 'Lascaux cave paintings'], artist: 'Anonymous', year: 'c. 17,000 BCE', movement: 'Ancient & Medieval', museum: 'Lascaux cave, Dordogne', fame: 51, wikipedia: 'Lascaux', inSitu: true },
  { key: 'qingming', title: 'Along the River During the Qingming Festival', titleAliases: ['Qingming Shanghe Tu', 'Along the River'], artist: 'Zhang Zeduan', year: 'early 12th c.', movement: 'Chinese & Korean painting', museum: 'Palace Museum, Beijing', fame: 50, wikipedia: 'Along_the_River_During_the_Qingming_Festival', crop: { left: 0.38, top: 0, width: 0.16, height: 1 } },
  // …all 246 rows, `fame` = the list's Rank column.
];

/** Cross-artist look-alikes (same-artist works are added automatically). */
export const SUBJECT_PAIRS: [string, string][] = [
  ['judith-caravaggio', 'judith-gentileschi'], ['judith-caravaggio', 'judith-i'], ['judith-gentileschi', 'judith-i'],
  ['last-supper', 'last-supper-tintoretto'], ['venus-of-urbino', 'sleeping-venus'], ['venus-of-urbino', 'rokeby-venus'],
  ['venus-of-urbino', 'olympia'], ['grande-odalisque', 'olympia'], ['nude-maja', 'olympia'], ['annunciation-martini', 'annunciation-angelico'],
  ['lamentation-giotto', 'lamentation-mantegna'], ['maesta', 'ognissanti-madonna'], ['holy-trinity', 'rublev-trinity'],
  ['raft-of-the-medusa', 'liberty-leading-the-people'], ['third-of-may', 'liberty-leading-the-people'], ['ninth-wave', 'raft-of-the-medusa'],
  ['self-portrait-durer', 'self-portrait-two-circles'], ['self-portrait-two-circles', 'self-portrait-bandaged-ear'], ['self-portrait-leyster', 'laughing-cavalier'],
  ['self-portrait-physalis', 'self-portrait-modersohn-becker'], ['self-portrait-straw-hat', 'self-portrait-allegory-painting'],
  ['sudden-shower', 'great-wave'], ['plum-park', 'irises-korin'], ['travelers-mountains', 'early-spring'], ['fuchun-mountains', 'early-spring'],
  ['qingming', 'inwang-clearing'], ['gleaners', 'burial-at-ornans'], ['absinthe', 'bar-folies-bergere'], ['paris-street-rainy-day', 'boulevard-montmartre'],
  ['grande-jatte', 'bal-du-moulin'], ['mondrian-composition', 'black-square'], ['city-rises', 'the-city-leger'], ['portrait-of-picasso', 'man-on-a-balcony'],
  ['woman-with-a-hat', 'posters-trouville'], ['ophelia', 'lady-of-shalott'], ['wanderer', 'oxbow'], ['milkmaid', 'courtyard-delft'],
  ['view-of-delft', 'windmill-wijk'], ['ambassadors', 'arnolfini'], ['tower-of-babel', 'garden-of-earthly-delights'], ['swing', 'pilgrimage-to-cythera'],
  ['blue-boy', 'charles-i-hunt'], ['death-of-general-wolfe', 'watson-and-the-shark'], ['whistlers-mother', 'madame-x'], ['gross-clinic', 'anatomy-lesson'],
  ['cheat-ace-of-diamonds', 'calling-of-st-matthew'], ['las-meninas', 'art-of-painting'], ['innocent-x', 'castiglione'], ['scream', 'death-and-the-maiden'],
  ['composition-vii', 'senecio'], ['ten-largest-adulthood', 'several-circles'], ['large-blue-horses', 'dance-matisse'],
];
```

**Transcription rules**, applied to every row:
- **Keys:** kebab-case short names. Use exactly the keys that `SUBJECT_PAIRS` above references.
- **Fame:** from the list's Rank column. Ranks 1–246 must each appear once (the validator checks).
- **Title changes for unambiguous title → image questions** (record each as a `Ruling:` line):
  - Leyster's *Self-Portrait* becomes *Self-Portrait at the Easel*;
  - Dürer's *Self-Portrait (1500)* becomes *Self-Portrait at Twenty-Eight*, with aliases `Self-Portrait (1500)` and `Self-Portrait in a Fur-Collared Robe`.
- **Title aliases** (`titleAliases`), when the work has well-known forms:
  - the common English form, the original-language form, and the short form without the subtitle (e.g. *Whistler's Mother* → `Arrangement in Grey and Black No. 1`; *Bal du moulin de la Galette* → `Dance at Le Moulin de la Galette`);
  - never an alias equal to another painting's title.
- **Lists:** `alsoMovements` is the list's "Also" column. `museum` and `year` are copied as written.
- **`inSitu: true`** for: Lascaux, Nebamun, Villa of the Mysteries, Ajanta, the Scrovegni *Lamentation*, Lorenzetti's *Good Government*, Masaccio's *Holy Trinity* and *Tribute Money*, Fra Angelico's *Annunciation*, the *Camera degli Sposi*, *The Last Supper*, the two Sistine Chapel works and *The School of Athens*.
- **`crop`** only for the list's "Detail" notes: *Camera degli Sposi* (oculus), *The Creation of Adam* (if the lead image is the whole ceiling), *Water Lilies (Orangerie)*, and the *Qingming* and *Fuchun* scrolls. Set the fractions after looking at the image in Task 4.

- [ ] **Step 5: Write `scripts/lib/build-paintings.ts`**

```ts
import type { PaintingRecord } from '../../lib/content/types';
import { normalize } from '../../lib/engine/grading';
import type { PaintingEntry } from '../paintings-data';

const MAX_PER_ARTIST = 4;
const MAX_ANONYMOUS = 8;
const LAST_YEAR = 1930;

/** Validates the reviewed list (spec §3.6) and derives rooms, neighbours and look-alikes. */
export function buildPaintings(
  entries: readonly PaintingEntry[],
  opts: {
    movements: readonly { name: string; neighbour: number }[];
    artists: Record<string, readonly string[]>;
    subjectPairs: readonly [string, string][];
    minPerMovement?: number;
    hasImage?: (key: string) => boolean;
  },
): PaintingRecord[] {
  const { movements, artists, subjectPairs } = opts;
  const roomOf = new Map(movements.map((m, i) => [m.name, i]));
  const keys = new Set(entries.map((e) => e.key));
  if (keys.size !== entries.length) throw new Error('Duplicate painting key');

  const fames = entries.map((e) => e.fame).sort((a, b) => a - b);
  fames.forEach((f, i) => {
    if (f !== i + 1) throw new Error(`fame ranks must be exactly 1–${entries.length}; problem at ${i + 1}`);
  });

  const titleOwner = new Map<string, string>();
  const artistOwner = new Map<string, string>();
  for (const [artist, aliases] of Object.entries(artists)) {
    for (const form of new Set([artist, ...aliases].map(normalize))) {
      const prev = artistOwner.get(form);
      if (prev && prev !== artist) throw new Error(`Artist form "${form}" accepted for both ${prev} and ${artist}`);
      artistOwner.set(form, artist);
    }
  }

  const perArtist = new Map<string, number>();
  for (const e of entries) {
    if (!roomOf.has(e.movement)) throw new Error(`${e.key}: unknown movement "${e.movement}"`);
    for (const m of e.alsoMovements ?? []) {
      if (!roomOf.has(m) || m === e.movement) throw new Error(`${e.key}: bad boundary movement "${m}"`);
    }
    if (!Object.hasOwn(artists, e.artist)) throw new Error(`${e.key}: unknown artist "${e.artist}"`);
    perArtist.set(e.artist, (perArtist.get(e.artist) ?? 0) + 1);
    const years = [...e.year.matchAll(/\b(\d{4})\b/g)].map((m) => Number(m[1]));
    if (years.some((y) => y > LAST_YEAR)) throw new Error(`${e.key}: dated after ${LAST_YEAR}`);
    if (opts.hasImage && !opts.hasImage(e.key)) throw new Error(`${e.key} has no image`);
    for (const t of new Set([e.title, ...(e.titleAliases ?? [])].map(normalize))) {
      const prev = titleOwner.get(t);
      if (prev && prev !== e.key) throw new Error(`Typed title "${t}" accepted by both ${prev} and ${e.key}`);
      titleOwner.set(t, e.key);
    }
  }
  for (const [artist, n] of perArtist) {
    if (artist === 'Anonymous' ? n > MAX_ANONYMOUS : n > MAX_PER_ARTIST) {
      throw new Error(artist === 'Anonymous' ? `${n} anonymous works (max ${MAX_ANONYMOUS})` : `${artist} has ${n} works (max ${MAX_PER_ARTIST})`);
    }
  }
  for (const m of movements) {
    const n = entries.filter((e) => e.movement === m.name).length;
    if (n < (opts.minPerMovement ?? 6)) throw new Error(`${m.name} has only ${n} works`);
  }
  for (const [a, b] of subjectPairs) {
    for (const k of [a, b]) if (!keys.has(k)) throw new Error(`Subject pair references unknown painting ${k}`);
  }

  const pairs = new Map<string, string[]>();
  for (const [a, b] of subjectPairs) {
    pairs.set(a, [...(pairs.get(a) ?? []), b]);
    pairs.set(b, [...(pairs.get(b) ?? []), a]);
  }
  return [...entries]
    .sort((a, b) => a.fame - b.fame)
    .map((e) => {
      const sameArtist = e.artist === 'Anonymous' ? [] : entries.filter((o) => o.key !== e.key && o.artist === e.artist).map((o) => o.key);
      const room = roomOf.get(e.movement)!;
      return {
        key: e.key,
        title: e.title,
        titleAliases: e.titleAliases ?? [],
        artist: e.artist,
        artistAliases: [...(artists[e.artist] ?? [])],
        year: e.year,
        movement: e.movement,
        alsoMovements: e.alsoMovements ?? [],
        museum: e.museum,
        fame: e.fame,
        room,
        neighbour: movements[room].neighbour,
        lookalikes: [...new Set([...sameArtist, ...(pairs.get(e.key) ?? [])])],
        detail: Boolean(e.crop),
      };
    });
}
```

- [ ] **Step 6: Run the unit tests, then validate the real list**

Run: `npx vitest run scripts/lib/build-paintings.test.ts`
Expected: PASS.

Then add this test, which validates the real data. It's the guard against transcription errors:

```ts
import { ARTISTS, MOVEMENTS, PAINTINGS, SUBJECT_PAIRS } from '../paintings-data';

it('validates the real list', () => {
  const records = buildPaintings(PAINTINGS, { movements: MOVEMENTS, artists: ARTISTS, subjectPairs: SUBJECT_PAIRS });
  expect(records.length).toBe(246);
  expect(records.filter((r) => r.artist === 'Anonymous').length).toBe(8);
});
```

Run: `npx vitest run scripts/lib/build-paintings.test.ts`
Expected: PASS. Fix the data, not the validator, for every error it reports.

- [ ] **Step 7: Commit**

Message: `feat(content): the Great Paintings list and its validation`.

---

### Task 4: Images, credits, and `content/paintings.json`

**Files:**
- Modify: `scripts/lib/portrait-license.ts` (+ its test), `scripts/build-content.ts`, `package.json`
- Create: `scripts/fetch-paintings.ts`, plus generated output in `content/paintings/` (`<key>.webp`, `<key>-thumb.webp`, `sources.json`, `CREDITS.md`)

**Interfaces:**
- Produces:
  - `isAttribution(meta)`, which accepts CC BY and CC BY-SA, any version.
  - `content/paintings.json`, shaped `{ paintings: PaintingRecord[] }`, in fame order.
  - `content/paintings/sources.json`, mapping each painting key to a `PaintingSource`.

- [ ] **Step 1: Write the failing licence test** (append to `scripts/lib/portrait-license.test.ts`)

```ts
describe('isAttribution', () => {
  it('accepts CC BY and CC BY-SA of any version, and nothing else', () => {
    expect(isAttribution({ LicenseShortName: 'CC BY-SA 4.0' })).toBe(true);
    expect(isAttribution({ LicenseShortName: 'CC BY 2.0' })).toBe(true);
    expect(isAttribution({ LicenseShortName: 'CC BY-NC 2.0' })).toBe(false);
    expect(isAttribution({ LicenseShortName: 'CC BY-ND 3.0' })).toBe(false);
    expect(isAttribution({ LicenseShortName: 'Public domain' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run scripts/lib/portrait-license.test.ts`
Expected: FAIL. `isAttribution` isn't exported.

- [ ] **Step 3: Implement** (append to `scripts/lib/portrait-license.ts`)

```ts
/** CC BY or CC BY-SA (any version): usable with credit. Never NC or ND. */
export function isAttribution(meta: LicenseMeta): boolean {
  return [meta.LicenseShortName, meta.License].some(
    (v) => typeof v === 'string' && /^cc[ -]by(-sa)?[ -]\d/i.test(v.trim()),
  );
}
```

Run: `npx vitest run scripts/lib/portrait-license.test.ts`
Expected: PASS.

- [ ] **Step 4: Write `scripts/fetch-paintings.ts`**

Model it on `scripts/fetch-portraits.ts`, reusing its `api`, `leadImage`, `fileInfo` and `strip`. Export those three helpers from `fetch-portraits.ts` and import them; don't copy them. The differences:

```ts
const OUT = path.join(process.cwd(), 'content', 'paintings');
const LARGE = 900;
const THUMB = 320;
const BUDGET = { large: 150 * 1024, thumb: 30 * 1024 };

async function encode(input: Buffer, crop: PaintingEntry['crop'], size: number, budget: number): Promise<Buffer> {
  let img = sharp(input);
  if (crop) {
    const { width = 0, height = 0 } = await img.metadata();
    img = img.extract({
      left: Math.round(crop.left * width), top: Math.round(crop.top * height),
      width: Math.round(crop.width * width), height: Math.round(crop.height * height),
    });
  }
  for (const quality of [78, 70, 62, 54, 46]) {
    const out = await img.clone().resize(size, size, { fit: 'inside', withoutEnlargement: true }).webp({ quality }).toBuffer();
    if (out.length <= budget) return out;
  }
  throw new Error(`cannot fit ${size}px under ${budget} bytes`);
}

async function fetchOne(p: PaintingEntry) {
  const file = p.commonsFile ?? (await leadImage(p.wikipedia));
  const info = await fileInfo(file, 1800); // fileInfo gains a width parameter (default 900, as before)
  const attributed = !isPublicDomain(info.license) && Boolean(p.inSitu) && isAttribution(info.license);
  if (!isPublicDomain(info.license) && !attributed) {
    throw new Error(`${file}: ${info.license.LicenseShortName ?? 'no licence'} is not allowed${p.inSitu ? '' : ' (not in situ)'}`);
  }
  if (attributed && !info.artist) throw new Error(`${file}: CC licence but no author to credit`);
  const res = await fetch(info.thumb, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const input = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(OUT, `${p.key}.webp`), await encode(input, p.crop, LARGE, BUDGET.large));
  fs.writeFileSync(path.join(OUT, `${p.key}-thumb.webp`), await encode(input, p.crop, THUMB, BUDGET.thumb));
  return {
    file, page: info.page, license: info.license.LicenseShortName ?? info.license.License ?? '',
    ...(attributed ? { author: info.artist } : {}),
  };
}
```

Write the rest as `fetch-portraits.ts`'s `main()` does:
- iterate `PAINTINGS`, optionally limited to keys given on the command line;
- keep `sources.json` keyed by painting key, in fame order;
- write `CREDITS.md`: a header, then one line per painting in the form `- *Title*, Artist: [file](page), licence[, photo by author]`;
- exit 1 listing any failures.

Also write `scratchpad/paintings-contact-sheet.html`, an `<img>` of every thumbnail labelled with title and rank, for the visual check in Step 6.

Add `"content:paintings": "tsx scripts/fetch-paintings.ts"` to the `package.json` scripts.

- [ ] **Step 5: Run the fetch**

Run: `npm run content:paintings`
Expected: an `ok` line per painting.

For each `FAIL`:
- set `commonsFile` to a reviewed Commons file of the painting itself, public domain or (in situ) CC BY/BY-SA, and rerun just that key: `npm run content:paintings -- <key>`;
- if no allowed file exists, delete the row, re-rank the later rows so fame stays 1..N, and add a `Ruling:` line.

- [ ] **Step 6: Check every image by eye**

Open the contact sheet. Each thumbnail must be the right painting: not a frame, a gallery photo, a sketch or a different version. Each must be uncropped, or show the intended detail. Fix any wrong one with `commonsFile` or `crop` and refetch it.

- [ ] **Step 7: Build `content/paintings.json`** (`scripts/build-content.ts`)

Append:

```ts
import { buildPaintings } from './lib/build-paintings';
import { ARTISTS, MOVEMENTS, PAINTINGS, SUBJECT_PAIRS } from './paintings-data';

// Painting images come from `npm run content:paintings` (committed); the build checks they exist and fit.
const paintingDir = path.join(root, 'content', 'paintings');
const fits = (file: string, budget: number) => {
  const full = path.join(paintingDir, file);
  return fs.existsSync(full) && fs.statSync(full).size <= budget;
};
const paintings = buildPaintings(PAINTINGS, {
  movements: MOVEMENTS, artists: ARTISTS, subjectPairs: SUBJECT_PAIRS,
  hasImage: (key) => fits(`${key}.webp`, 150 * 1024) && fits(`${key}-thumb.webp`, 30 * 1024),
});
fs.writeFileSync(path.join(root, 'content', 'paintings.json'), JSON.stringify({ paintings }, null, 2) + '\n');
console.log(`Wrote ${paintings.length} paintings to content/paintings.json.`);
```

Run: `npm run content:build`
Expected: "Wrote 246 paintings" (or N, after any rulings), and no errors.

- [ ] **Step 8: Commit**

Commit the script, `content/paintings/*`, `content/paintings.json` and `package.json`.
Message: `feat(content): Great Paintings images, credits and records`.

---

### Task 5: The course definition

**Files:**
- Create: `lib/content/painting-prompts.ts`, `lib/content/great-paintings.ts`, `lib/content/great-paintings.test.ts`
- Modify: `lib/content/registry.ts`, `lib/ui/copy.ts`

**Interfaces:**
- Consumes: `content/paintings.json` (Task 4) and the engine options from Tasks 1–2.
- Produces:
  - `GREAT_PAINTINGS: CourseDef`;
  - `PAINTING_PROMPT_TYPES`;
  - `paintingRecord(key): PaintingRecord`;
  - `paintingByRank(rank): PaintingRecord | null`;
  - `PAINTING_ROOMS: string[]`, the movement names in room order.

- [ ] **Step 1: Write the failing test** (`lib/content/great-paintings.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { buildQuestion, gradeTyped, initialStates, newItemsInOrder, seededRng } from '@/lib/engine';
import { getCourse } from './registry';
import { GREAT_PAINTINGS, PAINTING_ROOMS, paintingByRank, paintingRecord } from './great-paintings';

const course = GREAT_PAINTINGS;
const item = (key: string) => course.items.find((i) => i.key === key)!;

describe('GREAT_PAINTINGS', () => {
  it('has four prompts and places on typed title, fast-tracking both title prompts with a head start', () => {
    expect(course.promptTypes.map((p) => p.id)).toEqual(['image_to_title', 'image_to_artist', 'title_to_image', 'image_to_movement']);
    expect(course.placementPromptType).toBe('image_to_title');
    expect(course.placementGraduates).toEqual(['image_to_title', 'title_to_image']);
    expect(course.placementHeadStart).toBe(2);
    expect(getCourse('great-paintings')).toBe(course);
  });

  it('introduces paintings most famous first, across movements', () => {
    const order = newItemsInOrder(course, initialStates(course)).map((i) => i.key);
    expect(order.slice(0, 3)).toEqual(['mona-lisa', 'starry-night', 'last-supper']);
    expect(order.map((k) => paintingRecord(k).fame)).toEqual(order.map((_, i) => i + 1));
  });

  it('addresses reference images by rank and lists rooms in order', () => {
    expect(paintingByRank(1)?.key).toBe('mona-lisa');
    expect(paintingByRank(0)).toBeNull();
    expect(PAINTING_ROOMS[0]).toBe('Ancient & Medieval');
    expect(PAINTING_ROOMS.at(-1)).toBe('Abstraction');
  });

  it('never offers a boundary movement as a wrong answer', () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const rung of [1, 2, 3] as const) {
        const q = buildQuestion({ entry: { kind: 'prompt', itemKey: 'olympia', promptType: 'image_to_movement' }, rung, course, confusions: [], rng: seededRng(seed) });
        const labels = q.choiceKeys!.filter((k) => k !== 'olympia').map((k) => item(k).answers!.movement.text);
        expect(labels).not.toContain('Impressionism');
        expect(new Set(labels).size).toBe(labels.length);
      }
    }
  });

  it('offers neighbouring movements at level 3', () => {
    const q = buildQuestion({ entry: { kind: 'prompt', itemKey: 'starry-night', promptType: 'image_to_movement' }, rung: 3, course, confusions: [], rng: seededRng(1) });
    const labels = q.choiceKeys!.map((k) => item(k).answers!.movement.text);
    expect(labels).toEqual(expect.arrayContaining(['Post-Impressionism', 'Impressionism', 'Symbolism & Art Nouveau']));
  });

  it('accepts artist short forms and Anonymous only where right', () => {
    const grade = (text: string, key: string) =>
      gradeTyped(text, item(key), course.items, 'artist', { ambiguous: course.promptTypes[1].ambiguous });
    expect(grade('van gogh', 'starry-night').correct).toBe(true);
    expect(grade('Leonardo', 'mona-lisa').correct).toBe(true);
    expect(grade('Unknown', 'lascaux').correct).toBe(true);
    expect(grade('Anonymous', 'mona-lisa')).toEqual({ correct: false, typo: false, answeredItemKey: null });
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run lib/content/great-paintings.test.ts`
Expected: FAIL. The module isn't found.

- [ ] **Step 3: Implement `lib/content/painting-prompts.ts`**

```ts
import type { PromptTypeDef } from '@/lib/engine/types';

/** Great Paintings prompts (spec §4.1). Movement is multiple choice only; its level 3 offers neighbouring movements. */
export const PAINTING_PROMPT_TYPES: PromptTypeDef[] = [
  { id: 'image_to_title', label: 'Title', formats: {
      1: { format: 'mc-text', choices: 4, distractors: 'local' },
      2: { format: 'mc-text', choices: 6, distractors: 'hard' },
      3: { format: 'typed' } } },
  { id: 'image_to_artist', label: 'Artist', answerField: 'artist', distinctChoices: true,
    ambiguous: ['Anonymous', 'Unknown', 'Anon'], sharedAnswer: 'Anonymous', formats: {
      1: { format: 'mc-text', choices: 4, distractors: 'local' },
      2: { format: 'mc-text', choices: 6, distractors: 'hard' },
      3: { format: 'typed' } } },
  { id: 'title_to_image', label: 'Find it', formats: {
      1: { format: 'image-grid', choices: 4, distractors: 'local' },
      2: { format: 'image-grid', choices: 6, distractors: 'hard' },
      3: { format: 'image-grid', choices: 8, distractors: 'hard' } } },
  { id: 'image_to_movement', label: 'Movement', answerField: 'movement', distinctChoices: true, recordsConfusions: false, formats: {
      1: { format: 'mc-text', choices: 4, distractors: 'random' },
      2: { format: 'mc-text', choices: 6, distractors: 'random' },
      3: { format: 'mc-text', choices: 6, distractors: 'sequence' } } },
];
```

- [ ] **Step 4: Implement `lib/content/great-paintings.ts`**

```ts
import data from '@/content/paintings.json';
import type { CourseDef } from '@/lib/engine/types';
import { PAINTING_PROMPT_TYPES } from './painting-prompts';
import type { PaintingRecord } from './types';

const { paintings } = data as { paintings: PaintingRecord[] };
const byKey = new Map(paintings.map((p) => [p.key, p]));
const byRank = new Map(paintings.map((p) => [p.fame, p]));

/** Movement names in room (course-home) order. */
export const PAINTING_ROOMS: string[] = [...new Map(paintings.map((p) => [p.room, p.movement])).entries()]
  .sort(([a], [b]) => a - b)
  .map(([, name]) => name);

/**
 * About 246 public-domain paintings, one item each (spec §1). Every item shares one group order,
 * so the engine's "group, then item" order introduces them by fame across movements; `group` is the
 * movement (same-movement distractors), and `sequence` is the movement's neighbour index (level-3
 * movement options).
 */
export const GREAT_PAINTINGS: CourseDef = {
  slug: 'great-paintings',
  title: 'Great Paintings',
  placementPromptType: 'image_to_title',
  // Knowing the title shows the painting is known; its artist and movement are still taught, from level 2.
  placementGraduates: ['image_to_title', 'title_to_image'],
  placementHeadStart: 2,
  promptTypes: PAINTING_PROMPT_TYPES,
  items: paintings.map((p) => ({
    key: p.key,
    name: p.title,
    aliases: p.titleAliases,
    group: p.movement,
    groupOrder: 1,
    itemOrder: p.fame,
    lookalikes: p.lookalikes,
    sequence: [p.neighbour],
    answers: {
      artist: { text: p.artist, aliases: p.artistAliases },
      movement: { text: p.movement, aliases: p.alsoMovements },
    },
  })),
};

export function paintingRecord(key: string): PaintingRecord {
  const record = byKey.get(key);
  if (!record) throw new Error(`Unknown painting ${key}`);
  return record;
}

export function paintingByRank(rank: number): PaintingRecord | null {
  return byRank.get(rank) ?? null;
}
```

Register it in `lib/content/registry.ts` (`[GREAT_PAINTINGS.slug]: GREAT_PAINTINGS`), and add to `lib/ui/copy.ts`:

```ts
  'great-paintings': `${GREAT_PAINTINGS.items.length} of the world's great paintings: title, artist and movement.`,
```

If `copy.ts` can't import course modules (check for cycles), write the literal count and add a test asserting it equals `GREAT_PAINTINGS.items.length`.

- [ ] **Step 5: Check the sequence-slot side effect**

A one-entry `sequence` must never add a `slot` to a question: `slotFor` only acts on two or more positions. Confirm by reading `lib/study/issue.ts` `slotFor`. No code change is needed.

- [ ] **Step 6: Run the tests and the whole suite**

Run: `npx vitest run lib/content/great-paintings.test.ts && npm test && npm run typecheck`
Expected: PASS. If a "lists every course" test counts courses, update its expected list.

- [ ] **Step 7: Commit**

Message: `feat(content): the Great Paintings course`.

---

### Task 6: The paintings presenter

**Files:**
- Create: `lib/content/painting-art.ts`, `lib/study/paintings-presenter.ts`, `lib/study/paintings-presenter.test.ts`
- Modify: `lib/study/types.ts`, `lib/study/presenters.ts`

**Interfaces:**
- Produces:
  - **`paintingDataUri(key, size: 'large' | 'thumb')`.**
  - **`paintingsPresenter(course, { image })`.**
  - **View fields:**
    - `prompt.painting?: string`, `prompt.detail?: boolean`;
    - `asks: 'title' | 'artist' | 'movement'`;
    - `choices[].painting?: string`;
    - `ItemView.painting`, `ItemView.artist`, `ItemView.year`, `ItemView.movement`, `ItemView.museum` and `ItemView.detail` (all optional).

- [ ] **Step 1: Extend the view types** (`lib/study/types.ts`)

- In `QuestionView['prompt']`:
  - add `painting?: string;` and `detail?: boolean;`;
  - extend `asks` with `| 'title' | 'artist' | 'movement'`.
- In `choices`, add `painting?: string`.
- In `ItemView`, add:

```ts
  /** Great Paintings. */
  painting?: string;
  detail?: boolean;
  artist?: string;
  year?: string;
  movement?: string;
  museum?: string;
```

- [ ] **Step 2: Write the failing tests** (`lib/study/paintings-presenter.test.ts`)

```ts
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seededRng, type QuestionRung, type QueueEntry } from '@/lib/engine';
import { NOW } from '@/lib/engine/test-fixtures';
import { GREAT_PAINTINGS, paintingRecord } from '@/lib/content/great-paintings';
import { gradeSubmission, issueQuestion } from './issue';
import { toQuestionView } from './present';
import { getPresenter } from './presenters';
import type { PendingQuestion } from './types';

const course = GREAT_PAINTINGS;
const presenter = getPresenter(course);
const session = { id: 's', kind: 'study' as const, progress: { answered: 0, total: 20 } };
const issue = (entry: QueueEntry, rung: QuestionRung, seed = 3): PendingQuestion =>
  issueQuestion({ entry, rung, course, confusions: [], rng: seededRng(seed), now: NOW, newId: randomUUID });
const view = (p: PendingQuestion) => toQuestionView({ pending: p, session, course, presenter });

/** Everything in a view outside choice labels, with images removed (base64 could contain anything). */
function text(v: ReturnType<typeof view>): string {
  const { choices, ...rest } = v;
  const json = JSON.stringify({ ...rest, choices: choices?.map((c) => ({ ...c, label: undefined })) });
  return json.replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g, '');
}
const lower = (s: string) => s.toLowerCase();

describe('paintings leak rules (every painting × prompt × level)', () => {
  const PROMPTS = ['image_to_title', 'image_to_artist', 'image_to_movement', 'title_to_image'];
  it('image questions name no title, artist or movement; title → image names only the title', () => {
    for (const item of course.items) {
      const r = paintingRecord(item.key);
      for (const promptType of PROMPTS) {
        for (const rung of [1, 2, 3] as const) {
          const t = lower(text(view(issue({ kind: 'prompt', itemKey: item.key, promptType }, rung))));
          expect(t).not.toContain(lower(item.key));
          if (r.artist !== 'Anonymous') expect(t).not.toContain(lower(r.artist));
          expect(t).not.toContain(lower(r.movement));
          if (promptType === 'title_to_image') expect(t).toContain(lower(r.title));
          else expect(t).not.toContain(lower(r.title));
        }
      }
    }
  });

  it('shows the painting as an unlabelled data URI and, for title → image, unlabelled thumbnails', () => {
    const v = view(issue({ kind: 'prompt', itemKey: 'mona-lisa', promptType: 'image_to_title' }, 1));
    expect(v.prompt.painting).toMatch(/^data:image\/webp;base64,/);
    const g = view(issue({ kind: 'prompt', itemKey: 'mona-lisa', promptType: 'title_to_image' }, 3));
    expect(g.choices).toHaveLength(8);
    expect(g.choices!.every((c) => c.painting?.startsWith('data:image/webp') && !c.label)).toBe(true);
  });
});

describe('grading', () => {
  const typed = (key: string, promptType: string, text: string) =>
    gradeSubmission(issue({ kind: 'prompt', itemKey: key, promptType }, 3), { kind: 'typed', text }, course);

  it('accepts titles without accents, punctuation or articles (Review Focus 1)', () => {
    expect(typed('dejeuner-sur-lherbe', 'image_to_title', 'Dejeuner sur l herbe').correct).toBe(true);
    expect(typed('bal-du-moulin', 'image_to_title', 'bal du moulin de la galette').correct).toBe(true);
    expect(typed('bar-folies-bergere', 'image_to_title', 'A Bar at the Folies Bergere').correct).toBe(true);
  });

  it('rejects a first name alone, blaming nobody (Review Focus 2)', () => {
    expect(typed('starry-night', 'image_to_artist', 'Vincent')).toEqual({ correct: false, typo: false, answeredItemKey: null });
    expect(typed('hunters-in-the-snow', 'image_to_artist', 'Pieter').correct).toBe(false);
  });

  it('tells the Judith pair apart in one grid (Review Focus 3)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = issue({ kind: 'prompt', itemKey: 'judith-caravaggio', promptType: 'title_to_image' }, 3, seed);
      const twin = p.choices.find((c) => c.itemKey === 'judith-gentileschi');
      const right = p.choices.find((c) => c.itemKey === 'judith-caravaggio')!;
      expect(gradeSubmission(p, { kind: 'choice', choiceId: right.id }, course).correct).toBe(true);
      if (twin) expect(gradeSubmission(p, { kind: 'choice', choiceId: twin.id }, course)).toMatchObject({ correct: false, answeredItemKey: 'judith-gentileschi' });
    }
  });

  it('describes a painting fully for intros and feedback', () => {
    expect(presenter.item('night-watch')).toMatchObject({
      name: 'The Night Watch', artist: 'Rembrandt', year: '1642', movement: 'Dutch Golden Age', museum: 'Rijksmuseum, Amsterdam',
    });
  });
});
```

Use the keys you set in Task 3 (`dejeuner-sur-lherbe`, `bal-du-moulin`, `bar-folies-bergere`, `hunters-in-the-snow`). If a key differs, fix the test to match the data, not the reverse.

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `npx vitest run lib/study/paintings-presenter.test.ts`
Expected: FAIL. There is no presenter for `great-paintings`.

- [ ] **Step 4: Implement `lib/content/painting-art.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'content', 'paintings');
const cache = new Map<string, string>();

/** A painting as an `<img src>` data URI (server only). Keeps the key out of URLs, like flags and portraits. */
export function paintingDataUri(key: string, size: 'large' | 'thumb'): string {
  const id = `${key}:${size}`;
  const cached = cache.get(id);
  if (cached) return cached;
  const webp = fs.readFileSync(path.join(DIR, size === 'thumb' ? `${key}-thumb.webp` : `${key}.webp`));
  const uri = `data:image/webp;base64,${webp.toString('base64')}`;
  cache.set(id, uri);
  return uri;
}
```

- [ ] **Step 5: Implement `lib/study/paintings-presenter.ts`**

```ts
import { getItem, type CourseDef } from '@/lib/engine';
import { paintingRecord } from '@/lib/content/great-paintings';
import type { Presenter } from './present';

/**
 * Great Paintings views (spec §4.6). Image questions show the painting and name nothing outside
 * choice labels; Title → image names only the title, over unlabelled thumbnails.
 */
export function paintingsPresenter(course: CourseDef, deps: { image: (key: string, size: 'large' | 'thumb') => string }): Presenter {
  const { image } = deps;
  const title = (key: string) => getItem(course, key).name;
  const shown = (key: string) => ({ painting: image(key, 'large'), ...(paintingRecord(key).detail ? { detail: true } : {}) });

  return {
    prompt(entry) {
      const key = entry.itemKey;
      switch (entry.promptType) {
        case 'image_to_artist':
          return { ...shown(key), question: 'Who painted this?', asks: 'artist' };
        case 'image_to_movement':
          return { ...shown(key), question: 'Which movement or period is this?', asks: 'movement' };
        case 'title_to_image':
          return { name: title(key), question: `Which one is ${title(key)}?` };
        default:
          return { ...shown(key), question: 'What is this painting called?', asks: 'title' };
      }
    },

    choice(key, format, promptType) {
      if (format === 'image-grid') return { painting: image(key, 'thumb') };
      if (format === 'contrast') return { label: title(key), painting: image(key, 'thumb') };
      if (promptType === 'image_to_artist') return { label: paintingRecord(key).artist };
      if (promptType === 'image_to_movement') return { label: paintingRecord(key).movement };
      return { label: title(key) };
    },

    item(key) {
      const r = paintingRecord(key);
      return {
        name: r.title,
        painting: image(key, 'large'),
        ...(r.detail ? { detail: true } : {}),
        artist: r.artist,
        year: r.year,
        movement: r.movement,
        museum: r.museum,
      };
    },
  };
}
```

`Presenter.choice` returns `{ label?, flag?, portrait? }`. Widen that return type in `lib/study/present.ts` with `painting?: string`. Then make sure `toQuestionView`'s `choices` mapping passes it through. It spreads the presenter's result, so it does.

Wire it into `lib/study/presenters.ts`:

```ts
    case GREAT_PAINTINGS.slug:
      return paintingsPresenter(course, { image: paintingDataUri });
```

- [ ] **Step 6: Run the tests and the whole suite**

Run: `npx vitest run lib/study/paintings-presenter.test.ts && npm test && npm run typecheck`
Expected: PASS. The leak test covers 246 × 4 × 3 views and may take a few seconds.

- [ ] **Step 7: Commit**

Message: `feat(study): Great Paintings presenter`.

---

### Task 7: Painting screens (questions, intro, feedback, mix-up card)

**Files:**
- Create: `components/ui/painting.tsx`
- Modify:
  - `lib/ui/item-image.ts` (+ test, if one exists);
  - `components/ui/item-image.tsx`;
  - in `components/session/`: `prompt.tsx`, `image-grid.tsx`, `image-choice.tsx`, `intro-card.tsx`, `feedback-panel.tsx`, `typed-answer.tsx`, `contrast-drill.tsx`.
- Create test: `lib/ui/painting-feedback.test.ts`, for the feedback wording, which lives in `lib/ui/painting-feedback.ts`.

**Interfaces:**
- Consumes: the Task 6 view fields.
- Produces:
  - `<Painting src alt? eager? detail? fit? maxHeight? />`;
  - `paintingFeedback(asks, f)`, which returns `{ headline, detail? }`.

- [ ] **Step 1: Write the failing test** (`lib/ui/painting-feedback.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { paintingFeedback } from './painting-feedback';

const answer = { name: 'The Night Watch', artist: 'Rembrandt', year: '1642', movement: 'Dutch Golden Age' };
const tulp = { name: 'The Anatomy Lesson of Dr Nicolaes Tulp', artist: 'Rembrandt', year: '1632', movement: 'Dutch Golden Age' };

describe('paintingFeedback', () => {
  it('states the fact asked, and names what the learner gave', () => {
    expect(paintingFeedback('title', { correct: true, typo: false, answer })).toEqual({ headline: 'Correct: The Night Watch', detail: 'Rembrandt, 1642 · Dutch Golden Age' });
    expect(paintingFeedback('title', { correct: true, typo: true, answer }).headline).toBe('Correct. It’s spelled “The Night Watch”');
    expect(paintingFeedback('title', { correct: false, typo: false, answer, given: tulp })).toEqual({
      headline: 'Not quite: it’s The Night Watch', detail: 'You named The Anatomy Lesson of Dr Nicolaes Tulp.',
    });
    expect(paintingFeedback('artist', { correct: false, typo: false, answer }).headline).toBe('Not quite: The Night Watch is by Rembrandt (1642)');
    expect(paintingFeedback('movement', { correct: true, typo: false, answer }).headline).toBe('Correct: The Night Watch is Dutch Golden Age');
    expect(paintingFeedback(undefined, { correct: false, typo: false, answer }).headline).toBe('Not quite: that’s The Night Watch');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run lib/ui/painting-feedback.test.ts`
Expected: FAIL. The module isn't found.

- [ ] **Step 3: Implement `lib/ui/painting-feedback.ts`**

```ts
type Facts = { name: string; artist?: string; year?: string; movement?: string };

/** Feedback wording for Great Paintings (spec §6): the fact asked, then who/when/what. */
export function paintingFeedback(
  asks: string | undefined,
  f: { correct: boolean; typo?: boolean; answer: Facts; given?: Facts },
): { headline: string; detail?: string } {
  const { answer: a, given } = f;
  const facts = `${a.artist}, ${a.year} · ${a.movement}`;
  if (asks === 'artist') {
    return { headline: `${f.correct ? 'Correct' : 'Not quite'}: ${a.name} is by ${a.artist} (${a.year})`, detail: given ? `${given.artist} painted ${given.name}.` : undefined };
  }
  if (asks === 'movement') return { headline: `${f.correct ? 'Correct' : 'Not quite'}: ${a.name} is ${a.movement}`, detail: `${a.artist}, ${a.year}` };
  if (f.correct) return { headline: f.typo ? `Correct. It’s spelled “${a.name}”` : `Correct: ${a.name}`, detail: facts };
  if (asks === 'title') return { headline: `Not quite: it’s ${a.name}`, detail: given ? `You named ${given.name}.` : facts };
  return { headline: `Not quite: that’s ${a.name}`, detail: given ? `You picked ${given.name}.` : facts };
}
```

Run: `npx vitest run lib/ui/painting-feedback.test.ts`
Expected: PASS.

- [ ] **Step 4: The painting component** (`components/ui/painting.tsx`)

```tsx
/* eslint-disable @next/next/no-img-element -- paintings are webp data URIs or short-cached routes; next/image adds nothing. */

/**
 * A painting, never cropped: letterboxed on a mat, with a "Detail" badge when only part is shown.
 * In questions ALWAYS leave alt="" (the default): alt text would reveal the answer.
 * `fit="square"` gives grid and wall tiles one shape, whatever the painting's proportions.
 */
export function Painting({
  src, alt = '', eager = false, detail = false, fit = 'natural', maxHeight, className = '',
}: { src: string; alt?: string; eager?: boolean; detail?: boolean; fit?: 'natural' | 'square'; maxHeight?: string; className?: string }) {
  return (
    <div className={`relative flex items-center justify-center rounded-md bg-raised p-2 ring-1 ring-rule ${fit === 'square' ? 'aspect-square' : ''} ${className}`}>
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        style={maxHeight ? { maxHeight } : undefined}
        className={`max-w-full object-contain shadow-sm ${fit === 'square' ? 'max-h-full' : 'h-auto'}`}
      />
      {detail && (
        <span className="absolute bottom-3 right-3 rounded bg-paper/90 px-1.5 py-0.5 text-[10px] font-medium text-ink-soft">Detail</span>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Wire the shared components**
  - **`lib/ui/item-image.ts`:** `imageKind` returns `'painting'` when `item.painting` is set. Check it after `flag` and `portrait`, and add `'painting'` to the return union.
  - **`components/ui/item-image.tsx`:**
    - widen the `item` prop type to include `painting` and `detail`;
    - add `case 'painting': return <Painting src={item.painting!} alt={alt} eager={eager} detail={item.detail} fit="square" className={className} />;`.
  - **`components/session/image-choice.tsx`:** the `image` prop gains `painting?: string`.
  - **`components/session/image-grid.tsx`:**
    - pass `painting: c.painting` in `image`;
    - for paintings use `max-w-3xl grid-cols-2 sm:grid-cols-3 md:grid-cols-4`.
  - **`components/session/prompt.tsx`:** in the `question !== undefined` branch, read `painting` and `detail` from `view.prompt` and render, before `portrait`:

```tsx
        {painting && <Painting src={painting} detail={view.prompt.detail} eager maxHeight="50vh" className="mx-auto w-fit max-w-full" />}
```

  - **`components/session/typed-answer.tsx`:** add `title: { label: 'Painting title', placeholder: 'Type the title…' }` and `artist: { label: 'Artist', placeholder: 'Type the artist…' }` to `INPUT`.
  - **`components/session/feedback-panel.tsx`:** at the top of `message()`, add:

```ts
  if (answer.painting) return paintingFeedback(view.prompt.asks, f);
```

  - **`components/session/intro-card.tsx`:** add a branch before the presidents one:

```tsx
  if (prompt.painting) {
    return (
      <div className="mx-auto grid w-full max-w-4xl items-center gap-8 md:grid-cols-[minmax(0,1fr)_16rem]">
        <Painting src={prompt.painting} alt={prompt.name} detail={prompt.detail} eager maxHeight="60vh" className="mx-auto w-fit max-w-full" />
        <div className="space-y-4 text-center md:text-left">
          <p className="text-sm font-medium text-accent">New painting</p>
          <h2 className="font-display text-4xl tracking-tight">{prompt.name}</h2>
          <p>{prompt.artist}, {prompt.year}</p>
          <p className="text-sm text-ink-soft">{prompt.movement}<br />{prompt.museum}</p>
          {gotIt}
        </div>
      </div>
    );
  }
```

  This requires `artist`, `year`, `movement` and `museum` on `QuestionView['prompt']`. Intros spread `presenter.item()` into `prompt`, so add the four optional fields to `prompt` too.
  - **`components/session/contrast-drill.tsx`:**
    - in the study step's `figcaption`, show `{p.artist && <span className="block text-ink-soft">{p.artist}, {p.year}</span>}`;
    - in the quiz, pass `painting: c.painting` to `ImageChoice`.

- [ ] **Step 6: Typecheck, lint and test**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all clean.

- [ ] **Step 7: Commit**

Message: `feat(ui): painting frame, questions, intro, feedback and mix-up card`.

---

### Task 8: Gallery wall, reference view, image route, credits page

**Files:**
- Create:
  - `lib/ui/gallery.ts` and `lib/ui/gallery.test.ts`;
  - `components/paintings/gallery-wall.tsx`;
  - `app/api/painting-art/[rank]/route.ts`;
  - `app/courses/[slug]/painting/[rank]/page.tsx`;
  - `app/credits/paintings/page.tsx`.
- Modify: `app/courses/[slug]/page.tsx`

**Interfaces:**
- Produces: `galleryRooms(tiles, records)`, which returns `{ movement, tiles: { rank, tile, label?: { title, artist }, summary }[] }[]`. It is the only place that decides what an unintroduced painting reveals.

- [ ] **Step 1: Read the Next.js guides**

Read the route handler and dynamic route segment guides in `node_modules/next/dist/docs/`, and `app/api/portrait-art/[key]/route.ts`. Note how `params` is awaited.

- [ ] **Step 2: Write the failing test** (`lib/ui/gallery.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { GREAT_PAINTINGS, paintingRecord } from '@/lib/content/great-paintings';
import { galleryRooms } from './gallery';

const tiles = GREAT_PAINTINGS.items.map((i) => ({
  key: i.key, name: i.name, group: i.group, tile: i.key === 'mona-lisa' ? ('learning-1' as const) : ('new' as const),
  prompts: [{ label: 'Title', phase: 'new' as const }],
}));
const rooms = galleryRooms(tiles, GREAT_PAINTINGS.items.map((i) => paintingRecord(i.key)));

describe('galleryRooms (Review Focus 4)', () => {
  it('puts every painting in its movement room, rooms in chronological order', () => {
    expect(rooms[0].movement).toBe('Ancient & Medieval');
    expect(rooms.flatMap((r) => r.tiles)).toHaveLength(GREAT_PAINTINGS.items.length);
  });

  it('labels introduced paintings and reveals nothing about new ones', () => {
    const all = rooms.flatMap((r) => r.tiles);
    const mona = all.find((t) => t.rank === 1)!;
    expect(mona.label).toEqual({ title: 'Mona Lisa', artist: 'Leonardo da Vinci' });
    for (const t of all.filter((t) => t.rank !== 1)) {
      const r = paintingRecord(GREAT_PAINTINGS.items.find((i) => paintingRecord(i.key).fame === t.rank)!.key);
      expect(t.label).toBeUndefined();
      expect(t.summary).toBe('Not introduced yet');
      expect(JSON.stringify(t)).not.toContain(r.key);
      expect(JSON.stringify(t)).not.toContain(r.title);
    }
  });
});
```

- [ ] **Step 3: Run the test and confirm it fails**

Run: `npx vitest run lib/ui/gallery.test.ts`
Expected: FAIL. The module isn't found.

- [ ] **Step 4: Implement `lib/ui/gallery.ts`**

```ts
import type { Phase, TileState } from '@/lib/engine';
import type { PaintingRecord } from '@/lib/content/types';
import { masterySummary } from './mastery';

type Tile = { key: string; name: string; group: string; tile: TileState; prompts: { label: string; phase: Phase }[] };
export type WallTile = { rank: number; tile: TileState; label?: { title: string; artist: string }; summary: string };

/**
 * The gallery wall's rooms (movements, chronological) and tiles (by fame). A painting not yet
 * introduced is addressed only by rank and carries no title, artist or key: the wall is not a
 * cheat sheet.
 */
export function galleryRooms(tiles: readonly Tile[], records: readonly PaintingRecord[]): { movement: string; tiles: WallTile[] }[] {
  const byKey = new Map(records.map((r) => [r.key, r]));
  const rooms = new Map<number, { movement: string; tiles: (WallTile & { fame: number })[] }>();
  for (const t of tiles) {
    const r = byKey.get(t.key)!;
    const room = rooms.get(r.room) ?? { movement: r.movement, tiles: [] };
    const introduced = t.tile !== 'new';
    room.tiles.push({
      rank: r.fame,
      fame: r.fame,
      tile: t.tile,
      ...(introduced ? { label: { title: r.title, artist: r.artist } } : {}),
      summary: introduced ? masterySummary(r.title, t.prompts) : 'Not introduced yet',
    });
    rooms.set(r.room, room);
  }
  return [...rooms.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, room]) => ({ movement: room.movement, tiles: room.tiles.sort((a, b) => a.fame - b.fame).map(({ fame: _fame, ...t }) => t) }));
}
```

Run: `npx vitest run lib/ui/gallery.test.ts`
Expected: PASS.

- [ ] **Step 5: The image route** (`app/api/painting-art/[rank]/route.ts`)

```ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { paintingByRank } from '@/lib/content/great-paintings';

/**
 * Painting images for REFERENCE views only (gallery wall, enlarged view), addressed by fame rank so
 * the URL names nothing. Never used inside a question: questions get data URIs. Cached for a day,
 * not forever, so a corrected image reaches returning visitors.
 */
export async function GET(request: Request, { params }: { params: Promise<{ rank: string }> }) {
  const painting = paintingByRank(Number((await params).rank));
  if (!painting) return new Response('Not found', { status: 404 });
  const thumb = new URL(request.url).searchParams.get('size') === 'thumb';
  const file = path.join(process.cwd(), 'content', 'paintings', `${painting.key}${thumb ? '-thumb' : ''}.webp`);
  return new Response(new Uint8Array(await fs.readFile(file)), {
    headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' },
  });
}
```

Check that `next.config` `outputFileTracingIncludes` (or its equivalent) includes `content/portraits`. If it does, add `content/paintings` the same way, so the route works on Vercel.

- [ ] **Step 6: The gallery wall** (`components/paintings/gallery-wall.tsx`)

```tsx
/* eslint-disable @next/next/no-img-element -- short-cached webp thumbnails; next/image adds nothing. */
import Link from 'next/link';
import type { WallTile } from '@/lib/ui/gallery';
import { TILE_STYLE } from '@/lib/ui/tiles';

/** The Great Paintings course home (a reference view): movement rooms, paintings coloured in as learned. */
export function GalleryWall({ rooms, slug }: { rooms: { movement: string; tiles: WallTile[] }[]; slug: string }) {
  return (
    <div className="space-y-10">
      {rooms.map((room) => (
        <section key={room.movement} className="space-y-3">
          <h3 className="font-display text-lg">{room.movement}</h3>
          <ul className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-5 md:grid-cols-7">
            {room.tiles.map((t) => {
              const style = TILE_STYLE[t.tile];
              return (
                <li key={t.rank} data-tile={t.tile} title={t.summary} className="space-y-1">
                  <Link href={`/courses/${slug}/painting/${t.rank}`} className="block">
                    <div
                      style={{ filter: style.filter }}
                      className={`flex aspect-square items-center justify-center rounded-md bg-raised p-1.5 ring-1 ring-rule transition-[filter] duration-500 ${style.ring ? 'ring-2 ring-gold' : ''}`}
                    >
                      <img src={`/api/painting-art/${t.rank}?size=thumb`} alt={t.label?.title ?? ''} loading="lazy" decoding="async" className="max-h-full max-w-full object-contain" />
                    </div>
                  </Link>
                  {t.label && (
                    <>
                      <p className="truncate text-xs italic">{t.label.title}</p>
                      <p className="truncate text-[11px] text-ink-soft">{t.label.artist}</p>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: Wire the course page** (`app/courses/[slug]/page.tsx`)

Add a branch before the capitals one:

```tsx
        {course.slug === GREAT_PAINTINGS.slug ? (
          <section className="space-y-5">
            <h2 className="font-display text-2xl">Your gallery</h2>
            <GalleryWall slug={course.slug} rooms={galleryRooms(o.tiles, course.items.map((i) => paintingRecord(i.key)))} />
            <p className="text-sm text-ink-soft">
              Images are public domain or credited. <Link href="/credits/paintings" className="underline">Image credits</Link>
            </p>
          </section>
        ) : course.slug === WORLD_CAPITALS.slug ? (
```

- [ ] **Step 8: The reference view** (`app/courses/[slug]/painting/[rank]/page.tsx`)

This is a server component that:
- calls `requireUserId()`, then `notFound()` unless the slug is `great-paintings` and `paintingByRank(rank)` exists;
- loads the overview with `getCourseOverview(createServiceContext(...))`, the same way the course page does, and finds the painting's tile;
- renders a back link to the course, then `<Painting src={`/api/painting-art/${rank}`} alt={introduced ? title : ''} detail={record.detail} maxHeight="75vh" className="mx-auto w-fit max-w-full" />`;
- when the tile isn't `'new'`, also renders the title, "Artist, year", the movement and the museum;
- otherwise renders only "You haven't met this painting yet."

Give `generateMetadata` the title `'Painting'`, never the painting's title.

- [ ] **Step 9: The credits page** (`app/credits/paintings/page.tsx`)

Import `content/paintings/sources.json` and the records. Render a list in fame order, each line showing:
- the painting title in italics and the artist;
- the source file linked to its Commons page;
- the licence;
- for attribution licences, "photo by {author}".

Give it the heading "Painting image credits", plus the sentence "Paintings are public domain. Photographs of works in place are used under the licence shown, with credit." The page needs no sign-in.

- [ ] **Step 10: Verify**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all clean. The build lists `/api/painting-art/[rank]`, `/courses/[slug]/painting/[rank]` and `/credits/paintings`.

- [ ] **Step 11: Commit**

Message: `feat(ui): gallery wall, reference view and image credits`.

---

### Task 9: Simulation, Supabase flow, e2e and the visual pass

**Files:**
- Create: `lib/content/great-paintings.simulation.test.ts`, `lib/study/paintings-flow.int.test.ts`, `e2e/great-paintings.spec.ts`

- [ ] **Step 1: Write the simulation** (`lib/content/great-paintings.simulation.test.ts`)

Copy `lib/content/world-capitals.simulation.test.ts` and change:
- **Course:** `GREAT_PAINTINGS`.
- **Placement:** place the first 30 by fame (`course.items.filter((i) => i.itemOrder <= 30)`).
- **The intro:** apply `rung` the way `study-service` does:

```ts
const partlyPlaced = states.some((s) => s.itemKey === entry.itemKey && s.phase !== 'new');
({ session, states } = applyIntro({ session, itemKey: entry.itemKey, states, rung: partlyPlaced ? 2 : 1 }));
```

- **The scripted miss:** `entry.itemKey === 'milkmaid' && entry.promptType === 'image_to_artist'`, answering `'courtyard-delft'` the first 2 times.
- **New assertions:**

```ts
  it('never floods learning after a generous placement (Review Focus 5)', () => {
    const { maxLearning } = simulate(14);
    expect(maxLearning).toBeLessThanOrEqual(ENGINE_CONFIG.maxLearningPrompts + course.promptTypes.length);
  });

  it('starts the placed paintings’ artist and movement at level 2', () => {
    const { firstRungOf } = simulate(14);
    expect(firstRungOf('mona-lisa', 'image_to_artist')).toBe(2);
    expect(firstRungOf('mona-lisa', 'image_to_movement')).toBe(2);
  });
```

Make `simulate` return:
- `maxLearning`, the largest count of `phase === 'learning'` states seen after any step;
- `firstRungOf(key, promptType)`, the rung recorded the first time that prompt was asked.

Keep the existing kinds of assertions: a contrast drill for `milkmaid>courtyard-delft`, and paintings learned in 14 days. For the latter, run the test once, record the observed count in a comment, and set the floor at about 85% of it.

Run: `npx vitest run lib/content/great-paintings.simulation.test.ts`
Expected: PASS.

- [ ] **Step 2: Write the Supabase flow** (`lib/study/paintings-flow.int.test.ts`)

Copy `lib/study/capitals-flow.int.test.ts` and change:
- the course becomes `GREAT_PAINTINGS`;
- placement's first question is `format: 'typed'` with `prompt.question === 'What is this painting called?'`;
- answering every placement question correctly makes the status `exam_ready` only after the remaining prompts are graduated. Use `store.seedPromptStates(SLUG, allGraduated(GREAT_PAINTINGS))` as `capitals-flow` does;
- readiness is `4 * GREAT_PAINTINGS.items.length`;
- the exam has `GREAT_PAINTINGS.items.length` questions;
- practice ahead gives 20.

Run: `npm run test:integration`
Expected: PASS, with 7 files.

- [ ] **Step 3: Write the e2e** (`e2e/great-paintings.spec.ts`)

Copy `e2e/world-capitals.spec.ts` and change:
- **Enrolment:** enrol from the dashboard article "Great Paintings". Expect `0 / ${4 * n} prompts learned`, and `[data-tile]` to have count `n`.
- **Nothing named yet (Review Focus 4):**

```ts
  await expect(page.locator('[data-tile] img[alt=""]')).toHaveCount(n);
  await expect(page.getByText('Mona Lisa')).toHaveCount(0);
  expect(await page.locator('[data-tile] img').first().getAttribute('src')).toMatch(/^\/api\/painting-art\/\d+\?size=thumb$/);
```

- **Placement:**
  - 3 correct answers with `answer(page)`, then type "Atlantis";
  - the feedback contains `it’s ${titleOf(pending.entry.itemKey)}`;
  - then skip placement.
- **Seeding:** `seedLearning(user.id, GREAT_PAINTINGS, ['night-watch'], 2)` and `seedLearning(user.id, GREAT_PAINTINGS, ['milkmaid'], 3)`.
- **Study:** study `?size=40`, collecting kinds.
- **Kinds to expect:**
  - `intro`;
  - `image_to_title-mc-text`, `image_to_artist-mc-text`, `image_to_movement-mc-text`;
  - `title_to_image-image-grid`;
  - `image_to_title-typed`, `image_to_artist-typed`.
- **In `answer()`:**
  - image questions show `[data-question-id] img` with `alt=""`;
  - title → image shows no painting above the grid.
- **Course home:** at least one `[data-tile]` now has a non-empty `alt`.
- **Exam:** graduate everything, take the final exam (`n` answers), expect `Passed` and `${n}/${n}`, then practice ahead returns 20.
- **Credits:** `/credits/paintings` shows "Painting image credits" without signing in.

Run the spec alone first: `npx playwright test e2e/great-paintings.spec.ts > scratchpad/e2e-paintings.log 2>&1`
Expected: 2 passed (the credits check is inside the first test).

Then run the full suite, alone (never concurrently with another e2e run): `npx playwright test > scratchpad/e2e-p10.log 2>&1`
Expected: all pass, with 1 skipped (deployment-only).

- [ ] **Step 4: The visual pass**

Run the paintings spec with `E2E_SCREENSHOTS=<scratchpad>/shots` at phone width (390×844) and at desktop. Then review every screenshot:
- the image → title, image → artist and image → movement questions, both multiple choice and typed;
- the 8-image grid;
- the intro card;
- feedback, both right and wrong;
- the mix-up card, if one was captured;
- the gallery wall, before and after progress;
- the reference view;
- the credits page.

Check that:
- there is no horizontal scroll;
- paintings are uncropped and letterboxed;
- the "Detail" badge appears only on details;
- grid tiles are uniform squares;
- question text stays readable above a tall painting.

Fix what's wrong and re-shoot.

- [ ] **Step 5: Full verification**

Run: `npm test && npm run test:integration && npm run typecheck && npm run lint && npm run build`
Expected: all clean.

- [ ] **Step 6: Commit**

Message: `test(paintings): simulation, Supabase flow and e2e`.
