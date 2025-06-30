import { useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { toast } from "sonner";

interface AttendanceDashboardProps {
  isPremium: boolean;
}

export function AttendanceDashboard({ isPremium }: AttendanceDashboardProps) {
  const { user } = useUser();
  const clerkUserId = user?.id;
  
  // TODO: Supabaseクエリでデータを取得
  const todayAttendance = [
    { _id: '1', staff: { name: 'サンプル太郎' }, type: 'clock_in', timestamp: Date.now() - 60000 * 60 * 2 },
    { _id: '2', staff: { name: 'テスト花子' }, type: 'clock_in', timestamp: Date.now() - 60000 * 30 }
  ];

  const [showDevTools, setShowDevTools] = useState(false);

  const createDummyData = async () => {
    try {
      // TODO: Supabaseでのダミーデータ作成
      console.log('TODO: Supabaseでダミーデータ作成');
      toast.success("ダミーデータを作成しました（模擬）");
    } catch (error) {
      toast.error("ダミーデータ作成に失敗しました");
    }
  };

  const cleanupDevData = async () => {
    try {
      // TODO: Supabaseでの開発データクリーンアップ
      console.log('TODO: Supabaseで開発データクリーンアップ');
      toast.success("開発用データをクリーンアップしました（模擬）");
    } catch (error) {
      toast.error("クリーンアップに失敗しました");
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">勤怠ダッシュボード</h1>
        <button
          onClick={() => setShowDevTools(!showDevTools)}
          className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm"
        >
          {showDevTools ? "開発ツールを隠す" : "開発ツールを表示"}
        </button>
      </div>

      {/* 移行作業中の通知 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-yellow-800">
          <span className="text-2xl">🚧</span>
          <div>
            <p className="font-medium">移行作業中</p>
            <p className="text-sm">勤怠ダッシュボード機能はSupabase移行後に完全実装されます。現在はデモ表示中です。</p>
          </div>
        </div>
      </div>

      {/* 今日の勤怠状況 */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">今日の勤怠状況</h2>
          <p className="text-sm text-gray-600 mt-1">リアルタイムで更新されます</p>
        </div>
        <div className="p-4">
          {todayAttendance.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-gray-400 text-4xl">📋</span>
              <p className="text-gray-500 mt-4">まだ今日の勤怠記録がありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayAttendance.map((record) => (
                <div key={record._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-sm">
                        {record.staff?.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{record.staff?.name}</p>
                      <p className="text-sm text-gray-600">
                        {record.type === 'clock_in' ? '出勤' : '退勤'} - {formatTime(record.timestamp)}
                      </p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    record.type === 'clock_in' 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {record.type === 'clock_in' ? '出勤中' : '退勤済み'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 簡易統計 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <span className="text-blue-600 text-xl">👥</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">出勤中</p>
              <p className="text-2xl font-bold text-gray-900">{todayAttendance.filter(r => r.type === 'clock_in').length}名</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <span className="text-green-600 text-xl">✅</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">本日の記録</p>
              <p className="text-2xl font-bold text-gray-900">{todayAttendance.length}件</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <span className="text-purple-600 text-xl">📊</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">データ状態</p>
              <p className="text-lg font-bold text-gray-900">デモ中</p>
            </div>
          </div>
        </div>
      </div>

      {/* 開発ツール */}
      {showDevTools && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-orange-700">🔧 開発ツール</h2>
            <p className="text-sm text-gray-600 mt-1">開発・テスト用の機能です</p>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => void createDummyData()}
                className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                今日のダミーデータ作成
              </button>
              <button
                onClick={() => void cleanupDevData()}
                className="bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                開発用データクリーンアップ
              </button>
            </div>
            <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>移行作業中:</strong> 開発ツール機能はSupabase移行後に実装されます。現在はデモ動作です。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 