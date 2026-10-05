import type { Format, QuestionRung, QueueEntry, StudyOutcome } from '@/lib/engine';

export type SessionKind = 'study' | 'placement' | 'exam';

/** Server-side record of a question shown to the learner. Never sent to the browser. */
export interface PendingQuestion {
  questionId: string;
  entry: QueueEntry;
  rung: QuestionRung;
  format: Format;
  /** Opaque choice id → item key, in display order. Empty for intro/typed. */
  choices: { id: string; itemKey: string }[];
  /** ISO timestamp; response time is measured server-side from this. */
  issuedAt: string;
  /** Map courses: the frame the learner sees, chosen at issue time and used for grading. */
  frame?: string;
}

export type AnswerResponse =
  | { kind: 'choice'; choiceId: string }
  | { kind: 'typed'; text: string }
  /** A click on a map, normalized to [0,1] of the frame, with the map's rendered CSS width. */
  | { kind: 'point'; x: number; y: number; width: number }
  | { kind: 'dont-know' }
  | { kind: 'ack' };

export interface SubmissionInput {
  sessionId: string;
  questionId: string;
  response: AnswerResponse;
}

/** A map question's picture: an id-free base map plus overlays in viewBox units. */
export interface MapView {
  baseUrl: string;
  width: number;
  height: number;
  /** Outline of the country being asked about (Name, Capital, intro). */
  highlight?: string;
  /** Outlined options; `id` is the opaque choice id. */
  /** `small`: the shape is tiny, so its badge sits beside it rather than on top. */
  candidates?: { id: string; d: string; labelX: number; labelY: number; small?: boolean }[];
}

/** Everything the browser sees about a question. Contains no item keys. */
export interface QuestionView {
  sessionId: string;
  questionId: string;
  sessionKind: SessionKind;
  format: Format;
  progress: { answered: number; total: number };
  /** Flag → Name shows a flag; Name → Flag shows a name; intros show both. Map questions may ask a question. */
  prompt: {
    name?: string;
    flag?: string;
    question?: string;
    /** Map Name/Capital questions: what the learner answers with. */
    asks?: 'name' | 'capital';
    capital?: string;
    capitalNote?: string;
  };
  choices?: { id: string; label?: string; flag?: string }[];
  /** Contrast drills: the two confused items side by side, labelled. */
  pair?: ItemView[];
  map?: MapView;
}

export interface ItemView {
  name: string;
  flag: string;
  capital?: string;
  capitalNote?: string;
}

export interface FeedbackView {
  correct: boolean;
  typo: boolean;
  answer: ItemView;
  /** The other item the learner's answer resolved to, if any. */
  given?: ItemView;
  outcome?: StudyOutcome;
  contrastQueued?: boolean;
  /** Map questions: the correct country, and the one the learner picked, outlined on the same map. */
  map?: { baseUrl: string; width: number; height: number; correct: string; given?: string };
}

export type EndReason =
  | 'complete'
  | 'caught_up'
  | 'come_back_later'
  | 'more_new_available'
  | 'placement_complete'
  | 'exam_finished';

export interface EndView {
  reason: EndReason;
  examResult?: { score: number; total: number; passed: boolean; missed: ItemView[] };
}

export interface TurnResult {
  feedback?: FeedbackView;
  next: QuestionView | null;
  end?: EndView;
}

export type ServiceErrorCode =
  | 'not_enrolled'
  | 'placement_pending'
  | 'placement_done'
  | 'exam_in_progress'
  | 'exam_not_ready'
  | 'no_active_session'
  | 'stale_question'
  | 'invalid_response';

export class ServiceError extends Error {
  constructor(public readonly code: ServiceErrorCode) {
    super(code);
    this.name = 'ServiceError';
  }
}
