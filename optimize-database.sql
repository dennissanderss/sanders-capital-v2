-- ============================================================
-- Sanders Capital — Database optimalisatie
-- Voer dit uit in Supabase SQL Editor
-- ============================================================

-- 1. Zorg dat documents kolom bestaat in kennisbank_items
ALTER TABLE public.kennisbank_items
  ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '[]'::jsonb;

-- 2. Zorg dat alle JSONB kolommen nooit NULL zijn
UPDATE public.kennisbank_items
  SET documents = '[]'::jsonb
  WHERE documents IS NULL;

-- 3. RLS policies voor kennisbank_items (admins mogen alles schrijven)
DO $$
BEGIN
  -- Select: iedereen
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kennisbank_items' AND policyname = 'Anyone can read kennisbank items'
  ) THEN
    CREATE POLICY "Anyone can read kennisbank items"
      ON public.kennisbank_items FOR SELECT USING (true);
  END IF;

  -- Write: alleen admins
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kennisbank_items' AND policyname = 'Admins can manage kennisbank items'
  ) THEN
    CREATE POLICY "Admins can manage kennisbank items"
      ON public.kennisbank_items FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;

-- 4. RLS policies voor articles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'articles' AND policyname = 'Admins can manage articles'
  ) THEN
    CREATE POLICY "Admins can manage articles"
      ON public.articles FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;

-- 5. Verwijder dubbele slugs in articles (behoud nieuwste)
DELETE FROM public.articles a
USING public.articles b
WHERE a.slug = b.slug
  AND a.created_at < b.created_at;

-- 6. Verwijder dubbele slugs in kennisbank_items (behoud nieuwste)
DELETE FROM public.kennisbank_items a
USING public.kennisbank_items b
WHERE a.slug = b.slug
  AND a.id != b.id
  AND a.created_at < b.created_at;

-- 7. Verwijder dubbele slugs in kennisbank_categories (behoud nieuwste)
DELETE FROM public.kennisbank_categories a
USING public.kennisbank_categories b
WHERE a.slug = b.slug
  AND a.id != b.id
  AND a.order_index > b.order_index;

-- 8. Unique constraints (voorkomt dubbele slugs in de toekomst)
ALTER TABLE public.articles
  DROP CONSTRAINT IF EXISTS articles_slug_key;
ALTER TABLE public.articles
  ADD CONSTRAINT articles_slug_key UNIQUE (slug);

ALTER TABLE public.kennisbank_items
  DROP CONSTRAINT IF EXISTS kennisbank_items_slug_key;
ALTER TABLE public.kennisbank_items
  ADD CONSTRAINT kennisbank_items_slug_key UNIQUE (slug);

-- 9. Indexen voor betere performance
CREATE INDEX IF NOT EXISTS idx_articles_published ON public.articles(published);
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON public.articles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kennisbank_items_category ON public.kennisbank_items(category);
CREATE INDEX IF NOT EXISTS idx_kennisbank_items_order ON public.kennisbank_items(order_index);

-- 10. Zorg dat profiles tabel RLS heeft voor admins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'Admins can update all profiles'
  ) THEN
    CREATE POLICY "Admins can update all profiles"
      ON public.profiles FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p2
          WHERE p2.id = auth.uid() AND p2.role = 'admin'
        )
      );
  END IF;
END $$;

-- Klaar!
SELECT 'Database optimalisatie voltooid' AS status;
