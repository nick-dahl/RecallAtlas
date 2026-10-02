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
}
