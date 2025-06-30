-- QR勤怠管理システム - Supabaseデータベーススキーマ（Clerk User ID統一版）
-- 作成日: 2024年現在
-- プロジェクト: qr-attendance-dev

-- 1. スタッフテーブル（clerk_user_idを直接使用）
CREATE TABLE IF NOT EXISTS staff (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  qr_code_data TEXT UNIQUE NOT NULL,
  employee_id TEXT UNIQUE NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 勤務設定テーブル
CREATE TABLE IF NOT EXISTS work_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  work_hours NUMERIC(4,2) NOT NULL, -- 勤務時間（小数点以下2桁まで）
  break_hours NUMERIC(4,2) NOT NULL, -- 休憩時間
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 勤怠記録テーブル
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('clock_in', 'clock_out')),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  pair_id UUID,
  qr_code_data TEXT,
  is_corrected BOOLEAN DEFAULT false,
  correction_reason TEXT,
  corrected_by TEXT, -- Clerk user ID
  corrected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. QR打刻URLテーブル
CREATE TABLE IF NOT EXISTS qr_attendance_urls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  url_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by TEXT, -- Clerk user ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. スタッフ月次勤怠設定テーブル
CREATE TABLE IF NOT EXISTS staff_monthly_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  work_setting_id UUID REFERENCES work_settings(id) ON DELETE SET NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  date TEXT NOT NULL, -- YYYY-MM-DD形式
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(staff_id, year, month, date)
);

-- 6. ヘルプ記事テーブル
CREATE TABLE IF NOT EXISTS help_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  category TEXT,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. AIチャット履歴テーブル
CREATE TABLE IF NOT EXISTS ai_chat_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_staff_clerk_user_id ON staff(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_qr_code_data ON staff(qr_code_data);
CREATE INDEX IF NOT EXISTS idx_staff_employee_id ON staff(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_clerk_user_id ON attendance(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_staff_id ON attendance(staff_id);
CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance(timestamp);
CREATE INDEX IF NOT EXISTS idx_work_settings_clerk_user_id ON work_settings(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_qr_attendance_urls_clerk_user_id ON qr_attendance_urls(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_qr_attendance_urls_url_id ON qr_attendance_urls(url_id);
CREATE INDEX IF NOT EXISTS idx_staff_monthly_settings_staff_id ON staff_monthly_settings(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_monthly_settings_clerk_user_id ON staff_monthly_settings(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_help_articles_clerk_user_id ON help_articles(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_history_clerk_user_id ON ai_chat_history(clerk_user_id);

-- Row Level Security (RLS) の有効化
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_attendance_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_monthly_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_history ENABLE ROW LEVEL SECURITY;

-- RLSポリシーの作成（シンプル化：clerk_user_idで直接比較）
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

-- updated_atの自動更新トリガー関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_atトリガーの作成
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_work_settings_updated_at BEFORE UPDATE ON work_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qr_attendance_urls_updated_at BEFORE UPDATE ON qr_attendance_urls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_help_articles_updated_at BEFORE UPDATE ON help_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 