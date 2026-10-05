# To-do

## Practice ahead: a real retention check (all courses)

**Reported 2026-10-05.** In World Flags, "Practice ahead" keeps quizzing the same few flags over and over.

**Intended behaviour:** a short, mixed retention check that is lighter than the final exam.
- Draws a varied sample of material already learned, not the same handful every time. For example, a flag learned two days ago (Moldova) shows up alongside other recently mastered ones.
- Every answer counts: a miss puts the item back into learning (relearn), and a hit strengthens it.
- No full exam needed to find out what has slipped.

**Scope:** fix it in the shared engine and services (`nextEntry` practice-ahead branch in `lib/engine/session.ts`, `startStudy` in `lib/study/study-service.ts`) so it works the same for World Flags, World Map and any later course.

**When:** at the next natural breakpoint after the World Map work.
