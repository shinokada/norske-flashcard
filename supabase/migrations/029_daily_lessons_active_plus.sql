-- Match the app's Plus rule (hooks.server.ts): active, or not yet expired.
drop policy if exists "Plus users can read approved lessons" on public.daily_lessons;

create policy "Active Plus users can read approved lessons"
  on public.daily_lessons for select
  to authenticated
  using (
    approved = true
    and exists (
      select 1 from public.subscriptions s
      where s.user_id = (select auth.uid())
        and s.plan = 'plus'
        and (s.status = 'active' or (s.valid_until is not null and s.valid_until > now()))
    )
  );