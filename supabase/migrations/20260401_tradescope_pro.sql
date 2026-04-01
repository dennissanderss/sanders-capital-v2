-- ============================================================
-- TradeScope Pro - Database Schema
-- ============================================================

-- 1. Trading Accounts
CREATE TABLE IF NOT EXISTS ts_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('demo', 'sim', 'live', 'funded', 'prop_firm')),
  broker text,
  starting_balance numeric(12,2) NOT NULL DEFAULT 10000,
  currency text NOT NULL DEFAULT 'USD',
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ts_accounts_user ON ts_accounts(user_id, is_active);

-- 2. Strategies
CREATE TABLE IF NOT EXISTS ts_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  rules text,
  is_active boolean DEFAULT true,
  color text DEFAULT '#3d6ea5',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Setups
CREATE TABLE IF NOT EXISTS ts_setups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 4. Import history
CREATE TABLE IF NOT EXISTS ts_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES ts_accounts(id) ON DELETE SET NULL,
  filename text NOT NULL,
  format text NOT NULL DEFAULT 'generic',
  column_mapping jsonb,
  trade_count integer DEFAULT 0,
  status text DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- 5. Trades (core table)
CREATE TABLE IF NOT EXISTS ts_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES ts_accounts(id) ON DELETE SET NULL,
  strategy_id uuid REFERENCES ts_strategies(id) ON DELETE SET NULL,
  setup_id uuid REFERENCES ts_setups(id) ON DELETE SET NULL,
  import_id uuid REFERENCES ts_imports(id) ON DELETE SET NULL,

  -- Trade data
  symbol text NOT NULL,
  action text NOT NULL CHECK (action IN ('buy', 'sell')),
  lot_size numeric(10,4) DEFAULT 0,
  open_price numeric(12,6) NOT NULL,
  close_price numeric(12,6),
  sl numeric(12,6),
  tp numeric(12,6),
  exit_price numeric(12,6),
  commission numeric(10,2) DEFAULT 0,
  swap numeric(10,2) DEFAULT 0,

  -- Results
  pips numeric(10,2),
  profit_loss numeric(12,2),
  risk_reward numeric(6,2),
  result_r numeric(6,2),
  risk_amount numeric(12,2),
  position_size numeric(10,4),

  -- Dates
  open_date timestamptz NOT NULL,
  close_date timestamptz,
  holding_time_minutes integer,

  -- Session info
  session text,
  day_of_week text,
  asset_class text,
  environment text DEFAULT 'live' CHECK (environment IN ('backtest', 'sim', 'demo', 'live', 'funded')),

  -- Journal fields
  notes text,
  mistakes text,
  lessons text,
  entry_reason text,
  exit_reason text,
  tags text[],
  confluences text[],

  -- Scoring
  confidence_score integer CHECK (confidence_score BETWEEN 1 AND 5),
  trade_quality integer CHECK (trade_quality BETWEEN 1 AND 5),
  execution_quality integer CHECK (execution_quality BETWEEN 1 AND 5),

  -- Emotions
  emotion_before text,
  emotion_during text,
  emotion_after text,

  -- Discipline flags
  rules_followed boolean,
  was_impulsive boolean DEFAULT false,
  was_revenge boolean DEFAULT false,
  was_overtrading boolean DEFAULT false,
  htf_bias_respected boolean,
  news_checked boolean,

  -- Status
  status text DEFAULT 'closed' CHECK (status IN ('open', 'closed', 'cancelled')),
  is_win boolean GENERATED ALWAYS AS (profit_loss > 0) STORED,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ts_trades_user_date ON ts_trades(user_id, open_date DESC);
CREATE INDEX IF NOT EXISTS idx_ts_trades_account ON ts_trades(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_ts_trades_symbol ON ts_trades(user_id, symbol);
CREATE INDEX IF NOT EXISTS idx_ts_trades_strategy ON ts_trades(user_id, strategy_id);

-- 6. Trade screenshots
CREATE TABLE IF NOT EXISTS ts_trade_screenshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES ts_trades(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  label text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ts_screenshots_trade ON ts_trade_screenshots(trade_id);

-- 7. Daily routines / psychology
CREATE TABLE IF NOT EXISTS ts_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,

  -- Pre-session
  sleep_quality integer CHECK (sleep_quality BETWEEN 1 AND 5),
  exercised boolean DEFAULT false,
  meditated boolean DEFAULT false,
  news_checked boolean DEFAULT false,
  plan_written boolean DEFAULT false,
  prepared_properly boolean DEFAULT false,

  -- Mood
  mood_before integer CHECK (mood_before BETWEEN 1 AND 5),
  mood_after integer CHECK (mood_after BETWEEN 1 AND 5),
  focus_level integer CHECK (focus_level BETWEEN 1 AND 5),
  stress_level integer CHECK (stress_level BETWEEN 1 AND 5),

  -- Post-session
  followed_plan boolean,
  overtraded boolean DEFAULT false,
  revenge_traded boolean DEFAULT false,
  forced_setups boolean DEFAULT false,
  broke_risk_rules boolean DEFAULT false,
  felt_fear boolean DEFAULT false,
  felt_greed boolean DEFAULT false,
  felt_frustration boolean DEFAULT false,

  -- Scores
  discipline_score integer CHECK (discipline_score BETWEEN 1 AND 10),
  execution_score integer CHECK (execution_score BETWEEN 1 AND 10),
  patience_score integer CHECK (patience_score BETWEEN 1 AND 10),

  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(user_id, date)
);

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE ts_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ts_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ts_setups ENABLE ROW LEVEL SECURITY;
ALTER TABLE ts_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ts_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE ts_trade_screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ts_routines ENABLE ROW LEVEL SECURITY;

-- Accounts
CREATE POLICY "Users manage own accounts" ON ts_accounts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Strategies
CREATE POLICY "Users manage own strategies" ON ts_strategies
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Setups
CREATE POLICY "Users manage own setups" ON ts_setups
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Imports
CREATE POLICY "Users manage own imports" ON ts_imports
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trades
CREATE POLICY "Users manage own trades" ON ts_trades
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Screenshots
CREATE POLICY "Users manage own screenshots" ON ts_trade_screenshots
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Routines
CREATE POLICY "Users manage own routines" ON ts_routines
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Storage bucket for trade screenshots
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('trade-screenshots', 'trade-screenshots', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own screenshots" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'trade-screenshots' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users read own screenshots" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'trade-screenshots' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own screenshots" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'trade-screenshots' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Public read for screenshot URLs
CREATE POLICY "Public read trade screenshots" ON storage.objects
  FOR SELECT USING (bucket_id = 'trade-screenshots');
