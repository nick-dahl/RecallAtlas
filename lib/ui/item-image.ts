import type { ItemView } from '@/lib/study/types';

/** Which picture identifies an item: a flag stamp, a portrait frame, a painting, or nothing. */
export function imageKind(item: Pick<ItemView, 'flag' | 'portrait' | 'painting'>): 'flag' | 'portrait' | 'painting' | null {
  if (item.flag) return 'flag';
  if (item.portrait) return 'portrait';
  if (item.painting) return 'painting';
  return null;
}
