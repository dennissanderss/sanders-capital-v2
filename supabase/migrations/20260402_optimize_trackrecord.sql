-- Optimize trade_focus_records for V3 engine queries
-- Safe: only adds indexes (no data changes, no drops)

-- Index for metadata->>source filter (used by trackrecord-v2 API)
CREATE INDEX IF NOT EXISTS idx_trade_focus_records_source
  ON trade_focus_records ((metadata->>'source'));

-- Index for date ordering (used by all trackrecord queries)
CREATE INDEX IF NOT EXISTS idx_trade_focus_records_date
  ON trade_focus_records (date DESC);

-- Composite index for the most common query pattern: source + date
CREATE INDEX IF NOT EXISTS idx_trade_focus_records_source_date
  ON trade_focus_records ((metadata->>'source'), date DESC);

-- Index for pair lookups (used by backfill dedup check)
CREATE INDEX IF NOT EXISTS idx_trade_focus_records_pair_date
  ON trade_focus_records (pair, date);

-- Index for result filtering (used by stats calculations)
CREATE INDEX IF NOT EXISTS idx_trade_focus_records_result
  ON trade_focus_records (result);
