-- Campus Notes v3 setup
-- RUN THIS ONCE: Supabase dashboard > SQL editor > New query > paste the whole file > Run.
-- Safe to re-run: uses "if not exists" / "create or replace" and drops policies before recreating them.

-- ---------- tables ----------
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null default 'anatomy',
  author text not null default '',
  excerpt text not null default '',
  body text not null default '',
  cover_url text not null default '',
  read_time int not null default 4,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  views int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  body text not null check (char_length(body) between 1 and 2000),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  emoji_type text not null check (emoji_type in ('like', 'insight', 'save')),
  visitor_id text not null,
  created_at timestamptz not null default now(),
  unique (post_id, emoji_type, visitor_id)
);

create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (char_length(email) between 3 and 320),
  created_at timestamptz not null default now()
);

create table if not exists settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb
);

create table if not exists ads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  placement text not null default 'top' check (placement in ('top', 'inline', 'sidebar')),
  title text not null,
  body text not null default '',
  cta text not null default 'Learn more',
  url text not null,
  enabled boolean not null default false,
  impressions int not null default 0,
  clicks int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- counters (called from the site) ----------
create or replace function bump_view(p_slug text) returns void
language sql security definer set search_path = public as $$
  update posts set views = views + 1 where slug = p_slug and status = 'published';
$$;

create or replace function bump_ad(p_id uuid, p_kind text) returns void
language sql security definer set search_path = public as $$
  update ads set
    impressions = impressions + (case when p_kind = 'impression' then 1 else 0 end),
    clicks      = clicks      + (case when p_kind = 'click'      then 1 else 0 end)
  where id = p_id;
$$;

create or replace function subscriber_count() returns int
language sql security definer set search_path = public as $$
  select count(*)::int from subscribers;
$$;

-- ---------- row level security ----------
alter table posts       enable row level security;
alter table comments    enable row level security;
alter table reactions   enable row level security;
alter table subscribers enable row level security;
alter table settings    enable row level security;
alter table ads         enable row level security;

drop policy if exists "posts read" on posts;
drop policy if exists "posts write" on posts;
drop policy if exists "comments read" on comments;
drop policy if exists "comments insert" on comments;
drop policy if exists "comments admin" on comments;
drop policy if exists "reactions read" on reactions;
drop policy if exists "reactions write" on reactions;
drop policy if exists "subs insert" on subscribers;
drop policy if exists "settings read" on settings;
drop policy if exists "settings write" on settings;
drop policy if exists "ads read" on ads;
drop policy if exists "ads write" on ads;

-- Visitors can read published posts and approved comments only; the admin (anon key, client-side login) can read everything.
create policy "posts read" on posts for select using (true);
create policy "posts write" on posts for all using (true) with check (true);
create policy "comments read" on comments for select using (true);
create policy "comments insert" on comments for insert with check (approved = false);
create policy "comments admin" on comments for all using (true) with check (true);
create policy "reactions read" on reactions for select using (true);
create policy "reactions write" on reactions for all using (true) with check (true);
create policy "subs insert" on subscribers for insert with check (true);
create policy "settings read" on settings for select using (true);
create policy "settings write" on settings for all using (true) with check (true);
create policy "ads read" on ads for select using (true);
create policy "ads write" on ads for all using (true) with check (true);

-- Allow the anon role to call the helpers.
grant execute on function bump_view(text) to anon;
grant execute on function bump_ad(uuid, text) to anon;
grant execute on function subscriber_count() to anon;

-- ---------- starter settings row ----------
insert into settings (key, value) values ('site', '{"adsOn": false, "whatsapp": "", "logo": "", "authorImage": ""}')
on conflict (key) do nothing;

-- NOTE: the admin login is client-side (admin / studentblog), so the anon key can write.
-- Anyone who reads the page source can call the API directly. Good enough for a student blog;
-- for real protection later, switch to Supabase Auth and tighten the "write" policies.

-- ---------- storage: public 'media' bucket for image uploads ----------
-- Create the bucket once in the dashboard: Storage > New bucket > name "media" > Public ON.
-- The four policies below let the admin upload, replace and delete images in that bucket, and let anyone read them.
-- Safe to re-run.
drop policy if exists "media public read" on storage.objects;
drop policy if exists "media public insert" on storage.objects;
drop policy if exists "media public update" on storage.objects;
drop policy if exists "media public delete" on storage.objects;

create policy "media public read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'media');
create policy "media public insert" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'media');
create policy "media public update" on storage.objects for update to anon, authenticated
  using (bucket_id = 'media') with check (bucket_id = 'media');
create policy "media public delete" on storage.objects for delete to anon, authenticated
  using (bucket_id = 'media');
