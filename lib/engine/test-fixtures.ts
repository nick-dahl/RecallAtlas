import { FLAG_PROMPT_TYPES } from '@/lib/content/flag-prompts';
import type { CourseDef, Item } from './types';

function item(
  key: string,
  name: string,
  aliases: string[],
  group: string,
  groupOrder: number,
  itemOrder: number,
  lookalikes: string[] = [],
): Item {
  return { key, name, aliases, group, groupOrder, itemOrder, lookalikes };
}

export const ITEMS: Item[] = [
  item('US', 'United States', ['USA', 'United States of America'], 'North & Central America', 1, 1),
  item('EC', 'Ecuador', [], 'South America', 2, 1, ['CO', 'VE']),
  item('CO', 'Colombia', [], 'South America', 2, 2, ['EC', 'VE']),
  item('VE', 'Venezuela', [], 'South America', 2, 3, ['CO', 'EC']),
  item('PE', 'Peru', [], 'South America', 2, 4),
  item('TD', 'Chad', [], 'Central & Southern Africa', 3, 1, ['RO']),
  item('RO', 'Romania', [], 'Southern & Eastern Europe', 4, 1, ['TD']),
  item('NE', 'Niger', [], 'North & West Africa', 5, 1, ['IN']),
  item('NG', 'Nigeria', [], 'North & West Africa', 5, 2),
  item('CI', 'Ivory Coast', ["Côte d'Ivoire"], 'North & West Africa', 5, 3, ['IE']),
  item('GM', 'Gambia', ['The Gambia'], 'North & West Africa', 5, 4),
  item('IN', 'India', [], 'South & East Asia', 6, 1, ['NE']),
  item('IE', 'Ireland', [], 'Western & Northern Europe', 7, 1, ['CI']),
  item('DM', 'Dominica', [], 'Caribbean', 8, 1),
  item('DO', 'Dominican Republic', [], 'Caribbean', 8, 2),
  item('LC', 'Saint Lucia', [], 'Caribbean', 8, 3),
  item('MG', 'Madagascar', [], 'East Africa', 9, 1),
];

export const TEST_COURSE: CourseDef = {
  slug: 'test-flags',
  title: 'Test Flags',
  placementPromptType: 'flag_to_name',
  promptTypes: FLAG_PROMPT_TYPES,
  items: ITEMS,
};

export function fixtureItem(key: string): Item {
  const found = ITEMS.find((i) => i.key === key);
  if (!found) throw new Error(`No fixture item ${key}`);
  return found;
}

export const NOW = new Date('2026-10-01T12:00:00Z');

/** NOW shifted by whole days plus optional hours. */
export function days(n: number, hours = 0): Date {
  return new Date(NOW.getTime() + n * 86_400_000 + hours * 3_600_000);
}
