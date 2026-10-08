/** One entry in content/countries.json, shared by World Flags and (later) World Map. */
export interface CountryRecord {
  key: string; // ISO 3166-1 alpha-2, e.g. "EC"
  name: string;
  aliases: string[];
  region: string;
  subregion: string;
  group: string;
  groupOrder: number;
  itemOrder: number;
  flagLookalikes: string[];
  /** Dependent territory: a World Map item, never a World Flags item. */
  territory: boolean;
  /** ISO 3166-1 numeric; matches world-atlas feature ids. */
  ccn3: string;
  capital: string;
  capitalAliases: string[];
  capitalNote: string | null;
  /** Land neighbours (world-countries borders), as keys of other records. */
  neighbors: string[];
  /** The 6 nearest other records by great-circle distance between `latlng`s. */
  nearby: string[];
  /** [lat, lng] */
  latlng: [number, number];
}

/** One entry in content/presidents.json (US Presidents). */
export interface PresidentRecord {
  key: string;
  name: string;
  /** Accepted typed answers besides `name`. */
  aliases: string[];
  /** Presidency numbers; two for non-consecutive terms. */
  numbers: number[];
  /** Year(s) he took office, matching `numbers`. */
  startYears: number[];
  party: string;
  partyAliases: string[];
  era: string;
  groupOrder: number;
  itemOrder: number;
  /** Era neighbours (nearest number first), then hand-picked face look-alikes. */
  lookalikes: string[];
  wikipedia: string;
  commonsFile?: string;
}

export interface PaintingRecord {
  key: string;
  title: string;
  titleAliases: string[];
  artist: string;
  artistAliases: string[];
  /** Display text, e.g. "c. 1503–1519". */
  year: string;
  movement: string;
  /** Boundary movements never offered as wrong answers. */
  alsoMovements: string[];
  museum: string;
  /** 1 = introduced first. Also the reference-view address (/api/painting-art/<fame>). */
  fame: number;
  /** Index of the movement in room order (course home). */
  room: number;
  /** Movement position for "neighbouring movement" distractors. */
  neighbour: number;
  /** Same-artist works, then subject look-alikes. */
  lookalikes: string[];
  detail: boolean;
}

export interface PaintingSource {
  file: string;
  page: string;
  license: string;
  author?: string;
}
