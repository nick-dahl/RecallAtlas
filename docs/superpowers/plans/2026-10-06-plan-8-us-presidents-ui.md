# Recall Atlas — Plan 8: US Presidents UI, e2e, review

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make US Presidents playable end to end. Every format gets a real renderer (portrait prompts, face grid, gap chain, tap-in-order, year input), plus feedback, intro and contrast screens for presidents and a timeline course home. The course is registered, the dashboard card goes live, and Playwright covers placement, study, the exam and Practice ahead.

**Architecture:** Presentation only. The services already produce presidents' views (Plan 7). A shared `ItemImage` picks a flag stamp or a portrait frame from an `ItemView`. Put-in-order runs on a small pure state helper (`order-state.ts`) so its rules are unit-tested. The course home renders a server-side timeline from the overview tiles plus each president's numbers and years. Reference images come from a new public `/api/portrait-art/[key]` route; questions keep using data URIs.

**Tech Stack:** Next.js 16 App Router, React 19.2, Tailwind v4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-05-us-presidents-design.md` §6 (UI) and §7 (testing). Builds on Plan 7 (`2026-10-05-plan-7-us-presidents-data-engine.md`), whose interim renderers this replaces.

## Global Constraints

- Answers never leak:
  - Question portraits stay data URIs with `alt=""`.
  - The `/api/portrait-art/[key]` route is for reference views only (course home, intros, feedback, end screens), never inside a question.
  - No item keys in a question's DOM.
- Keyboard first: number keys pick options (1–8); Enter submits or continues; Esc = "I don't know" on typed questions; Backspace undoes the last pick in put-in-order.
- Portrait frame is 3:4, the stamp styling adapted; flags stay 4:3.
- Reduced motion respected; no new UI or animation libraries.
- Flags and World Map behaviour unchanged; their e2e specs still pass.
- Merging to `main` and deploying are not part of this plan; ask the user.

## Review Focus

1. **Put-in-order with a double-tap or a fast fifth key press** must never submit twice or submit a duplicate. Pinned by `order-state` tests (a pick of an already-placed card is ignored; nothing can be picked once complete).
2. **Feedback for start-year and party multiple choice** must mark the right option, even though the labels are years or parties, not names. Pinned by `choiceState` tests.
3. **Cleveland and Trump on the timeline and intro** show both numbers and both years ("22nd & 24th · 1885 & 1893"). Pinned by the `presidentFacts` formatting test.
4. **Typed year on a phone** brings up a numeric keyboard and is still graded as text. Covered by `inputMode="numeric"` and the e2e typed-year step.
5. **A missing image** (an `ItemView` with neither flag nor portrait) renders nothing rather than a broken `<img src="">`. Pinned by the `ItemImage` test.

---

## File map

| File | Responsibility |
|---|---|
| `components/ui/portrait.tsx` | 3:4 portrait frame |
| `components/ui/item-image.tsx` | Flag stamp or portrait frame from an `ItemView`; nothing when neither |
| `lib/ui/president-facts.ts` (+ test) | "22nd & 24th", "1885 & 1893", ordinals for reference views |
| `components/session/image-grid.tsx`, `image-choice.tsx` | Face grid (generalizes the flag grid's choice) |
| `components/session/gap-chain.tsx` | `before → ? → after` |
| `components/session/order-state.ts` (+ test), `order-picker.tsx` | Tap-in-order |
| `components/session/{prompt,typed-answer,intro-card,contrast-drill,feedback-panel,end-screen,choice-state,question-stage}.tsx/ts` | President branches |
| `lib/study/presidents-presenter.ts` (+ test) | `asks: 'party'` and `'president'` hints |
| `app/api/portrait-art/[key]/route.ts` (+ test) | Public reference portraits |
| `components/presidents/timeline.tsx`, `app/courses/[slug]/page.tsx` | Timeline course home |
| `lib/content/registry.ts`, `app/dashboard/page.tsx`, `lib/ui/copy.ts`, `app/page.tsx` | Registration, dashboard card, blurb, landing eyebrow |
| `scripts/presidents-data.ts`, `content/portraits/polk.webp` | Closer Polk portrait (deferred from Plan 7) |
| `e2e/support/session.ts`, `e2e/presidents.spec.ts` | Browser tests |

---

### Task 1: Images and facts

**Files:** Create `components/ui/portrait.tsx`, `components/ui/item-image.tsx`, `components/ui/item-image.test.ts`, `lib/ui/president-facts.ts`, `lib/ui/president-facts.test.ts`, `app/api/portrait-art/[key]/route.ts` (+ test); delete `lib/ui/item-image.ts` (replaced); update its four users (`feedback-panel`, `end-screen`, `contrast-drill`, course page).

**Interfaces:**
- `Portrait({ src, alt = '', eager, className })`: like `Flag`, `aspect-[3/4]`.
- `ItemImage({ item: Pick<ItemView, 'flag' | 'portrait' | 'name'>, labelled?: boolean, eager? })`: renders `Flag` or `Portrait`; `alt` is the name only when `labelled`; returns `null` with neither.
- `imageKind(item): 'flag' | 'portrait' | null` (pure, tested).
- `presidentFacts({ numbers, startYears, party }) → { numbers: string; years: string; party: string }`, e.g. `{ numbers: '22nd & 24th', years: '1885 & 1893', party: 'Democratic' }`.

- [ ] **Step 1: Failing tests.**

```ts
// lib/ui/president-facts.test.ts
expect(presidentFacts({ numbers: [16], startYears: [1861], party: 'Republican' }))
  .toEqual({ numbers: '16th', years: '1861', party: 'Republican' });
