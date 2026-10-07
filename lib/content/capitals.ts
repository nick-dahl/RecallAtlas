import countries from '@/content/countries.json';
import type { CountryRecord } from './types';

const notes = new Map((countries as CountryRecord[]).map((c) => [c.key, c.capitalNote]));

/** Context shown with a capital (split or contested capitals), if any. */
export function capitalNote(key: string): string | null {
  return notes.get(key) ?? null;
}
