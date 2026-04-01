-- News articles storage for historical access (run in Supabase SQL Editor)
CREATE TABLE IF NOT EXISTS news_articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  title_nl TEXT,
  summary TEXT,
  summary_nl TEXT,
  full_content TEXT,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  category TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  relevance_score INTEGER DEFAULT 0,
  relevance_tags TEXT[] DEFAULT '{}',
  affected_currencies TEXT[] DEFAULT '{}',
  relevance_context TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_news_published_at ON news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_category ON news_articles(category);
CREATE INDEX IF NOT EXISTS idx_news_source ON news_articles(source);

-- RLS: public read, admin write
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read news" ON news_articles
  FOR SELECT USING (true);

CREATE POLICY "Service role can insert news" ON news_articles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update news" ON news_articles
  FOR UPDATE USING (true);
