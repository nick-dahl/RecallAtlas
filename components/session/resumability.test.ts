import { describe, expect, it } from 'vitest';
import { blocksExamRestart, isResumable, RESUMABLE_ERRORS } from './resumability';

describe('isResumable', () => {
  it('is resumable for study/placement on transient session errors', () => {
    for (const error of RESUMABLE_ERRORS) {
      expect(isResumable('study', error)).toBe(true);
      expect(isResumable('placement', error)).toBe(true);
    }
  });
  it('treats a malformed request as resumable for study/placement, but not other errors', () => {
    expect(isResumable('study', 'invalid_response')).toBe(true);
    expect(isResumable('placement', 'invalid_response')).toBe(true);
    expect(isResumable('study', 'not_enrolled')).toBe(false);
    expect(isResumable('study', 'unauthorized')).toBe(false);
  });
  it('is never resumable for an exam — those errors are handled by blocksExamRestart instead', () => {
    for (const error of RESUMABLE_ERRORS) expect(isResumable('exam', error)).toBe(false);
    expect(isResumable('exam', 'invalid_response')).toBe(false);
  });
});

describe('blocksExamRestart', () => {
  it('blocks an automatic restart for an exam on transient session errors', () => {
    for (const error of RESUMABLE_ERRORS) expect(blocksExamRestart('exam', error)).toBe(true);
  });
  it('does not block for study/placement, or for other exam errors', () => {
    for (const error of RESUMABLE_ERRORS) {
      expect(blocksExamRestart('study', error)).toBe(false);
      expect(blocksExamRestart('placement', error)).toBe(false);
    }
    expect(blocksExamRestart('exam', 'invalid_response')).toBe(false);
    expect(blocksExamRestart('exam', 'unauthorized')).toBe(false);
  });
});
