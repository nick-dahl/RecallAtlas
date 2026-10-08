/* eslint-disable @next/next/no-img-element -- paintings are webp data URIs or short-cached routes; next/image adds nothing. */

/**
 * A painting, never cropped: letterboxed on a mat, with a "Detail" badge when only part is shown.
 * In questions ALWAYS leave alt="" (the default): alt text would reveal the answer.
 * `fit="square"` gives grid and wall tiles one shape, whatever the painting's proportions.
 */
export function Painting({
  src,
  alt = '',
  eager = false,
  detail = false,
  fit = 'natural',
  maxHeight,
  className = '',
}: {
  src: string;
  alt?: string;
  eager?: boolean;
  detail?: boolean;
  fit?: 'natural' | 'square';
  maxHeight?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative flex items-center justify-center rounded-md bg-raised p-2 ring-1 ring-rule ${fit === 'square' ? 'aspect-square' : ''} ${className}`}
    >
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        style={maxHeight ? { maxHeight } : undefined}
        className={`max-w-full object-contain shadow-sm ${fit === 'square' ? 'max-h-full' : 'h-auto'}`}
      />
      {detail && (
        <span className="absolute bottom-3 right-3 rounded bg-paper/90 px-1.5 py-0.5 text-[10px] font-medium text-ink-soft">
          Detail
        </span>
      )}
    </div>
  );
}
