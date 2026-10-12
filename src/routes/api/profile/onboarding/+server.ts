/**
 * PATCH /api/profile/onboarding
 *
 * Accepts partial updates from the onboarding slides
 * (`OnboardingSlides.svelte`) and the post-snooze nudge fields on
 * `/my-profile`. Each slide/section PATCHes only the field(s) it owns — any
 * combination of the keys below may be sent in a single request, including
 * none (a no-op).
 *
 * Body (JSON), all keys optional:
 *   - display_name:         string | null  (trimmed, max 40 chars)
 *   - flashcard_language:   'english' | 'spanish' | 'ukrainian' | 'german'
 *   - current_level:         'A1' | 'A2' | 'B1' | 'B2' | 'C' | null
 *   - onboarding_done:      boolean
 *   - onboarding_snoozed_at: string | null (ISO timestamp)
 *   - daily_reminder_enabled: boolean      (stored as email_reminder)
 *
 * The country is not set here: the root layout load records it from the
 * Cloudflare header (see ai-docs/implementation/profile-country.md).
 *
 * Response: { ok: true } | { message: string } (4xx/5xx)
 * Auth: requires a valid session cookie (locals.user).
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const VALID_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C'];
const VALID_FLASHCARD_LANGUAGES = new Set(['english', 'spanish', 'ukrainian', 'german']);
// ---------------------------------------------------------------------------
// Sanitisation helper — strips control characters and HTML-like content from
// free-text fields before they are stored. Svelte escapes on render so this
// won't prevent XSS on the site itself, but it keeps the DB clean.
// ---------------------------------------------------------------------------
function sanitizeText(val: string): string {
  return (
    val
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001F\u007F]/g, '') // control characters
      .replace(/[<>]/g, '') // no HTML angle brackets
      .trim()
  );
}

export const PATCH: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) error(401, { message: 'Unauthorized' });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    error(400, { message: 'Invalid JSON.' });
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    error(400, { message: 'Invalid request body.' });
  }

  const body = raw as Record<string, unknown>;

  // Build a safe allow-list of fields this endpoint may write
  const update: Record<string, unknown> = {};

  if ('display_name' in body) {
    const rawName = (body.display_name as string | null) ?? null;
    const name = rawName ? sanitizeText(rawName) : null;
    if (name && name.length > 40) error(422, { message: 'Display name too long.' });
    update.display_name = name || null;
  }

  if ('flashcard_language' in body) {
    const lang = body.flashcard_language as string | null;
    if (lang && !VALID_FLASHCARD_LANGUAGES.has(lang)) {
      error(422, { message: 'Invalid flashcard language.' });
    }
    update.flashcard_language = lang || 'english';
  }

  if ('current_level' in body) {
    const level = body.current_level as string | null;
    if (level && !VALID_LEVELS.includes(level)) error(422, { message: 'Invalid level.' });
    update.current_level = level || null;
  }

  if ('onboarding_done' in body) {
    update.onboarding_done = Boolean(body.onboarding_done);
  }

  if ('onboarding_snoozed_at' in body) {
    const snoozedAt = body.onboarding_snoozed_at;
    if (snoozedAt !== null && typeof snoozedAt !== 'string') {
      error(422, { message: 'onboarding_snoozed_at must be a string or null.' });
    }
    update.onboarding_snoozed_at = snoozedAt ?? null;
  }

  if ('daily_reminder_enabled' in body) {
    update.email_reminder = Boolean(body.daily_reminder_enabled);
  }

  if (Object.keys(update).length === 0) {
    return json({ ok: true }); // nothing to do
  }

  update.updated_at = new Date().toISOString();

  const { error: dbError } = await locals.supabase
    .from('profiles')
    .upsert({ id: locals.user.id, ...update }, { onConflict: 'id' });

  if (dbError) {
    console.error('[onboarding] upsert error:', dbError.message);
    error(500, { message: 'Failed to save. Please try again.' });
  }

  return json({ ok: true });
};
