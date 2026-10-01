# Recall Atlas — Design Spec

**Date:** 2026-10-01
**Status:** Approved design, pending spec review
**Working title:** Recall Atlas

## 1. Product summary

A desktop web app that helps a signed-in user learn and then retain discrete sets of information ("courses") — e.g. every flag in the world — until they can pass a 100% final exam. It is not a flashcard deck: an adaptive engine tracks what the user knows per item and per direction, spends time on weak and confused items, fades out known items, and keeps passed courses fresh with spaced review.

**Ambition:** portfolio / serious side project — real accounts, publicly deployed, polished, but not engineered for scale.

## 2. Scope

### Launch course catalog
| Course | Items | Memory type | Ships in |
|---|---|---|---|
| World Flags | ~197 | Visual recognition | **MVP** |
| World Map | ~197 | Spatial | Phase 2 |
| US Presidents | 46 | Sequence / ordering | Phase 3 |

**Country set** (shared by Flags and Map): 193 UN members + Vatican City + Palestine + Taiwan + Kosovo = 197. Western Sahara excluded from MVP (can be added via content JSON).

### MVP = full engine on World Flags
Auth → dashboard → World Flags with placement sweep, difficulty ladder, FSRS scheduling, sessions, confusion tracking + contrast drills, final exam, retention health. Deployed to Vercel. Map and Presidents appear on the dashboard as "Coming soon".

### Explicitly out of scope (MVP)
Mobile layout, email/push reminders, social features/leaderboards, user-created courses, per-user FSRS parameter optimization, World Map and US Presidents courses.

## 3. Tech stack
- **Next.js 15** (App Router, TypeScript), **Tailwind CSS**
- **Supabase**: Auth (Google + email magic link), Postgres with RLS
- **ts-fsrs** for spaced-repetition scheduling
- **Vitest** (engine + integration), **Playwright** (e2e)
- **Vercel** hosting
- Desktop-first; keyboard-driven interaction. No mobile design.

## 4. Architecture

```
app/                     routes + React UI
  /                      landing (signed out)
  /dashboard             course cards
  /courses/[slug]        course home (mastery grid, readiness, confusions)
  /placement/[slug]      placement sweep player
  /study/[slug]          session player
  /exam/[slug]           exam player
components/exercises/    one renderer per format; pure UI
  IntroCard, MultipleChoiceText, FlagGridChoice, TypedAnswer, ContrastDrill
server/actions/          auth → load → engine → persist (only layer touching DB + engine)
  startSession, submitAnswer, startPlacement, startExam, submitExamAnswer
lib/engine/              PURE TypeScript: no I/O, no React, no Supabase; `now` injected
  types.ts, ladder.ts, scheduler.ts, session.ts, placement.ts,
  confusion.ts, exam.ts, grading.ts, config.ts (all tunable constants)
lib/content/             course + prompt-type definitions
scripts/build-content.ts generates and validates content/*.json from open data
content/*.json           committed seed data
public/flags/*.svg       flag assets (flag-icons, MIT)
supabase/migrations/     schema + RLS
```

**Boundaries**
- The engine takes plain data plus `now` and returns plain data. Every behavior rule is unit-testable without a DB.
- Renderers receive a `Question` (`{ questionId, format, prompt, choices? }`) and emit an answer. They never receive the correct answer before submission.
- Grading happens server-side (exam integrity).
- Adding a course = content JSON + prompt-type definitions + (possibly) a new renderer. The engine is unchanged.

**Content sources:** world-atlas / Natural Earth TopoJSON (Map, later), `flag-icons` SVGs (MIT), Wikipedia/Wikimedia public-domain data and portraits (Presidents, later). Fetched only by the build script; no runtime external calls.

## 5. Data model

### Content (seeded, read-only to users)
```
courses   id, slug, title, description, item_noun, group_label
items     id, course_id, key, name, aliases text[], group, group_order, item_order,
          attrs jsonb, lookalikes text[]
```
`content/countries.json` is the single source for country data; it generates items for both World Flags and World Map (separate item rows per course). Prompt types per course are defined in code (`lib/content`), e.g. World Flags: `flag_to_name`, `name_to_flag`.

