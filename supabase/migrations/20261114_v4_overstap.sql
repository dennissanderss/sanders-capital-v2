-- ─── v4-overstap (NOG NIET UITVOEREN) ─────────────────────────
-- Pas draaien in de Supabase SQL-editor op het moment dat de v4-engine
-- na minimaal vier weken schaduwmodus wordt gepromoveerd (fase 7,
-- na akkoord op de schaduwresultaten — zie docs/audit/fundamental-audit.md).
--
-- De schaduwfase zelf heeft GEEN migratie nodig: v4-calls staan als
-- metadata.source='v4-shadow' in trade_focus_records en de dagelijkse
-- inputs in Storage-bucket 'v4-inputs'.
--
-- Additief en idempotent; verwijdert of overschrijft niets.

-- 1. engine_version als echte kolom (nu een metadata-key)
ALTER TABLE public.trade_focus_records
  ADD COLUMN IF NOT EXISTS engine_version text;

UPDATE public.trade_focus_records
   SET engine_version = metadata->>'engine_version'
 WHERE engine_version IS NULL
   AND metadata ? 'engine_version';

CREATE INDEX IF NOT EXISTS idx_trade_focus_engine_version
  ON public.trade_focus_records (engine_version);

-- 2. index om v4-calls snel te filteren (bestond al voor source via
--    idx_trade_focus_metadata_source; deze dekt de combinatie met datum)
CREATE INDEX IF NOT EXISTS idx_trade_focus_source_date
  ON public.trade_focus_records ((metadata->>'source'), date DESC);

-- 3. dagelijkse input-vastlegging als tabel (naast de Storage-JSON's),
--    zodat de inputs ook relationeel te bevragen zijn bij de overstap
CREATE TABLE IF NOT EXISTS public.v4_daily_inputs (
  input_date  date PRIMARY KEY,
  inputs      jsonb NOT NULL,       -- zelfde inhoud als v4-inputs/<datum>.json
  created_at  timestamptz DEFAULT now()
);
