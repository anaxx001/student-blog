-- Anaxx Science Hub v9: allow thumbs-down reactions while preserving old insight rows.
-- Run once in Supabase SQL editor after setup-v8.sql. Safe to re-run.

alter table public.reactions
  drop constraint if exists reactions_emoji_type_check;

alter table public.reactions
  add constraint reactions_emoji_type_check
  check (emoji_type in ('like', 'insight', 'dislike', 'save'));
