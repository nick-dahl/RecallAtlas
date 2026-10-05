import { describe, expect, it } from 'vitest';
import { gradeClick, hitTest } from './hit-test';
import type { CountryShape, FrameData, MarkerShape } from './types';

const sq = (x0: number, y0: number, x1: number, y1: number) => [x0, y0, x1, y0, x1, y1, x0, y1];

function shape(rings: number[][], label: [number, number], marker?: MarkerShape): CountryShape {
  const xs = rings.flatMap((r) => r.filter((_, i) => i % 2 === 0));
  const ys = rings.flatMap((r) => r.filter((_, i) => i % 2 === 1));
  return { rings, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], outline: 'M0,0Z', label, marker };
}

/** A with an enclave E (a hole in A), B next to A, and a tiny island C. */
const FRAME: FrameData = {
  id: 'test',
  width: 1000,
  height: 500,
  countries: {
    A: shape([sq(100, 100, 300, 300), sq(195, 195, 205, 205)], [150, 150]),
    E: shape([sq(195, 195, 205, 205)], [200, 200], { x: 200, y: 200, r: 4 }),
    B: shape([sq(300, 100, 500, 300)], [400, 200]),
    C: shape([sq(699, 99, 701, 101)], [700, 100], { x: 700, y: 100, r: 4 }),
  },
};

const at = (x: number, y: number, renderedWidth = 1000) => hitTest(FRAME, x / 1000, y / 500, renderedWidth);

describe('hitTest', () => {
  it('finds the country under the point', () => {
    expect(at(150, 150)).toBe('A');
    expect(at(450, 250)).toBe('B');
  });

  it('returns null over the ocean', () => {
    expect(at(900, 450)).toBeNull();
    expect(at(0, 0)).toBeNull();
  });

  it('treats an enclave as its own country, inside the hole and inside its dot', () => {
    expect(at(200, 200)).toBe('E');
    expect(at(203, 200)).toBe('E');
  });

  it('does not let the pad swallow clicks on the surrounding country', () => {
    expect(at(212, 200)).toBe('A');
  });

  it('pads small countries by 12 CSS px, scaled by the rendered width', () => {
    expect(at(712, 100, 1000)).toBe('C'); // 12 units: within r 4 + pad 12
    expect(at(720, 100, 1000)).toBeNull(); // 20 > 16
    expect(at(720, 100, 500)).toBe('C'); // pad = 24 units
    expect(at(712, 100, 4000)).toBeNull(); // pad = 3 units: 12 > 7
  });

  it('resolves a point on a shared border to exactly one side', () => {
    expect(['A', 'B']).toContain(at(300, 200));
  });
});

describe('gradeClick', () => {
  it('is correct on the target, a confusion on another country, and plain wrong on the ocean', () => {
    expect(gradeClick('A', FRAME, { x: 0.15, y: 0.3, width: 1000 })).toEqual({ correct: true, typo: false, answeredItemKey: null });
    expect(gradeClick('A', FRAME, { x: 0.45, y: 0.5, width: 1000 })).toEqual({ correct: false, typo: false, answeredItemKey: 'B' });
    expect(gradeClick('A', FRAME, { x: 0.9, y: 0.9, width: 1000 })).toEqual({ correct: false, typo: false, answeredItemKey: null });
  });
});
