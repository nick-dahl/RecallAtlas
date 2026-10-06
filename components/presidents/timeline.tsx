/* eslint-disable @next/next/no-img-element -- portraits are small immutable-cached webp files. */
import type { Phase, TileState } from '@/lib/engine';
import type { PresidentRecord } from '@/lib/content/types';
import { masterySummary } from '@/lib/ui/mastery';
import { presidentFacts } from '@/lib/ui/president-facts';
import { TILE_STYLE } from '@/lib/ui/tiles';

type Tile = { key: string; name: string; group: string; tile: TileState; prompts: { label: string; phase: Phase }[] };

/**
 * The US Presidents course home (a reference view, never a question): every president in order,
 * grouped by era, coloured in as he is learned, gold-ringed when mastered.
 */
export function Timeline({ tiles, records }: { tiles: readonly Tile[]; records: readonly PresidentRecord[] }) {
  const byKey = new Map(records.map((r) => [r.key, r]));
  const eras = [...new Set(tiles.map((t) => t.group))];
  return (
    <div className="space-y-10">
      {eras.map((era) => {
        const members = tiles
          .filter((t) => t.group === era)
          .sort((a, b) => byKey.get(a.key)!.numbers[0] - byKey.get(b.key)!.numbers[0]);
        const first = byKey.get(members[0].key)!.startYears[0];
        return (
          <section key={era} className="space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-[.2em] text-ink-soft">
              {era} <span className="normal-case tracking-normal">· from {first}</span>
            </h3>
            <ol className="grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-6">
              {members.map((t) => {
                const record = byKey.get(t.key)!;
                const facts = presidentFacts(record);
                const style = TILE_STYLE[t.tile];
                return (
                  <li key={t.key} data-tile={t.tile} title={masterySummary(t.name, t.prompts)} className="space-y-1.5">
                    <div
                      style={{ filter: style.filter }}
                      className={`transition-[filter] duration-500 ${style.ring ? 'rounded-md ring-2 ring-gold ring-offset-2 ring-offset-paper' : ''}`}
                    >
                      <img
                        src={`/api/portrait-art/${t.key}`}
                        alt={t.name}
                        loading="lazy"
                        decoding="async"
                        className="stamp aspect-[3/4] w-full object-cover"
                      />
                    </div>
                    <p className="font-mono text-[11px] text-ink-soft">
                      {facts.numbers} · {facts.years}
                    </p>
                    <p className="truncate text-xs">{t.name}</p>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
