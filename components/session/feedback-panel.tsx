'use client';

import { buttonClass } from '@/components/ui/button';
import { Flag } from '@/components/ui/flag';
import { Kbd } from '@/components/ui/kbd';
import { itemImage } from '@/lib/ui/item-image';
import type { FeedbackView, QuestionView } from '@/lib/study/types';
import { useHotkeys } from './use-hotkeys';

/** What went right or wrong, in the terms of the question that was asked. */
function message(view: QuestionView, f: FeedbackView): { headline: string; detail?: string } {
  const { answer, given } = f;
  const onMap = view.format === 'map-click' || view.format === 'map-pick';
  if (view.prompt.asks === 'capital') {
    if (f.correct) return { headline: f.typo ? `Correct. It’s spelled “${answer.capital}”` : `Correct: ${answer.capital}` };
    return {
      headline: `Not quite: the capital of ${answer.name} is ${answer.capital}`,
      detail: given?.capital ? `${given.capital} is the capital of ${given.name}.` : undefined,
    };
  }
  if (f.correct) return { headline: f.typo ? `Correct. It’s spelled “${answer.name}”` : 'Correct' };
  if (onMap) {
    return {
      headline: given ? `That’s ${given.name}` : `Not quite: that’s not ${answer.name}`,
      detail: `${answer.name} is the one outlined in green.`,
    };
  }
  return { headline: `Not quite: it’s ${answer.name}`, detail: given ? `You answered ${given.name}.` : undefined };
}

export function FeedbackPanel({
  view,
  feedback,
  onContinue,
}: {
  view: QuestionView;
  feedback: FeedbackView;
  onContinue: () => void;
}) {
  useHotkeys({ Enter: onContinue });
  const { headline, detail } = message(view, feedback);
  const note = view.prompt.asks === 'capital' ? feedback.answer.capitalNote : undefined;
  const relearn = feedback.outcome === 'lapsed' ? 'It’s back in your learning queue.' : undefined;
  return (
    <div
      data-testid="feedback"
      data-correct={feedback.correct}
      role="status"
      className={`animate-rise mx-auto mt-8 flex max-w-xl items-center gap-4 rounded-2xl p-4 ${feedback.correct ? 'bg-good-soft' : 'bg-bad-soft'}`}
    >
      <div className="w-16 shrink-0">
        <Flag src={itemImage(feedback.answer)} eager />
      </div>
      <div className="flex-1 space-y-0.5 text-sm">
        <p className={`font-semibold ${feedback.correct ? 'text-good' : 'text-bad'}`}>{headline}</p>
        {detail && <p className="text-ink-soft">{detail}</p>}
        {note && <p className="text-ink-soft">{note}</p>}
        {relearn && <p className="text-ink-soft">{relearn}</p>}
      </div>
      {!feedback.correct && (
        <button type="button" onClick={onContinue} className={buttonClass('secondary')}>
          Continue <Kbd>↵</Kbd>
        </button>
      )}
    </div>
  );
}
