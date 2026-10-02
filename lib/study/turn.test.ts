import { describe, expect, it } from 'vitest';
import { MemoryStore } from '@/lib/db/memory-store';
import { answerLog } from './turn';
import { testContext } from './test-helpers';
import type { PendingQuestion } from './types';

function pendingAt(issuedAt: string): PendingQuestion {
  return {
    questionId: 'q1',
    entry: { kind: 'prompt', itemKey: 'US', promptType: 'flag_to_name' },
    rung: 1,
    format: 'typed',
    choices: [],
    issuedAt,
  };
}

describe('answerLog', () => {
  it('records the elapsed response time', () => {
    const ctx = testContext(new MemoryStore(), { now: new Date('2026-10-01T12:00:10Z') });
    const pending = pendingAt('2026-10-01T12:00:00Z');
    const log = answerLog(ctx, pending, { kind: 'typed', text: 'United States' }, { correct: true, typo: false, answeredItemKey: null }, 'study');
    expect(log.responseMs).toBe(10_000);
  });

  it('nulls out responseMs past the 5-minute cap (a question resumed long after it was issued)', () => {
    const ctx = testContext(new MemoryStore(), { now: new Date('2026-10-01T12:05:00.001Z') });
    const pending = pendingAt('2026-10-01T12:00:00Z');
    const log = answerLog(ctx, pending, { kind: 'typed', text: 'United States' }, { correct: true, typo: false, answeredItemKey: null }, 'study');
    expect(log.responseMs).toBeNull();
  });

  it('keeps responseMs exactly at the 5-minute cap', () => {
    const ctx = testContext(new MemoryStore(), { now: new Date('2026-10-01T12:05:00.000Z') });
    const pending = pendingAt('2026-10-01T12:00:00Z');
    const log = answerLog(ctx, pending, { kind: 'typed', text: 'United States' }, { correct: true, typo: false, answeredItemKey: null }, 'study');
    expect(log.responseMs).toBe(5 * 60 * 1000);
  });
});
