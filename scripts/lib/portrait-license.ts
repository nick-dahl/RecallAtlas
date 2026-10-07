/** Commons `extmetadata` licence fields, reduced to their values. */
export interface LicenseMeta {
  LicenseShortName?: string;
  License?: string;
}

/** Public domain (including PD-USGov and PD-old variants) or CC0 only: no attribution or share-alike terms. */
export function isPublicDomain(meta: LicenseMeta): boolean {
  return [meta.LicenseShortName, meta.License].some(
    (v) => typeof v === 'string' && /^(pd\b|pd-|public domain|cc0)/i.test(v.trim()),
  );
}

/** CC BY or CC BY-SA (any version): usable with credit. Never NC or ND. */
export function isAttribution(meta: LicenseMeta): boolean {
  return [meta.LicenseShortName, meta.License].some(
    (v) => typeof v === 'string' && /^cc[ -]by(-sa)?[ -]\d/i.test(v.trim()),
  );
}
