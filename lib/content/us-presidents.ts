import data from '@/content/presidents.json';
import type { CourseDef } from '@/lib/engine/types';
import { PRESIDENT_PROMPT_TYPES } from './president-prompts';
import type { PresidentRecord } from './types';

const { presidents, orderExclusions } = data as { presidents: PresidentRecord[]; orderExclusions: [string, string][] };
const byKey = new Map(presidents.map((p) => [p.key, p]));

/** 45 presidents, one per person (spec §1); Cleveland and Trump carry two numbers. */
export const US_PRESIDENTS: CourseDef = {
  slug: 'us-presidents',
  title: 'US Presidents',
  placementPromptType: 'number_to_name',
  // A correct "who was the Nth?" shows the sequence is known; faces, years and party are studied.
  placementGraduates: ['number_to_name', 'sequence'],
  promptTypes: PRESIDENT_PROMPT_TYPES,
  orderExclusions,
  items: presidents.map((p) => ({
    key: p.key,
    name: p.name,
    aliases: p.aliases,
    group: p.era,
    groupOrder: p.groupOrder,
    itemOrder: p.itemOrder,
    lookalikes: p.lookalikes,
    sequence: p.numbers,
    answers: {
      startYear: { text: String(p.startYears[0]), aliases: p.startYears.slice(1).map(String) },
      party: { text: p.party, aliases: p.partyAliases },
    },
  })),
};

/** The full record (numbers, years, party), for presenters. */
export function presidentRecord(key: string): PresidentRecord {
  const record = byKey.get(key);
  if (!record) throw new Error(`Unknown president ${key}`);
  return record;
}
