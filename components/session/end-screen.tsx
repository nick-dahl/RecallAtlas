'use client';

import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { ItemImage } from '@/components/ui/item-image';
import type { EndView, SessionKind } from '@/lib/study/types';
import { END_COPY, practiceSummary } from '@/lib/ui/copy';

export function EndScreen({
  end,
  slug,
  kind,
  onRestart,
}: {
  end: EndView;
  slug: string;
  kind: SessionKind;
  onRestart: () => void;
}) {
  const copy = END_COPY[end.reason];
  const result = end.examResult;
  return (
    <div className="animate-rise mx-auto max-w-lg space-y-8 text-center">
      {result ? (
        <div className="space-y-5">
          <div className="relative mx-auto w-fit">
            <p className="font-display text-7xl tabular-nums tracking-tight">
              {result.score}
              <span className="text-ink-soft">/{result.total}</span>
            </p>
            {result.passed && (
              <span className="animate-stamp absolute -right-4 -top-10 rounded-md border-4 border-good px-3 py-1 font-display text-2xl font-bold uppercase text-good sm:-right-20 sm:-top-6">
                Passed
              </span>
            )}
          </div>
          {result.passed ? (
            <p className="text-ink-soft">A perfect run, no misses. The course is yours. We’ll keep it fresh with the occasional review.</p>
          ) : (
            <>
              <p className="text-ink-soft">So close. These go back into practice; the exam unlocks again once they stick.</p>
              <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4">
                {result.missed.map((m) => (
                  <li key={m.name} className="space-y-1 text-xs">
                    <ItemImage item={m} labelled />
                    <span>{m.name}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <h2 className="font-display text-4xl tracking-tight">{copy.title}</h2>
          <p className="text-ink-soft">{end.practiceResult ? practiceSummary(end.practiceResult) : copy.body}</p>
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        <Link href={`/courses/${slug}`} className={buttonClass('primary')}>
          Back to course
        </Link>
        {kind === 'study' && (end.reason === 'complete' || end.reason === 'more_new_available') && (
          <button type="button" onClick={onRestart} className={buttonClass('secondary')}>
            Another session
          </button>
        )}
        {kind === 'study' && end.reason === 'practice_complete' && (
          <button type="button" onClick={onRestart} className={buttonClass('secondary')}>
            Another check
          </button>
        )}
        {kind === 'study' && end.reason === 'nothing_to_practice' && (
          <Link href={`/courses/${slug}/study`} className={buttonClass('secondary')}>
            Study
          </Link>
        )}
        {kind === 'study' && end.reason === 'caught_up' && (
          <Link href={`/courses/${slug}/study?mode=practice-ahead`} className={buttonClass('secondary')}>
            Practice ahead
          </Link>
        )}
      </div>
    </div>
  );
}
