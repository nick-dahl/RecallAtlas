export interface CapitalOverride {
  /** Replaces world-countries `capital[0]` as the displayed capital. */
  capital?: string;
  /** Extra accepted answers (other official capitals, spelling variants). */
  aliases?: string[];
  /** Shown with the answer, for split or contested capitals. */
  note?: string;
}

/** Reviewed list; the content build validates every key and capital uniqueness (map spec §3). */
export const CAPITAL_OVERRIDES: Record<string, CapitalOverride> = {
  ZA: {
    capital: 'Pretoria',
    aliases: ['Cape Town', 'Bloemfontein'],
    note: 'South Africa has three capitals: Pretoria (executive), Cape Town (legislative) and Bloemfontein (judicial).',
  },
  BO: { capital: 'Sucre', aliases: ['La Paz'], note: 'Sucre is the constitutional capital; La Paz is the seat of government.' },
  SZ: {
    capital: 'Mbabane',
    aliases: ['Lobamba'],
    note: 'Mbabane is the administrative capital; Lobamba is the royal and legislative capital.',
  },
  NL: { capital: 'Amsterdam', note: 'The Hague is the seat of government, not the capital.' },
  IL: { capital: 'Jerusalem', note: "Jerusalem's status is disputed; most embassies are in Tel Aviv." },
  PS: { capital: 'Ramallah', note: 'Ramallah is the administrative centre; East Jerusalem is the claimed capital.' },
  UA: { capital: 'Kyiv', aliases: ['Kiev'] },
  MN: { capital: 'Ulaanbaatar', aliases: ['Ulan Bator'] },
  US: { capital: 'Washington, D.C.', aliases: ['Washington', 'Washington DC'] },
  PF: { capital: 'Papeete' },
  GU: { capital: 'Hagåtña', aliases: ['Hagatna', 'Agana'] },
  GL: { capital: 'Nuuk', aliases: ['Godthåb'] },
  XK: { capital: 'Pristina', aliases: ['Prishtina'] },
  CH: { capital: 'Bern', aliases: ['Berne'], note: 'Officially the "federal city".' },
  LK: {
    capital: 'Sri Jayawardenepura Kotte',
    aliases: ['Kotte', 'Colombo'],
    note: 'Sri Jayawardenepura Kotte is the legislative capital; Colombo is the executive and commercial capital.',
  },
  SM: { aliases: ['San Marino'] },
  KI: { aliases: ['Tarawa'] },
  MM: { aliases: ['Nay Pyi Taw', 'Naypyitaw'] },
  KZ: { aliases: ['Nur-Sultan'], note: 'Called Nur-Sultan from 2019 to 2022.' },
  CI: { note: 'Abidjan is the economic capital and largest city.' },
  TZ: { note: 'Dar es Salaam is the largest city and hosts most government offices.' },
  BJ: { note: 'Cotonou is the seat of government.' },
  BI: { note: 'Gitega became the political capital in 2019; Bujumbura is the economic capital.' },
  NR: { note: 'Nauru has no official capital; Yaren is the seat of government.' },
};
