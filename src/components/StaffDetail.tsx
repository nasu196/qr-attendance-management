import { useState, useEffect } from "react";
import { toast } from "sonner";
import { formatToJST, getStartOfJSTDay, getEndOfJSTDay } from "@/lib/timezone";
import { useUser } from "@clerk/clerk-react";
import { getStaff } from "@/lib/staff";
import { getWorkSettings } from "@/lib/workSettings";
import { 
  correctAttendance, 
  deletePair, 
  createAttendancePair, 
  getCorrectionHistory, 
  getStaffMonthlyAttendance,
  validateAttendanceData 
} from "@/lib/attendance";
import type { Staff } from "@/lib/staff";
import type { AttendancePair, MonthlyAttendance } from "@/lib/attendance";

interface StaffDetailProps {
  staffId: string;
  onBack: () => void;
  isPremium: boolean;
}

export default function StaffDetail({ staffId, onBack, isPremium }: StaffDetailProps) {
  const { user } = useUser();
  const clerkUserId = user?.id;

  // State
  const [staff, setStaff] = useState<Staff | null>(null);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [workSettings, setWorkSettings] = useState<any[]>([]);
  const [monthlyAttendance, setMonthlyAttendance] = useState<MonthlyAttendance | null>(null);
  const [correctionHistory, setCorrectionHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });

  // モーダル状態
  const [isCorrectModalOpen, setIsCorrectModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPair, setSelectedPair] = useState<AttendancePair | null>(null);
  const [correctionData, setCorrectionData] = useState({
    type: 'clock_in' as 'clock_in' | 'clock_out',
    time: '',
    reason: ''
  });
  const [createData, setCreateData] = useState({
    date: '',
    clockInTime: '',
    clockOutTime: '',
    reason: ''
  });

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      if (!clerkUserId) return;
      
      try {
        setLoading(true);
        
        // スタッフ一覧を取得
        const staff = await getStaff(clerkUserId);
        setStaffList(staff);
        
        // 対象スタッフを見つける
        const targetStaff = staff.find(s => s.id === staffId);
        setStaff(targetStaff || null);
        
        // 勤務設定を取得
        const workSettings = await getWorkSettings(clerkUserId);
        setWorkSettings(workSettings);
        
        // 月次勤怠データを取得
        if (targetStaff) {
          const startOfMonth = new Date(currentDate.year, currentDate.month - 1, 1).toISOString();
          const endOfMonth = new Date(currentDate.year, currentDate.month, 0, 23, 59, 59).toISOString();
          
          const attendance = await getStaffMonthlyAttendance({
            clerkUserId: clerkUserId,
            staffId: targetStaff.id,
            startOfMonth,
            endOfMonth
          });
          setMonthlyAttendance(attendance);
          
          // 修正履歴を取得
          const history = await getCorrectionHistory(clerkUserId, targetStaff.id);
          setCorrectionHistory(history);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [clerkUserId, staffId, currentDate]);

  // 月変更
  const changeMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      if (direction === 'prev') {
        const newMonth = prev.month === 1 ? 12 : prev.month - 1;
        const newYear = prev.month === 1 ? prev.year - 1 : prev.year;
        return { year: newYear, month: newMonth };
      } else {
        const newMonth = prev.month === 12 ? 1 : prev.month + 1;
        const newYear = prev.month === 12 ? prev.year + 1 : prev.year;
        return { year: newYear, month: newMonth };
      }
    });
  };

  // 勤怠修正
  const handleCorrection = async () => {
    if (!selectedPair || !clerkUserId) return;

    try {
      const targetRecord = correctionData.type === 'clock_in' ? selectedPair.clock_in : selectedPair.clock_out;
      if (!targetRecord) {
        toast.error('修正対象の記録が見つかりません');
        return;
      }

      const newTimestamp = new Date(`${selectedPair.date}T${correctionData.time}:00`).toISOString();
      
      await correctAttendance({
        attendanceId: targetRecord.id,
        newTimestamp,
        reason: correctionData.reason,
        correctedBy: clerkUserId
      });

      toast.success('勤怠記録を修正しました');
      setIsCorrectModalOpen(false);
      
      // データを再取得
      const startOfMonth = new Date(currentDate.year, currentDate.month - 1, 1).toISOString();
      const endOfMonth = new Date(currentDate.year, currentDate.month, 0, 23, 59, 59).toISOString();
      
      if (staff) {
        const attendance = await getStaffMonthlyAttendance({
          clerkUserId: clerkUserId,
          staffId: staff.id,
          startOfMonth,
          endOfMonth
        });
        setMonthlyAttendance(attendance);
      }
    } catch (error) {
      console.error('Error correcting attendance:', error);
      toast.error('修正に失敗しました');
    }
  };

  // ペア削除
  const handleDeletePair = async (pairId: string) => {
    if (!confirm('この勤怠記録を削除しますか？')) return;

    try {
      await deletePair(pairId);
      toast.success('勤怠記録を削除しました');
      
      // データを再取得
      const startOfMonth = new Date(currentDate.year, currentDate.month - 1, 1).toISOString();
      const endOfMonth = new Date(currentDate.year, currentDate.month, 0, 23, 59, 59).toISOString();
      
      if (staff && clerkUserId) {
        const attendance = await getStaffMonthlyAttendance({
          clerkUserId: clerkUserId,
          staffId: staff.id,
          startOfMonth,
          endOfMonth
        });
        setMonthlyAttendance(attendance);
      }
    } catch (error) {
      console.error('Error deleting pair:', error);
      toast.error('削除に失敗しました');
    }
  };

  // 新規ペア作成
  const handleCreatePair = async () => {
    if (!staff || !clerkUserId) return;

    try {
      const clockInTime = new Date(`${createData.date}T${createData.clockInTime}:00`).toISOString();
      const clockOutTime = createData.clockOutTime ? 
        new Date(`${createData.date}T${createData.clockOutTime}:00`).toISOString() : 
        undefined;

      await createAttendancePair({
        clerkUserId: clerkUserId,
        staffId: staff.id,
        clockInTime,
        clockOutTime,
        qrCodeData: staff.qr_code_data
      });

      toast.success('勤怠記録を作成しました');
      setIsCreateModalOpen(false);
      
      // データを再取得
      const startOfMonth = new Date(currentDate.year, currentDate.month - 1, 1).toISOString();
      const endOfMonth = new Date(currentDate.year, currentDate.month, 0, 23, 59, 59).toISOString();
      
      const attendance = await getStaffMonthlyAttendance({
        clerkUserId: clerkUserId,
        staffId: staff.id,
        startOfMonth,
        endOfMonth
      });
      setMonthlyAttendance(attendance);
    } catch (error) {
      console.error('Error creating pair:', error);
      toast.error('作成に失敗しました');
    }
  };

  // CSV出力
  const exportToCSV = () => {
    if (!monthlyAttendance || !staff) return;

    const csvData = [
      ['日付', '出勤時刻', '退勤時刻', '勤務時間', '休憩時間', '残業時間'],
      ...monthlyAttendance.pairs.map(pair => [
        pair.date,
        pair.clock_in ? formatToJST(pair.clock_in.timestamp).split(' ')[1] : '',
        pair.clock_out ? formatToJST(pair.clock_out.timestamp).split(' ')[1] : '',
        pair.total_hours ? pair.total_hours.toFixed(2) : '',
        pair.break_hours ? pair.break_hours.toFixed(2) : '',
        pair.overtime_hours ? pair.overtime_hours.toFixed(2) : ''
      ])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${staff.name}_${currentDate.year}年${currentDate.month}月_勤怠記録.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">スタッフが見つかりません</h2>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  const validationResult = monthlyAttendance ? validateAttendanceData(monthlyAttendance.pairs) : { errors: [] };

  return (
    <div className="p-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            ← 戻る
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{staff.name}の勤怠詳細</h1>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => changeMonth('prev')}
            className="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            ←
          </button>
          <span className="text-lg font-semibold">
            {currentDate.year}年{currentDate.month}月
          </span>
          <button
            onClick={() => changeMonth('next')}
            className="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            →
          </button>
        </div>
      </div>

      {/* スタッフ情報 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="text-sm text-gray-500">従業員ID</span>
            <p className="font-semibold">{staff.employee_id}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">タグ</span>
            <p className="font-semibold">{staff.tags?.join(', ') || 'なし'}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">QRコード</span>
            <p className="font-semibold text-xs">{staff.qr_code_data}</p>
          </div>
        </div>
      </div>

      {/* 月次サマリー */}
      {monthlyAttendance && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h2 className="text-lg font-semibold mb-4">月次サマリー</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="text-sm text-gray-500">総勤務時間</span>
              <p className="text-2xl font-bold text-blue-600">
                {monthlyAttendance.total_work_hours.toFixed(1)}h
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-500">残業時間</span>
              <p className="text-2xl font-bold text-orange-600">
                {monthlyAttendance.total_overtime_hours.toFixed(1)}h
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-500">出勤日数</span>
              <p className="text-2xl font-bold text-green-600">
                {monthlyAttendance.total_work_days}日
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-500">休憩時間</span>
              <p className="text-2xl font-bold text-gray-600">
                {monthlyAttendance.total_break_hours.toFixed(1)}h
              </p>
            </div>
          </div>
        </div>
      )}

      {/* エラー表示 */}
      {validationResult.errors.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-yellow-800 mb-2">注意事項</h3>
          <ul className="space-y-1">
            {validationResult.errors.map((error, index) => (
              <li key={index} className={`text-sm ${error.type === 'error' ? 'text-red-600' : 'text-yellow-600'}`}>
                {error.date}: {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* アクションボタン */}
      <div className="flex items-center space-x-4 mb-6">
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          disabled={!isPremium}
        >
          新規作成
        </button>
        <button
          onClick={exportToCSV}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          disabled={!isPremium}
        >
          CSV出力
        </button>
        {!isPremium && (
          <span className="text-sm text-gray-500">※プレミアム機能です</span>
        )}
      </div>

      {/* 勤怠記録テーブル */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                日付
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                出勤時刻
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                退勤時刻
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                勤務時間
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                アクション
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {monthlyAttendance?.pairs.map((pair) => (
              <tr key={pair.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {pair.date}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {pair.clock_in ? formatToJST(pair.clock_in.timestamp).split(' ')[1] : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {pair.clock_out ? formatToJST(pair.clock_out.timestamp).split(' ')[1] : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {pair.total_hours ? `${pair.total_hours.toFixed(2)}h` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                  <button
                    onClick={() => {
                      setSelectedPair(pair);
                      setIsCorrectModalOpen(true);
                    }}
                    className="text-blue-600 hover:text-blue-900"
                    disabled={!isPremium}
                  >
                    修正
                  </button>
                  <button
                    onClick={() => handleDeletePair(pair.id)}
                    className="text-red-600 hover:text-red-900"
                    disabled={!isPremium}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 修正モーダル */}
      {isCorrectModalOpen && selectedPair && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-lg font-semibold mb-4">勤怠記録の修正</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  修正対象
                </label>
                <select
                  value={correctionData.type}
                  onChange={(e) => setCorrectionData(prev => ({ ...prev, type: e.target.value as 'clock_in' | 'clock_out' }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  {selectedPair.clock_in && <option value="clock_in">出勤時刻</option>}
                  {selectedPair.clock_out && <option value="clock_out">退勤時刻</option>}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  新しい時刻
                </label>
                <input
                  type="time"
                  value={correctionData.time}
                  onChange={(e) => setCorrectionData(prev => ({ ...prev, time: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  修正理由
                </label>
                <textarea
                  value={correctionData.reason}
                  onChange={(e) => setCorrectionData(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setIsCorrectModalOpen(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleCorrection}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                修正
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新規作成モーダル */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-lg font-semibold mb-4">新規勤怠記録の作成</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  日付
                </label>
                <input
                  type="date"
                  value={createData.date}
                  onChange={(e) => setCreateData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  出勤時刻
                </label>
                <input
                  type="time"
                  value={createData.clockInTime}
                  onChange={(e) => setCreateData(prev => ({ ...prev, clockInTime: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  退勤時刻（任意）
                </label>
                <input
                  type="time"
                  value={createData.clockOutTime}
                  onChange={(e) => setCreateData(prev => ({ ...prev, clockOutTime: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  理由
                </label>
                <textarea
                  value={createData.reason}
                  onChange={(e) => setCreateData(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleCreatePair}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                作成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}