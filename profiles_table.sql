CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  narou_url TEXT,
  kakuyomu_url TEXT,
  x_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage_own_profile" ON profiles
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
