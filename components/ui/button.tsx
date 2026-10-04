export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold ' +
  'transition-[transform,background-color,box-shadow,color] duration-150 motion-safe:active:scale-[.97] ' +
  'disabled:pointer-events-none disabled:opacity-50 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink shadow-[0_8px_18px_-10px_var(--accent)] hover:brightness-105',
  secondary: 'bg-raised text-ink ring-1 ring-rule hover:ring-ink-soft',
  ghost: 'text-ink-soft hover:text-ink',
};

/** Class string for buttons and button-styled links. */
export function buttonClass(variant: ButtonVariant = 'primary', extra = ''): string {
  return `${BASE} ${VARIANTS[variant]} ${extra}`.trim();
}
