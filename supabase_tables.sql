-- Yonder データベーステーブル

-- 作品テーブル
CREATE TABLE novels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  catchcopy TEXT NOT NULL CHECK (char_length(catchcopy) <= 50),
  body TEXT NOT NULL,
  genre TEXT,
  char_count INTEGER,
  author_id UUID REFERENCES auth.users(id),
  narou_url TEXT,
  kakuyomu_url TEXT,
  x_url TEXT,
  is_visible BOOLEAN DEFAULT true,
  bayes_score FLOAT DEFAULT 0.65,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 評価テーブル（読了・離脱どちらも）
CREATE TABLE reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  novel_id UUID REFERENCES novels(id),
  user_id UUID REFERENCES auth.users(id),
  rating TEXT CHECK (rating IN ('good','mid','bad')) NOT NULL,
  is_completed BOOLEAN DEFAULT true,
  bail_reason TEXT,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 統計テーブル
CREATE TABLE novel_stats (
  novel_id UUID REFERENCES novels(id) PRIMARY KEY,
  good_count INTEGER DEFAULT 0,
  mid_count INTEGER DEFAULT 0,
  bad_count INTEGER DEFAULT 0,
  shown_count INTEGER DEFAULT 0,
  chosen_count INTEGER DEFAULT 0,
  not_chosen_count INTEGER DEFAULT 0,
  bayes_score FLOAT DEFAULT 0.65,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- スキップ管理テーブル（1日3回）
CREATE TABLE skips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  skip_date DATE DEFAULT CURRENT_DATE,
  count INTEGER DEFAULT 0,
  UNIQUE(user_id, skip_date)
);

-- 読書ロックテーブル（評価するまで次が読めない）
CREATE TABLE reading_lock (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  novel_id UUID REFERENCES novels(id),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
