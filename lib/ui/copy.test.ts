import { describe, expect, it } from 'vitest';
import { END_COPY, errorMessage, practiceSummary, STATUS_LABEL } from './copy';

describe('copy', () => {
  it('labels every status and every end reason', () => {
    expect(Object.keys(STATUS_LABEL).sort()).toEqual(['exam_ready', 'learning', 'passed', 'placement']);
    for (const reason of ['complete', 'caught_up', 'come_back_later', 'more_new_available', 'placement_complete', 'exam_finished', 'practice_complete', 'nothing_to_practice'] as const) {
      expect(END_COPY[reason].title.length).toBeGreaterThan(0);
    }
  });

  it('summarizes a practice check, pointing misses back to learning', () => {
    expect(practiceSummary({ checked: 8, remembered: 8 })).toBe('You remembered all 8. Everything stuck.');
    expect(practiceSummary({ checked: 8, remembered: 7 })).toBe('You remembered 7 of 8. The one that slipped is back in your learning queue.');
    expect(practiceSummary({ checked: 8, remembered: 5 })).toBe('You remembered 5 of 8. The 3 that slipped are back in your learning queue.');
  });

  it('has a human message for every non-recoverable error', () => {
    for (const code of [
      'not_enrolled',
      'placement_pending',
      'placement_done',
      'exam_in_progress',
      'exam_not_ready',
      'invalid_response',
      'unknown_course',
    ] as const) {
      expect(errorMessage(code)).toMatch(/\w/);
    }
  });
});
