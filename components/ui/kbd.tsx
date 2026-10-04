import type { ReactNode } from 'react';

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      aria-hidden="true"
      className="rounded border border-rule bg-paper px-1.5 py-0.5 font-mono text-[11px] leading-none text-ink-soft"
    >
      {children}
    </kbd>
  );
}
