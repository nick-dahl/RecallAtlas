import countries from '@/content/countries.json';
import type { CourseDef } from '@/lib/engine/types';
import { FLAG_PROMPT_TYPES } from './flag-prompts';
import type { CountryRecord } from './types';

const records = countries as CountryRecord[];

export const WORLD_FLAGS: CourseDef = {
  slug: 'world-flags',
  title: 'World Flags',
  placementPromptType: 'flag_to_name',
  promptTypes: FLAG_PROMPT_TYPES,
  items: records.map((c) => ({
    key: c.key,
    name: c.name,
    aliases: c.aliases,
    group: c.group,
    groupOrder: c.groupOrder,
    itemOrder: c.itemOrder,
    lookalikes: c.flagLookalikes,
  })),
};