### Per-user state
```
enrollments    user_id, course_id, status (placement|learning|exam_ready|passed),
               placement_completed_at, passed_at, created_at
prompt_states  PK(user_id, item_id, prompt_type)
               phase (new|learning|review), rung (0–3), rung_streak,
               due, stability, difficulty, reps, lapses, last_review, fsrs_state
answers        id, user_id, item_id, prompt_type, context (study|placement|exam),
               format, rung, given_text, given_item_id, correct, response_ms,
               question_id UNIQUE, created_at          -- append-only
confusions     PK(user_id, course_id, asked_item_id, answered_item_id), count, last_at
sessions       id, user_id, course_id, kind (study|placement|exam),
               queue jsonb, position, started_at, completed_at
exam_attempts  id, user_id, course_id, session_id, score, total, passed,
               missed_item_ids, finished_at
```

### Security
RLS: users may `SELECT` only their own rows. All writes go through server actions using the service role; the browser never writes directly. `answers` is the append-only history from which `confusions` can be rebuilt and FSRS parameters could later be tuned.

## 6. Engine rules

All numbers live in `lib/engine/config.ts` and are tunable.

### 6.1 Granularity
Mastery is tracked per **item × prompt type** (World Flags: 2 prompts per item → ~394 prompt states per user).

### 6.2 Difficulty ladder (learning phase)
| Rung | flag_to_name | name_to_flag | Advance rule |
|---|---|---|---|
| 0 Introduce | IntroCard (flag + name), ungraded — shared by both prompts | | viewed |
| 1 Recognize | 4-choice text MC, random distractors | 4-flag grid, random | 1 correct |
| 2 Discriminate | 6-choice MC, hard distractors | 6-flag grid, hard | 2 consecutive correct |
| 3 Recall | Typed answer | 8-flag grid incl. all lookalikes | 1 correct → graduate |

- A new **item** is introduced once (rung 0); after viewing, both prompts are at rung 1.
- **Miss:** rung = max(1, rung − 1); streak = 0; re-queued 3–5 positions later in the same session.

**Distractor selection.** *Hard* (rungs 2–3): user's personal confusions for this item (count desc) → static `lookalikes` → same group → random. *Random* (rung 1): random items, preferring other groups.

### 6.3 Scheduling (review phase)
- `ts-fsrs`, desired retention 0.90, short-term learning steps disabled (the ladder replaces them).
- **Graduation:** first FSRS review rated *Good*; prompt enters `review` phase.
- **Reviews** are always asked at Recall format. Correct → *Good*; correct only via typo tolerance → *Hard*; wrong → *Again* (lapse).
- **Lapse:** phase → `learning`, rung → 2. Re-graduation resumes FSRS from its post-lapse state.

### 6.4 Session builder
Default size N = 20 (user choice 10 / 20 / 40). Fill in order:
1. Due reviews (`phase=review`, `due ≤ now`), lowest retrievability first.
2. Learning prompts, lowest rung first.
3. New items from the current group (group order, then item order), max 5 per session, only while fewer than 15 prompts are in `learning`.

Interleave so the same item never appears consecutively. Re-queued misses may extend a session by at most 10 questions. If nothing is due/learning/new: show "All caught up" with **Practice ahead** (soonest-due prompts) and, if unlocked, **Take exam**.

