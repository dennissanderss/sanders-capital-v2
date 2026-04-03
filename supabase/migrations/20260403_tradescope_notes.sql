-- ============================================================
-- TradeScope Pro - Notes & Checklist
-- ============================================================

-- 1. Checklist items (task list)
CREATE TABLE IF NOT EXISTS ts_note_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text text NOT NULL DEFAULT '',
  checked boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ts_note_items_user ON ts_note_items(user_id, sort_order);

ALTER TABLE ts_note_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own note items" ON ts_note_items
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Free-form notes (single row per user, like a scratchpad)
CREATE TABLE IF NOT EXISTS ts_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ts_notes_user ON ts_notes(user_id);

ALTER TABLE ts_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own notes" ON ts_notes
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
