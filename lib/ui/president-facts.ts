/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st, 22nd … */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/** Reference-view facts, e.g. { numbers: '22nd & 24th', years: '1885 & 1893', party: 'Democratic' }. */
export function presidentFacts(p: { numbers: number[]; startYears: number[]; party: string }) {
  return {
    numbers: p.numbers.map(ordinal).join(' & '),
    years: p.startYears.join(' & '),
    party: p.party,
  };
}
