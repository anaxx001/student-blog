-- Anaxx Science Hub v6: display ad banners with media (image or video).
-- Run AFTER setup-v5.sql, once, in Supabase > SQL editor > New query > paste > Run.
-- Safe to re-run (uses "if not exists").

-- media for each ad: a link to an image or a video, and which kind it is
alter table ads add column if not exists media_url text not null default '';
alter table ads add column if not exists media_type text not null default 'image';

-- Video upload note: the existing 'media' bucket accepts mp4/webm only if its
-- allowed mime types include video/mp4 and video/webm. Check in Supabase > Storage > media > Settings.
-- If video uploads are blocked, paste a video link in the admin form instead (the ad still renders).
