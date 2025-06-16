import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";

interface AttendanceDashboardProps {
  isPremium: boolean;
}

export function AttendanceDashboard({ isPremium }: AttendanceDashboardProps) {
  // 今日の勤怠データから統計を計算
  const todayAttendance = useQuery(api.attendance.getTodayAttendance);
  
  // エラー検出関数
  const detectBasicErrors = (attendance: any) => {
    const errors = [];
    
    if (attendance.clockIn && attendance.clockOut) {
      const workHours = (attendance.clockOut.timestamp - attendance.clockIn.timestamp) / (1000 * 60 * 60);
      if (workHours >= 24) {
        errors.push("24時間以上の勤務");
      }
      if (workHours < 0) {
        errors.push("データエラー");
      }
    }
    
    return errors;
  };

  const detectConsecutiveErrors = () => {
    if (!todayAttendance) return new Map();
    
    const consecutiveErrors = new Map();
    
    // ペアIDベースで不整合ペアを検出
    todayAttendance.forEach(attendance => {
      const errors = [];
      
      // 出勤のみで退勤がない場合
      if (attendance.clockIn && !attendance.clockOut) {
        errors.push("退勤打刻なし");
      }
      
      // 退勤のみで出勤がない場合（理論上発生しないが念のため）
      if (!attendance.clockIn && attendance.clockOut) {
        errors.push("出勤打刻なし");
      }
      
      if (errors.length > 0) {
        consecutiveErrors.set(attendance.staff._id, errors[0]);
      }
    });
    
    return consecutiveErrors;
  };

  const consecutiveErrors = detectConsecutiveErrors();

  const getAttendanceErrors = (attendance: any) => {
    const errors = [];
    
    // 基本エラーチェック
    const basicErrors = detectBasicErrors(attendance);
    errors.push(...basicErrors);
    
    // 連続打刻エラーチェック
    const consecutiveError = consecutiveErrors.get(attendance.staff._id);
    if (consecutiveError) {
      errors.push(consecutiveError);
    }
    
    return errors;
  };
  
  const summary = todayAttendance ? {
    totalStaff: todayAttendance.length,
    presentStaff: todayAttendance.filter(a => a.status === "present" || a.status === "completed").length,
    completedStaff: todayAttendance.filter(a => a.status === "completed").length,
    currentlyPresent: todayAttendance.filter(a => a.status === "present").length,
    totalErrors: todayAttendance.reduce((total, attendance) => {
      return total + getAttendanceErrors(attendance).length;
    }, 0),
  } : null;
  
  const presentStaff = todayAttendance ? 
    todayAttendance.filter(a => a.status === "present" || a.status === "completed") : [];
  
  const correctAttendance = useMutation(api.attendance.correctAttendance);
  const createDummyData = useMutation(api.attendance.createTodayDummyData);
  const create2025MayJuneDummyData = useMutation(api.attendance.create2025MayJuneDummyData);
  const cleanupDevData = useMutation(api.attendance.cleanupDevData);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionData, setCorrectionData] = useState({
    staffId: "",
    date: "",
    type: "clock_in" as "clock_in" | "clock_out",
    time: "",
    reason: "",
  });

  // 修正履歴を取得（AttendanceDashboardでは一時的に無効化）
  const correctionHistory: any[] = [];

  if (!summary || !presentStaff) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const formatTime = (timestamp: number) => {
    // UTCタイムスタンプを日本時間（JST）に変換して表示
    const date = new Date(timestamp + (9 * 60 * 60 * 1000)); // UTC+9時間
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const openCorrectionModal = (staffId: string, staffName: string) => {
    const today = new Date();
    setCorrectionData({
      staffId,
      date: today.toISOString().split('T')[0],
      type: "clock_in",
      time: "",
      reason: "",
    });
    setShowCorrectionModal(true);
  };

  const closeCorrectionModal = () => {
    setShowCorrectionModal(false);
    setCorrectionData({
      staffId: "",
      date: "",
      type: "clock_in",
      time: "",
      reason: "",
    });
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // バリデーション
    if (!correctionData.date) {
      toast.error("日付を選択してください");
      return;
    }
    if (!correctionData.time) {
      toast.error("時刻を入力してください");
      return;
    }
    if (!correctionData.reason.trim()) {
      toast.error("修正理由を入力してください");
      return;
    }

    try {
      await correctAttendance({
        staffId: correctionData.staffId as any,
        date: correctionData.date,
        type: correctionData.type,
        time: correctionData.time,
        reason: correctionData.reason,
      });
      toast.success("勤怠記録を修正しました");
      closeCorrectionModal();
    } catch (error) {
      toast.error("修正に失敗しました");
    }
  };

  const handleCreateDummyData = async () => {
    try {
      await createDummyData();
      toast.success("本日のダミーデータを作成しました");
    } catch (error) {
      toast.error("ダミーデータの作成に失敗しました");
    }
  };

  const handleCreate2025MayJuneDummyData = async () => {
    try {
      const result = await create2025MayJuneDummyData();
      toast.success(result.message);
    } catch (error) {
      toast.error("2025年5月・6月のダミーデータ作成に失敗しました");
    }
  };

  const handleCleanupDevData = async () => {
    if (!window.confirm("全ての勤怠データと履歴を削除します。この操作は元に戻せません。実行しますか？")) {
      return;
    }
    
    try {
      const result = await cleanupDevData();
      toast.success(`データを削除しました（勤怠記録: ${result.deletedAttendance}件、履歴: ${result.deletedHistory}件）`);
    } catch (error) {
      toast.error("データ削除に失敗しました");
    }
  };

  const getErrorBadge = (error: string) => {
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
        {error}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">勤怠管理ボード</h1>
          <p className="text-gray-600">
            {new Date().toLocaleDateString("ja-JP", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => void handleCreateDummyData()}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            本日のダミーデータ作成
          </button>
          <button
            onClick={() => void handleCreate2025MayJuneDummyData()}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm whitespace-nowrap"
          >
            2025年5月・6月ダミーデータ作成
          </button>
          <button
            onClick={() => void handleCleanupDevData()}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm whitespace-nowrap"
          >
            🗑️ データクリーンアップ
          </button>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <span className="text-green-600 text-xl">👥</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">現在の出勤者</p>
              <p className="text-2xl font-bold text-gray-900">{summary.currentlyPresent}人</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <span className="text-blue-600 text-xl">✅</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">本日の勤務完了者</p>
              <p className="text-2xl font-bold text-gray-900">{summary.completedStaff}人</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <span className="text-red-600 text-xl">⚠️</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">勤怠エラー数</p>
              <p className="text-2xl font-bold text-gray-900">{summary.totalErrors}件</p>
            </div>
          </div>
        </div>
      </div>

      {/* 出勤者リスト */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">現在の出勤者</h2>
        </div>
        <div className="p-6">
          {presentStaff.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-gray-500 text-lg">👤</span>
              <p className="text-gray-500 mt-2">現在出勤中のスタッフはいません</p>
              <p className="text-gray-400 text-sm mt-1">右上の「本日のダミーデータ作成」ボタンでテストデータを作成できます</p>
            </div>
          ) : (
            <div className="space-y-3">
              {presentStaff.map((attendance) => {
                const errors = getAttendanceErrors(attendance);
                
                return (
                  <div
                    key={attendance.staff._id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold">
                          {attendance.staff.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{attendance.staff.name}</p>
                        <p className="text-sm text-gray-500">
                          職員番号: {attendance.staff.employeeId}
                        </p>
                        {attendance.staff.tags && attendance.staff.tags.length > 0 && (
                          <div className="mt-1 flex gap-1">
                            {attendance.staff.tags.map((tag: string, index: number) => (
                              <span
                                key={index}
                                className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          出勤時刻: {attendance.clockIn ? formatTime(attendance.clockIn.timestamp) : "—"}
                        </p>
                        <p className="text-sm text-gray-500">
                          退勤時刻: {attendance.clockOut ? formatTime(attendance.clockOut.timestamp) : "—"}
                        </p>
                        {attendance.status === "completed" && (
                          <p className="text-xs text-green-600 font-medium mt-1">勤務完了</p>
                        )}
                        {errors.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {errors.map((error, index) => (
                              <span key={index}>{getErrorBadge(error)}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => openCorrectionModal(attendance.staff._id, attendance.staff.name)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        修正
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 打刻修正モーダル */}
      {showCorrectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">勤怠記録修正</h2>
                <button
                  onClick={closeCorrectionModal}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={(e) => void handleCorrectionSubmit(e)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    日付 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={correctionData.date}
                    onChange={(e) => setCorrectionData({ ...correctionData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    修正対象 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={correctionData.type}
                    onChange={(e) => setCorrectionData({ ...correctionData, type: e.target.value as "clock_in" | "clock_out" })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="clock_in">出勤時刻</option>
                    <option value="clock_out">退勤時刻</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    修正後の時刻 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={correctionData.time}
                    onChange={(e) => setCorrectionData({ ...correctionData, time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    修正理由 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={correctionData.reason}
                    onChange={(e) => setCorrectionData({ ...correctionData, reason: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="修正理由を入力してください"
                    required
                  />
                </div>

                {/* 過去の変更履歴 */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">過去の変更履歴</h3>
                  <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                    {correctionHistory && correctionHistory.length > 0 ? (
                      correctionHistory.map((h: any, i: number) => (
                        <div key={i} className="text-xs text-gray-600 mb-2">
                          <div>
                            {h.oldTimestamp ? formatTime(h.oldTimestamp) : "—"} → {h.newTimestamp ? formatTime(h.newTimestamp) : "削除"}
                          </div>
                          <div className="text-gray-500">理由: {h.newNote || "—"}</div>
                          <div className="text-gray-400">{new Date(h.modifiedAt).toLocaleString("ja-JP")}</div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500">変更履歴はありません</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    修正を保存
                  </button>
                  <button
                    type="button"
                    onClick={closeCorrectionModal}
                    className="flex-1 bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 