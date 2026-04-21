-- Add hashtags support to GalleryItem.
-- Run this once on your Supabase/Postgres DB (in SQL editor) before starting the backend.
-- Prisma expects: gallery.hashtags TEXT[] NOT NULL DEFAULT '{}'

ALTER TABLE "gallery"
ADD COLUMN IF NOT EXISTS "hashtags" TEXT[] NOT NULL DEFAULT '{}';

-- Optional (recommended): speed up hashtag search.
CREATE INDEX IF NOT EXISTS "gallery_hashtags_gin_idx" ON "gallery" USING GIN ("hashtags");

