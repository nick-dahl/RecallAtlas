'use client';

import { buttonClass } from '@/components/ui/button';
import { Flag } from '@/components/ui/flag';
import { Kbd } from '@/components/ui/kbd';
import type { FeedbackView } from '@/lib/study/types';
import { useHotkeys } from './use-hotkeys';

export function FeedbackPanel({ feedback, onContinue }: { feedback: FeedbackView; onContinue: () => void }) {
  useHotkeys({ Enter: onContinue });
  return (
    <div
      data-testid="feedback"
      data-correct={feedback.correct}
      role="status"
      className={`animate-rise mx-auto mt-10 flex max-w-xl items-center gap-4 rounded-2xl p-4 ${feedback.correct ? 'bg-good-soft' : 'bg-bad-soft'}`}
    >
      <div className="w-16 shrink-0">
        <Flag src={feedback.answer.flag} eager />
      </div>
      <div className="flex-1 text-sm">
        {feedback.correct ? (
          <p className="font-semibold text-good">
            Correct{feedback.typo ? `. It’s spelled “${feedback.answer.name}”` : ''}
          </p>
        ) : (
          <>
            <p className="font-semibold text-bad">Not quite: it’s {feedback.answer.name}</p>
            {feedback.given && <p className="text-ink-soft">You answered {feedback.given.name}.</p>}
          </>
        )}
      </div>
      {!feedback.correct && (
        <button type="button" onClick={onContinue} className={buttonClass('secondary')}>
          Continue <Kbd>↵</Kbd>
        </button>
      )}
    </div>
  );
}
