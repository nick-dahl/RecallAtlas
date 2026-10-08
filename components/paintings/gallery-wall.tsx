/* eslint-disable @next/next/no-img-element -- short-cached webp thumbnails; next/image adds nothing. */
import Link from 'next/link';
import type { WallTile } from '@/lib/ui/gallery';
import { TILE_STYLE } from '@/lib/ui/tiles';

/** The Great Paintings course home (a reference view): movement rooms, paintings coloured in as learned. */
export function GalleryWall({ rooms, slug }: { rooms: { movement: string; tiles: WallTile[] }[]; slug: string }) {
  return (
    <div className="space-y-10">
      {rooms.map((room) => (
        <section key={room.movement} className="space-y-3">
          <h3 className="font-display text-lg">{room.movement}</h3>
          <ul className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-5 md:grid-cols-7">
            {room.tiles.map((t) => {
              const style = TILE_STYLE[t.tile];
              return (
                <li key={t.rank} data-tile={t.tile} title={t.summary} className="min-w-0 space-y-1">
                  <Link href={`/courses/${slug}/painting/${t.rank}`} className="block">
                    <div
                      style={{ filter: style.filter }}
                      className={`flex aspect-square items-center justify-center rounded-md bg-raised p-1.5 ring-1 ring-rule transition-[filter] duration-500 ${style.ring ? 'ring-2 ring-gold' : ''}`}
                    >
                      <img
                        src={`/api/painting-art/${t.rank}?size=thumb`}
                        alt={t.label?.title ?? ''}
                        loading="lazy"
                        decoding="async"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  </Link>
                  {t.label && (
                    <>
                      <p className="truncate text-xs italic">{t.label.title}</p>
                      <p className="truncate text-[11px] text-ink-soft">{t.label.artist}</p>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
