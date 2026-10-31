-- Add an explicit marker for comments published by the blog owner. Safe to rerun.
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS is_author boolean NOT NULL DEFAULT false;
