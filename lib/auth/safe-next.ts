const DEFAULT_NEXT = '/dashboard';

/** Only same-origin relative paths are allowed as post-login destinations (no open redirects). */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return DEFAULT_NEXT;
  return value;
}
