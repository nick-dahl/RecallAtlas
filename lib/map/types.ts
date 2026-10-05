export interface MarkerShape {
  x: number;
  y: number;
  r: number;
}

/** One country in one frame, in viewBox units. Server-only data (content/maps/<frame>.hit.json). */
export interface CountryShape {
  /** Projected rings, each flat [x0, y0, x1, y1, ...]. Even-odd across all rings, so holes are enclaves. */
  rings: number[][];
  bbox: [number, number, number, number];
  /** SVG path data for overlays; marker countries also get a circle. */
  outline: string;
  /** A representative interior point (pole of inaccessibility of the largest ring). */
  label: [number, number];
  /** Countries too small to click reliably get a dot with a padded hit area. */
  marker?: MarkerShape;
  /** Mostly cut off by the frame edge: clickable, but never offered as a candidate. */
  sliver?: true;
}

export interface FrameData {
  id: string;
  width: number;
  height: number;
  countries: Record<string, CountryShape>;
}

/** The course-home reference map (content/maps/world-atlas.json). Keys are fine here: never a question. */
export interface AtlasData {
  width: number;
  height: number;
  land: string;
  borders: string;
  countries: Record<string, { d: string; marker?: MarkerShape }>;
}
