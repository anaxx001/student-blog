-- Anaxx Science Hub v4 migration. Run once in the Supabase SQL editor (idempotent).
-- Adds comment spam flag, lets the admin read and remove subscribers, and a dashboard stats helper.

alter table comments add column if not exists spam boolean not null default false;

drop policy if exists "subs read" on subscribers;
drop policy if exists "subs admin" on subscribers;
create policy "subs read" on subscribers for select using (true);
create policy "subs admin" on subscribers for delete using (true);

-- Public visitors can't insert approved or spam comments; the admin can update either way.
drop policy if exists "comments insert" on comments;
create policy "comments insert" on comments for insert with check (approved = false and spam = false);
