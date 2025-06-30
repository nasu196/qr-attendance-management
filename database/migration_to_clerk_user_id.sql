-- データ移行SQL: user_id から clerk_user_id へ統一
-- 実行前: 必ずデータのバックアップを取ってください

-- 1. 既存テーブルの一時的なRLS無効化（移行作業のため）
ALTER TABLE staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE work_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE qr_attendance_urls DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff_monthly_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE help_articles DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_history DISABLE ROW LEVEL SECURITY;

-- 2. 新しいカラム追加（既存データを保持したまま）
ALTER TABLE staff ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;
ALTER TABLE work_settings ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;
ALTER TABLE qr_attendance_urls ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;
ALTER TABLE staff_monthly_settings ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;
ALTER TABLE help_articles ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;
ALTER TABLE ai_chat_history ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;

-- 3. データの移行（usersテーブルからclerk_user_idを取得して更新）
UPDATE staff SET clerk_user_id = u.clerk_user_id 
FROM users u WHERE staff.user_id = u.id;

UPDATE work_settings SET clerk_user_id = u.clerk_user_id 
FROM users u WHERE work_settings.user_id = u.id;

UPDATE attendance SET clerk_user_id = u.clerk_user_id 
FROM users u WHERE attendance.user_id = u.id;

UPDATE qr_attendance_urls SET clerk_user_id = u.clerk_user_id 
FROM users u WHERE qr_attendance_urls.user_id = u.id;

UPDATE staff_monthly_settings SET clerk_user_id = u.clerk_user_id 
FROM users u WHERE staff_monthly_settings.user_id = u.id;

UPDATE help_articles SET clerk_user_id = u.clerk_user_id 
FROM users u WHERE help_articles.user_id = u.id;

UPDATE ai_chat_history SET clerk_user_id = u.clerk_user_id 
FROM users u WHERE ai_chat_history.user_id = u.id;

-- 4. clerk_user_idにNOT NULL制約を追加
ALTER TABLE staff ALTER COLUMN clerk_user_id SET NOT NULL;
ALTER TABLE work_settings ALTER COLUMN clerk_user_id SET NOT NULL;
ALTER TABLE attendance ALTER COLUMN clerk_user_id SET NOT NULL;
ALTER TABLE qr_attendance_urls ALTER COLUMN clerk_user_id SET NOT NULL;
ALTER TABLE staff_monthly_settings ALTER COLUMN clerk_user_id SET NOT NULL;
ALTER TABLE help_articles ALTER COLUMN clerk_user_id SET NOT NULL;
ALTER TABLE ai_chat_history ALTER COLUMN clerk_user_id SET NOT NULL;

-- 5. 古いuser_idカラムを削除
ALTER TABLE staff DROP COLUMN IF EXISTS user_id;
ALTER TABLE work_settings DROP COLUMN IF EXISTS user_id;
ALTER TABLE attendance DROP COLUMN IF EXISTS user_id;
ALTER TABLE qr_attendance_urls DROP COLUMN IF EXISTS user_id;
ALTER TABLE staff_monthly_settings DROP COLUMN IF EXISTS user_id;
ALTER TABLE help_articles DROP COLUMN IF EXISTS user_id;
ALTER TABLE ai_chat_history DROP COLUMN IF EXISTS user_id;

-- 6. 不要になったusersテーブルを削除
DROP TABLE IF EXISTS users;

-- 7. 新しいインデックスの作成
DROP INDEX IF EXISTS idx_staff_user_id;
DROP INDEX IF EXISTS idx_work_settings_user_id;
DROP INDEX IF EXISTS idx_attendance_user_id;
DROP INDEX IF EXISTS idx_qr_attendance_urls_user_id;
DROP INDEX IF EXISTS idx_staff_monthly_settings_user_id;
DROP INDEX IF EXISTS idx_help_articles_user_id;
DROP INDEX IF EXISTS idx_ai_chat_history_user_id;

CREATE INDEX IF NOT EXISTS idx_staff_clerk_user_id ON staff(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_work_settings_clerk_user_id ON work_settings(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_clerk_user_id ON attendance(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_qr_attendance_urls_clerk_user_id ON qr_attendance_urls(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_monthly_settings_clerk_user_id ON staff_monthly_settings(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_help_articles_clerk_user_id ON help_articles(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_history_clerk_user_id ON ai_chat_history(clerk_user_id);

-- 8. 古いRLSポリシーを削除
DROP POLICY IF EXISTS "Users can manage own staff" ON staff;
DROP POLICY IF EXISTS "Users can manage own work settings" ON work_settings;
DROP POLICY IF EXISTS "Users can manage own attendance" ON attendance;
DROP POLICY IF EXISTS "Users can manage own QR URLs" ON qr_attendance_urls;
DROP POLICY IF EXISTS "Users can manage own monthly settings" ON staff_monthly_settings;
DROP POLICY IF EXISTS "Users can manage own help articles" ON help_articles;
DROP POLICY IF EXISTS "Users can manage own chat history" ON ai_chat_history;

-- 9. 新しいRLSポリシーの作成
CREATE POLICY "Users can manage own staff" ON staff
  FOR ALL USING (clerk_user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can manage own work settings" ON work_settings
  FOR ALL USING (clerk_user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can manage own attendance" ON attendance
  FOR ALL USING (clerk_user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can manage own QR URLs" ON qr_attendance_urls
  FOR ALL USING (clerk_user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can manage own monthly settings" ON staff_monthly_settings
  FOR ALL USING (clerk_user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can manage own help articles" ON help_articles
  FOR ALL USING (clerk_user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can manage own chat history" ON ai_chat_history
  FOR ALL USING (clerk_user_id = auth.jwt() ->> 'sub');

-- 10. RLSの再有効化
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_attendance_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_monthly_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_history ENABLE ROW LEVEL SECURITY; 