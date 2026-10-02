import worldCountries from 'world-countries';
import { describe, expect, it } from 'vitest';
import { GROUP_ORDER, SHORT_ALIAS_WHITELIST } from '../content-config';
import { buildCountries, type RawCountry } from './build-countries';

const raw = worldCountries as unknown as RawCountry[];
const { countries } = buildCountries(raw);
const byKey = new Map(countries.map((c) => [c.key, c]));

describe('buildCountries (real data)', () => {
  it('selects 193 UN members plus VA, PS, TW, XK', () => {
    expect(countries).toHaveLength(197);
    for (const k of ['VA', 'PS', 'TW', 'XK', 'US', 'EC']) expect(byKey.has(k)).toBe(true);
  });

  it('keeps useful aliases and drops short codes', () => {
    expect(byKey.get('US')!.aliases).toContain('USA');
    expect(byKey.get('CZ')!.aliases).toContain('Czech Republic');
    expect(byKey.get('CI')!.aliases).toContain("Côte d'Ivoire");
    for (const c of countries) {
      for (const a of c.aliases) {
        if (a.length <= 3) expect(SHORT_ALIAS_WHITELIST).toContain(a);
      }
    }
  });

  it('assigns every country to a known, non-empty group with sequential item order', () => {
    for (const g of GROUP_ORDER) {
      const members = countries.filter((c) => c.group === g);
      expect(members.length).toBeGreaterThan(0);
      expect(members.map((c) => c.itemOrder)).toEqual(members.map((_, i) => i + 1));
      expect(new Set(members.map((c) => c.groupOrder))).toEqual(new Set([GROUP_ORDER.indexOf(g) + 1]));
    }
  });

  it('makes flag look-alikes symmetric and valid', () => {
    for (const c of countries) {
      for (const other of c.flagLookalikes) {
        expect(byKey.get(other)?.flagLookalikes).toContain(c.key);
      }
    }
    expect(byKey.get('TD')!.flagLookalikes).toContain('RO');
  });

  it('points each country at its flag path', () => {
    expect(byKey.get('EC')!.flag).toBe('/flags/ec.svg');
  });
});

const fake = (over: Partial<RawCountry>): RawCountry => ({
  cca2: 'AA',
  unMember: true,
  region: 'Europe',
  subregion: 'Western Europe',
  name: { common: 'Aland', official: 'Republic of Aland' },
  altSpellings: [],
  ...over,
});

describe('buildCountries (validation)', () => {
  it('throws on an unmapped subregion', () => {
    expect(() => buildCountries([fake({ subregion: 'Atlantis' })])).toThrow(/Atlantis/);
  });

  it('throws on duplicate primary names', () => {
    expect(() => buildCountries([fake({ cca2: 'AA' }), fake({ cca2: 'BB' })])).toThrow(/Duplicate/);
  });

  it('drops aliases shared by two countries, with a warning', () => {
    const r = buildCountries(
      [
        fake({ cca2: 'AA', name: { common: 'Aland', official: 'Aland' }, altSpellings: ['Shared Name'] }),
        fake({ cca2: 'BB', name: { common: 'Bland', official: 'Bland' }, altSpellings: ['Shared Name'] }),
      ],
      [],
    );
    expect(r.countries.flatMap((c) => c.aliases)).not.toContain('Shared Name');
    expect(r.warnings.join('\n')).toMatch(/Shared Name/);
  });

  it('throws when a look-alike pair references an unknown key', () => {
    expect(() => buildCountries([fake({})], [['AA', 'ZZ']])).toThrow(/ZZ/);
  });
});
