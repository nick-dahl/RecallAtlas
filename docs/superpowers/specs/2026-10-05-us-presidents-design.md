# US Presidents course — Design Spec

**Date:** 2026-10-05
**Status:** Design agreed in an iterative Q&A with the user; written spec pending the user's review
**Parent spec:** `2026-10-01-recall-atlas-design.md`. Everything there applies unless overridden here. World Map (`2026-10-05-world-map-design.md`) is the closest precedent.

## 1. Summary

US Presidents is the third course. A learner who finishes it can:
- **A. Recite the presidents in order:** who was 16th, and who fills a gap in the sequence.
- **B. Recognize their faces,** in both directions.
- **C. Place each in time:** the exact year he took office.
- **E. Name each one's party.**

Vice presidents are deferred to a later version. "What each is known for" is out of scope.

The course has **45 items, one per person**. There are 47 presidencies: Cleveland (22nd and 24th) and Trump (45th and 47th) are single items whose facts include both numbers. Each president has **6 prompts**, so 270 in total.

## 2. Decisions

| # | Decision | Choice |
|---|---|---|
| P1 | Goals | Order (A), faces (B), start year (C), party (E). Vice presidents later |
| P2 | Items | One per person (45). Cleveland and Trump carry two numbers and two start years |
| P3 | Ordering questions | Number → name, fill the gap, put in order (no name → number, no "who came after") |
| P4 | Faces | Both directions: Portrait → Name and Name → Portrait |
| P5 | Time | President → start year, typed, **exact** |
| P6 | Party | President → party, multiple choice only |
| P7 | Typed names | Surname alone is accepted when unique; shared surnames need a distinguishing part |
| P8 | Learning order | Chronological, by era (§3.2) |
| P9 | Placement | Number → name, typed. Correct graduates Number → name and Sequence |
| P10 | Put in order | Combined with fill the gap into one **Sequence** prompt, stepped by level (§4) |
| P11 | Put-in-order interaction | Tap (or press 1–4) in chronological order; no drag and drop |
| P12 | Build order | Plan 7: data + engine (no UI). Plan 8: UI + e2e + review + deploy |

## 3. Content and data

### 3.1 The president list

One hand-curated entry per president in `scripts/presidents-data.ts`, checked into the repo and reviewed line by line, like `scripts/capital-overrides.ts`. The content build turns it into `content/presidents.json`.

| Field | Example | Notes |
|---|---|---|
| `key` | `polk`, `jq-adams` | A readable, stable slug. Stored in the database, never shown in a question |
| `numbers` | `[11]`; Cleveland `[22, 24]`; Trump `[45, 47]` | |
| `name` | `James K. Polk` | Display name |
| `aliases` | `["Polk", "James Polk"]` | Accepted typed answers (§3.3) |
| `startYears` | `[1845]`; Cleveland `[1885, 1893]`; Trump `[2017, 2025]` | The year he took office |
| `party` | `Democratic` | Displayed party |
| `partyAliases` | Andrew Johnson: `["Democratic"]` | Also accepted |
| `era` | `Jacksonian era` | §3.2 |
| `portrait` | file + source URL + licence | §3.4 |

**Party rulings:**
- Washington: "No party".
- John Tyler: Whig (elected as one, later expelled).
- Andrew Johnson: National Union (his ticket), with Democratic also accepted.
- Lincoln: Republican, with National Union also accepted (his 1864 ticket).
- John Quincy Adams: Democratic-Republican, with National Republican also accepted.

### 3.2 Eras (learning groups)

Refined from the conversation's 9 eras to 8 groups of 5–6 people, so no era has only three presidents:

| # | Era | Presidencies | People |
|---|---|---|---|
| 1 | Founding era | 1–6 (1789–1829) | Washington, J. Adams, Jefferson, Madison, Monroe, J. Q. Adams |
| 2 | Jacksonian era | 7–12 (1829–1850) | Jackson, Van Buren, W. H. Harrison, Tyler, Polk, Taylor |
| 3 | Civil War era | 13–18 (1850–1877) | Fillmore, Pierce, Buchanan, Lincoln, A. Johnson, Grant |
| 4 | Gilded Age | 19–25 (1877–1901) | Hayes, Garfield, Arthur, Cleveland, B. Harrison, McKinley |
| 5 | Progressive era & twenties | 26–31 (1901–1933) | T. Roosevelt, Taft, Wilson, Harding, Coolidge, Hoover |
| 6 | Depression, war & postwar | 32–36 (1933–1969) | F. D. Roosevelt, Truman, Eisenhower, Kennedy, L. B. Johnson |
| 7 | Late Cold War | 37–41 (1969–1993) | Nixon, Ford, Carter, Reagan, G. H. W. Bush |
| 8 | Modern era | 42–47 (1993–) | Clinton, G. W. Bush, Obama, Trump, Biden |

Items are introduced in presidency order within each era. Cleveland and Trump sit at their first number.

### 3.3 Typed names (P7)

- **Unique surnames are enough:** "Polk", "Lincoln", "Fillmore".
- **Shared surnames need a distinguishing part.** These surnames are shared: Adams (2, 6), Harrison (9, 23), Johnson (17, 36), Roosevelt (26, 32), Bush (41, 43). The bare surname is an alias of neither, so "Adams" alone is wrong for both. Accepted forms include:

