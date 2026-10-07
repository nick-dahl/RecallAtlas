import type { Phase, TileState } from '@/lib/engine';
import { capitalCardText } from '@/lib/ui/capital-card';
import { masterySummary } from '@/lib/ui/mastery';
import { groupTiles } from '@/lib/ui/tiles';

type Tile = { key: string; name: string; group: string; tile: TileState; prompts: { label: string; phase: Phase }[] };

const CARD: Record<TileState, string> = {
  new: 'bg-raised/60 text-ink-soft ring-1 ring-rule',
  'learning-1': 'bg-learning/10 ring-1 ring-learning/30',
  'learning-2': 'bg-learning/20 ring-1 ring-learning/40',
  'learning-3': 'bg-learning/30 ring-1 ring-learning/50',
  review: 'bg-good-soft ring-1 ring-good/50',
  strong: 'bg-good-soft ring-2 ring-gold',
};

/**
 * The World Capitals course home (a reference view, never a question): "Country · Capital" cards
 * by region, coloured in as they are learned. A capital stays "?" until the country is introduced,
 * so the page is not a cheat sheet for what is still to learn.
 */
export function CapitalList({ tiles, capitals }: { tiles: readonly Tile[]; capitals: Record<string, string> }) {
  return (
    <div className="space-y-8">
      {groupTiles(tiles).map((g) => (
        <section key={g.group} className="space-y-3">
          <h3 className="font-mono text-xs uppercase tracking-[.2em] text-ink-soft">{g.group}</h3>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {g.tiles.map((t) => (
              <li
                key={t.key}
                data-tile={t.tile}
                title={masterySummary(t.name, t.prompts)}
                className={`rounded-xl px-3 py-2 transition-colors duration-500 ${CARD[t.tile]}`}
              >
                <p className="truncate text-sm font-medium">{t.name}</p>
                <p className="truncate font-display text-base">{capitalCardText(t.tile, capitals[t.key])}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
