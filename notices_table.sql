CREATE TABLE notices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_notices" ON notices
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admin_manage_notices" ON notices
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
