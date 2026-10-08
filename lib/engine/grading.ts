import { ENGINE_CONFIG } from './config';
import type { AnswerGrade, Item } from './types';

export function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    // A leading article, but not an initial: "A Bar at…" loses "A"; "A. Johnson" and "A Johnson" keep it.
    .replace(/^(an?)\s+(?=\S+\s+\S)/, '')
    .replace(/&/g, ' and ')
    .replace(/['‘’ʼ´`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the /, '')
    .replace(/\bst\b/g, 'saint');
}

/** Optimal string alignment distance: Levenshtein plus adjacent transposition as a single edit. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) d[i][0] = i;
  for (let j = 0; j < cols; j++) d[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[rows - 1][cols - 1];
}

function tolerance(normalizedName: string): number {
  return normalizedName.length < ENGINE_CONFIG.typoLongMinLength
    ? ENGINE_CONFIG.typoShortMax
    : ENGINE_CONFIG.typoLongMax;
}

/** Display values an answer field accepts, the displayed one first ('name' = name + aliases). */
export function acceptedAnswers(item: Item, field: string): string[] {
  const answer = field === 'name' ? { text: item.name, aliases: item.aliases } : item.answers?.[field];
  return answer ? [answer.text, ...answer.aliases] : [];
}

/** Accepted spellings of `item` for an answer field, normalized. */
function namesOf(item: Item, field: string): string[] {
  return acceptedAnswers(item, field).map(normalize).filter(Boolean);
}

/** Smallest edit distance to any of the item's names that is within tolerance, else null. */
function typoDistance(input: string, item: Item, field: string): number | null {
  let best: number | null = null;
  for (const name of namesOf(item, field)) {
    const d = editDistance(input, name);
    if (d <= tolerance(name) && (best === null || d < best)) best = d;
  }
  return best;
}

function wrong(answeredItemKey: string | null = null): AnswerGrade {
  return { correct: false, typo: false, answeredItemKey };
}

/**
 * Who an exact wrong answer is a mix-up with. It's the answer's only owner if there's one;
 * otherwise (an artist with several works) a look-alike of the target among them; otherwise
 * nobody. Exact-match fields (years) never guess between owners.
 */
export function blameFor(owners: readonly Item[], target: Item, exact?: boolean): string | null {
  if (owners.length === 1) return owners[0].key;
  if (exact) return null;
  return target.lookalikes.find((k) => owners.some((o) => o.key === k)) ?? null;
}

/**
 * Grades typed text against `field` ('name', or an `Item.answers` key such as 'capital').
 * `exact` turns off typo tolerance (years); an exact miss is a mix-up only when the answer
 * belongs to exactly one other item.
 */
export function gradeTyped(
  input: string,
  target: Item,
  allItems: readonly Item[],
  field = 'name',
  opts: { exact?: boolean; ambiguous?: readonly string[] } = {},
): AnswerGrade {
  const n = normalize(input);
  if (!n) return wrong();
  if (namesOf(target, field).includes(n)) return { correct: true, typo: false, answeredItemKey: null };
  // A form that names no one in particular is never right, and never blamed on one namesake.
  if (opts.ambiguous?.some((a) => normalize(a) === n)) return wrong();

  // An item that accepts one of the target's own answers (another work by the same artist) gives the
  // same answer, so it is not a rival: it must neither win a typo tie nor be blamed for a miss.
  const targetNames = new Set(namesOf(target, field));
  const others = allItems.filter((i) => i.key !== target.key && !namesOf(i, field).some((n) => targetNames.has(n)));
  const exactOthers = others.filter((i) => namesOf(i, field).includes(n));
  if (exactOthers.length > 0) return wrong(blameFor(exactOthers, target, opts.exact));
  if (opts.exact) return wrong();

  const targetDistance = typoDistance(n, target, field);
  let closestOther: { key: string; d: number } | null = null;
  for (const other of others) {
    const d = typoDistance(n, other, field);
    if (d !== null && (closestOther === null || d < closestOther.d)) closestOther = { key: other.key, d };
  }

  // Another item within tolerance wins ties (spec §6.9).
  if (targetDistance !== null && (closestOther === null || targetDistance < closestOther.d)) {
    return { correct: true, typo: true, answeredItemKey: null };
  }
  if (closestOther) return wrong(closestOther.key);
  return wrong();
}

export function gradeChoice(choiceKey: string | null, targetKey: string): AnswerGrade {
  if (choiceKey === null) return wrong();
  if (choiceKey === targetKey) return { correct: true, typo: false, answeredItemKey: null };
  return wrong(choiceKey);
}