expect(presidentFacts({ numbers: [22, 24], startYears: [1885, 1893], party: 'Democratic' }))
  .toEqual({ numbers: '22nd & 24th', years: '1885 & 1893', party: 'Democratic' });
```

```ts
// components/ui/item-image.test.ts
expect(imageKind({ name: 'Chad', flag: 'data:x' })).toBe('flag');
expect(imageKind({ name: 'Polk', portrait: 'data:y' })).toBe('portrait');
expect(imageKind({ name: 'Nobody' })).toBeNull();
```

The route test mirrors `app/api/flag-art/[key]/route.test.ts`: 200 with `image/webp` and an immutable cache header for `polk`; 404 for an unknown key and for `../secrets`.

- [ ] **Step 2: Run them** → FAIL (modules missing).
- [ ] **Step 3: Implement.**
  - `presidentFacts` reuses `ordinal` (move it from `lib/study/presidents-presenter.ts` to `lib/ui/president-facts.ts` and import it back).
  - `ItemImage` switches on `imageKind`.
  - The route reads `content/portraits/<key>.webp` for keys in `US_PRESIDENTS`.
  - Replace `itemImage(...)` + `<Flag>` at the four call sites with `<ItemImage item={…} />`.
  - Add `./content/portraits/**/*` file tracing (already present from Plan 7).
- [ ] **Step 4:** `npx vitest run`, typecheck, lint → PASS. Commit `feat(ui): portrait frame, item images and president facts`.

### Task 2: Question renderers

**Files:**
- Create `components/session/image-choice.tsx`, `image-grid.tsx`, `gap-chain.tsx`, `order-state.ts`, `order-state.test.ts`, `order-picker.tsx`.
- Modify `prompt.tsx`, `typed-answer.tsx`, `choice-list.tsx` (gap chain above choices), `choice-state.ts` (+ test), `question-stage.tsx`, `intro-card.tsx`, `contrast-drill.tsx`, `feedback-panel.tsx`, `lib/study/types.ts` (`asks` += `'party' | 'president'`), `lib/study/presidents-presenter.ts` (+ test).

**Interfaces:**
- `order-state.ts`:

```ts
export interface OrderState { picks: string[]; total: number }
export const startOrder = (total: number): OrderState => ({ picks: [], total });
/** Adds a card; ignored if already placed or the order is complete. */
export function pick(state: OrderState, id: string): OrderState;
/** Removes the last pick (Backspace). */
export function undo(state: OrderState): OrderState;
export const isComplete = (state: OrderState) => state.picks.length === state.total;
/** 1-based position of a card, or null when not yet placed. */
export const positionOf = (state: OrderState, id: string): number | null;
```

- `presidentsPresenter` prompt hints:
  - `asks: 'president'` for Number → Name, Portrait → Name and fill the gap (all levels);
  - `asks: 'year'` for start year;
  - `asks: 'party'` for party.
- `choiceState` matches the answer by name, capital, any start year (`answer.startYears` includes `Number(label)`) or party.

- [ ] **Step 1: Failing tests.**
  - `order-state.test.ts`:
    - picks append in order;
    - re-picking a placed card is ignored;
    - after `total` picks, further picks are ignored and `isComplete` is true;
    - `undo` removes the last pick;
    - `undo` on empty is a no-op;
    - `positionOf` gives 1-based positions.
  - `choice-state.test.ts`:
    - the year label `'1893'` is correct for an answer with `startYears [1885, 1893]`;
    - `'Whig'` is correct for `party: 'Whig'`;
    - a different year or party is wrong or dim.
  - `presidents-presenter.test.ts`: the `asks` hints above for each prompt type.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
  - **`ImageChoice`** generalizes `FlagChoice`: renders `ItemImage` from `{ flag, portrait }` and is used by `FlagGrid` too. **`ImageGrid`** is a grid of 4/6/8 portraits; keys 1–8; columns 2 / 3 / 4.
  - **`Prompt`:** when `view.prompt.question` is set and there is no `view.map`, render the president prompt:
    - the portrait large (Portrait → Name), or the name heading (Name → Portrait), or the gap chain (fill the gap);
    - the question as the heading.
  - **`GapChain`:** three cells, `before → ? → after`. The `?` cell is accent-outlined; missing ends render as a muted "—". On feedback the `?` fills with the answer's name.
  - **`TypedAnswer`** label, placeholder and input mode by `asks`:

    | `asks` | Label | Placeholder | Input mode |
    |---|---|---|---|
    | `year` | Year | Type the year… | `numeric` |
    | `president` | President | Type the president… | text |
    | `capital` | Capital | (as now) | text |
    | anything else | Country name | (as now) | text |

  - **`OrderPicker`:**
    - shows "Put these in order, earliest first" and four name cards (`data-choice-id`);
    - a click, tap or number key `pick`s a card, and placed cards show a "1st/2nd/…" badge;
    - Backspace `undo`es;
    - when complete it submits `{ kind: 'order', choiceIds: picks }` once (guarded by `isComplete` and `locked`);
    - on feedback, each card shows its correct position (from `feedback.order`), green when the learner placed it there, red otherwise.
  - **`IntroCard`** with a portrait: "New president", portrait, name, `presidentFacts` ("16th president · took office 1861 · Republican").
  - **`ContrastDrill`** with portraits: the pair shows portraits and names; the quiz uses `ImageChoice`.
  - **`FeedbackPanel`:**
    - year: "Polk took office in 1845" (Cleveland: "1885 and 1893");
    - party: "Polk was Democratic";
    - order: "The right order: A → B → C → D".
  - **`question-stage`** maps `image-grid → ImageGrid`, `gap-choice → ChoiceList` (with the chain via `Prompt`), `gap-typed → TypedAnswer`, `order → OrderPicker`.
- [ ] **Step 4:** Unit tests, typecheck, lint → PASS. Commit `feat(ui): renderers for every US Presidents question`.

### Task 3: Timeline course home, registration and surfaces

**Files:** Create `components/presidents/timeline.tsx`; modify `app/courses/[slug]/page.tsx`, `lib/content/registry.ts` (+ test: `getCourse('us-presidents')` is `US_PRESIDENTS`, flipping Plan 7's "not registered" assertion), `app/dashboard/page.tsx` (drop the coming-soon card), `lib/ui/copy.ts` (blurb), `app/page.tsx` (eyebrow), `lib/content/us-presidents.test.ts`.

- [ ] **Step 1:** Update the registry test (expects registration) → FAIL.
- [ ] **Step 2: Implement.**
  - Register `US_PRESIDENTS`.
  - **`Timeline`** (server component): eras in order, each a heading with its year span and a responsive grid of cards. Each card shows:
    - the portrait from `/api/portrait-art/<key>`, filtered by `TILE_STYLE` (grayscale → colour) with a gold ring when mastered;
    - `presidentFacts` numbers and start years, and the name;
    - a `title` hover summary from `masterySummary`.
  - The course page renders `Timeline` when the course is US Presidents ("Your timeline"), the mastery map for World Map, and the album otherwise.
  - Dashboard: remove the "US Presidents — Coming soon" card.
  - `COURSE_BLURB['us-presidents'] = 'All 45 presidents: in order, by face, by year and by party.'`
  - Landing eyebrow: "Flags · maps · capitals · presidents".
- [ ] **Step 3:** Unit tests, typecheck, lint, build → PASS. Commit `feat(ui): US Presidents timeline course home and dashboard card`.

### Task 4: A closer Polk portrait

**Files:** Modify `scripts/presidents-data.ts` (`commonsFile` for Polk); regenerate `content/portraits/polk.webp`, `sources.json`, `CREDITS.md`.

- [ ] **Step 1:** Search Commons for public-domain Polk head-and-shoulders portraits (the same search Plan 7 used for FDR); pick one; add `commonsFile`.
- [ ] **Step 2:** `npm run content:portraits -- polk`; rebuild the contact sheet and compare with the others.
- [ ] **Step 3:** `npx vitest run lib/content` → PASS (licence and size tests). Commit `fix(content): a head-and-shoulders portrait for Polk`.

### Task 5: E2E

**Files:** Modify `e2e/support/session.ts` (order answers: click the issued cards in chronological order; typed answers use the prompt's answer field, the start year for year questions); create `e2e/presidents.spec.ts`.

- [ ] **Step 1: Spec.**
  1. Enroll from the dashboard; the timeline shows 45 cards.
  2. Placement by typing (first 3 correct, then one deliberate wrong name, checking the feedback); skip the rest.
  3. Study until every format has been seen at least once, or 40 answers: intro, mc-text, image-grid, gap-choice, typed name, typed year, party, put-in-order. Seed rungs via the admin client so level-2 and level-3 formats appear (`seedRungs(user, course, { rung: 2 })`).
  4. A 45-question exam → "Passed".
  5. A Practice ahead check of 20 with no repeats.
  6. Optional screenshots with `E2E_SCREENSHOTS=<dir>`, as in `world-map.spec.ts`.
- [ ] **Step 2:** Run the whole e2e suite → PASS (rerun once if a known flaky first request times out; ledger it).
- [ ] **Step 3:** Commit `test(e2e): US Presidents placement, study, exam and practice`.

### Task 6: Review and hand-off

- [ ] Screenshot review at desktop and phone widths: every renderer, the timeline, the intro, feedback for year/party/order, the end screen. Fix what looks wrong.
- [ ] Full verification: unit, typecheck, lint, integration, build, e2e.
- [ ] Independent whole-branch review (most capable model); fix Critical/Important findings test-first; ledger minors.
- [ ] Ask the user before merging `us-presidents` to `main` and deploying.
