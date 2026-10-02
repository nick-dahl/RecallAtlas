import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ServiceError } from './types';
import { parseStudyOptions, parseSubmission } from './validate';

const ids = { sessionId: randomUUID(), questionId: randomUUID() };

describe('parseSubmission', () => {
  it('accepts each well-formed response kind', () => {
    const choiceId = randomUUID();
    expect(parseSubmission({ ...ids, response: { kind: 'choice', choiceId } }).response).toEqual({ kind: 'choice', choiceId });
    expect(parseSubmission({ ...ids, response: { kind: 'typed', text: 'Chad' } }).response).toEqual({ kind: 'typed', text: 'Chad' });
    expect(parseSubmission({ ...ids, response: { kind: 'dont-know' } }).response).toEqual({ kind: 'dont-know' });
    expect(parseSubmission({ ...ids, response: { kind: 'ack', extra: 1 } }).response).toEqual({ kind: 'ack' });
  });

  it.each([
    null,
    'nope',
    { ...ids, sessionId: 'not-a-uuid', response: { kind: 'ack' } },
    { ...ids, response: { kind: 'choice', choiceId: 'EC' } },
    { ...ids, response: { kind: 'typed', text: 'x'.repeat(101) } },
    { ...ids, response: { kind: 'typed', text: 42 } },
    { ...ids, response: { kind: 'hack' } },
  ])('rejects %j', (input) => {
    expect(() => parseSubmission(input)).toThrowError(new ServiceError('invalid_response'));
  });
});

describe('parseStudyOptions', () => {
  it('defaults and validates', () => {
    expect(parseStudyOptions(undefined)).toEqual({ mode: 'normal', size: 20 });
    expect(parseStudyOptions({ mode: 'practice-ahead', size: 40 })).toEqual({ mode: 'practice-ahead', size: 40 });
    expect(() => parseStudyOptions({ size: 7 })).toThrowError(new ServiceError('invalid_response'));
    expect(() => parseStudyOptions({ mode: 'turbo' })).toThrowError(new ServiceError('invalid_response'));
  });
});
