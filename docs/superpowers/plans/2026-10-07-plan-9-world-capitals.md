# Recall Atlas — Plan 9: World Capitals course, lighter World Map

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split capitals out of World Map into a new **World Capitals** course (197 countries, both directions). World Map then teaches only Find it and Name it.

**Architecture:** No engine features and no database migration.
- World Map drops its `capital` prompt type; stored capital rows are ignored automatically by `hydrateStates`.
- World Capitals is a new `CourseDef` over the 197 non-territory records, with `answerField: 'capital'` for one direction and the default name field for the other.
- A `capitalsPresenter` renders the views. A small option on `mapSupport` gives country → capital questions a region locator map and capital → country questions none.
- A capitals course home lists "Country · Capital" cards by region.

**Tech Stack:** TypeScript, Next.js 16, React 19, Tailwind v4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-06-world-capitals-design.md`.

## Global Constraints

- World Map: prompts `find`, `name` only; 208 items; placement unchanged.
- World Capitals: 197 countries; prompts `country_to_capital`, `capital_to_country`; placement `country_to_capital` at level 3 graduating both.
- Capital → country questions show no map and no flag; country → capital questions show a locator map and never a capital outside choice labels.
- No item keys in any question view.
- No engine changes beyond tests; no database migration.
- Flags and Presidents unchanged; all their tests pass.
- Merging and deploying need the user's go-ahead.

## Review Focus

1. **A learner mid-way through World Map with capital progress** loads World Map without errors, and their Find/Name progress is unchanged. Pinned by a `hydrateStates` test with a stored `capital` row.
2. **Typing a country name on a capital → country question that is another country's *capital*** (e.g. "Luxembourg" is both): graded against country names only. Pinned in Task 3.
3. **Capital → country questions** never include a map, flag or the country's name outside choices. Pinned by presenter leak tests.
4. **A capitals course-home card** never shows a capital the learner hasn't been introduced to. Pinned by a `capitalCardText` test.
5. **Engine tests for partial placement** still exercise a three-prompt course. Pinned by moving `TEST_MAP_COURSE` to its own prompt list in Task 1.

---

### Task 1: World Map without capitals

**Files:**
- `lib/content/map-prompts.ts`: remove `capital`.
- `lib/engine/test-fixtures.ts`: `TEST_MAP_COURSE` gets its own `find` / `name` / `capital` prompt list, so the engine's partial-placement tests keep a third prompt.
- `lib/study/map-presenter.ts` (+ test): remove the capital branches.
- `lib/content/world-map.ts` (+ test, simulation test).
- `lib/study/map-services.test.ts`, `lib/study/map-flow.int.test.ts`.
- `lib/ui/copy.ts`: World Map blurb.
- `e2e/world-map.spec.ts`: "416 prompts".

- [ ] **Step 1: Failing tests.**
  - `world-map.test.ts`: prompt ids are `['find', 'name']`; `placementGraduates` covers both.
  - `state.test.ts`: `hydrateStates(WORLD_MAP, [a stored 'capital' row, a stored 'find' row])` keeps the find row and drops the capital row.
  - `map-presenter.test.ts`: the presenter's prompt for a `name` question asks `'name'`; there is no capital test.
- [ ] **Step 2:** Run → FAIL (World Map still has three prompts).
- [ ] **Step 3: Implement.**
  - Remove `capital` from `MAP_PROMPT_TYPES`.
  - Give the engine fixture its own three prompt types (copy of the old list).
  - Drop the capital code paths and their tests from the map presenter and map services tests.
  - **Simulation**, rewritten: perfect placement in the first six regions and nothing after. The learner then studies 30 days; one Name answer for Bolivia is "Peru" twice (contrast drill). Assert the rest is learned at a recorded pace.
  - **Integration flow:** readiness `2 × (208 − 1)` of `2 × 208`.
  - **Blurb:** "Find 208 countries and territories on the map, and name them from their shape."
- [ ] **Step 4:** Unit, typecheck, lint → PASS. Commit `feat(map): World Map teaches Find and Name only`.

### Task 2: World Capitals course definition

**Files:** Create `lib/content/capital-prompts.ts`, `lib/content/world-capitals.ts`, `lib/content/world-capitals.test.ts`; modify `lib/content/registry.ts`, `lib/ui/copy.ts`.

**Interfaces:** `CAPITAL_PROMPT_TYPES`, `WORLD_CAPITALS: CourseDef` (slug `world-capitals`, title `World Capitals`), `capitalNote` reused from `world-map.ts` (move it to `lib/content/capitals.ts` so both courses import it).

```ts
export const CAPITAL_PROMPT_TYPES: PromptTypeDef[] = [
  { id: 'country_to_capital', label: 'Country → Capital', answerField: 'capital', formats: {
      1: { format: 'mc-text', choices: 4, distractors: 'local' },
      2: { format: 'mc-text', choices: 6, distractors: 'hard' },
      3: { format: 'typed' } } },
  { id: 'capital_to_country', label: 'Capital → Country', formats: {
      1: { format: 'mc-text', choices: 4, distractors: 'local' },
      2: { format: 'mc-text', choices: 6, distractors: 'hard' },
      3: { format: 'typed' } } },
];
```

Items: records with `territory: false`. Fields: `key`, `name`, `aliases`, `group`, `groupOrder`, `itemOrder`, `lookalikes = [...neighbors, ...nearby].filter(non-territory)`, `answers.capital`. `placementPromptType: 'country_to_capital'`; no `placementGraduates` (both graduate).

- [ ] **Step 1: Failing tests:**
  - 197 items, no territory keys;
  - prompt ids;
  - placement settings;
  - look-alikes never reference a territory;
  - Bolivia's capital answer is `{ text: 'Sucre', aliases: ['La Paz'] }`;
  - registered.
- [ ] **Step 2:** FAIL → implement → PASS. Blurb: "The capitals of all 197 countries, both ways round." Commit `feat(content): the World Capitals course`.

### Task 3: Presenter, map support and services

**Files:**
- `lib/map/support.ts` (+ test): `mapSupport(course, load, { mapless?: (entry) => boolean })`. A mapless entry gets no frame.
- `lib/study/capitals-presenter.ts` (+ test).
- `lib/study/presenters.ts`: `getMapSupport` covers `world-capitals` with `mapless` = capital → country questions and contrast drills; `getPresenter` adds the capitals case.
- `lib/study/types.ts`: `asks` += `'country'`; `MapView.locator?: true`.

**Presenter behaviour:**
- **Country → capital:** `{ name, question: "What's the capital of Peru?", asks: 'capital' }`; the map has the region highlight and `locator: true`; choice labels are capitals.
- **Capital → country:** `{ capital: 'Lima', question: 'Lima is the capital of…?', asks: 'country' }`; no map; choice labels are country names.
- **`item()`:** name, flag, capital, capital note.
- **`feedbackMap`:** the country's region frame with the correct outline, for both directions. Capital → country questions have no frame, so this uses the item's region frame directly.
- **Contrast choices:** `{ label: name, flag }`.

- [ ] **Step 1: Failing tests.**
  - **Leak rules (spec §4.3), over every country × direction × level:**
    - country → capital names only the country outside choice labels and has a highlight map;
    - capital → country has no `map`, no flag, and no country name outside choice labels;
    - no item keys.
  - **Grading through `gradeSubmission`:**
    - "Lima" for Peru → correct; "Quito" for Peru → mix-up with Ecuador; "Peru" for Lima → correct; "Chile" for Lima → mix-up with Chile.
    - Review Focus 2: on capital → country for Luxembourg, "Luxembourg" is correct (country name), and on capital → country for Monaco, "Luxembourg" is a mix-up with Luxembourg.
  - **`mapSupport` with `mapless`:** capital → country entries get no frame; country → capital entries get the region frame.
- [ ] **Step 2:** FAIL → implement → PASS. Commit `feat(study): World Capitals presenter and locator maps`.

### Task 4: Screens and course home

**Files:**
- `components/session/prompt.tsx`: a locator map is smaller (`maxHeight 30vh`) and capital → country renders the capital as the heading.
- `components/session/typed-answer.tsx`: `asks: 'country'` → "Country name".
- `components/session/feedback-panel.tsx`: `asks: 'country'` messages.
- `components/session/intro-card.tsx`: the map intro adds "Lima is the capital of Peru".
- Create `components/capitals/capital-list.tsx` and `lib/ui/capital-card.ts` (+ test).
- `app/courses/[slug]/page.tsx`: World Capitals renders the list.

**Interfaces:** `capitalCardText(tile, capital): string` returns the capital, or `'?'` when the tile is `new`.

**Feedback copy:**

| Question | Result | Headline | Detail |
|---|---|---|---|
| Capital → country | Correct | "Correct: Lima is the capital of Peru" | |
| Capital → country | Wrong | "Not quite: Lima is the capital of Peru" | "Santiago is the capital of Chile." when another country was given |
| Country → capital | Either | existing capital copy | existing capital copy |

- [ ] **Step 1: Failing test** for `capitalCardText` (`new` → `?`; any other state → the capital).
- [ ] **Step 2:** FAIL → implement → PASS; typecheck, lint, build.
- [ ] **Step 3:** Commit `feat(ui): World Capitals questions, feedback and course home`.

### Task 5: Simulation, integration and e2e

**Files:** Create `lib/content/world-capitals.simulation.test.ts`, `lib/study/capitals-flow.int.test.ts`, `e2e/world-capitals.spec.ts`; extend `e2e/support/session.ts` if needed (typed answers already read the answer field).

**Simulation (30 days, two sessions a day):**
- A learner who knows the first three regions' capitals at placement and nothing else.
- Their capital → country answer for Bratislava is "Slovenia" twice, so a contrast drill is queued.
- Assert both directions get introduced and learned. Record the observed number in review.

**Integration:**
- Enrol; placement fully correct by typing.
- `readiness` `2 × 197` of `2 × 197`.
- Status `exam_ready` (both graduate).
- A 197-question exam passes; Practice ahead runs 20 checks with no repeats.

**E2E:**
- Enrol from the dashboard; the course home shows 197 cards, all "?".
- Placement: three correct, then one deliberate wrong capital (check the feedback); skip the rest.
- Seed one country at level 2 and one at level 3 (both prompts); study a 40-question session.
- Assert every kind appears: intro, both directions at mc-text, both directions typed, and the locator map on country → capital.
- `graduateEverything` → a 197-question exam → Passed → Practice ahead of 20.

- [ ] Run unit, integration and e2e. Commit `test(capitals): simulation, Supabase flow and e2e`.

### Task 6: Review and hand-off

- [ ] **Screenshots** at desktop and phone width: both directions at each level, intro, feedback, course home, and the World Map course home.
- [ ] **Full verification:** unit, typecheck, lint, integration, build, the whole e2e suite run alone.
- [ ] **Independent review** of the branch on the most capable model. Fix Critical and Important findings test-first; record minors.
- [ ] **Ask the user** before merging and deploying.
