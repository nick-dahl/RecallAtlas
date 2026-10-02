import { ENGINE_CONFIG } from './config';
import { isDue, retrievability } from './scheduler';
import { stateKey } from './state';
import type { CourseDef, Item, PromptEntry, PromptState, QueueEntry } from './types';

export type StudyMode = 'normal' | 'practice-ahead';

/** JSON-serializable so it can be stored server-side between answers. */
export interface StudySession {
  mode: StudyMode;
  size: number;
  /** Graded prompt answers so far (intros and contrast drills excluded). */
  answered: number;
  /** Every served entry increments the turn. */
  turn: number;
  /** Most recent first; at most `cooldownItems` distinct item keys. */
  recentItems: string[];
  lastAsked: Record<string, number>;
  lastMissed: Record<string, boolean>;
  newItemsIntroduced: number;
  pending: QueueEntry[];
}

export function startStudySession(opts: { size?: number; mode?: StudyMode } = {}): StudySession {
  return {
    mode: opts.mode ?? 'normal',
    size: opts.size ?? ENGINE_CONFIG.sessionSize,
    answered: 0,
    turn: 0,
    recentItems: [],
    lastAsked: {},
    lastMissed: {},
    newItemsIntroduced: 0,
    pending: [],
  };
}

export function isSessionComplete(session: StudySession): boolean {
  return session.pending.length === 0 && session.answered >= session.size;
}

/** Items whose prompts are all still new, in group order then item order. */
export function newItemsInOrder(course: CourseDef, states: readonly PromptState[]): Item[] {
  const started = new Set(states.filter((s) => s.phase !== 'new').map((s) => s.itemKey));
  return course.items
    .filter((i) => !started.has(i.key))
    .sort((a, b) => a.groupOrder - b.groupOrder || a.itemOrder - b.itemOrder);
}

export function canIntroduce(course: CourseDef, states: readonly PromptState[], session: StudySession): boolean {
  const learningCount = states.filter((s) => s.phase === 'learning').length;
  const remaining = session.size - session.answered;
  return (
    session.newItemsIntroduced < ENGINE_CONFIG.maxNewItemsPerSession &&
    learningCount < ENGINE_CONFIG.maxLearningPrompts &&
    remaining >= course.promptTypes.length
  );
}

const toEntry = (s: PromptState): PromptEntry => ({ kind: 'prompt', itemKey: s.itemKey, promptType: s.promptType });

function pickLearning(pool: PromptState[], session: StudySession): PromptState | undefined {
  const missed = (s: PromptState) => (session.lastMissed[stateKey(s.itemKey, s.promptType)] ? 0 : 1);
  const asked = (s: PromptState) => session.lastAsked[stateKey(s.itemKey, s.promptType)] ?? -1;
  return [...pool].sort((a, b) => missed(a) - missed(b) || asked(a) - asked(b) || a.rung - b.rung)[0];
}

export function nextEntry(args: {
  course: CourseDef;
  states: readonly PromptState[];
  session: StudySession;
  now: Date;
}): QueueEntry | null {
  const { course, states, session, now } = args;
  if (session.pending.length > 0) return session.pending[0];
  if (isSessionComplete(session)) return null;

  const recent = new Set(session.recentItems);
  const offCooldown = (s: PromptState) => !recent.has(s.itemKey);

  const reviewable = (s: PromptState) =>
    session.mode === 'practice-ahead' ? s.phase === 'review' : isDue(s, now);
  const reviews = states
    .filter((s) => reviewable(s) && offCooldown(s))
    .sort((a, b) => retrievability(a, now) - retrievability(b, now));
  if (reviews.length > 0) return toEntry(reviews[0]);

  const learning = states.filter((s) => s.phase === 'learning');
  const fresh = pickLearning(learning.filter(offCooldown), session);
  if (fresh) return toEntry(fresh);

  if (canIntroduce(course, states, session)) {
    const item = newItemsInOrder(course, states)[0];
    if (item) return { kind: 'intro', itemKey: item.key };
  }

  const lastItem = session.recentItems[0];
  const relaxed = pickLearning(learning.filter((s) => s.itemKey !== lastItem), session);
  return relaxed ? toEntry(relaxed) : null;
}

function pushRecent(recent: string[], itemKey: string): string[] {
  return [itemKey, ...recent.filter((k) => k !== itemKey)].slice(0, ENGINE_CONFIG.cooldownItems);
}

export function recordIntroServed(session: StudySession, itemKey: string): StudySession {
  return {
    ...session,
    turn: session.turn + 1,
    recentItems: pushRecent(session.recentItems, itemKey),
    newItemsIntroduced: session.newItemsIntroduced + 1,
  };
}

export function recordPromptAnswered(session: StudySession, entry: PromptEntry, correct: boolean): StudySession {
  const key = stateKey(entry.itemKey, entry.promptType);
  return {
    ...session,
    answered: session.answered + 1,
    turn: session.turn + 1,
    recentItems: pushRecent(session.recentItems, entry.itemKey),
    lastAsked: { ...session.lastAsked, [key]: session.turn },
    lastMissed: { ...session.lastMissed, [key]: !correct },
  };
}

export function queueContrast(session: StudySession, entry: Extract<QueueEntry, { kind: 'contrast' }>): StudySession {
  return { ...session, pending: [...session.pending, entry] };
}

export function recordContrastServed(session: StudySession): StudySession {
  return { ...session, turn: session.turn + 1, pending: session.pending.slice(1) };
}
