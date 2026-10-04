'use client';

import { useEffect, useRef } from 'react';

/**
 * Window-level shortcuts. Ignored while typing in a field, except Enter and Escape.
 * Keys are KeyboardEvent.key values ('1', 'Enter', 'Escape', ...).
 */
export function useHotkeys(handlers: Record<string, () => void>, enabled = true) {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      if (typing && e.key !== 'Enter' && e.key !== 'Escape') return;
      const handler = latest.current[e.key];
      if (!handler) return;
      e.preventDefault();
      handler();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
