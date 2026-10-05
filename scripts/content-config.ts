/** Non-UN-member countries included in the course (spec §2). */
export const EXTRA_KEYS = ['VA', 'PS', 'TW', 'XK'];

/** Dependent territories taught in World Map only; World Flags filters them out (map spec §3.1). */
export const MAP_TERRITORIES = ['GL', 'BM', 'PR', 'AW', 'CW', 'GF', 'FK', 'FO', 'NC', 'PF', 'GU'];

/** Learning chunks, in introduction order. */
export const GROUP_ORDER = [
  'Western & Northern Europe',
  'Southern Europe & Balkans',
  'Central & Eastern Europe',
  'North & Central America',
  'Caribbean',
  'South America',
  'Middle East & Central Asia',
  'South & East Asia',
  'Southeast Asia',
  'North & West Africa',
  'Central & Southern Africa',
  'East Africa',
  'Oceania',
] as const;

export type GroupName = (typeof GROUP_ORDER)[number];

export const SUBREGION_GROUPS: Record<string, GroupName> = {
  'Western Europe': 'Western & Northern Europe',
  'Northern Europe': 'Western & Northern Europe',
  'Southern Europe': 'Southern Europe & Balkans',
  'Southeast Europe': 'Southern Europe & Balkans',
  'Central Europe': 'Central & Eastern Europe',
  'Eastern Europe': 'Central & Eastern Europe',
  'North America': 'North & Central America',
  'Central America': 'North & Central America',
  Caribbean: 'Caribbean',
  'South America': 'South America',
  'Western Asia': 'Middle East & Central Asia',
  'Central Asia': 'Middle East & Central Asia',
  'Southern Asia': 'South & East Asia',
  'Eastern Asia': 'South & East Asia',
  'South-Eastern Asia': 'Southeast Asia',
  'Northern Africa': 'North & West Africa',
  'Western Africa': 'North & West Africa',
  'Middle Africa': 'Central & Southern Africa',
  'Southern Africa': 'Central & Southern Africa',
  'Eastern Africa': 'East Africa',
  'Australia and New Zealand': 'Oceania',
  Melanesia: 'Oceania',
  Micronesia: 'Oceania',
  Polynesia: 'Oceania',
};

/**
 * Per-country group overrides, applied before the subregion lookup. Keeps Austria,
 * Switzerland and Liechtenstein together in Central & Eastern Europe (Austria already
 * lands there via its subregion; Switzerland and Liechtenstein are nudged out of
 * Western & Northern Europe to join it). Germany is unaffected and stays Western.
 */
export const GROUP_OVERRIDES: Record<string, GroupName> = {
  CH: 'Central & Eastern Europe',
  LI: 'Central & Eastern Europe',
};

/** Display-name overrides, applied before primary-name uniqueness. The original common
 * name (e.g. "Türkiye") is preserved as an alias. */
export const NAME_OVERRIDES: Record<string, string> = {
  TR: 'Turkey',
};

/** Aliases of 3 characters or fewer are dropped unless whitelisted (avoids "IN", "NE"…). */
export const SHORT_ALIAS_WHITELIST = ['USA', 'UK', 'UAE', 'DRC', 'CAR', 'PNG', 'US'];

export const EXTRA_ALIASES: Record<string, string[]> = {
  US: ['America', 'United States of America', 'USA', 'US'],
  GB: ['Britain', 'Great Britain', 'UK'],
  CD: ['DRC', 'Congo Kinshasa', 'Democratic Republic of the Congo'],
  CG: ['Congo', 'Congo Brazzaville', 'Republic of Congo'],
  KP: ['North Korea'],
  KR: ['South Korea'],
  CZ: ['Czech Republic', 'Czech'],
  MM: ['Burma'],
  CV: ['Cabo Verde'],
  TL: ['East Timor'],
  SZ: ['Swaziland'],
  MK: ['Macedonia'],
  VA: ['Vatican', 'Holy See'],
  FM: ['Federated States of Micronesia'],
  AE: ['UAE'],
  CF: ['CAR'],
  BS: ['The Bahamas'],
  GM: ['The Gambia'],
  ST: ['Sao Tome'],
  TW: ['Republic of China'],
  LA: ['Laos'],
  RU: ['Russian Federation'],
  VN: ['Viet Nam'],
  CI: ["Côte d'Ivoire"],
  BA: ['Bosnia'],
  TT: ['Trinidad'],
  AG: ['Antigua'],
  KN: ['Saint Kitts', 'St Kitts'],
  VC: ['Saint Vincent'],
  PG: ['PNG'],
  BF: ['Burkina'],
};

/**
 * Per-country alias junk to drop before dedupe: ISO/world-countries alt spellings that
 * are not useful learner-facing names (partial-word fragments, demonyms, IPA pronunciations).
 * Aliases containing a comma (inverted ISO forms like "Moldova, Republic of") are dropped
 * generically in buildCountries, not listed here.
 */
export const ALIAS_DENYLIST: Record<string, string[]> = {
  TH: ['Prathet', 'Thai'],
  IS: ['Island'],
  BN: ['the Abode of Peace'],
  AO: ["ʁɛpublika de an'ɡɔla"],
  MX: ['Mexicanos'],
  PT: ['Portuguesa'],
  TG: ['Togolese'],
};

/** Statically similar flags (seed confusions). Symmetric; each pair listed once. */
export const FLAG_LOOKALIKE_PAIRS: [string, string][] = [
  ['TD', 'RO'], ['TD', 'AD'], ['TD', 'MD'], ['RO', 'AD'], ['RO', 'MD'], ['AD', 'MD'],
  ['ID', 'MC'], ['ID', 'PL'], ['MC', 'PL'],
  ['NL', 'LU'], ['NL', 'FR'], ['NL', 'RU'],
  ['AU', 'NZ'],
  ['IE', 'CI'], ['IE', 'IT'], ['IT', 'MX'],
  ['NE', 'IN'],
  ['SN', 'ML'], ['ML', 'GN'], ['SN', 'CM'],
  ['CO', 'EC'], ['CO', 'VE'], ['EC', 'VE'],
  ['SI', 'SK'], ['SI', 'RU'], ['SK', 'RU'], ['RS', 'RU'],
  ['NO', 'IS'], ['SE', 'FI'], ['DK', 'NO'],
  ['HN', 'NI'], ['HN', 'SV'], ['NI', 'SV'], ['GT', 'SV'],
  ['QA', 'BH'], ['AE', 'KW'], ['JO', 'PS'], ['SD', 'PS'],
  ['EG', 'IQ'], ['IQ', 'SY'], ['SY', 'YE'], ['EG', 'YE'],
  ['BO', 'GH'], ['BO', 'LT'], ['GH', 'LT'],
  ['LR', 'US'], ['MY', 'US'], ['LR', 'MY'],
  ['HT', 'LI'], ['BE', 'DE'], ['XK', 'BA'],
  ['AT', 'LV'], ['CZ', 'PH'], ['BD', 'JP'], ['BD', 'PW'], ['JP', 'PW'], ['HR', 'SK'],
];
