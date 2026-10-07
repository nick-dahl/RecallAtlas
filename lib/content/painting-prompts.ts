import type { PromptTypeDef } from '@/lib/engine/types';

/** Great Paintings prompts (spec §4.1). Movement is multiple choice only; its level 3 offers neighbouring movements. */
export const PAINTING_PROMPT_TYPES: PromptTypeDef[] = [
  { id: 'image_to_title', label: 'Title', formats: {
      1: { format: 'mc-text', choices: 4, distractors: 'local' },
      2: { format: 'mc-text', choices: 6, distractors: 'hard' },
      3: { format: 'typed' } } },
  { id: 'image_to_artist', label: 'Artist', answerField: 'artist', distinctChoices: true,
    ambiguous: ['Anonymous', 'Unknown', 'Anon'], sharedAnswer: 'Anonymous', formats: {
      1: { format: 'mc-text', choices: 4, distractors: 'local' },
      2: { format: 'mc-text', choices: 6, distractors: 'hard' },
      3: { format: 'typed' } } },
  { id: 'title_to_image', label: 'Find it', formats: {
      1: { format: 'image-grid', choices: 4, distractors: 'local' },
      2: { format: 'image-grid', choices: 6, distractors: 'hard' },
      3: { format: 'image-grid', choices: 8, distractors: 'hard' } } },
  { id: 'image_to_movement', label: 'Movement', answerField: 'movement', distinctChoices: true, recordsConfusions: false, formats: {
      1: { format: 'mc-text', choices: 4, distractors: 'random' },
      2: { format: 'mc-text', choices: 6, distractors: 'random' },
      3: { format: 'mc-text', choices: 6, distractors: 'sequence' } } },
];