| President | Accepted |
|---|---|
| John Adams | John Adams |
| John Quincy Adams | John Quincy Adams, J. Q. Adams, JQA, Quincy Adams |
| William Henry Harrison | William Henry Harrison, W. H. Harrison, William Harrison |
| Benjamin Harrison | Benjamin Harrison, Ben Harrison |
| Andrew Johnson | Andrew Johnson |
| Lyndon B. Johnson | Lyndon B. Johnson, Lyndon Johnson, LBJ |
| Theodore Roosevelt | Theodore Roosevelt, Teddy Roosevelt, TR |
| Franklin D. Roosevelt | Franklin D. Roosevelt, Franklin Roosevelt, FDR |
| George H. W. Bush | George H. W. Bush, H. W. Bush, Bush 41 |
| George W. Bush | George W. Bush, G. W. Bush, Bush 43 |

- Initialisms in common use are accepted where unique (JFK, LBJ, FDR, TR, JQA). Nicknames such as "Ike" or "Honest Abe" are not.
- The existing grading rules apply: normalization, typo tolerance, and "another item within tolerance wins ties" (so "John Adams" can never be accepted as a typo of "John Q. Adams").

### 3.4 Portraits

- **Source:** Wikimedia Commons, public-domain files only.
  - Painted portraits for presidents up to the early 20th century (old enough to be public domain).
  - **Official White House photographs** for photo-era presidents. Many modern *painted* official portraits are still under the artist's copyright and are not used.
- **Fetch once, commit the result.** A separate script (`npm run content:portraits`) downloads each file listed in the data, crops it to a consistent head-and-shoulders frame (3:4), resizes it (about 360×480) and writes `content/portraits/<key>.webp`. It never runs at request time or in `content:build`.
- **Provenance:** each entry records the Commons file page URL and licence; a `content/portraits/CREDITS.md` is generated from them.
- **In questions** portraits are sent as embedded data URIs with empty `alt` text, like flags, so no URL or file name reveals the answer. Reference views (course home, intro, feedback) may label them.

### 3.5 Look-alikes (hard distractors)

`lookalikes` = era neighbours (closest numbers first), then a short hand-picked list of easily confused faces (e.g. Arthur/Hayes, Pierce/Fillmore, Harding/Coolidge). The list lives in the data file and is validated for unknown keys.

### 3.6 Validation (fails the build)

- Every president has a portrait file, a party, at least one start year and at least one number.
- Presidency numbers 1–47 are each covered exactly once.
- No two presidents accept the same normalized typed name.
- Start years are **exempt** from uniqueness: W. H. Harrison and Tyler both took office in 1841, and Garfield and Arthur in 1881.
- Every look-alike key exists.

## 4. Prompts, levels, formats

| Prompt id | Label | Level 1 | Level 2 | Level 3 (recall, exam) |
|---|---|---|---|---|
| `number_to_name` | Number → Name | 4 names | 6 names, hard | typed name |
| `portrait_to_name` | Portrait → Name | 4 names | 6 names, hard | typed name |
| `name_to_portrait` | Name → Portrait | 4 faces | 6 faces, hard | 8 faces, hard |
| `start_year` | Start year | 4 years | 6 years, hard | typed year, exact |
| `party` | Party | 2–4 parties | 2–4 parties, hard | 2–4 parties, hard |
| `sequence` | Sequence | fill the gap, 4 names | put 4 in order | fill the gap, typed |

