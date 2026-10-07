import countries from '@/content/countries.json';
import type { CourseDef } from '@/lib/engine/types';
import { CAPITAL_PROMPT_TYPES } from './capital-prompts';
import type { CountryRecord } from './types';

const records = (countries as CountryRecord[]).filter((c) => !c.territory);
const keys = new Set(records.map((c) => c.key));

/** The capitals of the 197 countries, both ways round (capitals spec). */
export const WORLD_CAPITALS: CourseDef = {
  slug: 'world-capitals',
  title: 'World Capitals',
  // A correct "capital of X?" almost always means the reverse is known too, so both graduate.
  placementPromptType: 'country_to_capital',
  promptTypes: CAPITAL_PROMPT_TYPES,
  items: records.map((c) => ({
    key: c.key,
    name: c.name,
    aliases: c.aliases,
    group: c.group,
    groupOrder: c.groupOrder,
    itemOrder: c.itemOrder,
    lookalikes: [...new Set([...c.neighbors, ...c.nearby])].filter((k) => keys.has(k)),
    answers: { capital: { text: c.capital, aliases: c.capitalAliases } },
  })),
};
