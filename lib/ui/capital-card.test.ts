import { describe, expect, it } from 'vitest';
import { capitalCardText } from './capital-card';

describe('capitalCardText', () => {
  it('hides the capital until the country has been introduced', () => {
    expect(capitalCardText('new', 'Lima')).toBe('?');
  });

  it.each(['learning-1', 'learning-2', 'learning-3', 'review', 'strong'] as const)('shows the capital once %s', (tile) => {
    expect(capitalCardText(tile, 'Lima')).toBe('Lima');
  });
});
