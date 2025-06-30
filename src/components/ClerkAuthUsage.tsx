// Clerk認証を使ったSupabase関数の呼び出し例（移行後）
import { useUser } from "@clerk/clerk-react";

interface ClerkAuthUsageProps {
  isPremium: boolean;
}

export function ClerkAuthUsage({ isPremium }: ClerkAuthUsageProps) {
  const { user } = useUser();
  
  // TODO: Supabaseクライアントを使ったクエリの例
  // const { data: userData } = useSupabaseQuery('users', { clerkUserId: user?.id });
  
  // TODO: Supabaseミューテーションの例
  // const createOrUpdateUser = useSupabaseMutation('createOrUpdateUser');
  
  // Clerk認証が必要な他のSupabase関数では、以下のパターンを使用予定：
  // 1. フロントエンドでClerk User IDを取得
  // 2. そのIDをSupabase RPCに渡す
  // 3. Supabase RPC内でClerk User IDから対応するユーザーレコードを取得
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Clerk認証情報</h1>
        <div className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm font-medium">
          開発用機能
        </div>
      </div>

      {/* 移行作業中の通知 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-yellow-800">
          <span className="text-2xl">🚧</span>
          <div>
            <p className="font-medium">移行作業中</p>
            <p className="text-sm">Clerk認証機能はSupabase移行後に再実装されます。現在はデモ表示中です。</p>
          </div>
        </div>
      </div>

      {/* ユーザー情報 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">現在のユーザー情報</h2>
        {user ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">ユーザーID</label>
                <p className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded">{user.id}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">メールアドレス</label>
                <p className="text-sm text-gray-900">{user.primaryEmailAddress?.emailAddress || "未設定"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">ユーザー名</label>
                <p className="text-sm text-gray-900">{user.username || "未設定"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">フルネーム</label>
                <p className="text-sm text-gray-900">{user.fullName || "未設定"}</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">ユーザー情報を読み込み中...</p>
        )}
      </div>

      {/* デバッグ情報 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">デバッグ情報</h2>
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🔧</div>
          <h3 className="text-xl font-semibold mb-2">移行作業中</h3>
          <p>Clerk統合機能はSupabase移行後に実装されます</p>
          <div className="mt-6 text-sm text-gray-400">
            <p>実装予定機能:</p>
            <ul className="mt-2 space-y-1">
              <li>• ユーザー同期機能</li>
              <li>• 認証状態管理</li>
              <li>• デバッグ情報表示</li>
              <li>• ユーザーデータ操作</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/*
Supabase関数での使用例（移行後）:

-- RPC function example
CREATE OR REPLACE FUNCTION get_user_by_clerk_id(clerk_user_id TEXT)
RETURNS users
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM users WHERE clerk_user_id = clerk_user_id LIMIT 1;
$$;

-- TypeScript client example
const { data: user } = await supabase
  .rpc('get_user_by_clerk_id', { clerk_user_id: user?.id })
  .single();
*/ 