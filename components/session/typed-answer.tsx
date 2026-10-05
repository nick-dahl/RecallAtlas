'use client';

import { useState, type FormEvent } from 'react';
import { buttonClass } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Prompt } from './prompt';
import type { RendererProps } from './types';
import { useHotkeys } from './use-hotkeys';

/** Recall: type the country's name (or, for map Capital questions, its capital). Esc = "I don't know". */
export function TypedAnswer({ view, locked, feedback, onAnswer }: RendererProps) {
  const [text, setText] = useState('');
  const capital = view.prompt.asks === 'capital';
  useHotkeys({ Escape: () => !locked && onAnswer({ kind: 'dont-know' }) }, !locked);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!locked && text.trim()) onAnswer({ kind: 'typed', text });
  };
  const tone = !feedback
    ? 'ring-rule focus:ring-accent'
    : feedback.correct
      ? 'ring-good bg-good-soft animate-pop'
      : 'ring-bad bg-bad-soft animate-shake';

  return (
    <div className="space-y-8">
      <Prompt view={view} feedback={feedback} />
      <form onSubmit={submit} className="mx-auto flex max-w-md flex-col gap-3">
        <input
          autoFocus
          aria-label={capital ? 'Capital' : 'Country name'}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={locked}
          placeholder={capital ? 'Type the capital…' : 'Type the country…'}
          className={`rounded-2xl bg-raised px-5 py-4 text-lg outline-none ring-2 transition ${tone}`}
        />
        <div className="flex items-center justify-between text-sm text-ink-soft">
          <button
            type="button"
            disabled={locked}
            onClick={() => onAnswer({ kind: 'dont-know' })}
            className="flex items-center gap-2 hover:text-ink"
          >
            I don’t know <Kbd>Esc</Kbd>
          </button>
          <button type="submit" disabled={locked || !text.trim()} className={buttonClass('primary')}>
            Check <Kbd>↵</Kbd>
          </button>
        </div>
      </form>
    </div>
  );
}
