import type { PromptTypeDef } from '@/lib/engine/types';

/** World Map prompts (map spec §4). Rung 1 uses local distractors so candidates share the frame. */
export const MAP_PROMPT_TYPES: PromptTypeDef[] = [
  {
    id: 'find',
    label: 'Find it',
    formats: {
      1: { format: 'map-pick', choices: 4, distractors: 'local' },
      2: { format: 'map-pick', choices: 6, distractors: 'hard' },
      3: { format: 'map-click' },
    },
  },
  {
    id: 'name',
    label: 'Name it',
    formats: {
      1: { format: 'mc-text', choices: 4, distractors: 'local' },
      2: { format: 'mc-text', choices: 6, distractors: 'hard' },
      3: { format: 'typed' },
    },
  },
  {
    id: 'capital',
    label: 'Capital',
    answerField: 'capital',
    formats: {
      1: { format: 'mc-text', choices: 4, distractors: 'local' },
      2: { format: 'mc-text', choices: 6, distractors: 'hard' },
      3: { format: 'typed' },
    },
  },
];
