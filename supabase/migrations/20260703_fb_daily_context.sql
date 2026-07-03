-- Fundamental Briefing v2: gelockte dag-header (bias-strip + regime).
-- De header wordt bij de ochtend-generate één keer berekend (incl. LLM-nieuws,
-- kalender-verrassingen en grondstoffen) en hier vastgelegd, zodat de
-- bias-strip — net als de calls — de hele dag vaststaat en pageloads geen
-- LLM/kalender-calls meer doen.
--
-- Handmatig draaien in de Supabase SQL-editor (net als de vorige migraties).

-- Zelfde toegangsmodel als fb_calls/fb_outcomes (geen RLS; alleen de
-- server praat met deze tabel, via de service-role key).
CREATE TABLE IF NOT EXISTS fb_daily_context (
  ctx_date    DATE PRIMARY KEY,
  header      JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
