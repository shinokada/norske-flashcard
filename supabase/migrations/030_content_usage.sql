-- Migration 030: content_usage counters for the Plus content endpoints
-- (ai-docs/implementation/content-scraping-hardening.md, Phase 1)
--
-- Run in Supabase Dashboard → SQL Editor, BEFORE deploying the code that calls
-- record_content_usage (the code fails open if the function is missing, so the
-- order only avoids a burst of logged errors).
--
-- One row per account, UTC day and endpoint: how many requests and how many
-- entries the account took from a content endpoint. Counts only, no content.
-- Used to learn what a normal learner's day looks like and to flag an account
-- that pulls far more. Written and read by the server with the service role.

CREATE TABLE public.content_usage (
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day        date        NOT NULL,              -- UTC day
  endpoint   text        NOT NULL,              -- 'quiz-entries', 'review-entries', ...
  requests   integer     NOT NULL DEFAULT 0,
  entries    integer     NOT NULL DEFAULT 0,    -- entries returned (a proxy for bytes)
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_usage_pkey PRIMARY KEY (user_id, day, endpoint)
);

-- RLS on, no policies: users cannot read or write it. Only the service role
-- (which bypasses RLS) touches this table.
ALTER TABLE public.content_usage ENABLE ROW LEVEL SECURITY;

-- Counts one call and returns today's totals for the endpoint and overall, in
-- one round trip. The upsert is atomic, so parallel requests cannot lose a count.
CREATE OR REPLACE FUNCTION public.record_content_usage(
  p_user_id  uuid,
  p_endpoint text,
  p_entries  integer
)
RETURNS TABLE (
  endpoint_requests integer,
  endpoint_entries  integer,
  total_requests    integer,
  total_entries     integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_day date := (now() AT TIME ZONE 'utc')::date;
BEGIN
  INSERT INTO public.content_usage AS c (user_id, day, endpoint, requests, entries)
  VALUES (p_user_id, v_day, p_endpoint, 1, GREATEST(p_entries, 0))
  ON CONFLICT (user_id, day, endpoint) DO UPDATE
    SET requests   = c.requests + 1,
        entries    = c.entries + GREATEST(p_entries, 0),
        updated_at = now();

  RETURN QUERY
    SELECT
      COALESCE(SUM(u.requests) FILTER (WHERE u.endpoint = p_endpoint), 0)::integer,
      COALESCE(SUM(u.entries)  FILTER (WHERE u.endpoint = p_endpoint), 0)::integer,
      COALESCE(SUM(u.requests), 0)::integer,
      COALESCE(SUM(u.entries), 0)::integer
    FROM public.content_usage u
    WHERE u.user_id = p_user_id
      AND u.day = v_day;
END;
$$;

-- Same privilege pattern as migration 027: the function is SECURITY DEFINER and
-- takes p_user_id as a raw parameter, so no browser role may call it. Only the
-- server (service role) does.
REVOKE EXECUTE ON FUNCTION public.record_content_usage(uuid, text, integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_content_usage(uuid, text, integer)
  TO service_role;

-- Manual checks (SQL editor, replace the uuid with a real auth.users id):
--   select * from public.record_content_usage('<uuid>', 'quiz-entries', 100);
--   select * from public.record_content_usage('<uuid>', 'quiz-entries', 50);
--   -- second call: endpoint_requests = 2, endpoint_entries = 150
--   delete from public.content_usage where user_id = '<uuid>';
-- As anon / authenticated the call must fail with "permission denied for function".
