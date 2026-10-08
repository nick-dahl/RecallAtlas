'use client';

import { MapFrame } from '@/components/map/map-frame';
import { buttonClass } from '@/components/ui/button';
import { ItemImage } from '@/components/ui/item-image';
import { Kbd } from '@/components/ui/kbd';
import type { FeedbackView, QuestionView } from '@/lib/study/types';
import { useHotkeys } from './use-hotkeys';
import { paintingFeedback } from '@/lib/ui/painting-feedback';
import { presidentFacts } from '@/lib/ui/president-facts';

/** What went right or wrong, in the terms of the question that was asked. */
function message(view: QuestionView, f: FeedbackView): { headline: string; detail?: string } {
  const { answer, given } = f;
  const onMap = view.format === 'map-click' || view.format === 'map-pick';
  if (answer.painting) return paintingFeedback(view.prompt.asks, f);
  if (view.format === 'order') {
    if (f.correct) return { headline: 'Correct order' };
    return { headline: 'Not quite', detail: `The right order: ${(f.order ?? []).join(' → ')}` };
  }
  if (view.prompt.asks === 'year' && answer.startYears) {
    const years = presidentFacts({ numbers: [], startYears: answer.startYears, party: '' }).years;
    if (f.correct && !f.typo) return { headline: `Correct: ${answer.name} took office in ${years}` };
    return {
      headline: `Not quite: ${answer.name} took office in ${years}`,
      detail: given?.startYears ? `${given.startYears.join(' & ')} was ${given.name}.` : undefined,
    };
  }
  if (view.prompt.asks === 'country' && answer.capital) {
    const pair = `${answer.capital} is the capital of ${answer.name}`;
    if (f.correct) return { headline: `Correct: ${pair}` };
    return {
      headline: `Not quite: ${pair}`,
      detail: given?.capital ? `${given.capital} is the capital of ${given.name}.` : undefined,
    };
  }
  if (view.prompt.asks === 'party' && answer.party) {
    return { headline: `${f.correct ? 'Correct' : 'Not quite'}: ${answer.name} was ${answer.party}` };
  }
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
  const note = view.prompt.asks === 'capital' || view.prompt.asks === 'country' ? feedback.answer.capitalNote : undefined;
  // A question with no map of its own (capital → country) shows where the country is here.
  const map = !view.map && feedback.map ? feedback.map : undefined;
  const relearn = feedback.outcome === 'lapsed' ? 'It’s back in your learning queue.' : undefined;
  return (
    <>
      <div
        data-testid="feedback"
        data-correct={feedback.correct}
        role="status"
        className={`animate-rise mx-auto mt-8 flex max-w-xl items-center gap-4 rounded-2xl p-4 ${feedback.correct ? 'bg-good-soft' : 'bg-bad-soft'}`}
      >
        <div className="w-16 shrink-0">
          <ItemImage item={feedback.answer} eager />
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
      {map && (
        <div className="animate-rise mx-auto mt-3 max-w-xl">
          <MapFrame
            map={{ baseUrl: map.baseUrl, width: map.width, height: map.height }}
            maxHeight="24vh"
            correct={map.correct}
            given={map.given}
          />
        </div>
      )}
    </>
  );
}
