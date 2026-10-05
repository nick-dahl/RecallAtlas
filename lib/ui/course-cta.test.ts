import { describe, expect, it } from 'vitest';
import { offersPracticeAhead, primaryCta } from './course-cta';

const base = { slug: 'world-flags', enrolled: true, dueCount: 0, activeSessionKind: null } as const;

describe('primaryCta', () => {
  it('has no link for unenrolled courses (the card shows an enroll form)', () => {
    expect(primaryCta({ ...base, enrolled: false, status: null })).toBeNull();
  });

  it.each([
    [{ status: 'placement' }, 'Start placement', '/courses/world-flags/placement'],
    [{ status: 'placement', activeSessionKind: 'placement' }, 'Continue placement', '/courses/world-flags/placement'],
    [{ status: 'learning' }, 'Study', '/courses/world-flags/study'],
    [{ status: 'learning', dueCount: 12 }, 'Study · 12 due', '/courses/world-flags/study'],
    [{ status: 'exam_ready' }, 'Take the final exam', '/courses/world-flags/exam'],
    [{ status: 'learning', activeSessionKind: 'exam' }, 'Resume exam', '/courses/world-flags/exam'],
    [{ status: 'passed', dueCount: 3 }, 'Review · 3 due', '/courses/world-flags/study'],
    [{ status: 'passed' }, 'Practice ahead', '/courses/world-flags/study?mode=practice-ahead'],
  ] as const)('%j → %s', (over, label, href) => {
    expect(primaryCta({ ...base, ...over })).toEqual({ label, href });
  });
});

describe('offersPracticeAhead', () => {
  const learned = { ...base, readiness: { graduated: 10, total: 394 } } as const;

  it('is offered while learning, even with reviews due, once something is learned', () => {
    expect(offersPracticeAhead({ ...learned, status: 'learning' })).toBe(true);
    expect(offersPracticeAhead({ ...learned, status: 'learning', dueCount: 5 })).toBe(true);
    expect(offersPracticeAhead({ ...learned, status: 'exam_ready' })).toBe(true);
  });

  it('is not offered with nothing learned, during placement or an exam, or when it is the primary action', () => {
    expect(offersPracticeAhead({ ...learned, status: 'learning', readiness: { graduated: 0, total: 394 } })).toBe(false);
    expect(offersPracticeAhead({ ...learned, status: 'placement' })).toBe(false);
    expect(offersPracticeAhead({ ...learned, status: 'learning', activeSessionKind: 'exam' })).toBe(false);
    expect(offersPracticeAhead({ ...learned, status: 'passed' })).toBe(false);
  });
});
