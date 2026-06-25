-- ═══════════════════════════════════════════════════════════════
-- Sanders Capital — Fundamental Briefing (nieuwe, schone tool)
-- Eigen tabellen, volledig los van trade_focus_records (oude tool).
-- Trackrecord wordt VOORUIT opgebouwd: geen backfill, geen look-ahead.
-- ═══════════════════════════════════════════════════════════════

-- Eén gelockte call (daily of weekly). Vastgezet bij genereren 's ochtends.
CREATE TABLE IF NOT EXISTS fb_calls (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_date    DATE NOT NULL,                 -- handelsdag waar de call bij hoort
  call_type    TEXT NOT NULL,                 -- 'daily' | 'weekly'
  pair         TEXT NOT NULL,
  base         TEXT NOT NULL,
  quote        TEXT NOT NULL,
  direction    TEXT NOT NULL,                 -- 'bullish' | 'bearish'
  fund_score   NUMERIC(5,2) NOT NULL,         -- ruwe fundamentele onbalans -5..+5
  conviction   NUMERIC(4,1) NOT NULL,         -- 0..10
  breakdown    JSONB NOT NULL,                -- conviction-componenten
  regime       TEXT NOT NULL,
  entry_price  NUMERIC(14,6) NOT NULL,        -- slotkoers waarop het signaal is berekend
  entry_date   DATE NOT NULL,                 -- datum van die slotkoers
  reasoning    JSONB NOT NULL,                -- factoren per valuta, momentum, regime
  status       TEXT NOT NULL DEFAULT 'open',  -- 'open' | 'complete'
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (call_date, call_type, pair)
);
CREATE INDEX IF NOT EXISTS idx_fb_calls_date ON fb_calls (call_date);
CREATE INDEX IF NOT EXISTS idx_fb_calls_type ON fb_calls (call_type);

-- Eén directioneel oordeel per call per horizon (close-to-close).
-- mfe/mae = grootste favorabele/adverse beweging binnen de horizon, met
-- koers + datum erbij zodat pips altijd na te rekenen zijn in TradingView.
CREATE TABLE IF NOT EXISTS fb_outcomes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id      UUID NOT NULL REFERENCES fb_calls(id) ON DELETE CASCADE,
  horizon      INT NOT NULL,                  -- 1,3,5,10,20 handelsdagen
  exit_date    DATE,
  exit_price   NUMERIC(14,6),
  correct      BOOLEAN,                       -- null = pending
  mfe_pips     INT,
  mfe_date     DATE,
  mfe_price    NUMERIC(14,6),
  mae_pips     INT,
  mae_date     DATE,
  mae_price    NUMERIC(14,6),
  resolved     BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at  TIMESTAMPTZ,
  UNIQUE (call_id, horizon)
);
CREATE INDEX IF NOT EXISTS idx_fb_outcomes_call ON fb_outcomes (call_id);
CREATE INDEX IF NOT EXISTS idx_fb_outcomes_unresolved ON fb_outcomes (resolved) WHERE resolved = FALSE;
