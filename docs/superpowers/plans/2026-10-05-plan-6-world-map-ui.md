# Recall Atlas — Plan 6: World Map UI, e2e, review

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make World Map playable: map renderers for every World Map question, map-aware feedback, intro and contrast cards, a mastery map on the course home, a live dashboard card, and Playwright coverage for placement and the exam by clicking.

**Architecture:** One client component, `<MapFrame>`, draws the id-free base map as an `<img>` with an absolutely positioned SVG overlay in the frame's viewBox units. Every map renderer is built from it. Clicks are normalized against the rendered box and sent as `point` responses; the server grades them (Plan 5). The course home renders the world atlas inline on the server, coloured by tile state.

**Tech Stack:** Next.js 16 App Router, React 19.2, Tailwind v4, Playwright, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-05-world-map-design.md` §8 (UI), §9 (E2E). Builds on Plan 5 (`2026-10-05-plan-5-world-map-data-engine.md`), whose interim renderers this replaces.

## Global Constraints

- Answers never leak: the base map is an `<img alt="">`; overlays are bare paths; no names in Name/Capital views except choice labels; no item keys anywhere in the DOM of a question.
- Clicks are reported as `{ kind: 'point', x, y, width }` with `x, y ∈ [0,1]` of the rendered map box and `width` its CSS width clamped to `[100, 4000]`.
- Keyboard first: `1`–`6` pick map candidates; `Esc` = "I don't know" on map-click; `Enter` continues.
- Reduced motion respected (all new animations are disabled under `prefers-reduced-motion`).
- Design: existing tokens only (paper, ink, accent, good, bad, learning, gold). No new UI or animation libraries.
- Flags course behaviour unchanged; its e2e spec still passes.
- Deployment (merging to `main` / pushing) is **not** part of this plan's execution without the user's explicit go-ahead.

## Review Focus

1. **The rendered map is a different size from the viewBox** (narrow phone, tall frame like central/southern Africa): a click must land on the same country the learner sees. Pinned by the pure `normalizePoint` test and the e2e click helper, which clicks at the hit-data label point scaled to the on-screen box.
2. **Feedback for a Capital mc question** must mark the right option although labels are capitals, not names. Pinned by the `choiceState` test.
3. **Map-pick feedback** must mark the right candidate without any key in the DOM: matched by outline path. Pinned by the `candidateState` test.
4. **A contrast drill without a map** (confusion across continents) must still render: falls back to labelled names. Covered by the renderer branching on `view.map`.
5. **Course home for a learner with no progress**: the mastery map shows every country unfilled, with tooltips. Checked in e2e (map visible with 208 `data-tile` shapes).

---

### Task 1: Map primitives

**Files:** Create `components/map/map-frame.tsx`, `components/map/geometry.ts`, `components/map/geometry.test.ts`; modify `app/globals.css`, `vitest.config.mts` (include `components/**/*.test.ts` — already covered by `**/*.test.ts`).

**Interfaces:**
- `normalizePoint(clientX, clientY, rect: { left; top; width; height }) → { x; y; width }` (clamped).
- `candidateState(candidateD, feedback, chosenId, id) → ChoiceState`.
- `<MapFrame map={MapView} maxHeight="62vh" highlight? candidates? feedback? marks? onPoint? onCandidate? cursor?>`.

Steps: test `normalizePoint` (center, edges, clamping, width clamp) and `candidateState`; implement; add CSS: `.map-hatch` pattern via SVG `<pattern>`, `@keyframes ink-in` (fill-opacity 0→1), `@keyframes map-pulse` (stroke-width), both under reduced-motion guard. Commit.

### Task 2: Map renderers

**Files:** Create `components/session/map-pick.tsx`, `components/session/map-click.tsx`, `components/session/map-prompt.tsx`; modify `question-stage.tsx`, `prompt.tsx`, `intro-card.tsx`, `contrast-drill.tsx`, `typed-answer.tsx`, `feedback-panel.tsx`, `choice-state.ts` (+test), `lib/study/map-presenter.ts` (prompt `asks`), `lib/study/types.ts`.

- `MapPick`: "Find {name}", MapFrame with candidates (outline + numbered HTML badge buttons carrying `data-choice-id`), keys 1–6; after feedback correct candidate green + pulse, chosen wrong red, others dimmed.
- `MapClick`: "Click {name}", crosshair, a dot where the learner clicked, Esc = don't know; after feedback correct outline green + pulse, clicked country red.
- `Prompt` with `view.map`: MapFrame with the hatched highlight above "Which country is this?" / "What's its capital?"; feedback outlines stay on the map.
- `TypedAnswer`: aria-label/placeholder "Capital" for capital questions (`view.prompt.asks === 'capital'`).
- `IntroCard` with a map: "New country", the map, name, flag, capital and note.
- `ContrastDrill` with a map: study step labels both outlines on the map; quiz step shows numbered unlabelled candidates.
- `FeedbackPanel` with `feedback.map`: "That's {given}; {answer} is highlighted" (click/pick) and "The capital of {answer} is {capital}" + note for capital questions.
- `choiceState`: a label matches the answer's name or capital.

Commit after `npm test`, typecheck, lint.

### Task 3: Course home mastery map, dashboard card, copy

**Files:** Create `lib/map/atlas.ts` (server-only loader), `components/map/mastery-map.tsx`, `lib/ui/mastery.ts` (+test); modify `lib/study/overview-service.ts` (per-prompt phases on tiles), `app/courses/[slug]/page.tsx`, `app/dashboard/page.tsx`, `components/course-card.tsx`, `lib/ui/copy.ts`, `components/session/end-screen.tsx`, `scripts/lib/maps/build-maps.ts` (drop unused atlas borders).

- Mastery map: SVG inline, each item a `<path data-tile=...>` filled by tile state (new: paper; learning 1–3: learning colour at rising opacity; review: good; strong: good + gold stroke), markers as dots; `<title>` "Bolivia — Find: learned, Name: learned, Capital: learning". Legend below.
- World Map shows the mastery map instead of the flag album.
- Dashboard: remove the World Map coming-soon card; course blurbs per slug.
- Course-neutral copy ("Every flag" → per course).

### Task 4: E2E

**Files:** Modify `e2e/support/supabase.ts`, `e2e/support/session.ts`; create `e2e/world-map.spec.ts`.

- `pendingQuestion` returns `frame`; `answerCorrectly(page, user, course)` handles map-click (click at the label point scaled to the map's box), map-pick (badge), typed capitals.
- Spec: enroll World Map, mastery map visible; placement by clicking several countries; one deliberate wrong click (a neighbour) → feedback shows "That's …"; skip placement; study a few answers; `graduateEverything(WORLD_MAP)`; exam of 208 by clicking and typing → "Passed".

### Task 5: Review and hand-off

- Full suites (unit, integration, e2e), typecheck, lint, build.
- Screenshot review of every renderer at desktop and phone widths; fix what looks wrong.
- Whole-branch code review; fix findings.
- Ask the user before merging to `main` / deploying.