### 6.5 Confusion tracking
- Any wrong answer that resolves to another item (MC choice, flag click, or typed text matching another item's name/alias) increments `confusions(asked, answered)`.
- When a pair's count reaches **2**, a **ContrastDrill** for that pair is injected as the next re-queued question: both flags side by side with labels, then a 2-choice "Which one is X?". Drills are logged but do not move the ladder.
- Course home shows the user's top confusion pairs.

### 6.6 Placement sweep
- Optional, offered on first enrollment; resumable; can be stopped at any time.
- One typed `flag_to_name` question per item, in group order, with a prominent "I don't know" (Esc).
- Correct → **both** prompts graduate immediately (FSRS *Good*). Wrong / don't know / untested → item remains `new`.
- Placement answers are logged (`context = placement`) and wrong answers that match another item count as confusions.

### 6.7 Final exam
- **Unlock:** every prompt in `review` phase (enrollment status `exam_ready`).
- **Content:** each item once, random prompt type, Recall format, shuffled. No per-question feedback. Pause/resume supported (server-side queue).
- **FSRS:** exam answers count as reviews (correct → *Good*/*Hard*, wrong → *Again*/lapse).
- **Pass:** 100% → enrollment `passed`, `passed_at` set, permanent dated badge.
- **Fail:** results report listing misses; missed prompts lapse into learning; exam re-locks until all prompts are back in `review`; retake is the full exam.
- **Abandon:** attempt voided; FSRS updates already made stand.

### 6.8 After passing — maintenance
Passing is permanent. FSRS continues scheduling reviews. **Retention health** = mean FSRS retrievability across all prompts at `now`; below 90% the course card shows a nudge. No emails in MVP.

### 6.9 Grading
- Normalize: case-fold, strip diacritics and punctuation, collapse whitespace, ignore leading "the".
- Match against item name + `aliases`.
- Typo tolerance: Levenshtein ≤ 1 for normalized names < 8 chars, ≤ 2 otherwise — **but** an exact or within-tolerance match to a *different* item's name/alias always wins (e.g. "Niger" is never accepted as "Nigeria"; it is graded wrong and logged as a confusion).
- Typo-accepted answers are correct but display the canonical spelling.
- "I don't know" = wrong, `given_item_id` null (no confusion logged).

## 7. Pages & UX
- **Landing:** one-screen pitch with animated example; sign-in (Google / email magic link).
- **Dashboard:** course cards with status (Placement / Learning X% / Exam ready / Passed 🏆), reviews due, Study button. Map and Presidents shown as "Coming soon".
- **Course home:** flag mastery grid (gray = new, amber shades = learning by rung, green = review, gold border = high stability; hover for stats), exam readiness meter ("graduated / total prompts"), top confusions, actions (Study, Continue placement, Take exam).
- **Session player:** focused view, progress bar. Correct → green flash, auto-advance ~600 ms. Wrong → correct answer shown beside the user's answer; Enter to continue.
- **Session summary:** accuracy, prompts promoted/graduated, new confusions, next review due.
- **Exam player:** no feedback, "n / total" counter, pause/resume, final report.
- **Keyboard:** `1`–`8` choose, `Enter` submit/continue, `Esc` "I don't know", auto-focus on typed input.
- Detailed visual design done during UI implementation.

## 8. Error handling
- Every served question carries a server-issued `question_id`; `submitAnswer` is idempotent on it (unique constraint).
- Sessions persist server-side and resume on refresh; sessions idle > 24 h are discarded and rebuilt.
- Network failure on submit → inline "Couldn't save — retry"; no silent loss.
- Content build validates: every flag asset exists, aliases unique across items, lookalike keys resolve, groups non-empty. Fails the build on violation.

## 9. Testing
- **Engine (Vitest), primary investment:** deterministic simulations with injected time. Must cover: ladder climb/drop; a known item fades from sessions while a missed item recurs; new-item throttle; contrast-drill injection at count 2; placement fast-track; exam gating, fail → re-lock → re-graduate → unlock; grading edge cases (aliases, diacritics, typo thresholds, Niger/Nigeria, Dominica/Dominican Republic).
- **Server actions (integration):** against local Supabase (Docker); state round-trips; RLS denies cross-user reads; direct client writes rejected.
- **E2E (Playwright):** sign in → placement → study session → pass a 4-item test-only course's exam.

## 10. Roadmap after MVP
1. **World Map:** MapClick renderer (d3-geo + TopoJSON, microstates as clickable circles), "name the highlighted country" prompt, world mastery heatmap. Reuses `countries.json`.
2. **US Presidents:** number→name, portrait→name, ordering prompts; OrderingDrag renderer; timeline progress view; era-based groups.
3. Candidates: email reminders, per-user FSRS tuning from `answers`, additional courses.

## 11. Decision log
| # | Decision | Choice |
|---|---|---|
| 1 | Ambition | Portfolio / serious side project |
| 2 | Platform | Desktop web only |
| 3 | Stack | Next.js + Supabase + Vercel |
| 4 | Accounts | Sign-in required |
| 5 | Courses | World Flags, World Map, US Presidents |
| 6 | Tracking granularity | Item × prompt direction |
| 7 | Country set | UN 193 + Vatican, Palestine, Taiwan, Kosovo |
| 8 | Format selection | Difficulty ladder |
| 9 | Scheduling | Ladder (learning) + FSRS (retention) |
| 10 | Sessions | Fixed length, priority-filled |
| 11 | Onboarding | Placement sweep + region/era chunks |
| 12 | Confusions | Full: learned pairs + contrast drills |
| 13 | Final exam | 100%, gated by readiness, full retake |
| 14 | After pass | Permanent badge + retention health |
| 15 | MVP slice | Full engine, World Flags only |
| 16 | Engine location | Pure TS module, server actions, server-side grading |
