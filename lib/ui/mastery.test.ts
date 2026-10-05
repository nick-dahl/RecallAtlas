import { describe, expect, it } from 'vitest';
import { MASTERY_LEGEND, MASTERY_STYLE, masterySummary } from './mastery';

describe('mastery map', () => {
  it('summarizes each prompt for the hover title', () => {
    expect(
      masterySummary('Bolivia', [
        { label: 'Find it', phase: 'review' },
        { label: 'Name it', phase: 'review' },
        { label: 'Capital', phase: 'learning' },
      ]),
    ).toBe('Bolivia: Find it learned, Name it learned, Capital learning');
  });

  it('marks only mastered countries gold, and has a legend entry per distinct label', () => {
    expect(Object.entries(MASTERY_STYLE).filter(([, s]) => s.gold).map(([t]) => t)).toEqual(['strong']);
    expect(MASTERY_LEGEND.map((l) => l.label)).toEqual(['Not started', 'Learning', 'Learned', 'Mastered']);
  });
});
