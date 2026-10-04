import type { EnrollmentStatus } from '@/lib/engine';
import { STATUS_LABEL } from '@/lib/ui/copy';

const TONE: Record<EnrollmentStatus, string> = {
  placement: 'bg-rule text-ink',
  learning: 'bg-learning/15 text-learning',
  exam_ready: 'bg-accent/15 text-accent',
  passed: 'bg-good/15 text-good',
};

export function StatusPill({ status }: { status: EnrollmentStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-[.15em] ${TONE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
