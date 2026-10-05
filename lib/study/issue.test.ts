import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seededRng } from '@/lib/engine';
import { NOW, TEST_COURSE, TEST_SEQ_COURSE } from '@/lib/engine/test-fixtures';
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

describe('sequence courses', () => {
  const seq = TEST_SEQ_COURSE;
  const issueSeq = (itemKey: string, promptType: string, rung: 1 | 2 | 3, seed = 1) =>
    issueQuestion({ entry: { kind: 'prompt', itemKey, promptType }, rung, course: seq, confusions: [], rng: seededRng(seed), now: NOW, newId: randomUUID });
  const firstOf = (key: string) => seq.items.find((i) => i.key === key)!.sequence![0];

  it('records a slot only for items with two positions, and it is one of them', () => {
    expect(issueSeq('s1', 'name', 1).slot).toBeUndefined();
    const slots = new Set(Array.from({ length: 12 }, (_, seed) => issueSeq('s3', 'name', 1, seed).slot));
    expect(slots).toEqual(new Set([3, 5]));
  });

  it('grades an order answer: chronological is right, anything else wrong with no mix-up', () => {
    const p = issueSeq('s6', 'sequence', 2);
    const sorted = [...p.choices].sort((a, b) => firstOf(a.itemKey) - firstOf(b.itemKey)).map((c) => c.id);
    expect(gradeSubmission(p, { kind: 'order', choiceIds: sorted }, seq)).toEqual({ correct: true, typo: false, answeredItemKey: null });
    const swapped = [sorted[1], sorted[0], ...sorted.slice(2)];
    expect(gradeSubmission(p, { kind: 'order', choiceIds: swapped }, seq)).toEqual({ correct: false, typo: false, answeredItemKey: null });
  });

  it('rejects forged order answers and order answers to other questions', () => {
    const p = issueSeq('s6', 'sequence', 2);
    const ids = p.choices.map((c) => c.id);
    const bad = (choiceIds: string[]) => expect(() => gradeSubmission(p, { kind: 'order', choiceIds }, seq)).toThrow(new ServiceError('invalid_response'));
    bad(ids.slice(1));
    bad([ids[0], ids[0], ids[1], ids[2]]);
    bad([randomUUID(), ...ids.slice(1)]);
    const typedQuestion = issueSeq('s6', 'sequence', 3);
    expect(() => gradeSubmission(typedQuestion, { kind: 'order', choiceIds: ids }, seq)).toThrow(new ServiceError('invalid_response'));
  });

  it('grades a typed gap by name and a typed year exactly', () => {
    expect(gradeSubmission(issueSeq('s6', 'sequence', 3), { kind: 'typed', text: 'Seven' }, seq).correct).toBe(true);
    const year = issueSeq('s1', 'year', 3);
    expect(gradeSubmission(year, { kind: 'typed', text: '1801' }, seq).correct).toBe(true);
    expect(gradeSubmission(year, { kind: 'typed', text: '1810' }, seq)).toEqual({ correct: false, typo: false, answeredItemKey: 's2' });
  });

  it('never records a party miss as a mix-up', () => {
    const p = issueSeq('s1', 'party', 1);
    const wrong = p.choices.find((c) => c.itemKey !== 's1')!;
    expect(gradeSubmission(p, { kind: 'choice', choiceId: wrong.id }, seq)).toEqual({ correct: false, typo: false, answeredItemKey: null });
  });
});
