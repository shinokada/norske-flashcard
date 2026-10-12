/**
 * ISO 3166-1 alpha-2 country from Cloudflare's `cf-ipcountry` header, or null if unknown.
 *
 * `XX` means Cloudflare could not tell and `T1` is Tor, so both count as unknown. The header is an
 * estimate, and a request sent straight to the origin can carry any value (only the format is
 * checked here). Only the two-letter code is ever kept, never the IP address.
 */
export function countryFromRequest(request: Request): string | null {
  const raw = request.headers.get('cf-ipcountry')?.trim().toUpperCase();
  if (!raw || !/^[A-Z]{2}$/.test(raw)) return null;
  return raw === 'XX' || raw === 'T1' ? null : raw;
}
