import { describe, expect, it } from 'vitest';
import { END_COPY, errorMessage, STATUS_LABEL } from './copy';

describe('copy', () => {
  it('labels every status and every end reason', () => {
    expect(Object.keys(STATUS_LABEL).sort()).toEqual(['exam_ready', 'learning', 'passed', 'placement']);
    for (const reason of ['complete', 'caught_up', 'come_back_later', 'more_new_available', 'placement_complete', 'exam_finished'] as const) {
      expect(END_COPY[reason].title.length).toBeGreaterThan(0);
    }
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
