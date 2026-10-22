-- DESTRUCTIVE CLEANUP, RUN ONLY AFTER BACKING UP YOUR EXISTING CLOUDFLARE D1 DATABASE.
-- The prior version used Cloudflare D1 table connected_sites (NOT Supabase).
-- This removes old Quartz-hosted client website content/SEO records.
-- Old website asset files in Cloudflare R2 are separate: remove SITES_BUCKET
-- AFTER confirming old client sites no longer need hosting or backing up the bucket.
DROP INDEX IF EXISTS idx_connected_sites_slug;
DROP INDEX IF EXISTS idx_connected_sites_status;
DROP TABLE IF EXISTS connected_sites;
