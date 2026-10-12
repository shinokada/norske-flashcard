import type { SupabaseClient } from '@supabase/supabase-js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  current_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C';
  ui_language: 'en' | 'nb' | 'es' | 'uk' | 'de';
  card_direction: 'l1_l2' | 'l2_l1' | 'def_l1';
  flashcard_language: 'english' | 'spanish' | 'ukrainian' | 'german';
  include_phrases: boolean;
  daily_reminder: boolean;
  email_reminder: boolean;
  email_lesson: boolean;
  voice_speed: number;
  voice_pitch: number;
  session_limit: number | null; // null = All cards; the column default is 20
  quiz_limit: number | null; // null = default (10)
  show_example: boolean; // show example translation below the card by default
  fsrs_retention: number | null; // FSRS request_retention preset: 0.8/0.9/0.95, null = default (0.9)
  country: string | null; // ISO 3166-1 alpha-2 from cf-ipcountry; set once by the root layout load, never by the UI
  // Onboarding fields
  study_goals: string[] | null; // ['vocab','grammar','speaking','listening','writing']
  onboarding_done: boolean;
  onboarding_snoozed_at: string | null; // ISO timestamp
  // Lemon Squeezy fields — written by webhook only, never by client
  ls_customer_id: string | null;
  ls_subscription_id: string | null;
  ls_status: 'active' | 'paused' | 'cancelled' | 'expired' | null;
  ls_renews_at: string | null; // ISO date string
  ls_ends_at: string | null; // ISO date string
  updated_at: string;
}

export type ProfileUpdate = Partial<
  Pick<
    Profile,
    | 'display_name'
    | 'current_level'
    | 'ui_language'
    | 'flashcard_language'
    | 'card_direction'
    | 'include_phrases'
    | 'daily_reminder'
    | 'email_reminder'
    | 'email_lesson'
    | 'voice_speed'
    | 'voice_pitch'
    | 'session_limit'
    | 'quiz_limit'
    | 'show_example'
    | 'fsrs_retention'
  >
>;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetch the profile row for the given user.
 * Returns null if no row exists yet (first login before upsert).
 */
export async function getProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[profile] getProfile error:', error.message);
    return null;
  }

  return data as Profile | null;
}

/**
 * Create or update the profile row for the given user.
 * Safe to call on first login — upsert creates the row with defaults if absent.
 */
export async function upsertProfile(
  supabase: SupabaseClient,
  userId: string,
  updates: ProfileUpdate
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'id' });

  if (error) {
    console.error('[profile] upsertProfile error:', error.message);
    return { error: error.message };
  }

  return { error: null };
}

/**
 * Delete the authenticated user's account.
 * Requires the Supabase service-role key — must only be called from a
 * trusted server context (form action or API route), never from the browser.
 *
 * Steps:
 *  1. Delete the auth.users row (cascades to profiles via FK).
 *  2. Caller is responsible for cancelling the Lemon Squeezy subscription
 *     before calling this function.
 */
export async function deleteAccount(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<{ error: string | null }> {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (error) {
    console.error('[profile] deleteAccount error:', error.message);
    return { error: error.message };
  }

  return { error: null };
}
