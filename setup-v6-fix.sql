-- Anaxx Science Hub v6 fix: create the public 'media' bucket that ad image uploads go to.
-- Run ONCE in Supabase > SQL editor > New query > paste > Run. Safe to re-run.
-- Without this bucket, uploads fail with "bucket 'media' missing" and the ad never gets an image.
-- Upload policies on storage.objects come from setup-v5.sql (owner uploads, anyone reads).

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;