Behaviour:
- **Hard distractors:** personal mix-ups, then look-alikes (era neighbours first), then the same era, then anyone.
- **Number → name** shows one number. For Cleveland and Trump it picks one of the two at issue time and records which (§5).
- **Start year:**
  - Typed answers are exact. Typo tolerance is off, so "1854" is not accepted for 1845.
  - Cleveland accepts 1885 or 1893; Trump 2017 or 2025. Multiple choice shows the year matching the recorded slot.
  - Options never repeat a year (shared years like 1841 are excluded from a question's distractors).
  - A typed year counts as a mix-up only when it belongs to exactly one other president.
- **Party:**
  - Options are distinct party names, drawn from nearby presidents so they fit the period. There are as many options as there are distinct parties nearby, from 2 up to 4.
  - The right option is the target's displayed party. A wrong party is never recorded as a mix-up between two presidents.
- **Sequence:**
  - **Fill the gap** (levels 1 and 3) shows the neighbours by display name: `Zachary Taylor → ? → Franklin Pierce`. At the ends it shows `? → John Adams` and `Joe Biden → ?`. For Cleveland and Trump it uses the recorded slot. Level 1 gives 4 named options; level 3 is typed, graded as a name.
  - **Put in order** (level 2) shows the target plus the 3 presidents nearest to him in number, shuffled. It is correct only if all 4 are put in chronological order, and the credit or miss goes to the target. Sets never combine Cleveland with Benjamin Harrison, or Trump with Biden, because there would be no single right order; the next-nearest president is used instead.
- **Contrast drills** are unchanged: two presidents mixed up twice produces an "easy to mix up" card with both portraits and names.
- **Placement:** `number_to_name` at level 3 (typed), once per person; Cleveland and Trump are asked one of their numbers. A correct answer graduates `number_to_name` and `sequence`; faces, start year and party are learned in study.
- **Exam:** each president once, a random prompt at level 3 (unchanged rule).
- **Practice ahead** works unchanged (one prompt per learned president, weighted towards what is fading).

## 5. Engine and service changes (`lib/engine`, `lib/study`)

All general, so later courses can reuse them. Flags and Map behaviour is unchanged by default.

1. **Exact answer fields.** An answer field can declare `exact: true` (no typo tolerance) and can hold several values (Cleveland's years). `gradeTyped` honours both.
2. **Distinct-choice prompts.** `PromptTypeDef.distinctChoices?: boolean`: distractors must differ from the target, and from each other, in the prompt's answer field, so options never repeat a label. `PromptTypeDef.recordsConfusions?: false` stops a prompt recording mix-ups (party).
3. **Sequence numbers.** `Item.sequence?: number[]` (presidency numbers). A distractor mode `sequence` picks the nearest items by number, skipping declared ambiguous pairs (`CourseDef.orderExclusions`).
4. **Slots.** `PendingQuestion.slot?: number`, chosen at issue time for multi-number items. It drives the number shown, the gap's neighbours and the multiple-choice year, so the screen and the grading agree.
5. **Formats:** `image-grid` (generalizes `flag-grid`, which stays as is for flags), `gap-choice`, `gap-typed`, `order`.
6. **Order answers.** `AnswerResponse` gains `{ kind: 'order'; choiceIds: string[] }`. Validation requires exactly the issued choice ids, each once. It is graded correct only if they are in ascending sequence order.
7. **Placement:** `placementPromptType: 'number_to_name'`, `placementGraduates: ['number_to_name', 'sequence']` (reuses World Map's subset mechanism).
8. **Presenter:** a new `presidentsPresenter`.
   - Prompt text: "Who was the 16th president?", "Who is this?", "Which one is Chester A. Arthur?", "When did James K. Polk take office?", "Which party was James K. Polk?", the gap chain, "Put these in order".
   - Choice labels use the prompt's answer field (names, years or parties).
   - `item()` returns name, portrait, numbers, years and party, for feedback, intros and end screens.
9. **Leak rules.** A Portrait → Name view contains no names except choice labels. A Name → Portrait view contains the target's name and unlabelled portraits. A Number → Name view contains no names except choice labels. A gap view contains its neighbours' names and, at level 1, choice labels. Start-year and party views name only the target. Put-in-order views name the four presidents but show no numbers or years. No view contains item keys.

## 6. UI (Plan 8)

- **Portraits** use a portrait frame (3:4, the stamp styling adapted) in prompts, grids, intros, feedback and the course home.
- **Face grid:** the flag grid generalized to images (4, 6 or 8 faces; keys 1–8).
- **Fill the gap:** the chain of names with the gap highlighted, then choices (level 1) or a typed answer (level 3).
- **Put in order:** four name cards. Click, tap or press 1–4 on them in chronological order; each gets a sequence badge (1st, 2nd…). Backspace undoes the last pick. It submits when the fourth is placed. Feedback shows the correct order.
- **Start year:** choice buttons, or a numeric input for typed.
- **Intro card:** portrait, name, number(s), years, party.
- **Feedback** names the right president (portrait thumbnail) and the relevant fact, e.g. "Polk took office in 1845".
- **Course home: a timeline.** All 45 portraits in a strip grouped by era, labelled with number(s) and start year(s), coloured by tile state (grayscale → colour → gold ring when mastered), with a per-prompt hover summary like the mastery map. The readiness meter, mix-ups and last exam are reused.
- **Dashboard:** the US Presidents card goes live (it is "Coming soon" today). Blurb: "All 45 presidents: in order, by face, by year and by party."
- **Landing page:** eyebrow becomes "Flags · maps · capitals · presidents".

## 7. Testing

- **Content build:** the §3.6 validations, plus a staleness check that `content/presidents.json` matches the data file.
- **Unit:**
  - Name grading: shared surnames ("Adams" alone is wrong for both Adamses; "JQA" is right), typos, ties.
  - Exact years: "1854" is wrong for Polk (1845); Cleveland accepts 1885 and 1893; shared years (1841).
  - Distinct party choices; party misses record no mix-up.
  - Sequence neighbours at the ends of the list, around Cleveland/B. Harrison and Trump/Biden.
  - Order validation and grading.
  - Slot consistency: a Cleveland question's number, gap and year options all match its slot.
  - Presenter leak tests (§5.9).
- **Engine:** a 30-day learner simulation on the real course.
- **Integration:** placement and an exam through Supabase.
- **E2E (Plan 8):** placement by typing; a study session covering every format, including tap-in-order; the 45-question exam; a Practice ahead check; one deliberate miss to check feedback.

## 8. Out of scope

Vice presidents (planned as a follow-up); "what each is known for"; first ladies; terms' end years; name → number questions; drag and drop.
