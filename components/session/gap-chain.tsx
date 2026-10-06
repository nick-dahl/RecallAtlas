/** Fill the gap: `before → ? → after`. After feedback the gap shows the answer. */
export function GapChain({ gap, filled }: { gap: { before?: string; after?: string }; filled?: string }) {
  const cell = 'min-w-0 flex-1 rounded-xl px-3 py-3 text-center text-sm font-medium sm:text-base';
  const end = (name: string | undefined) =>
    name ? <span className={`${cell} bg-raised ring-1 ring-rule`}>{name}</span> : <span className={`${cell} text-ink-soft`}>—</span>;
  return (
    <div className="mx-auto flex max-w-2xl items-center gap-2" aria-label="Sequence">
      {end(gap.before)}
      <span aria-hidden="true" className="text-ink-soft">→</span>
      <span
        data-gap
        className={`${cell} border-2 border-dashed ${filled ? 'border-good bg-good-soft' : 'border-accent text-accent'}`}
      >
        {filled ?? '?'}
      </span>
      <span aria-hidden="true" className="text-ink-soft">→</span>
      {end(gap.after)}
    </div>
  );
}
