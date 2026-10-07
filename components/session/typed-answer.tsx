'use client';

import { useState, type FormEvent } from 'react';
import { buttonClass } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Prompt } from './prompt';
import type { RendererProps } from './types';
import { useHotkeys } from './use-hotkeys';

const INPUT: Record<string, { label: string; placeholder: string; numeric?: boolean }> = {
  name: { label: 'Country name', placeholder: 'Type the country…' },
  capital: { label: 'Capital', placeholder: 'Type the capital…' },
  president: { label: 'President', placeholder: 'Type the president…' },
  country: { label: 'Country name', placeholder: 'Type the country…' },
  year: { label: 'Year', placeholder: 'Type the year…', numeric: true },
  title: { label: 'Painting title', placeholder: 'Type the title…' },
  artist: { label: 'Artist', placeholder: 'Type the artist…' },
};

/** Recall: type the country's name (or, for map Capital questions, its capital). Esc = "I don't know". */
export function TypedAnswer({ view, locked, feedback, onAnswer }: RendererProps) {
  const [text, setText] = useState('');
  const { label, placeholder, numeric } = INPUT[view.prompt.asks ?? 'name'] ?? INPUT.name;
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
          aria-label={label}
          inputMode={numeric ? 'numeric' : undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={locked}
          placeholder={placeholder}
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
