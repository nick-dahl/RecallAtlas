# World Capitals course, and a lighter World Map — Design Spec

**Date:** 2026-10-06
**Status:** Design agreed with the user in an iterative Q&A; written spec pending the user's review
**Parent specs:** `2026-10-01-recall-atlas-design.md` (applies unless overridden) and `2026-10-05-world-map-design.md`, whose Capital prompt this spec moves into its own course.

## 1. Summary

**The problem.** Learning where every country is *and* its capital in one course is too much at once.

**The change:**
- **World Map** keeps only the map skills: **Find it** and **Name it**.
- A new course, **World Capitals**, teaches capitals in **both directions** for the 197 countries.

Each course can be learned on its own.

## 2. Decisions

| # | Decision | Choice |
|---|---|---|
| C1 | World Map prompts | Find it and Name it (Capital removed): 416 prompts over 208 items |
| C2 | Capitals directions | Country → capital and capital → country: 394 prompts over 197 items |
| C3 | Question context | A small locator map on country → capital. Capital → country shows no map (it would reveal the answer). Flag and map on the intro card and in feedback |
| C4 | Existing capital progress | Start fresh. Old World Map capital rows are ignored; no migration |
| C5 | Capitals item set | The 197 countries only; the 11 territories stay in World Map |
| C6 | Capitals placement | Country → capital, typed, for all 197. A correct answer fast-tracks both directions |
| C7 | Capitals course home | A list by region of "Country · Capital" cards that colour in as they are learned |
| C8 | Build | One plan (no new engine features) |

## 3. World Map after the split

- **Prompts:** `find` and `name` only. The `capital` prompt type is removed from `MAP_PROMPT_TYPES`.
- **Placement:** unchanged (`find` at recall; `placementGraduates: ['find', 'name']`, which is now every prompt).
- **Exam:** unchanged rule (each item once, a random prompt at recall), now only Find or Name.
- **Existing learners:**
  - `hydrateStates` drops stored rows for prompt types a course no longer has, so `capital` rows are ignored without a database change.
  - Passes already earned stay passed.
  - A learner who had graduated Find and Name but not Capital becomes exam-ready. That is intended: capitals are no longer part of this course.
- **Map presenter:** its Capital branches are removed; World Capitals has its own presenter (§5).
- **Copy:**
  - World Map's dashboard blurb becomes "Find 208 countries and territories on the map, and name them from their shape."
  - The landing page eyebrow "Flags · maps · capitals · presidents" still holds, since capitals become their own course.

## 4. World Capitals

### 4.1 Items and groups

- **Items:** the 197 countries from `content/countries.json` (records with `territory: false`), with each country's existing capital, aliases and capital note. No new content data.
- **Groups and order:** the 13 learning regions and item order shared with World Flags.
- **Look-alikes (hard distractors):** neighbours, then nearby countries (as World Map), restricted to the 197.

### 4.2 Prompts, levels, formats

| Prompt id | Label | Level 1 | Level 2 | Level 3 (recall, exam) |
|---|---|---|---|---|
| `country_to_capital` | Country → Capital | 4 capitals | 6 capitals, hard | typed capital |
| `capital_to_country` | Capital → Country | 4 countries | 6 countries, hard | typed country |

**Country → capital:**
- Question: "What's the capital of Peru?"
- A small locator map shows the country highlighted on its region map (the map frames World Map already uses).
- The answer field is `capital`, so options and typed answers use capitals, with all existing capital aliases accepted and typo tolerance.
- Typing another country's capital records a mix-up with that country (existing behaviour).

**Capital → country:**
- Question: "Lima is the capital of…?"
- No map, and no flag: either would reveal the answer.
- Options and typed answers are country names, with the usual name aliases.
- Typing a different country records a mix-up with it.

**Hard distractors:** personal mix-ups, then look-alikes, then the same region, then anyone (existing `hard` mode). Level 1 uses `local` (same region first).

**Placement:**
- `placementPromptType: 'country_to_capital'` at level 3 (typed).
- No `placementGraduates`, so the engine default (every prompt) applies: a correct answer fast-tracks both directions.

**Exam:** each country once, a random direction, level 3.

**Practice ahead:** works unchanged.

**Contrast drills:**
- Unchanged: two countries mixed up twice produce an "easy to mix up" card.
- The card shows both countries with their flags and capitals, so the learner sees the two pairs side by side.

### 4.3 Leak rules

- A country → capital view names the country and shows its locator map. It contains no capital except choice labels.
- A capital → country view names the capital. It contains no country name except choice labels, no map and no flag.
- No view contains item keys.

### 4.4 Screens

- **Questions** reuse the existing renderers: text choices, typed answer (label "Capital" or "Country name") and the map prompt for the locator. The locator map is shown smaller than World Map's question map.
- **Intro card:** flag, locator map, "Lima is the capital of Peru", and the capital note if any (e.g. Bolivia).
- **Feedback:** the right pair ("The capital of Bolivia is Sucre", plus the note), the flag, and the country's locator map. When the learner named another country's capital or another country, a line says so ("Lima is the capital of Peru").
- **Course home:** the 13 regions, each a grid of cards showing the country name and its capital.
  - Cards are coloured by tile state: muted when new, deepening while learning, full when learned, gold edge when mastered.
  - A card shows "?" in place of the capital until either direction has been introduced, so the home page doesn't give away what is still to learn.
  - The per-direction hover summary matches the other course homes.
- **Dashboard card:** "World Capitals". Blurb: "The capitals of all 197 countries, both ways round."

## 5. Code shape

- `lib/content/capital-prompts.ts` and `lib/content/world-capitals.ts` (`WORLD_CAPITALS`), registered in `lib/content/registry.ts`.
- **A capitals presenter** (`lib/study/capitals-presenter.ts`) uses the shared map support:
  - `country_to_capital` questions, intros and feedback use the item's region frame;
  - `capital_to_country` questions get no frame.
- `getMapSupport` covers both World Map and World Capitals, so locator maps load from the same frames.
- **New component:** a capitals course home (`components/capitals/capital-list.tsx`).
- **World Map:** remove `capital` from `MAP_PROMPT_TYPES`; update its tests and the e2e spec.
- No engine changes, and no database migration.

## 6. Testing

- **Unit:**
  - **World Map:** two prompt types; placement still graduates both; the presenter has no capital prompt.
  - **World Capitals:**
    - 197 items, both prompt types, placement on country → capital graduating both;
    - leak rules (§4.3);
    - capital → country has no map;
    - typed grading in both directions, including a reverse-direction mix-up.
- **Simulation:** a 30-day learner on World Capitals.
- **Integration:** World Capitals placement, a fully correct exam, and a Practice ahead check against the database.
- **E2E:**
  - **World Map** spec updated (no capital questions);
  - **new World Capitals spec:** enrol, placement by typing with one miss, a study session reaching every question kind (both directions at levels 1–3, intro), the 197-question exam, and a Practice ahead check.
- **Review:** screenshots at desktop and phone width, then an independent whole-branch review before merging.

## 7. Out of scope

Carrying World Map capital progress into World Capitals; territory capitals; capitals of sub-national regions (US states etc.); capital → country with a map.
