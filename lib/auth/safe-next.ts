const DEFAULT_NEXT = '/dashboard';

/** Control characters (which some hosts/parsers treat as path separators) and backslashes. */
const UNSAFE_CHARS = /[\u0000-\u001f\\]/;

/** Only same-origin relative paths are allowed as post-login destinations (no open redirects). */
export function safeNext(value: string | null | undefined): string {
  if (!value || UNSAFE_CHARS.test(value)) return DEFAULT_NEXT;
  try {
    const sameOrigin = new URL(value, 'http://n').origin === 'http://n';
    return sameOrigin && value.startsWith('/') ? value : DEFAULT_NEXT;
  } catch {
    return DEFAULT_NEXT;
  }
}
