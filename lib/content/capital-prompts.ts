import type { PromptTypeDef } from '@/lib/engine/types';

/** World Capitals prompts: both directions (capitals spec §4.2). */
export const CAPITAL_PROMPT_TYPES: PromptTypeDef[] = [
  {
    id: 'country_to_capital',
    label: 'Country → Capital',
    answerField: 'capital',
    formats: {
      1: { format: 'mc-text', choices: 4, distractors: 'local' },
      2: { format: 'mc-text', choices: 6, distractors: 'hard' },
      3: { format: 'typed' },
    },
  },
  {
    id: 'capital_to_country',
    label: 'Capital → Country',
    formats: {
      1: { format: 'mc-text', choices: 4, distractors: 'local' },
      2: { format: 'mc-text', choices: 6, distractors: 'hard' },
      3: { format: 'typed' },
    },
  },
];
