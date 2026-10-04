export function ReadinessMeter({ graduated, total }: { graduated: number; total: number }) {
  const pct = total ? Math.round((graduated / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div
        className="h-2 overflow-hidden rounded-full bg-rule"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Readiness"
      >
        <div className="h-full rounded-full bg-good transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>
      <p className="font-mono text-xs tabular-nums text-ink-soft">
        {graduated} / {total} prompts learned · exam unlocks at 100%
      </p>
    </div>
  );
}
