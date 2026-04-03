-- ============================================================
-- Custom Filters for TradeMind
-- Allows users to create custom filter categories with options
-- and assign them to trades for strategy analysis.
-- ============================================================

-- Filter definitions: categories + options
CREATE TABLE IF NOT EXISTS ts_custom_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  label text NOT NULL,
  color text DEFAULT NULL,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Junction: link filters to trades (many-to-many)
CREATE TABLE IF NOT EXISTS ts_trade_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES ts_trades(id) ON DELETE CASCADE,
  filter_id uuid NOT NULL REFERENCES ts_custom_filters(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(trade_id, filter_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ts_custom_filters_user ON ts_custom_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_ts_custom_filters_category ON ts_custom_filters(user_id, category);
CREATE INDEX IF NOT EXISTS idx_ts_trade_filters_trade ON ts_trade_filters(trade_id);
CREATE INDEX IF NOT EXISTS idx_ts_trade_filters_filter ON ts_trade_filters(filter_id);

-- RLS policies
ALTER TABLE ts_custom_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE ts_trade_filters ENABLE ROW LEVEL SECURITY;

-- ts_custom_filters: users can only see/manage their own
CREATE POLICY "Users can view own custom filters"
  ON ts_custom_filters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own custom filters"
  ON ts_custom_filters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own custom filters"
  ON ts_custom_filters FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own custom filters"
  ON ts_custom_filters FOR DELETE
  USING (auth.uid() = user_id);

-- ts_trade_filters: users can manage via join to their trades
CREATE POLICY "Users can view own trade filters"
  ON ts_trade_filters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ts_trades
      WHERE ts_trades.id = ts_trade_filters.trade_id
      AND ts_trades.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own trade filters"
  ON ts_trade_filters FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ts_trades
      WHERE ts_trades.id = ts_trade_filters.trade_id
      AND ts_trades.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own trade filters"
  ON ts_trade_filters FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM ts_trades
      WHERE ts_trades.id = ts_trade_filters.trade_id
      AND ts_trades.user_id = auth.uid()
    )
  );
