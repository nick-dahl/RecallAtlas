import type { Card } from 'ts-fsrs';

export type Phase = 'new' | 'learning' | 'review';
/** 0 = Introduce, 1 = Recognize, 2 = Discriminate, 3 = Recall */
export type Rung = 0 | 1 | 2 | 3;
/** Rungs that produce a graded question. */
export type QuestionRung = 1 | 2 | 3;
export type Format = 'intro' | 'mc-text' | 'flag-grid' | 'typed' | 'contrast';
export type DistractorMode = 'random' | 'hard';
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
}

export interface FormatSpec {
  format: 'mc-text' | 'flag-grid' | 'typed';
  /** Total options shown, including the correct one. Omitted for typed. */
  choices?: number;
  distractors?: DistractorMode;
}

export interface PromptTypeDef {
  id: string;
  label: string;
  formats: Record<QuestionRung, FormatSpec>;
}

export interface CourseDef {
  slug: string;
  title: string;
  placementPromptType: string;
  promptTypes: PromptTypeDef[];
  items: Item[];
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
