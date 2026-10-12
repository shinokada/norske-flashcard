-- Migration 031: store the user's country on the profile.
--
-- ISO 3166-1 alpha-2 code taken from the Cloudflare cf-ipcountry header. It is set once by the
-- root layout load (src/routes/+layout.server.ts) with an UPDATE only, so it never creates a
-- profile row. See ai-docs/implementation/profile-country.md.
--
-- Run this BEFORE deploying the code change: the layout adds `country` to its profiles select,
-- and if the column is missing Supabase returns an error, `data` is null, and every signed-in
-- user would look like they have no profile row.
--
-- (Migration 018 added a `country` column for the onboarding slides and 020 dropped it.)

alter table public.profiles
  add column if not exists country text
  check (country is null or country ~ '^[A-Z]{2}$');

comment on column public.profiles.country is
  'ISO 3166-1 alpha-2 code from the Cloudflare cf-ipcountry header, set once by the root '
  'layout load on the first signed-in page view. Never overwritten. No IP address is stored.';
