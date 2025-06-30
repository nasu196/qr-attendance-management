import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { formatToJST } from "@/lib/timezone";

interface AttendanceDashboardProps {
  isPremium: boolean;
}

export function AttendanceDashboard({ isPremium }: AttendanceDashboardProps) {
  const { supabaseUser, loading: userLoading } = useSupabaseUser();
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // ダミーデータ（Supabase実装後に置き換え予定）
  const [attendanceData] = useState({
    records: [
      {
        id: '1',
        staff: { id: '1', name: 'サンプル太郎' },
        clockIn: '09:00',
        clockOut: '18:00',
        workHours: 8.0,
        overtimeHours: 0.0
      }
    ],
    totalWorkHours: 8.0,
    totalOvertimeHours: 0.0
  });

  useEffect(() => {
    async function loadAttendanceData() {
      if (!supabaseUser) return;

      try {
        setLoading(true);
        // TODO: Supabase APIで勤怠データを取得
        await new Promise(resolve => setTimeout(resolve, 500)); // ダミー待機
        toast.success("勤怠データを読み込みました");
      } catch (error) {
        console.error("Error loading attendance data:", error);
        toast.error("勤怠データの読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    }

    if (!userLoading && supabaseUser) {
      void loadAttendanceData();
    }
  }, [supabaseUser, userLoading, selectedDate]);

  if (userLoading || loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">勤怠ダッシュボード</h1>
        <div className="flex items-center gap-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Supabase移行作業中の通知 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-yellow-800">
          <span className="text-2xl">🚧</span>
          <div>
            <p className="font-medium">Supabase移行作業中</p>
            <p className="text-sm">勤怠ダッシュボードはSupabase移行完了後、完全に実装されます。現在はデモ表示中です。</p>
          </div>
        </div>
      </div>

      {/* 日別サマリー */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-3xl">👥</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">出勤スタッフ</p>
              <p className="text-2xl font-bold text-gray-900">{attendanceData.records.length}人</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-3xl">⏱️</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">総勤務時間</p>
              <p className="text-2xl font-bold text-gray-900">{attendanceData.totalWorkHours}時間</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-3xl">🔥</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">総残業時間</p>
              <p className="text-2xl font-bold text-gray-900">{attendanceData.totalOvertimeHours}時間</p>
            </div>
          </div>
        </div>
      </div>

      {/* 勤怠記録一覧 */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-medium text-gray-900">
                         {formatToJST(new Date(selectedDate), "yyyy年MM月dd日")} の勤怠記録
          </h2>
        </div>
        
        <div className="p-4">
          {attendanceData.records.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-gray-400 text-4xl">📅</span>
              <p className="text-gray-500 mt-4">この日の勤怠記録がありません</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-900">スタッフ名</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">出勤時刻</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">退勤時刻</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">勤務時間</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">残業時間</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceData.records.map((record) => (
                    <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900">{record.staff.name}</td>
                      <td className="py-3 px-4 text-gray-600">{record.clockIn || '-'}</td>
                      <td className="py-3 px-4 text-gray-600">{record.clockOut || '-'}</td>
                      <td className="py-3 px-4 text-gray-600">{record.workHours}時間</td>
                      <td className="py-3 px-4 text-gray-600">
                        {record.overtimeHours > 0 ? (
                          <span className="text-orange-600 font-medium">{record.overtimeHours}時間</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button
                            className="text-blue-600 hover:text-blue-700 text-sm"
                            onClick={() => toast.info("編集機能はSupabase移行後に実装されます")}
                          >
                            編集
                          </button>
                          <button
                            className="text-red-600 hover:text-red-700 text-sm"
                            onClick={() => toast.info("削除機能はSupabase移行後に実装されます")}
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 手動記録追加ボタン */}
      <div className="flex justify-end">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          onClick={() => toast.info("手動記録機能はSupabase移行後に実装されます")}
        >
          手動で記録を追加
        </button>
      </div>
    </div>
  );
} 