-- =====================================================
-- Yonder ランキング機能・ニックネーム機能 SQL
-- Supabase SQL Editor で実行してください
-- =====================================================

-- 1. profiles テーブルにカラム追加
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pen_name TEXT,
  ADD COLUMN IF NOT EXISTS booker_number INTEGER;

-- 2. booker_number にユニーク制約
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_booker_number_key;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_booker_number_key UNIQUE (booker_number);

-- 3. 既存ユーザー（pen_name が NULL）に Booker# を登録順に一括割り当て
-- auth.users の created_at 順に連番を振る
WITH ordered AS (
  SELECT
    u.id,
    ROW_NUMBER() OVER (ORDER BY u.created_at ASC) AS rn
  FROM auth.users u
  LEFT JOIN profiles p ON p.user_id = u.id
  WHERE p.pen_name IS NULL OR p.user_id IS NULL
),
max_num AS (
  SELECT COALESCE(MAX(booker_number), 0) AS m FROM profiles
)
INSERT INTO profiles (user_id, booker_number, pen_name, updated_at)
SELECT
  o.id,
  (SELECT m FROM max_num) + o.rn,
  'Booker#' || LPAD(((SELECT m FROM max_num) + o.rn)::TEXT, 4, '0'),
  NOW()
FROM ordered o
ON CONFLICT (user_id) DO UPDATE
  SET
    booker_number = EXCLUDED.booker_number,
    pen_name = EXCLUDED.pen_name,
    updated_at = NOW()
WHERE profiles.pen_name IS NULL;

-- 4. ランキング集計テーブル（毎日 0:00 に Vercel Cron が更新）
CREATE TABLE IF NOT EXISTS reader_ranking (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  total_chars BIGINT DEFAULT 0,
  novel_count INTEGER DEFAULT 0,
  rank INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE reader_ranking ENABLE ROW LEVEL SECURITY;

-- 全ログインユーザーが読める
CREATE POLICY IF NOT EXISTS "read_ranking" ON reader_ranking
  FOR SELECT TO authenticated USING (true);

-- service_role のみ書き込み（Cron からは service_role で接続）
CREATE POLICY IF NOT EXISTS "service_write_ranking" ON reader_ranking
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. novels.char_count を必須化（新規投稿のみ。既存は NULL のまま除外）
-- アプリ側で NOT NULL チェックを行うため DB 制約は不要

-- 6. Booker# 採番用の関数（新規ユーザー登録時にアプリから呼ぶ）
CREATE OR REPLACE FUNCTION get_next_booker_number()
RETURNS INTEGER
LANGUAGE SQL
AS $$
  SELECT COALESCE(MAX(booker_number), 0) + 1 FROM profiles;
$$;

GRANT EXECUTE ON FUNCTION get_next_booker_number() TO authenticated;
