import type { AnswerGrade } from '@/lib/engine/types';
import type { CountryShape, FrameData } from './types';

/** Small countries accept clicks this many CSS pixels outside their dot (map spec §6). */
export const CLICK_PAD_PX = 12;

/** Even-odd point-in-polygon over flat rings ([x0, y0, x1, y1, ...]). */
export function pointInRings(rings: readonly number[][], x: number, y: number): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
      const xi = ring[i];
      const yi = ring[i + 1];
      const xj = ring[j];
      const yj = ring[j + 1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

const inBbox = (s: CountryShape, x: number, y: number) =>
  x >= s.bbox[0] && x <= s.bbox[2] && y >= s.bbox[1] && y <= s.bbox[3];

function nearestMarker(frame: FrameData, x: number, y: number, pad: number): string | null {
  let best: { key: string; d: number } | null = null;
  for (const [key, s] of Object.entries(frame.countries)) {
    if (!s.marker) continue;
    const d = Math.hypot(s.marker.x - x, s.marker.y - y);
    if (d <= s.marker.r + pad && (!best || d < best.d)) best = { key, d };
  }
  return best?.key ?? null;
}

/**
 * The country at a normalized point ([0,1] of the frame's viewBox), or null: ocean, or land
 * that is not a course item. Order: inside a marker's dot, inside a polygon, then the nearest
 * marker within the click pad. Dots come first so enclaves stay clickable; the pad comes last so
 * it never swallows clicks on the country around them.
 */
export function hitTest(frame: FrameData, nx: number, ny: number, renderedWidth: number): string | null {
  const x = nx * frame.width;
  const y = ny * frame.height;
  const dot = nearestMarker(frame, x, y, 0);
  if (dot) return dot;
  for (const [key, s] of Object.entries(frame.countries)) {
    if (inBbox(s, x, y) && pointInRings(s.rings, x, y)) return key;
  }
  return nearestMarker(frame, x, y, (CLICK_PAD_PX * frame.width) / renderedWidth);
}

/** Another country is a confusion with it; the ocean is just wrong. */
export function gradeClick(
  targetKey: string,
  frame: FrameData,
  point: { x: number; y: number; width: number },
): AnswerGrade {
  const hit = hitTest(frame, point.x, point.y, point.width);
  if (hit === targetKey) return { correct: true, typo: false, answeredItemKey: null };
  return { correct: false, typo: false, answeredItemKey: hit };
}
