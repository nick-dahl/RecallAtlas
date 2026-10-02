import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seededRng } from '@/lib/engine';
import { NOW, TEST_COURSE } from '@/lib/engine/test-fixtures';
import { gradeSubmission, issueQuestion } from './issue';
import { ServiceError } from './types';

const issue = (entry: Parameters<typeof issueQuestion>[0]['entry'], rung: 1 | 2 | 3) =>
  issueQuestion({ entry, rung, course: TEST_COURSE, confusions: [], rng: seededRng(7), now: NOW, newId: randomUUID });

describe('issueQuestion', () => {
  it('gives each choice an opaque id and records the issue time', () => {
    const q = issue({ kind: 'prompt', itemKey: 'EC', promptType: 'flag_to_name' }, 1);
    expect(q.format).toBe('mc-text');
    expect(q.choices).toHaveLength(4);
    expect(q.choices.map((c) => c.itemKey)).toContain('EC');
    expect(new Set(q.choices.map((c) => c.id)).size).toBe(4);
    expect(q.choices.every((c) => c.id !== c.itemKey)).toBe(true);
    expect(q.issuedAt).toBe(NOW.toISOString());
  });

  it('issues typed questions without choices', () => {
    expect(issue({ kind: 'prompt', itemKey: 'EC', promptType: 'flag_to_name' }, 3)).toMatchObject({
      format: 'typed',
      choices: [],
    });
  });
});

describe('gradeSubmission', () => {
  const mc = issue({ kind: 'prompt', itemKey: 'EC', promptType: 'flag_to_name' }, 1);
  const typed = issue({ kind: 'prompt', itemKey: 'EC', promptType: 'flag_to_name' }, 3);
  const choiceFor = (key: string) => mc.choices.find((c) => c.itemKey === key);

  it('grades a correct choice and a wrong choice (reporting the confused item)', () => {
    expect(gradeSubmission(mc, { kind: 'choice', choiceId: choiceFor('EC')!.id }, TEST_COURSE)).toEqual({
      correct: true,
      typo: false,
      answeredItemKey: null,
    });
    const wrong = mc.choices.find((c) => c.itemKey !== 'EC')!;
    expect(gradeSubmission(mc, { kind: 'choice', choiceId: wrong.id }, TEST_COURSE)).toEqual({
      correct: false,
      typo: false,
      answeredItemKey: wrong.itemKey,
    });
  });

  it('grades typed answers with the engine rules', () => {
    expect(gradeSubmission(typed, { kind: 'typed', text: 'Equador' }, TEST_COURSE)).toEqual({
      correct: true,
      typo: true,
      answeredItemKey: null,
    });
  });

  it('treats "I don\'t know" as wrong with no confusion', () => {
    expect(gradeSubmission(typed, { kind: 'dont-know' }, TEST_COURSE)).toEqual({
      correct: false,
      typo: false,
      answeredItemKey: null,
    });
  });

  it('rejects choices that were never offered and responses of the wrong kind', () => {
    const bad = (fn: () => unknown) => expect(fn).toThrowError(new ServiceError('invalid_response'));
    bad(() => gradeSubmission(mc, { kind: 'choice', choiceId: randomUUID() }, TEST_COURSE));
    bad(() => gradeSubmission(mc, { kind: 'typed', text: 'Ecuador' }, TEST_COURSE));
    bad(() => gradeSubmission(typed, { kind: 'choice', choiceId: randomUUID() }, TEST_COURSE));
    bad(() => gradeSubmission(typed, { kind: 'ack' }, TEST_COURSE));
  });
});
