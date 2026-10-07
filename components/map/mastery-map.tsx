import type { Phase, TileState } from '@/lib/engine';
import type { AtlasData } from '@/lib/map/types';
import { MASTERY_LEGEND, MASTERY_STYLE, masterySummary } from '@/lib/ui/mastery';

type Tile = { key: string; name: string; tile: TileState; prompts: { label: string; phase: Phase }[] };

/**
 * The course-home map (reference view, never a question): each country filled by how well it is
 * known, tiny ones as dots, with a per-prompt summary on hover.
 */
export function MasteryMap({ atlas, tiles }: { atlas: AtlasData; tiles: readonly Tile[] }) {
  const learned = tiles.filter((t) => t.tile === 'review' || t.tile === 'strong').length;
  return (
    <figure className="space-y-4">
      <svg
        viewBox={`0 0 ${atlas.width} ${atlas.height}`}
        role="img"
        aria-label={`Mastery map: ${learned} of ${tiles.length} learned`}
        className="map-plate block h-auto w-full rounded-xl"
      >
        <rect width={atlas.width} height={atlas.height} style={{ fill: 'color-mix(in oklab, #6f9fb0 30%, var(--paper))' }} />
        <path d={atlas.land} style={{ fill: 'var(--rule)' }} />
        {tiles.map((t) => {
          const shape = atlas.countries[t.key];
          if (!shape) return null;
          const style = MASTERY_STYLE[t.tile];
          const stroke = style.gold ? 'var(--gold)' : 'color-mix(in oklab, var(--ink-soft) 55%, transparent)';
          return (
            <g key={t.key} data-tile={t.tile} className="transition-opacity hover:opacity-75">
              <title>{masterySummary(t.name, t.prompts)}</title>
              {shape.d && (
                <path
                  d={shape.d}
                  style={{ fill: style.fill, stroke }}
                  strokeWidth={style.gold ? 1.5 : 0.6}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                />
              )}
              {shape.marker && (
                <circle
                  cx={shape.marker.x}
                  cy={shape.marker.y}
                  r={shape.marker.r}
                  style={{ fill: style.fill, stroke: style.gold ? 'var(--gold)' : 'var(--ink-soft)' }}
                  strokeWidth={style.gold ? 1.5 : 0.75}
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-soft">
        {MASTERY_LEGEND.map(({ tile, label }) => (
          <span key={tile} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-3 rounded-sm ring-1"
              style={{
                background: MASTERY_STYLE[tile].fill,
                boxShadow: MASTERY_STYLE[tile].gold ? '0 0 0 1.5px var(--gold)' : undefined,
                ['--tw-ring-color' as string]: 'var(--rule)',
              }}
            />
            {label}
          </span>
        ))}
        <span>Hover a country for its Find and Name progress.</span>
      </figcaption>
    </figure>
  );
}
