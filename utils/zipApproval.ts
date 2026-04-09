export function parseApprovedZips(raw: string | undefined): Set<string> {
  const tokens = String(raw || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return new Set(tokens);
}

/**
 * Returns true if the ZIP is in your approved service area list.
 *
 * Configure with `EXPO_PUBLIC_SERVICE_AREA_ZIPS` as a comma-separated list, e.g.:
 * `07029,07030,07031`
 *
 * If not configured, defaults to allowing all ZIPs so the app remains usable.
 */
export async function isZipInApprovedServiceArea(zip: string): Promise<boolean> {
  const cleaned = String(zip || '').trim();
  if (!/^[0-9]{5}$/.test(cleaned)) return false;

  const approved = parseApprovedZips(process.env.EXPO_PUBLIC_SERVICE_AREA_ZIPS);
  if (approved.size === 0) return true;
  return approved.has(cleaned);
}

