import { FLAG_PROMPT_TYPES } from '@/lib/content/flag-prompts';
import { MAP_PROMPT_TYPES } from '@/lib/content/map-prompts';
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

const CAPITALS: Record<string, [string, ...string[]]> = {
  US: ['Washington, D.C.', 'Washington'],
  EC: ['Quito'],
  CO: ['Bogotá'],
  VE: ['Caracas'],
  PE: ['Lima'],
  TD: ["N'Djamena"],
  RO: ['Bucharest'],
  NE: ['Niamey'],
  NG: ['Abuja'],
  CI: ['Yamoussoukro'],
  GM: ['Banjul'],
  IN: ['New Delhi'],
  IE: ['Dublin'],
  DM: ['Roseau'],
  DO: ['Santo Domingo'],
  LC: ['Castries'],
  MG: ['Antananarivo'],
};

/** The fixture items as a map course: Find / Name / Capital, placement graduating Find + Name. */
export const TEST_MAP_COURSE: CourseDef = {
  slug: 'test-map',
  title: 'Test Map',
  placementPromptType: 'find',
  placementGraduates: ['find', 'name'],
  promptTypes: MAP_PROMPT_TYPES,
  items: ITEMS.map((i) => {
    const [text, ...aliases] = CAPITALS[i.key];
    return { ...i, answers: { capital: { text, aliases } } };
  }),
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

const seqItem = (
  key: string,
  name: string,
  aliases: string[],
  group: string,
  itemOrder: number,
  sequence: number[],
  years: string[],
  party: string,
  partyAliases: string[] = [],
): Item => ({
  key,
  name,
  aliases,
  group,
  groupOrder: group === 'G1' ? 1 : 2,
  itemOrder,
  lookalikes: [],
  sequence,
  answers: { year: { text: years[0], aliases: years.slice(1) }, party: { text: party, aliases: partyAliases } },
});

/**
 * A sequence course like US Presidents: s3 serves twice (3 and 5) around s4, so s3 and s4 never
 * share an ordering question. s6 and s7 share a year (1840).
 */
export const TEST_SEQ_COURSE: CourseDef = {
  slug: 'test-seq',
  title: 'Test Sequence',
  placementPromptType: 'name',
  promptTypes: [
    {
      id: 'name',
      label: 'Name',
      formats: {
        1: { format: 'mc-text', choices: 4, distractors: 'local' },
        2: { format: 'mc-text', choices: 6, distractors: 'hard' },
        3: { format: 'typed' },
      },
    },
    {
      id: 'year',
      label: 'Year',
      answerField: 'year',
      exactAnswer: true,
      distinctChoices: true,
      formats: {
        1: { format: 'mc-text', choices: 4, distractors: 'local' },
        2: { format: 'mc-text', choices: 6, distractors: 'hard' },
        3: { format: 'typed' },
      },
    },
    {
      id: 'party',
      label: 'Party',
      answerField: 'party',
      distinctChoices: true,
      recordsConfusions: false,
      formats: {
        1: { format: 'mc-text', choices: 4, distractors: 'sequence', window: 6 },
        2: { format: 'mc-text', choices: 4, distractors: 'sequence', window: 6 },
        3: { format: 'mc-text', choices: 4, distractors: 'sequence', window: 6 },
      },
    },
    {
      id: 'sequence',
      label: 'Sequence',
      formats: {
        1: { format: 'gap-choice', choices: 4, distractors: 'local' },
        2: { format: 'order', choices: 4, distractors: 'sequence' },
        3: { format: 'gap-typed' },
      },
    },
  ],
  orderExclusions: [['s3', 's4']],
  items: [
    seqItem('s1', 'John Adams', [], 'G1', 1, [1], ['1801'], 'A'),
    seqItem('s2', 'John Quincy Adams', ['JQA'], 'G1', 2, [2], ['1810'], 'B'),
    seqItem('s3', 'Sam Three', ['Three'], 'G1', 3, [3, 5], ['1820', '1830'], 'A'),
    seqItem('s4', 'Sam Four', ['Four'], 'G1', 4, [4], ['1825'], 'C'),
    seqItem('s5', 'Sam Six', ['Six'], 'G2', 1, [6], ['1835'], 'B'),
    seqItem('s6', 'Sam Seven', ['Seven'], 'G2', 2, [7], ['1840'], 'A'),
    seqItem('s7', 'Sam Eight', ['Eight'], 'G2', 3, [8], ['1840'], 'B'),
    seqItem('s8', 'Sam Nine', ['Nine'], 'G2', 4, [9], ['1850'], 'B', ['C']),
  ],
};
