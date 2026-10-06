/* eslint-disable @next/next/no-img-element -- portraits are small webp data URIs or immutable-cached routes; next/image adds nothing. */

/**
 * A president's portrait in a 3:4 frame (the stamp styling, upright). In questions, ALWAYS pass
 * alt="" (the default): alt text would reveal the answer.
 */
export function Portrait({
  src,
  alt = '',
  eager = false,
  className = '',
}: {
  src: string;
  alt?: string;
  eager?: boolean;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      className={`stamp aspect-[3/4] w-full object-cover ${className}`}
    />
  );
}
