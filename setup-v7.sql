-- Anaxx Science Hub v7: daily traffic tracking for the admin dashboard chart.
-- Run AFTER setup.sql, setup-v4.sql, setup-v5.sql (needs is_admin()). Once, in Supabase > SQL editor > New query > paste > Run.
-- Safe to re-run (uses "if not exists", "create or replace", and drops the policy before recreating it).

-- ---------- one row per day ----------
create table if not exists traffic_daily (
  day date primary key,
  views int not null default 0,
  ad_impressions int not null default 0
);
alter table traffic_daily enable row level security;

-- Nobody reads or writes this table directly. Visitors go through increment_traffic_daily(),
-- and only the owner reads it through the policy below.
drop policy if exists "traffic admin read" on traffic_daily;
create policy "traffic admin read" on traffic_daily for select to authenticated
  using (is_admin());

-- ---------- visitor counter (anon allowed) ----------
-- Adds at most 1 view and 1 ad impression per call, so one visitor cannot inflate a day.
-- The day must be within 2 days of the server's date, otherwise it falls back to the server's date.
create or replace function increment_traffic_daily(p_day date, p_views int default 0, p_ad_impressions int default 0)
returns void
language plpgsql security definer set search_path = public as $$
declare
  d date := p_day;
  v int := least(greatest(coalesce(p_views, 0), 0), 1);
  a int := least(greatest(coalesce(p_ad_impressions, 0), 0), 1);
begin
  if d is null or d < current_date - 2 or d > current_date + 2 then
    d := current_date;
  end if;
  if v = 0 and a = 0 then return; end if;
  insert into traffic_daily as t (day, views, ad_impressions)
  values (d, v, a)
  on conflict (day) do update
    set views = t.views + excluded.views,
        ad_impressions = t.ad_impressions + excluded.ad_impressions;
end;
$$;

revoke all on function increment_traffic_daily(date, int, int) from public;
grant execute on function increment_traffic_daily(date, int, int) to anon, authenticated;
