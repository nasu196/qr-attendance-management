-- QR勤怠管理システム - Supabaseデータベーススキーマ
-- 作成日: 2024年現在
-- プロジェクト: qr-attendance-dev

-- 1. ユーザーテーブル (Clerk認証連携)
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id TEXT UNIQUE NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  image_url TEXT,
  is_premium BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. スタッフテーブル
CREATE TABLE IF NOT EXISTS staff (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  qr_code_data TEXT UNIQUE NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 勤務設定テーブル
CREATE TABLE IF NOT EXISTS work_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  work_hours NUMERIC(4,2) NOT NULL, -- 勤務時間（小数点以下2桁まで）
  break_hours NUMERIC(4,2) NOT NULL, -- 休憩時間
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 勤怠記録テーブル
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('clock_in', 'clock_out')),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  qr_code_data TEXT,
  is_corrected BOOLEAN DEFAULT false,
  correction_reason TEXT,
  corrected_by UUID REFERENCES users(id),
  corrected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. QR打刻URLテーブル
CREATE TABLE IF NOT EXISTS qr_attendance_urls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  url_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by TEXT, -- Clerk user ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. スタッフ月次勤怠設定テーブル
CREATE TABLE IF NOT EXISTS staff_monthly_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  work_setting_id UUID REFERENCES work_settings(id) ON DELETE SET NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  date TEXT NOT NULL, -- YYYY-MM-DD形式
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(staff_id, year, month, date)
);

-- 7. ヘルプ記事テーブル
CREATE TABLE IF NOT EXISTS help_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  category TEXT,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. AIチャット履歴テーブル
CREATE TABLE IF NOT EXISTS ai_chat_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_user_id ON staff(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_qr_code_data ON staff(qr_code_data);
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_staff_id ON attendance(staff_id);
CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance(timestamp);
CREATE INDEX IF NOT EXISTS idx_work_settings_user_id ON work_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_qr_attendance_urls_user_id ON qr_attendance_urls(user_id);
CREATE INDEX IF NOT EXISTS idx_qr_attendance_urls_url_id ON qr_attendance_urls(url_id);
CREATE INDEX IF NOT EXISTS idx_staff_monthly_settings_staff_id ON staff_monthly_settings(staff_id);
CREATE INDEX IF NOT EXISTS idx_help_articles_user_id ON help_articles(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_history_user_id ON ai_chat_history(user_id);

-- Row Level Security (RLS) の有効化
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_attendance_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_monthly_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_history ENABLE ROW LEVEL SECURITY;

-- RLSポリシーの作成（ユーザーは自分のデータのみアクセス可能）
CREATE POLICY "Users can view own data" ON users
  FOR ALL USING (clerk_user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can manage own staff" ON staff
  FOR ALL USING (user_id IN (
    SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
  ));

CREATE POLICY "Users can manage own work settings" ON work_settings
  FOR ALL USING (user_id IN (
    SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
  ));

CREATE POLICY "Users can manage own attendance" ON attendance
  FOR ALL USING (user_id IN (
    SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
  ));

CREATE POLICY "Users can manage own QR URLs" ON qr_attendance_urls
  FOR ALL USING (user_id IN (
    SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
  ));

CREATE POLICY "Users can manage own monthly settings" ON staff_monthly_settings
  FOR ALL USING (user_id IN (
    SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
  ));

CREATE POLICY "Users can manage own help articles" ON help_articles
  FOR ALL USING (user_id IN (
    SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
  ));

CREATE POLICY "Users can manage own chat history" ON ai_chat_history
  FOR ALL USING (user_id IN (
    SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
  ));

-- updated_atの自動更新トリガー関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_atトリガーの作成
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_work_settings_updated_at BEFORE UPDATE ON work_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qr_attendance_urls_updated_at BEFORE UPDATE ON qr_attendance_urls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_help_articles_updated_at BEFORE UPDATE ON help_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- サンプルデータの挿入（開発用）
-- 注意: 本番環境では削除してください

-- ダミーユーザー（Clerk User IDは実際の値に置き換える必要があります）
INSERT INTO users (clerk_user_id, name, email, is_premium) VALUES
('user_example123', 'テストユーザー', 'test@example.com', true)
ON CONFLICT (clerk_user_id) DO NOTHING;

-- 初期勤務設定
INSERT INTO work_settings (user_id, name, work_hours, break_hours, description)
SELECT id, '日勤', 8.0, 1.0, '一般的な日勤シフト'
FROM users WHERE clerk_user_id = 'user_example123'
ON CONFLICT DO NOTHING;

INSERT INTO work_settings (user_id, name, work_hours, break_hours, description)
SELECT id, '夜勤', 8.0, 1.0, '夜勤シフト'
FROM users WHERE clerk_user_id = 'user_example123'
ON CONFLICT DO NOTHING;

INSERT INTO work_settings (user_id, name, work_hours, break_hours, description)
SELECT id, 'パート', 4.0, 0.5, 'パートタイム勤務'
FROM users WHERE clerk_user_id = 'user_example123'
ON CONFLICT DO NOTHING; 