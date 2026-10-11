/**
 * Cloudflare Turnstile server-side verification helper.
 *
 * Usage:
 *   const ok = await verifyTurnstileToken(token, clientIp);
 *   if (!ok) throw error(400, 'Bot check failed');
 *
 * Env vars required:
 *   TURNSTILE_SECRET_KEY  — from Cloudflare Dashboard → Turnstile → your site → Secret key
 *
 * In development / testing, pass the always-pass test secret:
 *   TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
 *
 * The secret is read through `$env/dynamic/private`, not `process.env`: SvelteKit loads
 * `.env` / `.env.local` into it under `vite dev` and `vite preview`, while a bare
 * `process.env` read is empty there (so preview, which runs with NODE_ENV=production,
 * rejected every login with "Bot check failed"). On Vercel both read the same variables.
 */

import { env } from '$env/dynamic/private';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verifies a Turnstile challenge token with Cloudflare's siteverify API.
 *
 * @param token   The cf-turnstile-response value submitted by the browser widget.
 * @param remoteIp  Optional — the client IP; improves Cloudflare's analytics but is not required.
 * @returns true if the token is valid, false otherwise.
 */
export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    // Missing key — fail open only in development so the app stays usable without config.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[turnstile] TURNSTILE_SECRET_KEY not set — skipping verification in dev');
      return true;
    }
    console.error('[turnstile] TURNSTILE_SECRET_KEY is not configured');
    return false;
  }

  // An empty token always fails — no need to hit the network.
  if (!token || token.trim() === '') {
    return false;
  }

  // Cloudflare's siteverify endpoint requires application/x-www-form-urlencoded,
  // NOT JSON. Sending JSON causes silent failures on mobile/non-desktop browsers.
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) {
    body.set('remoteip', remoteIp);
  }

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    if (!res.ok) {
      console.error('[turnstile] siteverify HTTP error', res.status);
      return false;
    }

    const data = (await res.json()) as { success: boolean; 'error-codes'?: string[] };

    if (!data.success) {
      console.warn('[turnstile] verification failed', data['error-codes']);
    }

    return data.success === true;
  } catch (err) {
    console.error('[turnstile] network error during verification', err);
    return false;
  }
}
