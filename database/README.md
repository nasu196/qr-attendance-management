# QR勤怠管理システム - Supabaseデータベース設定

## 概要
このドキュメントでは、ConvexからSupabaseへの移行に伴うデータベース設定について説明します。

## 前提条件
- Supabaseプロジェクト「qr-attendance-dev」が作成済み
- Clerk認証システムが設定済み

## 設定手順

### 1. 環境変数の設定
プロジェクトルートに `.env.local` ファイルを作成し、以下の内容を設定してください：

```env
# Supabase環境変数
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Clerk環境変数
VITE_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key-here
```

**値の取得方法：**
- Supabaseダッシュボード → Settings → API で URL と anon key を取得
- Clerkダッシュボード → API Keys で Publishable key を取得

### 2. データベーススキーマの実行

1. Supabaseダッシュボードにアクセス
2. 「SQL Editor」を開く
3. `database/schema.sql` の内容をコピー&ペースト
4. 「Run」ボタンをクリックして実行

### 3. Row Level Security (RLS) の確認
スキーマ実行後、以下が自動的に設定されます：
- 各テーブルでRLSが有効化
- ユーザーは自分のデータのみアクセス可能
- Clerk JWTトークンによる認証

## データベース構造

### 主要テーブル
- **users**: Clerk認証連携ユーザー情報
- **staff**: スタッフ情報（QRコード含む）
- **attendance**: 勤怠記録（出勤・退勤）
- **work_settings**: 勤務設定（日勤・夜勤・パート等）
- **qr_attendance_urls**: QR打刻URL管理
- **staff_monthly_settings**: 月次勤怠設定適用
- **help_articles**: ヘルプ記事
- **ai_chat_history**: AIチャット履歴

### 関係性
```
users (1) → (n) staff
users (1) → (n) work_settings
users (1) → (n) attendance
staff (1) → (n) attendance
work_settings (1) → (n) staff_monthly_settings
```

## 初期データ
スキーマには以下の初期データが含まれています：
- サンプルユーザー（Clerk User ID: `user_example123`）
- 基本的な勤務設定（日勤・夜勤・パート）

**重要：** 本番環境では、サンプルデータを削除してください。

## 注意事項

### セキュリティ
- RLSにより、ユーザーは自分のデータのみアクセス可能
- Clerk JWTトークンによる認証が必要
- 環境変数ファイル（.env.local）はGitにコミットしないでください

### パフォーマンス
- 主要なクエリパターンに対してインデックスを設定済み
- タイムスタンプフィールドには自動更新トリガーを設定

### Clerk連携
- `users.clerk_user_id` がクレークユーザーとの紐付けキー
- 新規ユーザー登録時は `src/lib/user.ts` の関数を使用

## トラブルシューティング

### よくある問題
1. **環境変数エラー**: `.env.local` のファイル名と値を確認
2. **RLSエラー**: Clerk認証が正しく設定されているかを確認
3. **接続エラー**: Supabase URL とキーが正しいかを確認

### デバッグ方法
```javascript
// Supabase接続テスト
import { supabase } from './src/lib/supabase'

// 接続確認
const { data, error } = await supabase.from('users').select('count')
console.log('Connection test:', { data, error })
```

## 次のステップ
1. 各コンポーネントでSupabaseクライアントの実装
2. Convexダミー実装の置き換え
3. リアルタイム機能の実装（必要に応じて） 