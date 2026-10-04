/* eslint-disable @next/next/no-img-element -- flags are tiny SVG data URIs or immutable-cached routes; next/image adds nothing. */

/**
 * A flag rendered as a stamp. In questions, ALWAYS pass alt="" (the default):
 * alt text would reveal the answer to screen readers and to anyone reading the DOM.
 */
export function Flag({
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
      className={`stamp aspect-[4/3] w-full object-cover ${className}`}
    />
  );
}
