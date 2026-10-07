import { MapFrame } from '@/components/map/map-frame';
import { Flag } from '@/components/ui/flag';
import { Portrait } from '@/components/ui/portrait';
import { GapChain } from './gap-chain';
import type { FeedbackView, QuestionView } from '@/lib/study/types';

/**
 * Flag → Name shows the flag (alt="" so the DOM doesn't give it away); Name → Flag shows the name.
 * Map Name/Capital questions show the country hatched on its region map; feedback outlines the
 * right country (and the one answered) on the same map.
 */
export function Prompt({ view, feedback = null }: { view: QuestionView; feedback?: FeedbackView | null }) {
  if (view.map) {
    return (
      <div className="space-y-5 text-center">
        <MapFrame
          map={view.map}
          maxHeight={view.map.locator ? '28vh' : '44vh'}
          highlight={view.map.highlight}
          correct={feedback && !feedback.correct ? feedback.map?.correct : undefined}
          given={feedback?.map?.given}
        />
        <h2 className="font-display text-3xl tracking-tight md:text-4xl">{view.prompt.question}</h2>
      </div>
    );
  }
  const { question, portrait, gap } = view.prompt;
  if (question !== undefined) {
    // US Presidents: a portrait to name, a name to find, or a gap in the sequence.
    return (
      <div className="space-y-5 text-center">
        {portrait && (
          <div className="mx-auto w-36 sm:w-44">
            <Portrait src={portrait} eager />
          </div>
        )}
        {gap && <GapChain gap={gap} filled={feedback && !feedback.correct ? feedback.answer.name : undefined} />}
        <h2 className="font-display text-3xl tracking-tight md:text-4xl">{question}</h2>
      </div>
    );
  }
  if (view.prompt.flag && !view.prompt.name) {
    return (
      <div className="mx-auto w-full max-w-xs space-y-4 text-center">
        <p className="text-sm text-ink-soft">Which country flies this flag?</p>
        <Flag src={view.prompt.flag} eager />
      </div>
    );
  }
  return (
    <div className="space-y-1 text-center">
      <p className="text-sm text-ink-soft">Find the flag of</p>
      <h2 className="font-display text-4xl tracking-tight md:text-5xl">{view.prompt.name}</h2>
    </div>
  );
}
