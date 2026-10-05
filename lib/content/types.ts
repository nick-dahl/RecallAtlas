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
