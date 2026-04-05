-- ─── Execution Signals Table ──────────────────────────────────
-- Stores daily technical + fundamental verdicts for all 21 pairs.
-- Links to the existing fundamental briefing system.
-- Tracks outcomes when trades are taken and resolved.

CREATE TABLE IF NOT EXISTS execution_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  pair text NOT NULL,

  -- Fundamental layer
  fund_direction text NOT NULL,
  fund_conviction text NOT NULL,
  fund_score numeric(4,2) NOT NULL,
  regime text,

  -- Technical layer
  tech_htf_bias text,
  tech_setup_status text,
  tech_fib_level numeric(12,6),
  tech_sl numeric(12,6),
  tech_tp1 numeric(12,6),
  tech_tp2 numeric(12,6),
  tech_ltf_breaks integer,
  tech_score numeric(4,2),

  -- Combined
  composite_score numeric(4,2) NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('SKIP','WATCHLIST','VALID','HIGH_CONVICTION')),
  position_size numeric(10,4),
  risk_pct numeric(4,2),

  -- Execution outcome (filled when trade is taken + resolved)
  was_triggered boolean DEFAULT false,
  entry_price numeric(12,6),
  exit_price numeric(12,6),
  result text CHECK (result IN ('win_tp1','win_tp2','loss','breakeven','pending',NULL)),
  pips_result numeric(10,2),

  reasons text[],
  created_at timestamptz DEFAULT now(),
  UNIQUE(date, pair)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_exec_signals_date ON execution_signals(date DESC);
CREATE INDEX IF NOT EXISTS idx_exec_signals_verdict ON execution_signals(verdict);
CREATE INDEX IF NOT EXISTS idx_exec_signals_pair ON execution_signals(pair);

-- RLS
ALTER TABLE execution_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read execution signals" ON execution_signals
  FOR SELECT USING (true);
