import type { PromptTypeDef } from '@/lib/engine/types';

/** US Presidents prompts (spec §4). Party is always multiple choice; Sequence steps gap → order → typed gap. */
export const PRESIDENT_PROMPT_TYPES: PromptTypeDef[] = [
  { id: 'number_to_name', label: 'Number → Name', formats: {
      1: { format: 'mc-text', choices: 4, distractors: 'local' },
      2: { format: 'mc-text', choices: 6, distractors: 'hard' },
      3: { format: 'typed' } } },
  { id: 'portrait_to_name', label: 'Portrait → Name', formats: {
      1: { format: 'mc-text', choices: 4, distractors: 'local' },
      2: { format: 'mc-text', choices: 6, distractors: 'hard' },
      3: { format: 'typed' } } },
  { id: 'name_to_portrait', label: 'Name → Portrait', formats: {
      1: { format: 'image-grid', choices: 4, distractors: 'local' },
      2: { format: 'image-grid', choices: 6, distractors: 'hard' },
      3: { format: 'image-grid', choices: 8, distractors: 'hard' } } },
  { id: 'start_year', label: 'Start year', answerField: 'startYear', exactAnswer: true, distinctChoices: true, formats: {
      1: { format: 'mc-text', choices: 4, distractors: 'local' },
      2: { format: 'mc-text', choices: 6, distractors: 'hard' },
      3: { format: 'typed' } } },
  { id: 'party', label: 'Party', answerField: 'party', distinctChoices: true, recordsConfusions: false, formats: {
      1: { format: 'mc-text', choices: 4, distractors: 'sequence', window: 6 },
      2: { format: 'mc-text', choices: 4, distractors: 'sequence', window: 6 },
      3: { format: 'mc-text', choices: 4, distractors: 'sequence', window: 6 } } },
  // Keeps the full ladder: fill the gap first, then put in order (no quick start).
  { id: 'sequence', label: 'Sequence', fullLadder: true, formats: {
      1: { format: 'gap-choice', choices: 4, distractors: 'local' },
      2: { format: 'order', choices: 4, distractors: 'sequence' },
      3: { format: 'gap-typed' } } },
];
