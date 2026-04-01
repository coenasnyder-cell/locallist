/**
 * Resolves a US zip code to a "City, ST" string using the free Zippopotam.us API.
 * Returns null if the zip is invalid or the request fails.
 */
export async function getCityFromZip(zip: string): Promise<string | null> {
  const cleaned = zip.trim().replace(/\D/g, '').slice(0, 5);
  if (cleaned.length !== 5) return null;
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${cleaned}`);
    if (!res.ok) return null;
    const data = await res.json();
    const place = data?.places?.[0];
    if (!place) return null;
    return `${place['place name']}, ${place['state abbreviation']}`;
  } catch {
    return null;
  }
}
