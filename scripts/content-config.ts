/** Non-UN-member countries included in the course (spec §2). */
export const EXTRA_KEYS = ['VA', 'PS', 'TW', 'XK'];

/** Learning chunks, in introduction order. */
export const GROUP_ORDER = [
  'Western & Northern Europe',
  'Southern & Eastern Europe',
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

export const SUBREGION_GROUPS: Record<string, (typeof GROUP_ORDER)[number]> = {
  'Western Europe': 'Western & Northern Europe',
  'Northern Europe': 'Western & Northern Europe',
  'Southern Europe': 'Southern & Eastern Europe',
  'Central Europe': 'Southern & Eastern Europe',
  'Eastern Europe': 'Southern & Eastern Europe',
  'Southeast Europe': 'Southern & Eastern Europe',
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

/** Aliases of 3 characters or fewer are dropped unless whitelisted (avoids "IN", "NE"…). */
export const SHORT_ALIAS_WHITELIST = ['USA', 'UK', 'UAE', 'DRC', 'CAR'];

export const EXTRA_ALIASES: Record<string, string[]> = {
  US: ['America', 'United States of America', 'USA'],
  GB: ['Britain', 'Great Britain', 'UK'],
  CD: ['DRC', 'Congo Kinshasa', 'Democratic Republic of the Congo'],
  CG: ['Congo', 'Congo Brazzaville'],
  KP: ['North Korea'],
  KR: ['South Korea'],
  CZ: ['Czech Republic'],
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
  TR: ['Turkey', 'Türkiye'],
  CI: ["Côte d'Ivoire"],
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
];
