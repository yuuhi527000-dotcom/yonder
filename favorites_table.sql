-- お気に入りテーブル
CREATE TABLE favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  novel_id UUID REFERENCES novels(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, novel_id)
);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manage_own_favorites" ON favorites
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- reading_lockにis_from_favカラムを追加
ALTER TABLE reading_lock ADD COLUMN IF NOT EXISTS is_from_fav BOOLEAN DEFAULT false;
