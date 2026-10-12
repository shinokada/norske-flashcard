/**
 * content-usage.ts (server only)
 *
 * Per-account counters for the Plus content endpoints, kept in Supabase
 * (`content_usage`, migration 030) so they are shared across serverless
 * instances and survive a day. Purpose: learn what a normal learner's day looks
 * like and make a bulk copy through a Plus account visible
 * (ai-docs/implementation/content-scraping-hardening.md, Phase 1).
 *
 * It ships log-only: over a limit it logs a warning and serves as before.
 * Blocking (429) needs ENFORCE_CONTENT_LIMITS = true, a deliberate later change.
 *
 * Only Plus calls are counted, so free and guest requests cost no database write.
 * Fails open: if the counter cannot be written, the request is served and the
 * error is logged, so a Supabase problem never breaks a paying learner.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

export type ContentEndpoint =
  | 'quiz-entries'
  | 'review-entries'
  | 'review-grammar-entries'
  | 'grammar-questions'
  | 'c-uttrykk';

export interface ContentLimit {
  requestsPerDay: number;
  entriesPerDay: number;
}

/**
 * PLACEHOLDERS, not measured values. They are set well above any honest day so that, in
 * log-only mode, a warning means "look at this account". Replace them with numbers from
 * the `content_usage` data after one to two weeks (content-scraping-hardening.md).
 */
export const CONTENT_LIMITS: Record<ContentEndpoint, ContentLimit> = {
  'quiz-entries': { requestsPerDay: 100, entriesPerDay: 40_000 },
  'review-entries': { requestsPerDay: 300, entriesPerDay: 20_000 },
  'review-grammar-entries': { requestsPerDay: 300, entriesPerDay: 20_000 },
  'grammar-questions': { requestsPerDay: 100, entriesPerDay: 20_000 },
  'c-uttrykk': { requestsPerDay: 50, entriesPerDay: 20_000 }
};

/** Across all content endpoints. Also a placeholder. */
export const TOTAL_CONTENT_LIMIT: ContentLimit = { requestsPerDay: 500, entriesPerDay: 50_000 };

/** Log-only until the thresholds come from real data. Flip in a deliberate PR. */
export const ENFORCE_CONTENT_LIMITS = false;

export interface ContentUsageTotals {
  endpointRequests: number;
  endpointEntries: number;
  totalRequests: number;
  totalEntries: number;
}

export type RecordRpc = (
  userId: string,
  endpoint: ContentEndpoint,
  entries: number
) => Promise<ContentUsageTotals>;

export interface RecordParams {
  userId: string | null | undefined;
  plan: string | null | undefined;
  endpoint: ContentEndpoint;
  /** Number of entries in the response. */
  entries: number;
}

export interface UsageResult {
  /** True when a row was written. False for free/guest callers and on failure. */
  counted: boolean;
  /** True when today's totals exceed a limit. Never true when counted is false. */
  over: boolean;
  usage?: ContentUsageTotals;
}

let client: SupabaseClient | null = null;

/** Real counter call: the service-role client, created once per server instance. */
async function recordViaSupabase(
  userId: string,
  endpoint: ContentEndpoint,
  entries: number
): Promise<ContentUsageTotals> {
  const url = publicEnv.PUBLIC_SUPABASE_URL;
  const key = privateEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role is not configured');

  client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data, error } = await client.rpc('record_content_usage', {
    p_user_id: userId,
    p_endpoint: endpoint,
    p_entries: entries
  });
  if (error) throw new Error(error.message);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('record_content_usage returned no row');

  return {
    endpointRequests: Number(row.endpoint_requests),
    endpointEntries: Number(row.endpoint_entries),
    totalRequests: Number(row.total_requests),
    totalEntries: Number(row.total_entries)
  };
}

/** Whether today's totals exceed the endpoint limit or the overall limit. */
export function isOverLimit(endpoint: ContentEndpoint, usage: ContentUsageTotals): boolean {
  const limit = CONTENT_LIMITS[endpoint];
  return (
    usage.endpointRequests > limit.requestsPerDay ||
    usage.endpointEntries > limit.entriesPerDay ||
    usage.totalRequests > TOTAL_CONTENT_LIMIT.requestsPerDay ||
    usage.totalEntries > TOTAL_CONTENT_LIMIT.entriesPerDay
  );
}

/**
 * Counts one content call for a Plus account. Safe to call for anyone: it does
 * nothing for free and guest callers. Never throws.
 * `rpc` is injectable for tests.
 */
export async function recordContentUsage(
  { userId, plan, endpoint, entries }: RecordParams,
  rpc: RecordRpc = recordViaSupabase
): Promise<UsageResult> {
  if (plan !== 'plus' || !userId) return { counted: false, over: false };

  let usage: ContentUsageTotals;
  try {
    usage = await rpc(userId, endpoint, Math.max(0, Math.trunc(entries) || 0));
  } catch (err) {
    console.error(`[content-usage] could not record ${endpoint}:`, (err as Error).message);
    return { counted: false, over: false };
  }

  const over = isOverLimit(endpoint, usage);
  if (over) {
    console.warn('[content-usage] over daily limit', { userId, endpoint, ...usage });
  }
  return { counted: true, over, usage };
}

/** True when the request should be answered with 429 instead of served. */
export function shouldBlock(result: UsageResult, enforce = ENFORCE_CONTENT_LIMITS): boolean {
  return enforce && result.over;
}

/** Seconds until the next UTC midnight, when the daily counters start again. */
export function secondsUntilUtcMidnight(now: Date = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

/** The 429 an API endpoint returns instead of its body. */
export function rateLimitedResponse(now: Date = new Date()): Response {
  return Response.json(
    { error: 'rate_limited' },
    {
      status: 429,
      headers: {
        'Cache-Control': 'private, no-store',
        'Retry-After': String(secondsUntilUtcMidnight(now))
      }
    }
  );
}
