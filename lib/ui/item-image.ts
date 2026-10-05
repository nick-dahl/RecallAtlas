import type { ItemView } from '@/lib/study/types';

/** The picture that identifies an item in reference views: its flag, or a president's portrait. */
export function itemImage(view: Pick<ItemView, 'flag' | 'portrait'>): string {
  return view.flag ?? view.portrait ?? '';
}
