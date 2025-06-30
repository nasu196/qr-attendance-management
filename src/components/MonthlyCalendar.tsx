import { useState } from "react";
import { useUser } from "@clerk/clerk-react";

interface MonthlyCalendarProps {
  isPremium: boolean;
}

export function MonthlyCalendar({ isPremium }: MonthlyCalendarProps) {
  const { user } = useUser();
  const clerkUserId = user?.id;
  
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // TODO: Supabaseクエリでデータを取得
  const staffList = [
    { _id: '1', name: 'サンプル太郎', tags: ['正社員'] },
    { _id: '2', name: 'テスト花子', tags: ['パート'] }
  ];
  const allUsedTags = ['正社員', 'パート', 'アルバイト'];

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

  // カレンダーの日数を計算
  const daysInMonth = new Date(currentDate.year, currentDate.month, 0).getDate();
  const firstDayOfWeek = new Date(currentDate.year, currentDate.month - 1, 1).getDay();
  
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const leadingEmptyDays = Array.from({ length: firstDayOfWeek }, (_, i) => null);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">月次カレンダー</h1>
        {!isPremium && (
          <div className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-sm font-medium">
            有料プラン機能
          </div>
        )}
        {isPremium && (
          <div className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-sm font-medium">
            有料プラン
          </div>
        )}
      </div>

      {/* 移行作業中の通知 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-yellow-800">
          <span className="text-2xl">🚧</span>
          <div>
            <p className="font-medium">移行作業中</p>
            <p className="text-sm">月次カレンダー機能はSupabase移行後に完全実装されます。現在はデモ表示中です。</p>
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

      {/* フィルター */}
      {isPremium && (
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
      )}

      {/* カレンダー */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">勤怠カレンダー</h2>
        </div>
        
        <div className="p-4">
          {/* カレンダーヘッダー */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
              <div key={day} className="text-center font-semibold text-gray-700 py-2">
                {day}
              </div>
            ))}
          </div>
          
          {/* カレンダー本体 */}
          <div className="grid grid-cols-7 gap-1">
            {/* 前月の空白日 */}
            {leadingEmptyDays.map((_, index) => (
              <div key={`empty-${index}`} className="h-20"></div>
            ))}
            
            {/* 当月の日付 */}
            {days.map((day) => (
              <div
                key={day}
                className="h-20 border rounded-lg p-1 hover:bg-gray-50 cursor-pointer"
              >
                <div className="font-medium text-sm text-gray-900 mb-1">{day}</div>
                {isPremium ? (
                  <div className="text-xs space-y-1">
                    <div className="text-blue-600">デモデータ</div>
                    <div className="text-green-600">サンプル</div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400">
                    有料プラン
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {!isPremium && (
          <div className="relative">
            <div className="absolute inset-0 bg-white/80 rounded-b-lg flex items-center justify-center">
              <div className="text-center">
                <span className="text-gray-400 text-4xl">📅</span>
                <p className="text-gray-700 font-medium mt-4">カレンダー機能は有料プランでご利用いただけます</p>
                <p className="text-gray-500 text-sm mt-2">日別の勤怠状況をカレンダー形式で確認できます</p>
                <p className="text-gray-500 text-sm mt-1">左下の開発用スイッチで有料プランに切り替えてお試しください</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {isPremium && (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">📅</div>
          <h3 className="text-xl font-semibold mb-2">移行作業中</h3>
          <p>詳細なカレンダー機能はSupabase移行後に実装されます</p>
          <div className="mt-6 text-sm text-gray-400">
            <p>実装予定機能:</p>
            <ul className="mt-2 space-y-1">
              <li>• 日別勤怠状況表示</li>
              <li>• スタッフ別フィルタリング</li>
              <li>• 勤務時間の可視化</li>
              <li>• 異常値のハイライト</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
