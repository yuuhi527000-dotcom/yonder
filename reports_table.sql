-- 通報テーブル
CREATE TABLE reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  novel_id UUID REFERENCES novels(id),
  user_id UUID REFERENCES auth.users(id),
  reason TEXT CHECK (reason IN ('copyright','inappropriate','other')) NOT NULL,
  comment TEXT,
  status TEXT CHECK (status IN ('pending','resolved','dismissed')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLSポリシー
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insert_report" ON reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "read_own_reports" ON reports
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admin_read_all_reports" ON reports
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
