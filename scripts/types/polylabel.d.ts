declare module 'polylabel' {
  /** Pole of inaccessibility of `polygon` ([outer, ...holes]), with its distance to the edge. */
  export default function polylabel(
    polygon: number[][][],
    precision?: number,
    debug?: boolean,
  ): [number, number] & { distance: number };
}
