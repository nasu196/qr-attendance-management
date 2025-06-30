import { useState } from "react";
import { useUser } from "@clerk/clerk-react";

interface MonthlyReportProps {
  isPremium: boolean;
}

export function MonthlyReport({ isPremium }: MonthlyReportProps) {
  const { user } = useUser();
  const clerkUserId = user?.id;
  
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // TODO: Supabaseクエリでデータを取得
  const allUsedTags = ['正社員', 'パート', 'アルバイト'];
  const staffList = [
    { _id: '1', name: 'サンプル太郎', tags: ['正社員'] },
    { _id: '2', name: 'テスト花子', tags: ['パート'] }
  ];

  const changeMonth = (delta: number) => {
    const newDate = new Date(currentDate.year, currentDate.month - 1 + delta, 1);
    setCurrentDate({
      year: newDate.getFullYear(),
      month: newDate.getMonth() + 1,
    });
  };

  const monthName = new Date(currentDate.year, currentDate.month - 1, 1).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
  });

  // プロプランでない場合はティザー表示
  if (!isPremium) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">月次レポート</h1>
          <div className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-sm font-medium">
            有料プラン機能
          </div>
        </div>
        
        <div className="relative bg-white rounded-lg shadow p-6">
          <div className="filter blur-sm pointer-events-none">
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg">← 前月</button>
                <h2 className="text-xl font-semibold">{monthName}</h2>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg">次月 →</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-800">総労働時間</h3>
                <p className="text-2xl font-bold text-blue-600">160時間</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-green-800">平均勤務日数</h3>
                <p className="text-2xl font-bold text-green-600">20日</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-purple-800">スタッフ数</h3>
                <p className="text-2xl font-bold text-purple-600">5名</p>
              </div>
            </div>
          </div>
          
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
            <div className="text-center">
              <span className="text-gray-400 text-4xl">📊</span>
              <p className="text-gray-700 font-medium mt-4">月次レポート機能は有料プランでご利用いただけます</p>
              <p className="text-gray-500 text-sm mt-2">スタッフごとの勤務実績、集計データを確認できます</p>
              <p className="text-gray-500 text-sm mt-1">左下の開発用スイッチで有料プランに切り替えてお試しください</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">月次レポート</h1>
            <div className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-sm font-medium">
              有料プラン
            </div>
          </div>
          <p className="text-gray-600 mt-2">スタッフの月次勤務実績と集計データを確認できます</p>
        </div>
      </div>

      {/* 移行作業中の通知 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-yellow-800">
          <span className="text-2xl">🚧</span>
          <div>
            <p className="font-medium">移行作業中</p>
            <p className="text-sm">月次レポート機能はSupabase移行後に完全実装されます。現在はデモ表示中です。</p>
          </div>
        </div>
      </div>

      {/* 月次ナビゲーション */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between">
          <button
            onClick={() => changeMonth(-1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            ← 前月
          </button>
          <h2 className="text-xl font-semibold">{monthName}</h2>
          <button
            onClick={() => changeMonth(1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            次月 →
          </button>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">総労働時間</h3>
          <p className="text-3xl font-bold text-blue-600">サンプル</p>
          <p className="text-sm text-blue-600 mt-1">前月比: +5%</p>
        </div>
        <div className="bg-green-50 p-6 rounded-lg border border-green-200">
          <h3 className="text-lg font-semibold text-green-800 mb-2">平均勤務日数</h3>
          <p className="text-3xl font-bold text-green-600">デモ</p>
          <p className="text-sm text-green-600 mt-1">前月比: +2日</p>
        </div>
        <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
          <h3 className="text-lg font-semibold text-purple-800 mb-2">アクティブスタッフ数</h3>
          <p className="text-3xl font-bold text-purple-600">{staffList.length}名</p>
          <p className="text-sm text-purple-600 mt-1">総登録: {staffList.length}名</p>
        </div>
      </div>

      {/* フィルター */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            タグでフィルター
          </label>
          <div className="flex flex-wrap gap-2">
            {allUsedTags.map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  setSelectedTags(prev => 
                    prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                  );
                }}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedTags.includes(tag)
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* スタッフ別レポート */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">スタッフ別実績</h2>
        </div>
        <div className="p-4">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold mb-2">移行作業中</h3>
            <p>詳細なレポート機能はSupabase移行後に実装されます</p>
            <div className="mt-6 text-sm text-gray-400">
              <p>実装予定機能:</p>
              <ul className="mt-2 space-y-1">
                <li>• スタッフ別労働時間集計</li>
                <li>• 残業時間の計算</li>
                <li>• 勤務パターン分析</li>
                <li>• CSV/PDF出力</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
