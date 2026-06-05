-- コメント通報機能: reportsテーブルにreview_idカラムを追加
-- Supabaseダッシュボードの SQL Editor で実行してください

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS report_type TEXT CHECK (report_type IN ('novel','comment')) DEFAULT 'novel';

-- report_typeのデフォルト値を既存レコードに設定
UPDATE reports SET report_type = 'novel' WHERE report_type IS NULL;

-- reasonのCHECK制約を拡張（コメント通報用理由を追加）
-- ※ PostgreSQLではCHECK制約の変更はDROP→ADD
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_reason_check;
ALTER TABLE reports ADD CONSTRAINT reports_reason_check
  CHECK (reason IN ('copyright','inappropriate','other','spam','harassment','spoiler'));
