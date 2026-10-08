/**
 * The Creative Commons deed for a Commons licence short name ("CC BY-SA 4.0", "CC BY 2.0 de", "CC0"),
 * so attribution links the licence as CC BY asks. Public domain has no licence to link.
 */
export function licenseUrl(shortName: string): string | null {
  const name = shortName.trim();
  if (/^cc0\b/i.test(name)) return 'https://creativecommons.org/publicdomain/zero/1.0/';
  const m = /^cc[ -](by(?:-sa)?)[ -](\d\.\d)(?:\s+([a-z]{2}))?$/i.exec(name);
  if (!m) return null;
  return `https://creativecommons.org/licenses/${m[1].toLowerCase()}/${m[2]}/${m[3] ? `${m[3].toLowerCase()}/` : ''}`;
}
