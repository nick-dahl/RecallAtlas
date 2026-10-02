import type { StudyMode } from '@/lib/engine';
import { ServiceError, type AnswerResponse, type SubmissionInput } from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TYPED_LENGTH = 100;
const SESSION_SIZES = [10, 20, 40];

const invalid = (): never => {
  throw new ServiceError('invalid_response');
};
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

function parseResponse(value: unknown): AnswerResponse {
  if (!isRecord(value)) return invalid();
  switch (value.kind) {
    case 'ack':
      return { kind: 'ack' };
    case 'dont-know':
      return { kind: 'dont-know' };
    case 'choice':
      return isUuid(value.choiceId) ? { kind: 'choice', choiceId: value.choiceId } : invalid();
    case 'typed':
      return typeof value.text === 'string' && value.text.length <= MAX_TYPED_LENGTH
        ? { kind: 'typed', text: value.text }
        : invalid();
    default:
      return invalid();
  }
}

/** Server actions receive untrusted input; never pass it to services unparsed. */
export function parseSubmission(input: unknown): SubmissionInput {
  if (!isRecord(input) || !isUuid(input.sessionId) || !isUuid(input.questionId)) return invalid();
  return { sessionId: input.sessionId, questionId: input.questionId, response: parseResponse(input.response) };
}

export function parseStudyOptions(input: unknown): { mode: StudyMode; size: number } {
  const value = isRecord(input) ? input : {};
  const mode = value.mode ?? 'normal';
  const size = value.size ?? 20;
  if (mode !== 'normal' && mode !== 'practice-ahead') return invalid();
  if (typeof size !== 'number' || !SESSION_SIZES.includes(size)) return invalid();
  return { mode, size };
}
