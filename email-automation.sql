-- Email automation prerequisites. Safe to run more than once.
create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.subscribers add column if not exists email text;
alter table public.subscribers add column if not exists created_at timestamptz not null default now();
create unique index if not exists subscribers_email_unique_idx on public.subscribers (email);
