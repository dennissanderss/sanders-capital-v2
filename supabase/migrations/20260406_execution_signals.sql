-- ─── Execution Signals Table ──────────────────────────────────
-- Dagelijks trackrecord voor de Execution Engine.
-- Slaat concrete trades op met momentum status per model.
-- Resolved na 1 handelsdag via cron job.

CREATE TABLE IF NOT EXISTS execution_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  pair text NOT NULL,

  -- Fundamental (van briefing)
  fund_direction text NOT NULL,
  fund_conviction text NOT NULL,
  fund_score numeric(4,2) NOT NULL,
  regime text,

  -- Momentum data
  momentum_5d numeric(10,2),
  is_contrarian boolean DEFAULT false,

  -- Per model: is dit pair in de momentum zone?
  selective_in_zone boolean DEFAULT false,
  balanced_in_zone boolean DEFAULT false,
  aggressive_in_zone boolean DEFAULT false,

  -- Entry/exit (dagkoersen via Yahoo Finance)
  entry_price numeric(12,6),
  exit_price numeric(12,6),

  -- Resultaat (resolved na 1 handelsdag)
  result text CHECK (result IN ('correct','incorrect','pending')),
  pips_moved numeric(10,2),

  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE(date, pair)
);

CREATE INDEX IF NOT EXISTS idx_exec_signals_date ON execution_signals(date DESC);
CREATE INDEX IF NOT EXISTS idx_exec_signals_pair ON execution_signals(pair);
CREATE INDEX IF NOT EXISTS idx_exec_signals_result ON execution_signals(result);

ALTER TABLE execution_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read execution signals" ON execution_signals
  FOR SELECT USING (true);
