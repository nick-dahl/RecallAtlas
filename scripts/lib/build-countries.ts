import type { CountryRecord } from '../../lib/content/types';
import { normalize } from '../../lib/engine/grading';
import { CAPITAL_OVERRIDES, type CapitalOverride } from '../capital-overrides';
import {
  ALIAS_DENYLIST,
  EXTRA_ALIASES,
  EXTRA_KEYS,
  FLAG_LOOKALIKE_PAIRS,
  GROUP_OVERRIDES,
  GROUP_ORDER,
  MAP_TERRITORIES,
  NAME_OVERRIDES,
  SHORT_ALIAS_WHITELIST,
  SUBREGION_GROUPS,
} from '../content-config';

/** The subset of world-countries fields we rely on. */
export interface RawCountry {
  cca2: string;
  cca3: string;
  ccn3: string;
  unMember: boolean;
  region: string;
  subregion: string;
  name: { common: string; official: string };
  altSpellings: string[];
  capital: string[];
  borders: string[];
  /** [lat, lng] */
  latlng: [number, number];
}

const NEARBY_COUNT = 6;
const EARTH_KM = 6371;

function distanceKm([lat1, lng1]: [number, number], [lat2, lng2]: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

export function buildCountries(
  raw: readonly RawCountry[],
  lookalikePairs: readonly [string, string][] = FLAG_LOOKALIKE_PAIRS,
  capitalOverrides: Record<string, CapitalOverride> = CAPITAL_OVERRIDES,
  territories: readonly string[] = MAP_TERRITORIES,
): { countries: CountryRecord[]; warnings: string[] } {
  const warnings: string[] = [];
  const selected = raw.filter((c) => c.unMember || EXTRA_KEYS.includes(c.cca2) || territories.includes(c.cca2));

  const base = selected.map((c) => {
    const group = GROUP_OVERRIDES[c.cca2] ?? SUBREGION_GROUPS[c.subregion];
    if (!group) throw new Error(`No group mapping for subregion "${c.subregion}" (${c.cca2})`);
    const rawName = c.name.common;
    const name = NAME_OVERRIDES[c.cca2] ?? rawName;
    const denylist = new Set(ALIAS_DENYLIST[c.cca2] ?? []);
    const candidates = [
      // The overridden-away original name goes first so it wins the alias slot over any
      // altSpelling that normalizes identically (e.g. ASCII "Turkiye" vs. "Türkiye").
      ...(name !== rawName ? [rawName] : []),
      c.name.official,
      ...c.altSpellings,
      ...(EXTRA_ALIASES[c.cca2] ?? []),
    ];
    return {
      key: c.cca2,
      name,
      candidates: candidates.filter(
        (a) => !denylist.has(a) && !a.includes(',') && (a.length > 3 || SHORT_ALIAS_WHITELIST.includes(a)),
      ),
      region: c.region,
      subregion: c.subregion,
      group,
    };
  });

  const primaryOwner = new Map<string, string>();
  for (const c of base) {
    const n = normalize(c.name);
    const prev = primaryOwner.get(n);
    if (prev) throw new Error(`Duplicate primary name "${c.name}" for ${prev} and ${c.key}`);
    primaryOwner.set(n, c.key);
  }

  const aliasOwners = new Map<string, Set<string>>();
  for (const c of base) {
    for (const a of c.candidates) {
      const n = normalize(a);
      if (!n) continue;
      if (!aliasOwners.has(n)) aliasOwners.set(n, new Set());
      aliasOwners.get(n)!.add(c.key);
    }
  }

  const withAliases = base.map((c) => {
    const seen = new Set([normalize(c.name)]);
    const aliases: string[] = [];
    for (const a of c.candidates) {
      const n = normalize(a);
      if (!n || seen.has(n)) continue;
      const primary = primaryOwner.get(n);
      if (primary && primary !== c.key) {
        warnings.push(`Dropped alias "${a}" from ${c.key}: it is ${primary}'s name`);
        continue;
      }
      if ((aliasOwners.get(n)?.size ?? 0) > 1) {
        warnings.push(`Dropped ambiguous alias "${a}" from ${c.key}`);
        continue;
      }
      seen.add(n);
      aliases.push(a);
    }
    return { ...c, aliases };
  });

  const keys = new Set(withAliases.map((c) => c.key));
  const rawByKey = new Map(selected.map((c) => [c.cca2, c]));
  const keyByCca3 = new Map(selected.map((c) => [c.cca3, c.cca2]));

  for (const k of Object.keys(capitalOverrides)) {
    if (!keys.has(k)) throw new Error(`Capital override for unknown key ${k}`);
  }
  const capitals = new Map<string, Pick<CountryRecord, 'capital' | 'capitalAliases' | 'capitalNote'>>();
  const capitalOwner = new Map<string, string>();
  for (const c of withAliases) {
    const r = rawByKey.get(c.key)!;
    const o = capitalOverrides[c.key] ?? {};
    const capital = o.capital ?? r.capital[0];
    if (!capital) throw new Error(`${c.key} has no capital`);
    // An overridden-away world-countries capital stays accepted (e.g. a spelling variant).
    const extra = [...(r.capital[0] && r.capital[0] !== capital ? [r.capital[0]] : []), ...r.capital.slice(1)];
    const seen = new Set([normalize(capital)]);
    const capitalAliases: string[] = [];
    for (const a of [...extra, ...(o.aliases ?? [])]) {
      const n = normalize(a);
      if (!n || seen.has(n)) continue;
      seen.add(n);
      capitalAliases.push(a);
    }
    for (const n of seen) {
      const prev = capitalOwner.get(n);
      if (prev) throw new Error(`Capital spelling "${n}" accepted by both ${prev} and ${c.key}`);
      capitalOwner.set(n, c.key);
    }
    capitals.set(c.key, { capital, capitalAliases, capitalNote: o.note ?? null });
  }

  const neighbors = (k: string) =>
    [...new Set(rawByKey.get(k)!.borders.map((b) => keyByCca3.get(b)).filter((x): x is string => !!x))].sort();
  const nearby = (k: string) => {
    const here = rawByKey.get(k)!.latlng;
    return [...keys]
      .filter((o) => o !== k)
      .map((o) => ({ o, d: distanceKm(here, rawByKey.get(o)!.latlng) }))
      .sort((a, b) => a.d - b.d || a.o.localeCompare(b.o))
      .slice(0, NEARBY_COUNT)
      .map((x) => x.o);
  };

  const lookalikes = new Map<string, Set<string>>();
  for (const [a, b] of lookalikePairs) {
    for (const k of [a, b]) {
      if (!keys.has(k)) throw new Error(`Flag look-alike pair references unknown key ${k}`);
    }
    if (!lookalikes.has(a)) lookalikes.set(a, new Set());
    if (!lookalikes.has(b)) lookalikes.set(b, new Set());
    lookalikes.get(a)!.add(b);
    lookalikes.get(b)!.add(a);
  }

  const groupIndex = (g: string) => GROUP_ORDER.indexOf(g as (typeof GROUP_ORDER)[number]);
  const sorted = [...withAliases].sort(
    (x, y) => groupIndex(x.group) - groupIndex(y.group) || x.name.localeCompare(y.name, 'en'),
  );

  const counters = new Map<string, number>();
  const countries: CountryRecord[] = sorted.map((c) => {
    const itemOrder = (counters.get(c.group) ?? 0) + 1;
    counters.set(c.group, itemOrder);
    const r = rawByKey.get(c.key)!;
    return {
      key: c.key,
      name: c.name,
      aliases: c.aliases,
      region: c.region,
      subregion: c.subregion,
      group: c.group,
      groupOrder: groupIndex(c.group) + 1,
      itemOrder,
      flagLookalikes: [...(lookalikes.get(c.key) ?? [])].sort(),
      territory: territories.includes(c.key),
      ccn3: r.ccn3,
      ...capitals.get(c.key)!,
      neighbors: neighbors(c.key),
      nearby: nearby(c.key),
      latlng: [r.latlng[0], r.latlng[1]],
    };
  });

  return { countries, warnings };
}
