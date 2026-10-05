'use client';
/* eslint-disable @next/next/no-img-element -- the base map is an immutable static SVG; next/image adds nothing. */

import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { ChoiceState } from '@/components/session/choice-state';
import type { MapView } from '@/lib/study/types';
import { moveCursor, normalizePoint } from './geometry';

export interface MapCandidate {
  id: string;
  d: string;
  labelX: number;
  labelY: number;
  /** Shown on the candidate's badge: its number (1–6) or, in a contrast study step, a name. */
  badge: string;
  /** Tiny shapes get their badge up and to the right, so it doesn't hide them. */
  small?: boolean;
  state: ChoiceState;
}

const CANDIDATE_PATH: Record<ChoiceState, string> = {
  idle: 'fill-accent/15 stroke-ink hover:fill-accent/30',
  correct: 'fill-good/35 stroke-good animate-map-pulse',
  wrong: 'fill-bad/30 stroke-bad',
  dim: 'fill-transparent stroke-ink-soft opacity-40',
};

const CANDIDATE_BADGE: Record<ChoiceState, string> = {
  idle: 'bg-raised text-ink ring-ink hover:bg-accent hover:text-accent-ink',
  correct: 'bg-good text-raised ring-good animate-pop',
  wrong: 'bg-bad text-raised ring-bad animate-shake',
  dim: 'bg-raised text-ink-soft ring-rule opacity-50',
};

/**
 * A map plate: the id-free base map as an <img alt=""> with an SVG overlay in viewBox units.
 * Sized to fit both the column width and `maxHeight`, keeping the frame's aspect ratio, so a
 * normalized click lands on what the learner sees at any size.
 */
export function MapFrame({
  map,
  maxHeight = '62vh',
  highlight,
  candidates,
  correct,
  given,
  mark,
  disabled = false,
  onPoint,
  onCandidate,
  autoFocus = false,
  className = '',
}: {
  map: MapView;
  maxHeight?: string;
  /** Outline of the country being asked about, drawn with the survey hatch. */
  highlight?: string;
  candidates?: MapCandidate[];
  /** Feedback: the right country and the one the learner picked. */
  correct?: string;
  given?: string;
  /** Where the learner clicked, normalized. */
  mark?: { x: number; y: number };
  disabled?: boolean;
  onPoint?: (point: { x: number; y: number; width: number }) => void;
  onCandidate?: (id: string) => void;
  /** Click mode: take keyboard focus on mount, so the arrow keys work straight away. */
  autoFocus?: boolean;
  className?: string;
}) {
  const hatch = `hatch-${useId().replace(/:/g, '')}`;
  const { width: w, height: h } = map;
  const clickable = Boolean(onPoint) && !disabled;
  const ref = useRef<HTMLDivElement>(null);
  /** Keyboard crosshair, normalized; shown once an arrow key is used. */
  const [cursor, setCursor] = useState({ x: 0.5, y: 0.5 });
  const [keyboard, setKeyboard] = useState(false);

  useEffect(() => {
    if (autoFocus && clickable) ref.current?.focus({ preventScroll: true });
  }, [autoFocus, clickable]);

  const click = (e: MouseEvent<HTMLDivElement>) => {
    if (!clickable) return;
    onPoint!(normalizePoint(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect()));
  };

  // Arrow keys move a crosshair (Shift for bigger steps); Enter or Space clicks at it.
  const keyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!clickable) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      onPoint!(normalizePoint(rect.left + cursor.x * rect.width, rect.top + cursor.y * rect.height, rect));
      return;
    }
    const next = moveCursor(cursor, e.key, e.shiftKey, w / h);
    if (!next) return;
    e.preventDefault();
    setCursor(next);
    setKeyboard(true);
  };

  return (
    <div
      ref={ref}
      data-map-frame
      data-viewbox={`${w} ${h}`}
      onClick={click}
      onKeyDown={keyDown}
      tabIndex={clickable ? 0 : undefined}
      role={clickable ? 'application' : undefined}
      aria-label={clickable ? 'Map. Move the crosshair with the arrow keys (Shift for bigger steps), then press Enter.' : undefined}
      style={{ aspectRatio: `${w} / ${h}`, width: `min(100%, calc(${maxHeight} * ${w / h}))` }}
      className={`map-plate relative mx-auto select-none overflow-hidden rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-accent/60 ${clickable ? 'cursor-crosshair' : ''} ${className}`}
    >
      <img src={map.baseUrl} alt="" draggable={false} className="absolute inset-0 h-full w-full" />
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 h-full w-full">
        <defs>
          <pattern id={hatch} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="7" height="7" className="fill-accent/15" />
            <line x1="0" y1="0" x2="0" y2="7" className="stroke-accent" strokeWidth="3.5" />
          </pattern>
        </defs>
        {highlight && (
          <path
            d={highlight}
            fill={`url(#${hatch})`}
            className="animate-ink stroke-accent"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round" fillRule="evenodd"
          />
        )}
        {candidates?.map((c) => (
          <path
            key={c.id}
            d={c.d}
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) onCandidate?.(c.id);
            }}
            className={`animate-ink transition-[fill,opacity] duration-150 ${disabled ? '' : 'cursor-pointer'} ${CANDIDATE_PATH[c.state]}`}
            strokeWidth="1.75"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round" fillRule="evenodd"
          />
        ))}
        {given && (
          <path d={given} className="fill-bad/30 stroke-bad" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" fillRule="evenodd" />
        )}
        {correct && (
          <path
            d={correct}
            className="animate-map-pulse fill-good/35 stroke-good"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round" fillRule="evenodd"
          />
        )}
      </svg>
      {keyboard && clickable && (
        <span
          aria-hidden="true"
          data-crosshair
          style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }}
          className="pointer-events-none absolute size-7 -translate-x-1/2 -translate-y-1/2"
        >
          <span className="absolute inset-0 rounded-full ring-2 ring-accent" />
          <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-accent" />
          <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-accent" />
        </span>
      )}
      {mark && (
        <span
          aria-hidden="true"
          style={{ left: `${mark.x * 100}%`, top: `${mark.y * 100}%` }}
          className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-2 ring-raised"
        />
      )}
      {candidates?.map((c, i) => (
        <button
          key={c.id}
          type="button"
          data-choice-id={c.id}
          aria-label={/^\d+$/.test(c.badge) ? `Option ${c.badge}` : c.badge}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onCandidate?.(c.id);
          }}
          style={{ left: `${(c.labelX / w) * 100}%`, top: `${(c.labelY / h) * 100}%`, animationDelay: `${i * 40}ms` }}
          className={`absolute whitespace-nowrap ${c.small ? 'translate-x-[40%] -translate-y-[140%]' : '-translate-x-1/2 -translate-y-1/2'} rounded-full px-2 py-0.5 font-mono text-xs font-semibold shadow-sm ring-2 transition-colors ${CANDIDATE_BADGE[c.state]}`}
        >
          {c.badge}
        </button>
      ))}
    </div>
  );
}
