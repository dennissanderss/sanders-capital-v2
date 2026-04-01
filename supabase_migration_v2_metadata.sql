-- V2 Trackrecord: add metadata column for detailed trade data
-- Run this in Supabase SQL Editor AFTER the news_articles migration

ALTER TABLE trade_focus_records ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Index for filtering v2 records
CREATE INDEX IF NOT EXISTS idx_trade_focus_metadata_source
  ON trade_focus_records ((metadata->>'source'));
