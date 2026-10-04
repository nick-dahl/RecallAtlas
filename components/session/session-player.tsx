'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  endStudyAction,
  startExamAction,
  startPlacementAction,
  startStudyAction,
  submitExamAction,
  submitPlacementAction,
  submitStudyAction,
  type ActionError,
  type ActionResult,
} from '@/app/actions/course';
import { buttonClass } from '@/components/ui/button';
import { ProgressRoute } from '@/components/ui/progress-route';
import type { AnswerResponse, EndView, FeedbackView, QuestionView, SessionKind, TurnResult } from '@/lib/study/types';
import { errorMessage } from '@/lib/ui/copy';
import { EndScreen } from './end-screen';
import { QuestionStage } from './question-stage';

type StudyOptions = { mode?: string; size?: number };

type Phase =
  | { name: 'loading' }
  | { name: 'question'; view: QuestionView; busy: boolean }
  | { name: 'feedback'; view: QuestionView; feedback: FeedbackView; chosenId: string | null; result: TurnResult }
  | { name: 'end'; end: EndView }
  | { name: 'error'; message: string; retry: (() => void) | null };

const AUTO_ADVANCE_MS = 700;
const RESUMABLE: ReadonlySet<ActionError> = new Set(['stale_question', 'stale_session', 'no_active_session']);
const KIND_LABEL: Record<SessionKind, string> = { study: 'Study', placement: 'Placement', exam: 'Final exam' };

function startFor(kind: SessionKind, slug: string, options?: StudyOptions): Promise<ActionResult<TurnResult>> {
  if (kind === 'study') return startStudyAction(slug, options);
  if (kind === 'placement') return startPlacementAction(slug);
  return startExamAction(slug);
}

function submitFor(kind: SessionKind, slug: string, input: unknown): Promise<ActionResult<TurnResult>> {
  if (kind === 'study') return submitStudyAction(slug, input);
  if (kind === 'placement') return submitPlacementAction(slug, input);
  return submitExamAction(slug, input);
}

/**
 * Runs one session against the server actions. Starts via a POST action on mount (never on GET).
 * Correct answers auto-advance; misses wait for Continue/Enter; exams show no feedback.
 */
export function SessionPlayer({ slug, kind, options }: { slug: string; kind: SessionKind; options?: StudyOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>({ name: 'loading' });
  const timer = useRef<number | null>(null);
  const started = useRef(false);

  const clearTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  const advance = (result: TurnResult) => {
    clearTimer();
    if (result.next) setPhase({ name: 'question', view: result.next, busy: false });
    else setPhase({ name: 'end', end: result.end ?? { reason: 'complete' } });
  };

  const show = (result: TurnResult, view: QuestionView | null, chosenId: string | null) => {
    if (result.feedback && view) {
      setPhase({ name: 'feedback', view, feedback: result.feedback, chosenId, result });
      if (result.feedback.correct) timer.current = window.setTimeout(() => advance(result), AUTO_ADVANCE_MS);
      return;
    }
    advance(result);
  };

  const fail = (error: ActionError) => {
    if (error === 'unauthorized') {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (RESUMABLE.has(error)) {
      void begin();
      return;
    }
    setPhase({ name: 'error', message: errorMessage(error), retry: null });
  };

  async function begin() {
    clearTimer();
    try {
      const result = await startFor(kind, slug, options);
      if (result.ok) show(result.data, null, null);
      else fail(result.error);
    } catch {
      setPhase({ name: 'error', message: 'Couldn’t reach the server.', retry: () => void begin() });
    }
  }

  async function answer(view: QuestionView, response: AnswerResponse, chosenId: string | null = null) {
    setPhase({ name: 'question', view, busy: true });
    try {
      const result = await submitFor(kind, slug, { sessionId: view.sessionId, questionId: view.questionId, response });
      if (result.ok) show(result.data, view, chosenId);
      else fail(result.error);
    } catch {
      setPhase({
        name: 'error',
        message: 'Couldn’t save that answer. Check your connection.',
        retry: () => void answer(view, response, chosenId),
      });
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void begin();
    return clearTimer;
    // Runs once per mount; the page remounts the player (via `key`) when options change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leave = async () => {
    if (kind === 'study') await endStudyAction(slug);
    router.push(`/courses/${slug}`);
  };

  const progress =
    phase.name === 'question' ? phase.view.progress : phase.name === 'feedback' ? (phase.result.next?.progress ?? phase.view.progress) : null;

  return (
    <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-5 pb-12">
      <header className="flex items-center gap-4 py-5">
        {kind === 'exam' || kind === 'placement' ? (
          <Link href={`/courses/${slug}`} className={buttonClass('ghost', 'px-0')}>
            ✕ Pause
          </Link>
        ) : (
          <button type="button" onClick={leave} className={buttonClass('ghost', 'px-0')}>
            ✕ End
          </button>
        )}
        <div className="flex-1">{progress && <ProgressRoute answered={progress.answered} total={progress.total} />}</div>
        <span className="font-mono text-xs uppercase tracking-[.2em] text-ink-soft">{KIND_LABEL[kind]}</span>
      </header>

      <main className="flex flex-1 flex-col justify-center py-6">
        {phase.name === 'loading' && <p className="animate-pulse text-center text-ink-soft">Shuffling the deck…</p>}

        {phase.name === 'error' && (
          <div className="mx-auto max-w-md space-y-4 text-center">
            <p>{phase.message}</p>
            <div className="flex justify-center gap-3">
              {phase.retry && (
                <button type="button" onClick={phase.retry} className={buttonClass('primary')}>
                  Retry
                </button>
              )}
              <Link href={`/courses/${slug}`} className={buttonClass('secondary')}>
                Back to course
              </Link>
            </div>
          </div>
        )}

        {phase.name === 'end' && <EndScreen end={phase.end} slug={slug} kind={kind} onRestart={() => void begin()} />}

        {(phase.name === 'question' || phase.name === 'feedback') && (
          <QuestionStage
            key={phase.view.questionId}
            view={phase.view}
            locked={phase.name === 'feedback' || phase.busy}
            feedback={phase.name === 'feedback' ? phase.feedback : null}
            chosenId={phase.name === 'feedback' ? phase.chosenId : null}
            onAnswer={(response, chosenId) => void answer(phase.view, response, chosenId ?? null)}
            onContinue={() => phase.name === 'feedback' && advance(phase.result)}
          />
        )}
      </main>
    </div>
  );
}
