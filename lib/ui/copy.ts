import type { EnrollmentStatus } from '@/lib/engine';

export const STATUS_LABEL: Record<EnrollmentStatus, string> = {
  placement: 'Placement',
  learning: 'Learning',
  exam_ready: 'Exam ready',
  passed: 'Passed',
};
