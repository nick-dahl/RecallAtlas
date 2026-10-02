import type { CountryRecord } from '../../lib/content/types';
import { normalize } from '../../lib/engine/grading';
import {
  EXTRA_ALIASES,
  EXTRA_KEYS,
  FLAG_LOOKALIKE_PAIRS,
  GROUP_ORDER,
  SHORT_ALIAS_WHITELIST,
  SUBREGION_GROUPS,
} from '../content-config';

/** The subset of world-countries fields we rely on. */
export interface RawCountry {
  cca2: string;
  unMember: boolean;
  region: string;
  subregion: string;
  name: { common: string; official: string };
  altSpellings: string[];
}

export function buildCountries(raw: readonly RawCountry[]): { countries: CountryRecord[]; warnings: string[] } {
  const warnings: string[] = [];
  const selected = raw.filter((c) => c.unMember || EXTRA_KEYS.includes(c.cca2));

  const base = selected.map((c) => {
    const group = SUBREGION_GROUPS[c.subregion];
    if (!group) throw new Error(`No group mapping for subregion "${c.subregion}" (${c.cca2})`);
    const candidates = [c.name.official, ...c.altSpellings, ...(EXTRA_ALIASES[c.cca2] ?? [])];
    return {
      key: c.cca2,
      name: c.name.common,
      candidates: candidates.filter((a) => a.length > 3 || SHORT_ALIAS_WHITELIST.includes(a)),
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
  const lookalikes = new Map<string, Set<string>>();
  for (const [a, b] of FLAG_LOOKALIKE_PAIRS) {
    const hasA = keys.has(a);
    const hasB = keys.has(b);
    if (!hasA && !hasB) continue; // pair not applicable to this input set (e.g. a reduced test fixture)
    if (!hasA || !hasB) throw new Error(`Flag look-alike pair references unknown key ${hasA ? b : a}`);
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
    return {
      key: c.key,
      name: c.name,
      aliases: c.aliases,
      region: c.region,
      subregion: c.subregion,
      group: c.group,
      groupOrder: groupIndex(c.group) + 1,
      itemOrder,
      flag: `/flags/${c.key.toLowerCase()}.svg`,
      flagLookalikes: [...(lookalikes.get(c.key) ?? [])].sort(),
    };
  });

  return { countries, warnings };
}
