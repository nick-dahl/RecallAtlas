import { describe, expect, it } from 'vitest';
import { licenseUrl } from './license-link';

describe('licenseUrl', () => {
  it('links Creative Commons licences to their deeds, and nothing else', () => {
    expect(licenseUrl('CC BY 2.0')).toBe('https://creativecommons.org/licenses/by/2.0/');
    expect(licenseUrl('CC BY-SA 4.0')).toBe('https://creativecommons.org/licenses/by-sa/4.0/');
    expect(licenseUrl('CC BY-SA 2.0 de')).toBe('https://creativecommons.org/licenses/by-sa/2.0/de/');
    expect(licenseUrl('CC0')).toBe('https://creativecommons.org/publicdomain/zero/1.0/');
    expect(licenseUrl('Public domain')).toBeNull();
  });
});
