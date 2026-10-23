-- Anaxx Science Hub v5: real admin login with Supabase Auth.
-- Run AFTER setup.sql and setup-v4.sql, once, in Supabase > SQL editor > New query > paste > Run.
-- Safe to re-run (uses "if not exists", "create or replace", and drops policies before recreating them).

-- ---------- who is an admin ----------
-- One row per owner account. The first account that calls claim_admin() becomes the owner.
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table admins enable row level security;
-- Nobody can read or edit this table from the browser. Only the functions below touch it.
drop policy if exists "admins none" on admins;

-- true when the signed-in user is the owner
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- true only while no owner has been claimed yet (drives the one-time ?setup=1 screen)
create or replace function setup_open() returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from admins);
$$;

-- the signed-in user claims admin, but only if nobody has yet. Returns true when they became the owner.
create or replace function claim_admin() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from admins) then return false; end if;
  insert into admins (user_id) values (auth.uid());
  return true;
end;
$$;

revoke all on function is_admin() from public;
revoke all on function setup_open() from public;
revoke all on function claim_admin() from public;
grant execute on function is_admin() to anon, authenticated;
grant execute on function setup_open() to anon, authenticated;
grant execute on function claim_admin() to authenticated;

-- ---------- posts: public sees published only; only the owner writes ----------
drop policy if exists "posts read" on posts;
drop policy if exists "posts write" on posts;
drop policy if exists "posts admin" on posts;
create policy "posts read" on posts for select to anon, authenticated
  using (status = 'published' or is_admin());
create policy "posts admin" on posts for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- comments: public sees approved; anyone can suggest; only the owner moderates ----------
drop policy if exists "comments read" on comments;
drop policy if exists "comments insert" on comments;
drop policy if exists "comments admin" on comments;
create policy "comments read" on comments for select to anon, authenticated
  using (approved = true or is_admin());
create policy "comments insert" on comments for insert to anon, authenticated
  with check (approved = false and spam = false);
create policy "comments admin" on comments for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- reactions: public feature, unchanged ----------
drop policy if exists "reactions read" on reactions;
drop policy if exists "reactions write" on reactions;
create policy "reactions read" on reactions for select to anon, authenticated using (true);
create policy "reactions write" on reactions for all to anon, authenticated using (true) with check (true);

-- ---------- subscribers: anyone can sign up; ONLY the owner can read or delete ----------
drop policy if exists "subs insert" on subscribers;
drop policy if exists "subs read" on subscribers;
drop policy if exists "subs admin" on subscribers;
drop policy if exists "subs owner read" on subscribers;
drop policy if exists "subs owner delete" on subscribers;
create policy "subs insert" on subscribers for insert to anon, authenticated with check (true);
create policy "subs owner read" on subscribers for select to authenticated using (is_admin());
create policy "subs owner delete" on subscribers for delete to authenticated using (is_admin());
-- subscriber_count() (already in setup.sql) returns only a number, so the public count still works.

-- ---------- settings: public reads the site settings; only the owner writes ----------
drop policy if exists "settings read" on settings;
drop policy if exists "settings write" on settings;
drop policy if exists "settings admin" on settings;
create policy "settings read" on settings for select to anon, authenticated using (true);
create policy "settings admin" on settings for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- ads: public sees enabled ads; only the owner writes or sees disabled ones ----------
drop policy if exists "ads read" on ads;
drop policy if exists "ads write" on ads;
drop policy if exists "ads admin" on ads;
create policy "ads read" on ads for select to anon, authenticated
  using (enabled = true or is_admin());
create policy "ads admin" on ads for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- image uploads ('media' bucket): anyone reads, only the owner uploads or deletes ----------
drop policy if exists "media public read" on storage.objects;
drop policy if exists "media public insert" on storage.objects;
drop policy if exists "media public update" on storage.objects;
drop policy if exists "media public delete" on storage.objects;
drop policy if exists "media owner insert" on storage.objects;
drop policy if exists "media owner update" on storage.objects;
drop policy if exists "media owner delete" on storage.objects;
create policy "media public read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'media');
create policy "media owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and is_admin());
create policy "media owner update" on storage.objects for update to authenticated
  using (bucket_id = 'media' and is_admin()) with check (bucket_id = 'media' and is_admin());
create policy "media owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and is_admin());

-- ---------- counters the public site calls (unchanged behaviour) ----------
-- bump_view, bump_ad and subscriber_count keep working for anon because they are security definer.
