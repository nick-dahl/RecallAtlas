import type { AnswerResponse, FeedbackView, QuestionView } from '@/lib/study/types';

export interface RendererProps {
  view: QuestionView;
  /** True while submitting or showing feedback. */
  locked: boolean;
  feedback: FeedbackView | null;
  chosenId: string | null;
  onAnswer: (response: AnswerResponse, chosenId?: string | null) => void;
}
