import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useMemo } from "react";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { formatToJST, convertToUTC, getStartOfJSTDay, getEndOfJSTDay } from "@/lib/timezone";

interface StaffDetailProps {
  staffId: Id<"staff">;
  onBack: () => void;
  isPremium: boolean;
  initialYear?: number;
  initialMonth?: number;
}

export function StaffDetail({ staffId, onBack, isPremium, initialYear, initialMonth }: StaffDetailProps) {
  const staff = useQuery(api.staff.getStaffList)?.find(s => s._id === staffId);
  const correctAttendance = useMutation(api.attendance.correctAttendance);
  const deletePair = useMutation(api.attendance.deletePair);
  const workSettings = useQuery(api.workSettings.getWorkSettings);
  
  const [currentDate, setCurrentDate] = useState(() => {
    if (initialYear && initialMonth) {
      return { year: initialYear, month: initialMonth };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  
  // UTC期間を計算してAPIに渡す
  const startOfMonth = getStartOfJSTDay(new Date(currentDate.year, currentDate.month - 1, 1));
  const endOfMonth = getEndOfJSTDay(new Date(currentDate.year, currentDate.month, 0));

  const monthlyAttendance = useQuery(api.staffAttendance.getStaffMonthlyAttendance, {
    staffId,
    startOfMonth,
    endOfMonth,
  });

  const appliedSettings = useQuery(api.staffAttendance.getStaffMonthlyAppliedSettings, {
    staffId,
    year: currentDate.year,
    month: currentDate.month,
  });

  const setAppliedWorkSetting = useMutation(api.staffAttendance.setAppliedWorkSetting);
  const autoAssignWorkSetting = useMutation(api.staffAttendance.autoAssignWorkSetting);

  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionData, setCorrectionData] = useState({
    date: "",
    type: "clock_in" as "clock_in" | "clock_out",
    time: "",
    reason: "",
    pairId: "" as string,
  });

  // 削除確認モーダル用のstate
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteData, setDeleteData] = useState({
    pairId: "" as Id<"attendance"> | "",
    date: "",
    reason: "",
  });

  // 新規勤怠記録作成用のstate
  const [showNewRecordModal, setShowNewRecordModal] = useState(false);
  const [newRecordData, setNewRecordData] = useState({
    date: "",
    type: "clock_in" as "clock_in" | "clock_out",
    time: "",
    reason: "",
  });

  const [selectedSettings, setSelectedSettings] = useState<Map<string, string>>(new Map());

  // 出勤と退勤が両方揃った時に自動割り当てを実行（初回のみ）
  const handleAutoAssign = async (date: string, workMinutes: number) => {
    try {
      const result = await autoAssignWorkSetting({
        staffId,
        date,
        workMinutes,
      });
      // 成功した場合のみログ出力（デバッグ用）
      if (result.success && result.setting) {
        console.log(`自動割り当て完了: ${date} - ${result.setting.name}`);
      }
    } catch (error) {
      // エラーは無視（既に設定がある場合など）
      console.log(`自動割り当てスキップ: ${date}`);
    }
  };

  // 夜勤対応：出勤と退勤をペアリング（日付をまたぐシフト・同日複数勤務に対応）
  const createAttendancePairs = (records: any[]) => {
    if (!records || records.length === 0) return [];
    
    // 時系列順にソート
    const sortedRecords = [...records].sort((a, b) => a.timestamp - b.timestamp);
    const pairs = [];
    const usedRecords = new Set();
    
    for (let i = 0; i < sortedRecords.length; i++) {
      const current = sortedRecords[i];
      
      // 既に使用済みの記録はスキップ
      if (usedRecords.has(current._id)) continue;
      
      if (current.type === "clock_in") {
        // 出勤記録の場合、次の未使用の退勤記録を探す
        let clockOut = null;
        for (let j = i + 1; j < sortedRecords.length; j++) {
          if (sortedRecords[j].type === "clock_out" && !usedRecords.has(sortedRecords[j]._id)) {
            clockOut = sortedRecords[j];
            usedRecords.add(sortedRecords[j]._id);
            break;
          }
        }
        
        // ペアを作成（退勤がない場合もペアとして扱う）
        const clockInDate = formatToJST(current.timestamp, "yyyy-MM-dd");
        const clockInTime = formatToJST(current.timestamp, "HH:mm");
        
        pairs.push({
          date: clockInDate, // 出勤日を基準日とする
          displayTime: clockInTime, // 表示用の時刻（同日複数勤務の区別用）
          clockIn: { timestamp: current.timestamp, id: current._id },
          clockOut: clockOut ? { timestamp: clockOut.timestamp, id: clockOut._id } : null
        });
        
        usedRecords.add(current._id);
      }
    }
    
    // 出勤日時順でソート（同日の場合は出勤時刻順）
    return pairs.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.clockIn.timestamp - b.clockIn.timestamp;
    });
  };

  const dailyAttendance = createAttendancePairs(monthlyAttendance || []);

  // 修正履歴を取得（ペアベース）- 固定のペアIDを使用
  const correctionHistory = useQuery(
    api.attendance.getCorrectionHistory,
    correctionData.pairId ? { pairId: correctionData.pairId } : "skip"
  );

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const isRestrictedMonth = !isPremium && (
    currentDate.year < currentYear || 
    (currentDate.year === currentYear && currentDate.month < currentMonth - 1)
  );

  if (!staff) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const formatTime = (timestamp: number) => {
    // UTCタイムスタンプをJST表示に変換
    return formatToJST(timestamp, "HH:mm");
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()} (${date.toLocaleDateString("ja-JP", { weekday: "short" })})`;
  };

  // 勤務設定に基づくシフト判定（最適な設定を自動選択）
  const detectBestWorkSetting = (workMinutes: number) => {
    if (!workSettings || workSettings.length === 0) return null;
    
    let bestSetting = workSettings[0];
    let minDiff = Infinity;
    
    for (const setting of workSettings) {
      const settingTotalMinutes = (setting.workHours + setting.breakHours) * 60;
      const diff = Math.abs(workMinutes - settingTotalMinutes);
      
      if (diff < minDiff) {
        minDiff = diff;
        bestSetting = setting;
      }
    }
    
    return bestSetting;
  };

  // 指定された日付の適用設定を取得（保存済み設定 > 手動選択 > 自動判定）
  const getAppliedSetting = (date: string, workMinutes: number) => {
    // 保存済み設定を確認
    if (appliedSettings && appliedSettings[date]) {
      return appliedSettings[date].workSetting;
    }
    
    // 手動選択を確認
    const manualSetting = selectedSettings.get(date);
    if (manualSetting) {
      if (manualSetting === 'null') return null;
      if (workSettings) {
        const setting = workSettings.find(s => s._id === manualSetting);
        if (setting) return setting;
      }
    }
    
    // 自動判定（表示のみ、保存はしない）
    return detectBestWorkSetting(workMinutes);
  };

  // 設定変更ハンドラー
  const handleSettingChange = async (date: string, settingId: string) => {
    try {
      if (settingId === 'auto') {
        await setAppliedWorkSetting({
          staffId,
          date,
          workSettingId: null,
        });
      } else if (settingId === 'null') {
        await setAppliedWorkSetting({
          staffId,
          date,
          workSettingId: null,
        });
      } else {
        await setAppliedWorkSetting({
          staffId,
          date,
          workSettingId: settingId as any,
        });
      }
      
      const newSettings = new Map(selectedSettings);
      if (settingId === 'auto') {
        newSettings.delete(date);
      } else {
        newSettings.set(date, settingId);
      }
      setSelectedSettings(newSettings);
    } catch (error) {
      toast.error("設定の変更に失敗しました");
    }
  };

  const detectBasicErrors = (day: any) => {
    const errors = [];
    
    if (day.clockIn && day.clockOut) {
      const workMinutes = (day.clockOut.timestamp - day.clockIn.timestamp) / (1000 * 60);
      const workHours = workMinutes / 60;
      
      // 夜勤対応：24時間制限に変更
      if (workHours >= 24) {
        errors.push("24時間以上の勤務");
      }
      if (workHours < 0) {
        errors.push("退勤時刻が出勤時刻より早い");
      }
      
      // 適用設定より勤務時間が短い場合のエラー
      const appliedSetting = getAppliedSetting(day.date, workMinutes);
      if (appliedSetting) {
        // 勤務時間のみで比較（休憩時間は除く）
        const standardWorkMinutes = appliedSetting.workHours * 60;
        if (workMinutes < standardWorkMinutes) {
          errors.push("勤務時間が設定より短い");
        }
      }
    }
    
    return errors;
  };

  const detectConsecutiveErrors = () => {
    if (!monthlyAttendance) return new Map();
    
    const consecutiveErrors = new Map();
    const allRecords: Array<{ pairId: string; timestamp: number; type: 'clock_in' | 'clock_out' }> = [];
    
    dailyAttendance.forEach((day, index) => {
      const pairId = day.clockIn ? day.clockIn.id : `pair-${index}`;
      if (day.clockIn) allRecords.push({ pairId, timestamp: day.clockIn.timestamp, type: 'clock_in' });
      if (day.clockOut) allRecords.push({ pairId, timestamp: day.clockOut.timestamp, type: 'clock_out' });
    });
    
    allRecords.sort((a, b) => a.timestamp - b.timestamp);
    
    for (let i = 0; i < allRecords.length - 1; i++) {
      const current = allRecords[i];
      const next = allRecords[i + 1];
      
      if (current.type === next.type) {
        consecutiveErrors.set(next.pairId, current.type === 'clock_in' ? "連続出勤打刻" : "連続退勤打刻");
      }
    }
    
    return consecutiveErrors;
  };

  const consecutiveErrors = detectConsecutiveErrors();

  const getDayStatusBadges = (day: any) => {
    const badges: React.JSX.Element[] = [];
    
    const basicErrors = detectBasicErrors(day);
    basicErrors.forEach((error, index) => {
      badges.push(
        <span key={`basic-${index}`} className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          {error}
        </span>
      );
    });
    
    const pairId = day.clockIn ? day.clockIn.id : `pair-${day.date}`;
    const consecutiveError = consecutiveErrors.get(pairId);
    if (consecutiveError) {
      badges.push(
        <span key="consecutive" className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          {consecutiveError}
        </span>
      );
    }
    
    // エラーがない場合のみ正常バッジを表示
    if (badges.length === 0 && day.clockIn && day.clockOut) {
      badges.push(
        <span key="normal" className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          正常
        </span>
      );
    }
    
    return badges;
  };

  const calculateWorkingHours = (clockIn: any, clockOut: any) => {
    if (!clockIn || !clockOut) return null;
    const totalMinutes = (clockOut.timestamp - clockIn.timestamp) / (1000 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);
    return `${hours}時間${minutes}分`;
  };

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

  const calculateMonthlySummary = () => {
    if (!dailyAttendance || !workSettings || workSettings.length === 0) {
      return { totalHours: "0時間0分", overtimeHours: "0時間0分" };
    }
    
    let totalMinutes = 0;
    let overtimeMinutes = 0;
    
    dailyAttendance.forEach(day => {
      if (day.clockIn && day.clockOut) {
        const dayMinutes = (day.clockOut.timestamp - day.clockIn.timestamp) / (1000 * 60);
        totalMinutes += dayMinutes;
        
        // 適用設定を取得して残業時間を計算
        const appliedSetting = getAppliedSetting(day.date, dayMinutes);
        if (appliedSetting) {
          // 勤務時間のみで比較（休憩時間は除く）
          const standardWorkMinutes = appliedSetting.workHours * 60;
          
          if (dayMinutes > standardWorkMinutes) {
            overtimeMinutes += dayMinutes - standardWorkMinutes;
          }
        }
      }
    });
    
    const totalHours = Math.floor(totalMinutes / 60);
    const totalMins = Math.floor(totalMinutes % 60);
    const overtimeHrs = Math.floor(overtimeMinutes / 60);
    const overtimeMins = Math.floor(overtimeMinutes % 60);
    
    return { 
      totalHours: `${totalHours}時間${totalMins}分`, 
      overtimeHours: `${overtimeHrs}時間${overtimeMins}分` 
    };
  };

  const { totalHours, overtimeHours } = calculateMonthlySummary();

  const getAttendanceStats = () => {
    if (!dailyAttendance) return { workDays: 0 };
    
    let workDays = 0;
    
    dailyAttendance.forEach(day => {
      if (day.clockIn) {
        workDays++;
      }
    });
    
    return { workDays };
  };

  const attendanceStats = getAttendanceStats();

  const exportToCSV = () => {
    if (!dailyAttendance?.length) return toast.error("出力するデータがありません");
    const csvData = [["日付", "曜日", "開始時刻", "出勤時刻", "退勤時刻", "勤務時間", "適用設定", "残業時間"]];
    dailyAttendance.forEach(day => {
      const date = new Date(day.date);
      let appliedSetting = "";
      let overtimeForDay = "";
      
      if (day.clockIn && day.clockOut) {
        const dayMinutes = (day.clockOut.timestamp - day.clockIn.timestamp) / (1000 * 60);
        const appliedSettingObj = getAppliedSetting(day.date, dayMinutes);
        if (appliedSettingObj) {
          appliedSetting = appliedSettingObj.name;
          // 勤務時間のみで比較（休憩時間は除く）
          const standardWorkMinutes = appliedSettingObj.workHours * 60;
          if (dayMinutes > standardWorkMinutes) {
            const overtimeMin = dayMinutes - standardWorkMinutes;
            const overtimeHrs = Math.floor(overtimeMin / 60);
            const overtimeMins = Math.floor(overtimeMin % 60);
            overtimeForDay = `${overtimeHrs}時間${overtimeMins}分`;
          } else {
            overtimeForDay = "0時間0分";
          }
        } else {
          appliedSetting = "—";
          overtimeForDay = "—";
        }
      } else {
        appliedSetting = "—";
        overtimeForDay = "—";
      }
      
      csvData.push([
        day.date, 
        date.toLocaleDateString("ja-JP", { weekday: "short" }),
        day.displayTime || "",
        day.clockIn ? formatTime(day.clockIn.timestamp) : "",
        day.clockOut ? formatTime(day.clockOut.timestamp) : "",
        calculateWorkingHours(day.clockIn, day.clockOut) || "",
        appliedSetting,
        overtimeForDay
      ]);
    });
    const blob = new Blob([csvData.map(row => row.join(",")).join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${staff.name}_${monthName}_勤怠記録.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSVファイルをダウンロードしました");
  };

  const openCorrectionModal = (day?: any) => {
    let initialType: "clock_in" | "clock_out" = "clock_in";
    let initialTime = "";
    let initialDate = "";
    let pairId = "";
    
    if (day && typeof day === 'object') {
      // ペアIDを設定（出勤記録のIDを使用）
      pairId = day.clockIn?.id || "";
      
      // 出勤記録がある場合は出勤を優先、なければ退勤を選択
      if (day.clockIn) {
        initialType = "clock_in";
        initialTime = formatToJST(day.clockIn.timestamp, "HH:mm");
        // 出勤の場合は表示されている日付（day.date）を使用
        initialDate = day.date;
      } else if (day.clockOut) {
        initialType = "clock_out";
        initialTime = formatToJST(day.clockOut.timestamp, "HH:mm");
        // 退勤の場合は実際の退勤日付を計算
        initialDate = formatToJST(day.clockOut.timestamp, "yyyy-MM-dd");
      }
    }
    
    setCorrectionData({
      date: initialDate || day?.date || `${currentDate.year}-${String(currentDate.month).padStart(2, '0')}-01`,
      type: initialType,
      time: initialTime,
      reason: "",
      pairId,
    });
    setShowCorrectionModal(true);
  };

  const openDeleteModal = (day: any) => {
    if (!day.clockIn) {
      toast.error("削除対象のペアが見つかりません");
      return;
    }
    
    setDeleteData({
      pairId: day.clockIn.id,
      date: day.date,
      reason: "",
    });
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteData({
      pairId: "",
      date: "",
      reason: "",
    });
  };

  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!deleteData.pairId) {
      toast.error("削除対象が選択されていません");
      return;
    }
    if (!deleteData.reason.trim()) {
      toast.error("削除理由を入力してください");
      return;
    }

    try {
      await deletePair({
        pairId: deleteData.pairId,
        reason: deleteData.reason,
      });
      toast.success("勤怠ペアを削除しました");
      closeDeleteModal();
    } catch (error) {
      toast.error("削除に失敗しました");
    }
  };

  const closeCorrectionModal = () => {
    setShowCorrectionModal(false);
    setCorrectionData({
      date: "",
      type: "clock_in",
      time: "",
      reason: "",
      pairId: "",
    });
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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

    // 既に設定されているペアIDを使用（日付変更時も維持される）
    const pairId = correctionData.pairId;

    if (!pairId) {
      toast.error("修正対象のペアが見つかりません");
      return;
    }

    try {
      await correctAttendance({
        staffId,
        pairId, // 固定されたペアIDを送信
        date: correctionData.date,
        type: correctionData.type,
        time: correctionData.time,
        reason: correctionData.reason,
      });
      toast.success("勤怠記録を修正しました");
      
      // 修正後は自動割り当てを実行しないよう、手動選択状態にマーク
      const newSettings = new Map(selectedSettings);
      if (!newSettings.has(correctionData.date)) {
        newSettings.set(correctionData.date, 'manual_corrected');
      }
      setSelectedSettings(newSettings);
      
      closeCorrectionModal();
    } catch (error) {
      toast.error("修正に失敗しました");
    }
  };

  // 新規勤怠記録作成用の関数
  const openNewRecordModal = () => {
    setNewRecordData({
      date: `${currentDate.year}-${String(currentDate.month).padStart(2, '0')}-01`,
      type: "clock_in",
      time: "",
      reason: "",
    });
    setShowNewRecordModal(true);
  };

  const closeNewRecordModal = () => {
    setShowNewRecordModal(false);
    setNewRecordData({
      date: "",
      type: "clock_in",
      time: "",
      reason: "",
    });
  };

  const handleNewRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newRecordData.date) {
      toast.error("日付を選択してください");
      return;
    }
    if (!newRecordData.time) {
      toast.error("時刻を入力してください");
      return;
    }
    if (!newRecordData.reason.trim()) {
      toast.error("作成理由を入力してください");
      return;
    }

    try {
      await correctAttendance({
        staffId,
        date: newRecordData.date,
        type: newRecordData.type,
        time: newRecordData.time,
        reason: newRecordData.reason,
      });
      toast.success("新しい勤怠記録を作成しました");
      closeNewRecordModal();
    } catch (error) {
      toast.error("作成に失敗しました");
    }
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          ← 戻る
        </button>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-blue-600 font-semibold text-xl">
              {staff.name.charAt(0)}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{staff.name}</h1>
            <p className="text-gray-600">職員番号: {staff.employeeId}</p>
            {staff.tags && staff.tags.length > 0 && (
              <div className="mt-2 flex gap-1">
                {staff.tags.map((tag, index) => (
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
      </div>

      {/* 月次サマリー */}
      {isPremium ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <span className="text-blue-600 text-xl">⏰</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">総勤務時間</p>
              <p className="text-2xl font-bold text-gray-900">{totalHours}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <span className="text-orange-600 text-xl">⏱️</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">総残業時間</p>
              <p className="text-2xl font-bold text-gray-900">{overtimeHours}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <span className="text-purple-600 text-xl">📊</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">出勤日数</p>
              <p className="text-2xl font-bold text-gray-900">{attendanceStats.workDays}日</p>
            </div>
          </div>
        </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <span className="text-gray-400 text-2xl">🔒</span>
          <p className="text-gray-700 font-medium mt-2">月次サマリーは有料プラン機能です</p>
        </div>
      )}

      {/* 月次勤怠データ */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">勤怠記録</h2>
            <div className="flex items-center gap-2">
              {!isRestrictedMonth && (
                <>
                  <button
                    onClick={openNewRecordModal}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                  >
                    新規作成
                  </button>
                  <button
                    onClick={exportToCSV}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                  >
                    CSV出力
                  </button>
                </>
              )}
              <button
                onClick={() => changeMonth(-1)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                ←
              </button>
              <span className="text-sm font-medium text-gray-700 min-w-[120px] text-center">
                {monthName}
              </span>
              <button
                onClick={() => changeMonth(1)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                →
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {isRestrictedMonth ? (
            <div className="relative">
              {/* ブラー効果のあるダミーデータ */}
              <div className="filter blur-sm pointer-events-none">
                <div className="space-y-3">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-20 text-sm font-medium text-gray-700">
                          {i + 1}/1 (月)
                        </div>
                        <div className="flex items-center gap-6">
                          <div>
                            <span className="text-xs text-gray-500">出勤</span>
                            <p className="text-sm font-medium">09:00</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">退勤</span>
                            <p className="text-sm font-medium">18:00</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">勤務時間</span>
                            <p className="text-sm font-medium">8時間0分</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* オーバーレイメッセージ */}
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
                <div className="text-center">
                  <span className="text-gray-400 text-4xl">🔒</span>
                  <p className="text-gray-700 font-medium mt-4">先々月以前のデータは有料プランでご利用いただけます</p>
                  <p className="text-gray-500 text-sm mt-2">左下の開発用スイッチで有料プランに切り替えてお試しください</p>
                </div>
              </div>
            </div>
          ) : !monthlyAttendance ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : dailyAttendance.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-gray-400 text-4xl">📅</span>
              <p className="text-gray-500 mt-4">この月の勤怠記録がありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dailyAttendance.map((day) => {
                const statusBadges = getDayStatusBadges(day);
                let appliedSetting = "";
                let overtimeForDay = "";
                
                if (day.clockIn && day.clockOut) {
                  const dayMinutes = (day.clockOut.timestamp - day.clockIn.timestamp) / (1000 * 60);
                  
                  // 初回のみ自動割り当てを実行（設定がない場合のみ）
                  if (appliedSettings && !appliedSettings[day.date] && !selectedSettings.has(day.date)) {
                    void handleAutoAssign(day.date, dayMinutes);
                  }
                  
                  const appliedSettingObj = getAppliedSetting(day.date, dayMinutes);
                  if (appliedSettingObj) {
                    appliedSetting = appliedSettingObj.name;
                    // 勤務時間のみで比較（休憩時間は除く）
                    const standardWorkMinutes = appliedSettingObj.workHours * 60;
                    if (dayMinutes > standardWorkMinutes) {
                      const overtimeMin = dayMinutes - standardWorkMinutes;
                      const overtimeHrs = Math.floor(overtimeMin / 60);
                      const overtimeMins = Math.floor(overtimeMin % 60);
                      overtimeForDay = `${overtimeHrs}時間${overtimeMins}分`;
                    } else {
                      overtimeForDay = "0時間0分";
                    }
                  } else {
                    appliedSetting = "—";
                    overtimeForDay = "—";
                  }
                } else {
                  appliedSetting = "—";
                  overtimeForDay = "—";
                }
                
                return (
                  <div
                    key={day.clockIn ? day.clockIn.id : `no-clockin-${day.date}`}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-24 text-sm font-medium text-gray-700 flex-shrink-0">
                        {formatDate(day.date)}
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="w-16 flex-shrink-0">
                          <span className="text-xs text-gray-500">出勤</span>
                          <p className="text-sm font-medium">
                            {day.clockIn ? formatTime(day.clockIn.timestamp) : "—"}
                          </p>
                        </div>
                        <div className="w-16 flex-shrink-0">
                          <span className="text-xs text-gray-500">退勤</span>
                          <p className="text-sm font-medium">
                            {day.clockOut ? formatTime(day.clockOut.timestamp) : "—"}
                          </p>
                        </div>
                        <div className="w-20 flex-shrink-0">
                          <span className="text-xs text-gray-500">勤務時間</span>
                          <p className="text-sm font-medium">
                            {calculateWorkingHours(day.clockIn, day.clockOut) || "—"}
                          </p>
                        </div>
                        {workSettings && (
                          <div className="w-32 flex-shrink-0">
                            <span className="text-xs text-gray-500">適用設定</span>
                            <select
                              value={appliedSettings && appliedSettings[day.date] ? appliedSettings[day.date].workSettingId : (selectedSettings.get(day.date) || 'auto')}
                              onChange={(e) => void handleSettingChange(day.date, e.target.value)}
                              className="text-xs font-medium text-blue-600 bg-transparent border-none p-0 focus:ring-0 cursor-pointer w-full"
                            >
                              <option value="auto">{appliedSetting || "—"}</option>
                              <option value="null">—（設定なし）</option>
                              {workSettings.map((setting) => (
                                <option key={setting._id} value={setting._id}>
                                  {setting.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div className="w-20 flex-shrink-0">
                          <span className="text-xs text-gray-500">残業時間</span>
                          <p className="text-sm font-medium text-orange-600">{overtimeForDay || "—"}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex flex-wrap gap-1">
                        {statusBadges}
                      </div>
                      <div className="flex gap-1 ml-2">
                        <button 
                          onClick={() => openCorrectionModal(day)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium px-2 py-1 border border-blue-300 rounded"
                        >
                          修正
                        </button>
                        <button 
                          onClick={() => openDeleteModal(day)}
                          className="text-red-600 hover:text-red-800 text-xs font-medium px-2 py-1 border border-red-300 rounded"
                        >
                          削除
                        </button>
                      </div>
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
                    onChange={(e) => {
                      const newType = e.target.value as "clock_in" | "clock_out";
                      let newTime = "";
                      let newDate = correctionData.date;
                      
                      // 元のペアIDを維持
                      const originalPairId = correctionData.pairId;
                      
                      // 選択された修正対象に応じて時刻、日付を自動入力
                      // ペアIDが設定されている場合は、そのペアから情報を取得
                      if (originalPairId) {
                        const targetDay = dailyAttendance.find(day => day.clockIn?.id === originalPairId);
                        if (targetDay) {
                          if (newType === "clock_in" && targetDay.clockIn) {
                            newTime = formatToJST(targetDay.clockIn.timestamp, "HH:mm");
                            newDate = targetDay.date;
                          } else if (newType === "clock_out" && targetDay.clockOut) {
                            newTime = formatToJST(targetDay.clockOut.timestamp, "HH:mm");
                            newDate = formatToJST(targetDay.clockOut.timestamp, "yyyy-MM-dd");
                          }
                        }
                      } else {
                        // ペアIDが未設定の場合は、現在の日付から検索
                        const selectedDay = dailyAttendance.find(day => day.date === correctionData.date);
                        if (selectedDay) {
                          if (newType === "clock_in" && selectedDay.clockIn) {
                            newTime = formatToJST(selectedDay.clockIn.timestamp, "HH:mm");
                            newDate = selectedDay.date;
                          } else if (newType === "clock_out" && selectedDay.clockOut) {
                            newTime = formatToJST(selectedDay.clockOut.timestamp, "HH:mm");
                            newDate = formatToJST(selectedDay.clockOut.timestamp, "yyyy-MM-dd");
                          }
                        }
                      }
                      
                      setCorrectionData({ 
                        ...correctionData, 
                        type: newType,
                        time: newTime,
                        date: newDate,
                        pairId: originalPairId, // 元のペアIDを維持
                      });
                    }}
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

                {/* 過去の変更履歴（ペアベース） */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">このペアの変更履歴</h3>
                  <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                    {correctionHistory && correctionHistory.length > 0 ? (
                      correctionHistory.map((h: any, i: number) => (
                        <div key={i} className="text-xs text-gray-600 mb-2">
                          <div className="font-medium">
                            {h.recordType === "clock_in" ? "出勤" : "退勤"}修正: 
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

      {/* 新規勤怠記録作成モーダル */}
      {showNewRecordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">新規勤怠記録作成</h2>
                <button
                  onClick={closeNewRecordModal}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={(e) => void handleNewRecordSubmit(e)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    日付 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={newRecordData.date}
                    onChange={(e) => setNewRecordData({ ...newRecordData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    記録種別 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newRecordData.type}
                    onChange={(e) => setNewRecordData({ ...newRecordData, type: e.target.value as "clock_in" | "clock_out" })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="clock_in">出勤時刻</option>
                    <option value="clock_out">退勤時刻</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    時刻 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={newRecordData.time}
                    onChange={(e) => setNewRecordData({ ...newRecordData, time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    作成理由 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={newRecordData.reason}
                    onChange={(e) => setNewRecordData({ ...newRecordData, reason: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="例：打刻忘れのため後日入力"
                    required
                  />
                </div>

                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>注意：</strong>この機能は打刻を忘れた日の勤怠記録を後日作成するためのものです。既存の記録を修正する場合は「修正」ボタンをご利用ください。
                  </p>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    記録を作成
                  </button>
                  <button
                    type="button"
                    onClick={closeNewRecordModal}
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

      {/* 削除確認モーダル */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">勤怠ペア削除確認</h2>
                <button
                  onClick={closeDeleteModal}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ✕
                </button>
              </div>
              
              <div className="mb-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <span className="text-red-600 text-2xl mr-3">⚠️</span>
                    <div>
                      <h3 className="text-red-800 font-medium">注意</h3>
                      <p className="text-red-700 text-sm mt-1">
                        {formatDate(deleteData.date)}の勤怠ペア（出勤・退勤）を完全に削除します。
                        この操作は取り消すことができません。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <form onSubmit={(e) => void handleDeleteSubmit(e)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    削除理由 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={deleteData.reason}
                    onChange={(e) => setDeleteData({ ...deleteData, reason: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    rows={3}
                    placeholder="例：誤った打刻のため削除"
                    required
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    削除する
                  </button>
                  <button
                    type="button"
                    onClick={closeDeleteModal}
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