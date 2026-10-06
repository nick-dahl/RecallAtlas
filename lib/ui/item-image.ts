import type { ItemView } from '@/lib/study/types';

/** Which picture identifies an item: a flag stamp, a portrait frame, or nothing. */
export function imageKind(item: Pick<ItemView, 'flag' | 'portrait'>): 'flag' | 'portrait' | null {
  if (item.flag) return 'flag';
  if (item.portrait) return 'portrait';
  return null;
}
