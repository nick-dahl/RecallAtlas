import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seededRng, type QuestionRung, type QueueEntry } from '@/lib/engine';
import { NOW } from '@/lib/engine/test-fixtures';
import { GREAT_PAINTINGS, paintingRecord } from '@/lib/content/great-paintings';
import { gradeSubmission, issueQuestion } from './issue';
import { toQuestionView } from './present';
import { getPresenter } from './presenters';
import type { PendingQuestion } from './types';

const course = GREAT_PAINTINGS;
const presenter = getPresenter(course);
const session = { id: 's', kind: 'study' as const, progress: { answered: 0, total: 20 } };
const issue = (entry: QueueEntry, rung: QuestionRung, seed = 3): PendingQuestion =>
  issueQuestion({ entry, rung, course, confusions: [], rng: seededRng(seed), now: NOW, newId: randomUUID });
const view = (p: PendingQuestion) => toQuestionView({ pending: p, session, course, presenter });

/** Everything in a view outside choice labels, with images removed (base64 could contain anything). */
function text(v: ReturnType<typeof view>): string {
  const { choices, ...rest } = v;
  const json = JSON.stringify({ ...rest, choices: choices?.map((c) => ({ ...c, label: undefined })) });
  return json.replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g, '');
}
const lower = (s: string) => s.toLowerCase();

describe('paintings leak rules (every painting × prompt × level)', () => {
  const PROMPTS = ['image_to_title', 'image_to_artist', 'image_to_movement', 'title_to_image'];
  it('image questions name no title, artist or movement; title → image names only the title', () => {
    for (const item of course.items) {
      const r = paintingRecord(item.key);
      for (const promptType of PROMPTS) {
        for (const rung of [1, 2, 3] as const) {
          const raw = text(view(issue({ kind: 'prompt', itemKey: item.key, promptType }, rung)));
          // Case-sensitive: a one-word key ("sunflowers") is the title lowercased, which title → image shows.
          expect(raw).not.toContain(`"${item.key}"`);
          const t = lower(raw);
          if (r.artist !== 'Anonymous') expect(t).not.toContain(lower(r.artist));
          expect(t).not.toContain(lower(r.movement));
          if (promptType === 'title_to_image') expect(t).toContain(lower(r.title));
          else expect(t).not.toContain(lower(r.title));
        }
      }
    }
  });

  it('shows the painting as an unlabelled data URI and, for title → image, unlabelled thumbnails', () => {
    const v = view(issue({ kind: 'prompt', itemKey: 'mona-lisa', promptType: 'image_to_title' }, 1));
    expect(v.prompt.painting).toMatch(/^data:image\/webp;base64,/);
    const g = view(issue({ kind: 'prompt', itemKey: 'mona-lisa', promptType: 'title_to_image' }, 3));
    expect(g.choices).toHaveLength(8);
    expect(g.choices!.every((c) => c.painting?.startsWith('data:image/webp') && !c.label)).toBe(true);
  });
});

describe('grading', () => {
  const typed = (key: string, promptType: string, text: string) =>
    gradeSubmission(issue({ kind: 'prompt', itemKey: key, promptType }, 3), { kind: 'typed', text }, course);

  it('accepts titles without accents, punctuation or articles (Review Focus 1)', () => {
    expect(typed('dejeuner-sur-lherbe', 'image_to_title', 'Dejeuner sur l herbe').correct).toBe(true);
    expect(typed('bal-du-moulin', 'image_to_title', 'bal du moulin de la galette').correct).toBe(true);
    expect(typed('bar-folies-bergere', 'image_to_title', 'A Bar at the Folies Bergere').correct).toBe(true);
  });

  it('rejects a first name alone, blaming nobody (Review Focus 2)', () => {
    expect(typed('starry-night', 'image_to_artist', 'Vincent')).toEqual({ correct: false, typo: false, answeredItemKey: null });
    expect(typed('hunters-in-the-snow', 'image_to_artist', 'Pieter').correct).toBe(false);
  });

  it('tells the Judith pair apart in one grid (Review Focus 3)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = issue({ kind: 'prompt', itemKey: 'judith-caravaggio', promptType: 'title_to_image' }, 3, seed);
      const twin = p.choices.find((c) => c.itemKey === 'judith-gentileschi');
      const right = p.choices.find((c) => c.itemKey === 'judith-caravaggio')!;
      expect(gradeSubmission(p, { kind: 'choice', choiceId: right.id }, course).correct).toBe(true);
      if (twin) expect(gradeSubmission(p, { kind: 'choice', choiceId: twin.id }, course)).toMatchObject({ correct: false, answeredItemKey: 'judith-gentileschi' });
    }
  });

  it('describes a painting fully for intros and feedback', () => {
    expect(presenter.item('night-watch')).toMatchObject({
      name: 'The Night Watch', artist: 'Rembrandt', year: '1642', movement: 'Dutch Golden Age', museum: 'Rijksmuseum, Amsterdam',
    });
  });
});
