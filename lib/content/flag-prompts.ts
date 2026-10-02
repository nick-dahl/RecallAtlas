import type { PromptTypeDef } from '@/lib/engine/types';

export const FLAG_PROMPT_TYPES: PromptTypeDef[] = [
  {
    id: 'flag_to_name',
    label: 'Flag → Name',
    formats: {
      1: { format: 'mc-text', choices: 4, distractors: 'random' },
      2: { format: 'mc-text', choices: 6, distractors: 'hard' },
      3: { format: 'typed' },
    },
  },
  {
    id: 'name_to_flag',
    label: 'Name → Flag',
    formats: {
      1: { format: 'flag-grid', choices: 4, distractors: 'random' },
      2: { format: 'flag-grid', choices: 6, distractors: 'hard' },
      3: { format: 'flag-grid', choices: 8, distractors: 'hard' },
    },
  },
];
