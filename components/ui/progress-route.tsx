export function ProgressRoute({ answered, total }: { answered: number; total: number }) {
  const pct = total ? Math.min(100, (answered / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-rule" aria-label={`${answered} of ${total} answered`}>
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs tabular-nums text-ink-soft">
        {answered}/{total}
      </span>
    </div>
  );
}
