import { describe, expect, it } from 'vitest';
import { isPublicDomain } from './portrait-license';

describe('isPublicDomain', () => {
  it('accepts Commons public-domain and CC0 licences', () => {
    expect(isPublicDomain({ LicenseShortName: 'Public domain', License: 'pd' })).toBe(true);
    expect(isPublicDomain({ LicenseShortName: 'PD-USGov-POTUS' })).toBe(true);
    expect(isPublicDomain({ LicenseShortName: 'CC0', License: 'cc0' })).toBe(true);
  });

  it('rejects attribution, share-alike and unknown licences', () => {
    expect(isPublicDomain({ LicenseShortName: 'CC BY-SA 4.0', License: 'cc-by-sa-4.0' })).toBe(false);
    expect(isPublicDomain({ LicenseShortName: 'CC BY 2.0', License: 'cc-by-2.0' })).toBe(false);
    expect(isPublicDomain({})).toBe(false);
  });
});
