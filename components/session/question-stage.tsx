'use client';

import type { ComponentType } from 'react';
import type { Format } from '@/lib/engine';
import { ChoiceList } from './choice-list';
import { ContrastDrill } from './contrast-drill';
import { FeedbackPanel } from './feedback-panel';
import { FlagGrid } from './flag-grid';
import { IntroCard } from './intro-card';
import { TypedAnswer } from './typed-answer';
import type { RendererProps } from './types';

const RENDERERS: Record<Format, ComponentType<RendererProps>> = {
  intro: IntroCard,
  'mc-text': ChoiceList,
  'flag-grid': FlagGrid,
  typed: TypedAnswer,
  contrast: ContrastDrill,
  // Interim until the World Map renderers land (Plan 6); no map course reaches the player yet.
  'map-pick': ChoiceList,
  'map-click': TypedAnswer,
};

export function QuestionStage(props: RendererProps & { onContinue: () => void }) {
  const { view, feedback, onContinue } = props;
  const Renderer = RENDERERS[view.format];
  return (
    <section data-question-id={view.questionId} data-format={view.format} className="animate-rise">
      <Renderer {...props} />
      {feedback && <FeedbackPanel feedback={feedback} onContinue={onContinue} />}
    </section>
  );
}
