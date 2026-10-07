import type { ActionError } from '@/app/actions/course';
import type { EnrollmentStatus } from '@/lib/engine';
import type { EndReason } from '@/lib/study/types';

export const STATUS_LABEL: Record<EnrollmentStatus, string> = {
  placement: 'Placement',
  learning: 'Learning',
  exam_ready: 'Exam ready',
  passed: 'Passed',
};

/** Dashboard card copy for courses not yet started. */
export const COURSE_BLURB: Record<string, string> = {
  'world-flags': 'All 197 flags, from Andorra to Zimbabwe.',
  'world-map': 'Find 208 countries and territories on the map, and name them from their shape.',
  'world-capitals': 'The capitals of all 197 countries, both ways round.',
  'us-presidents': 'All 45 presidents: in order, by face, by year and by party.',
};

export const END_COPY: Record<EndReason, { title: string; body: string }> = {
  complete: { title: 'Session complete', body: 'Nice work. Your next reviews are already scheduled.' },
  caught_up: { title: 'All caught up', body: 'Nothing is due right now. Practice ahead, or come back later.' },
  come_back_later: {
    title: 'That’s enough for now',
    body: 'What’s left needs a little time before it sticks. Come back later.',
  },
  more_new_available: { title: 'Session complete', body: 'Ready for more? Start another session to meet new ones.' },
  placement_complete: { title: 'Placement done', body: 'We know where you stand. Time to learn the rest.' },
  exam_finished: { title: 'Exam finished', body: '' },
  practice_complete: { title: 'Check complete', body: '' },
  nothing_to_practice: {
    title: 'Nothing to check yet',
    body: 'Practice ahead checks what you have already learned. Learn a few first, then come back to see what stuck.',
  },
};

/** The end-of-check summary for a practice-ahead session. */
export function practiceSummary({ checked, remembered }: { checked: number; remembered: number }): string {
  const slipped = checked - remembered;
  if (slipped === 0) return `You remembered all ${checked}. Everything stuck.`;
  const back = slipped === 1 ? 'The one that slipped is' : `The ${slipped} that slipped are`;
  return `You remembered ${remembered} of ${checked}. ${back} back in your learning queue.`;
}

/** Messages for errors the player can't recover from by itself (stale/unauthorized are handled in code). */
export function errorMessage(code: ActionError): string {
  switch (code) {
    case 'not_enrolled':
      return 'Enroll in this course first.';
    case 'placement_pending':
      return 'Finish or skip placement before studying.';
    case 'placement_done':
      return 'Placement is already done.';
    case 'exam_in_progress':
      return 'You have an exam in progress. Finish it before studying.';
    case 'exam_not_ready':
      return 'The exam unlocks once every prompt has been learned.';
    case 'invalid_response':
      return 'Something got out of sync. Please reload.';
    case 'unknown_course':
      return 'That course doesn’t exist.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
