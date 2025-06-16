import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { formatToJST } from "@/lib/timezone";

interface MonthlyCalendarProps {
  isPremium: boolean;
}

export function MonthlyCalendar({ isPremium }: MonthlyCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // React Hooksは必ず条件分岐の外で呼ぶ
  const staffList = useQuery(api.staff.getStaffList);
  const allUsedTags = useQuery(api.staff.getAllUsedTags);
  const calendarData = useQuery(api.calendar.getMonthlyCalendar, {
    year: currentDate.year,
    month: currentDate.month,
  });

  if (!isPremium) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">月次カレンダー表示</h1>
          <div className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-sm font-medium">
            有料プラン機能
          </div>
        </div>
        
        <div className="relative bg-white rounded-lg shadow p-6">
          <div className="filter blur-sm pointer-events-none">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px]">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-gray-700 w-32">スタッフ</th>
                    {Array.from({ length: 10 }, (_, i) => (
                      <th key={i} className="px-3 py-3 text-center font-medium text-gray-700 min-w-[80px]">{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }, (_, i) => (
                    <tr key={i} className="border-t border-gray-200">
                      <td className="px-6 py-4 font-medium text-gray-900">スタッフ{i + 1}</td>
                      {Array.from({ length: 10 }, (_, j) => (
                        <td key={j} className="px-3 py-4 text-center text-xs">
                          {j % 3 === 0 ? (
                            <div className="space-y-1">
                              <div className="text-green-600">09:00</div>
                              <div className="text-red-600">18:00</div>
                            </div>
                          ) : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* オーバーレイメッセージ */}
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
            <div className="text-center">
              <span className="text-gray-400 text-4xl">📅</span>
              <p className="text-gray-700 font-medium mt-4">月次カレンダー機能は有料プランでご利用いただけます</p>
              <p className="text-gray-500 text-sm mt-2">左下の開発用スイッチで有料プランに切り替えてお試しください</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (calendarData === undefined || staffList === undefined) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

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

  // 月の日付を生成（1日から月末まで）
  const generateMonthDays = () => {
    const lastDay = new Date(currentDate.year, currentDate.month, 0).getDate();
    const days = [];
    for (let i = 1; i <= lastDay; i++) {
      days.push(i);
    }
    return days;
  };

  const monthDays = generateMonthDays();

  const formatDate = (day: number) => {
    return `${currentDate.year}-${String(currentDate.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const formatTime = (timestamp: number) => {
    // UTCタイムスタンプをJSTに変換して表示
    return formatToJST(timestamp, "HH:mm");
  };

  // タグでフィルタリングされたスタッフ一覧
  const filteredStaff = staffList.filter(staff => {
    if (selectedTags.length === 0) return true;
    return staff.tags && staff.tags.some(tag => selectedTags.includes(tag));
  });

  // スタッフの日別勤怠データを取得
  const getStaffDayData = (staffId: string, day: number) => {
    const dateKey = formatDate(day);
    const dayData = calendarData?.dailyData[dateKey];
    if (!dayData) return null;
    
    const staffData = dayData.staffList.find(s => s.staffId === staffId);
    return staffData || null;
  };

  // タグの選択/解除
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const clearTagFilter = () => {
    setSelectedTags([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">月次カレンダー表示</h1>
        <div className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-sm font-medium">
          有料プラン
        </div>
      </div>

      {/* 月選択 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => changeMonth(-1)}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            ←
          </button>
          <span className="text-lg font-medium text-gray-700 min-w-[120px] text-center">
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

      {/* タグフィルター */}
      {allUsedTags && allUsedTags.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">タグでフィルター</h3>
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={clearTagFilter} 
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                selectedTags.length === 0 
                  ? "bg-blue-600 text-white" 
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              すべて
            </button>
            {allUsedTags.map((tag) => (
              <button 
                key={tag} 
                onClick={() => toggleTag(tag)} 
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  selectedTags.includes(tag)
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* スタッフ別月次表示 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">スタッフ別月次勤怠表</h2>
          <p className="text-sm text-gray-600 mt-1">
            {filteredStaff.length}名のスタッフ表示中 
            {selectedTags.length > 0 && `（タグフィルター: ${selectedTags.join(", ")}）`}
          </p>
        </div>
        
        <div className="p-6">
          {filteredStaff.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-gray-400 text-4xl">👥</span>
              <p className="text-gray-500 mt-4">
                {selectedTags.length > 0 
                  ? "選択されたタグに該当するスタッフがいません" 
                  : "表示するスタッフがいません"
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-6 py-3 text-left font-medium text-gray-700 w-40 sticky left-0 bg-white">
                      スタッフ
                    </th>
                    {monthDays.map((day) => (
                      <th key={day} className="px-3 py-3 text-center font-medium text-gray-700 min-w-[80px]">
                        <div className="text-sm">{day}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(currentDate.year, currentDate.month - 1, day).toLocaleDateString("ja-JP", { weekday: "short" })}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((staff) => (
                    <tr key={staff._id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-4 sticky left-0 bg-white">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-blue-600 font-semibold text-sm">
                              {staff.name.charAt(0)}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 truncate">{staff.name}</div>
                            <div className="text-xs text-gray-500">{staff.employeeId}</div>
                          </div>
                        </div>
                      </td>
                      {monthDays.map((day) => {
                        const dayData = getStaffDayData(staff._id, day);
                        const isWeekend = new Date(currentDate.year, currentDate.month - 1, day).getDay() % 6 === 0;
                        
                        return (
                          <td key={day} className={`px-3 py-4 text-center text-xs ${isWeekend ? 'bg-gray-50' : ''}`}>
                            {dayData ? (
                              <div className="space-y-1">
                                {dayData.clockIn && (
                                  <div className="text-xs font-medium text-green-600">
                                    {formatTime(dayData.clockIn.timestamp)}
                                  </div>
                                )}
                                {dayData.clockOut && (
                                  <div className="text-xs font-medium text-blue-600">
                                    {formatTime(dayData.clockOut.timestamp)}
                                  </div>
                                )}
                                {dayData.clockIn && dayData.clockOut && (
                                  <div className="text-xs text-gray-500">
                                    {(() => {
                                      const hours = (dayData.clockOut.timestamp - dayData.clockIn.timestamp) / (1000 * 60 * 60);
                                      if (hours < 0 || hours > 24) {
                                        return "データエラー";
                                      }
                                      return `${Math.round(hours * 10) / 10}h`;
                                    })()}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 統計サマリー */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-blue-800">総出勤日数</h3>
          <p className="text-2xl font-bold text-blue-900">{calendarData?.summary?.totalWorkDays || 0}日</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-green-800">平均出勤者数</h3>
          <p className="text-2xl font-bold text-green-900">{calendarData?.summary?.averageAttendance || 0}人</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-orange-800">最大出勤者数</h3>
          <p className="text-2xl font-bold text-orange-900">{calendarData?.summary?.maxAttendance || 0}人</p>
        </div>
      </div>
    </div>
  );
}
