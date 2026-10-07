import countries from '@/content/countries.json';
import type { CourseDef } from '@/lib/engine/types';
import { MAP_PROMPT_TYPES } from './map-prompts';
import type { CountryRecord } from './types';

const records = countries as CountryRecord[];

/** 197 countries plus the World Map territories (map spec §3.1). */
export const WORLD_MAP: CourseDef = {
  slug: 'world-map',
  title: 'World Map',
  placementPromptType: 'find',
  // A correct click shows the learner knows where and what it is; capitals are always studied.
  placementGraduates: ['find', 'name'],
  promptTypes: MAP_PROMPT_TYPES,
  items: records.map((c) => ({
    key: c.key,
    name: c.name,
    aliases: c.aliases,
    group: c.group,
    groupOrder: c.groupOrder,
    itemOrder: c.itemOrder,
    lookalikes: [...new Set([...c.neighbors, ...c.nearby])],
  })),
};
