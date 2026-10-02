import type { QueueEntry } from './types';

/** A fixed, pre-built sequence (placement sweep, final exam). JSON-serializable. */
export interface QueueSession {
  queue: QueueEntry[];
  position: number;
}

export function currentEntry(q: QueueSession): QueueEntry | null {
  return q.queue[q.position] ?? null;
}

export function advance(q: QueueSession): QueueSession {
  return { ...q, position: q.position + 1 };
}

export function isQueueComplete(q: QueueSession): boolean {
  return q.position >= q.queue.length;
}
