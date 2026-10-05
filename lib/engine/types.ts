import type { Card } from 'ts-fsrs';

export type Phase = 'new' | 'learning' | 'review';
/** 0 = Introduce, 1 = Recognize, 2 = Discriminate, 3 = Recall */
export type Rung = 0 | 1 | 2 | 3;
/** Rungs that produce a graded question. */
export type QuestionRung = 1 | 2 | 3;
export type Format =
  | 'intro'
  | 'mc-text'
  | 'flag-grid'
  | 'typed'
  | 'contrast'
  | 'map-pick'
  | 'map-click'
  | 'image-grid'
  | 'gap-choice'
  | 'gap-typed'
  | 'order';
/**
 * random: other groups first; hard: confusions, look-alikes, same group; local: same group first;
 * sequence: nearest by sequence number (items without a sequence fall back to local).
 */
export type DistractorMode = 'random' | 'hard' | 'local' | 'sequence';

/** Formats answered by typing. */
export function isTypedFormat(format: Format): boolean {
  return format === 'typed' || format === 'gap-typed';
}
/** Returns a float in [0, 1). Injected so the engine stays deterministic in tests. */
export type Rng = () => number;

export interface Item {
  key: string;
  name: string;
  aliases: string[];
  group: string;
  groupOrder: number;
  itemOrder: number;
  /** Keys of statically similar items (seed confusions). */
  lookalikes: string[];
  /** Answers other than the name, by answer field (e.g. `capital`). */
  answers?: Record<string, { text: string; aliases: string[] }>;
  /** Position(s) in a sequence course (e.g. presidency numbers; two for non-consecutive terms). */
  sequence?: number[];
}

export interface FormatSpec {
  format: Exclude<Format, 'intro' | 'contrast'>;
  /** Total options shown, including the correct one. Omitted for typed. */
  choices?: number;
  distractors?: DistractorMode;
  /** `sequence` mode: only items within this many positions. */
  window?: number;
}

export interface PromptTypeDef {
  id: string;
  label: string;
  /** What typed answers are graded by and mc-text shows: 'name' (default) or an `Item.answers` key. */
  answerField?: string;
  /** Typed answers must match exactly (no typo tolerance), e.g. years. */
  exactAnswer?: boolean;
  /** Options never repeat an answer-field label, nor show one the target also accepts. */
  distinctChoices?: boolean;
  /** False: wrong answers are never recorded as mix-ups (e.g. party). Default true. */
  recordsConfusions?: boolean;
  formats: Record<QuestionRung, FormatSpec>;
}

export interface CourseDef {
  slug: string;
  title: string;
  placementPromptType: string;
  /** Prompt types a correct placement answer graduates (default: all). */
  placementGraduates?: string[];
  promptTypes: PromptTypeDef[];
  items: Item[];
  /** Pairs never shown together in a put-in-order question (no single chronological order). */
  orderExclusions?: [string, string][];
  /** Typed names that could mean more than one item ("Adams"): always wrong, never a mix-up. */
  ambiguousAnswers?: string[];
}

export interface PromptState {
  itemKey: string;
  promptType: string;
  phase: Phase;
  rung: Rung;
  /** Consecutive correct answers at the current rung. */
  streak: number;
  /** FSRS card; null until the prompt first graduates. */
  fsrs: Card | null;
}

export interface Confusion {
  asked: string;
  answered: string;
  count: number;
}

export type QueueEntry =
  | { kind: 'intro'; itemKey: string }
  | { kind: 'prompt'; itemKey: string; promptType: string }
  | { kind: 'contrast'; itemKey: string; otherKey: string };

export type PromptEntry = Extract<QueueEntry, { kind: 'prompt' }>;

export interface Question {
  entry: QueueEntry;
  format: Format;
  /** Item keys to show as options (already shuffled). Absent for intro/typed. */
  choiceKeys?: string[];
}

export interface AnswerGrade {
  correct: boolean;
  /** True when accepted only thanks to typo tolerance. */
  typo: boolean;
  /** For wrong answers: the other item the user's answer resolved to, if any. */
  answeredItemKey: string | null;
}
