import { Flag } from '@/components/ui/flag';
import type { QuestionView } from '@/lib/study/types';

/** Flag → Name shows the flag (alt="" so the DOM doesn't give it away); Name → Flag shows the name. */
export function Prompt({ view }: { view: QuestionView }) {
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
