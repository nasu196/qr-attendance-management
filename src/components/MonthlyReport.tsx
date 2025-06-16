import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";
import { StaffDetail } from "./StaffDetail";

interface MonthlyReportProps {
  isPremium: boolean;
}

type PeriodType = "thisMonth" | "lastMonth" | "thisYear" | "lastYear" | "last12Months" | "custom";

export function MonthlyReport({ isPremium }: MonthlyReportProps) {
  const [periodType, setPeriodType] = useState<PeriodType>("thisMonth");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "totalHours" | "workDays">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selectedStaffId, setSelectedStaffId] = useState<Id<"staff"> | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isPeriodSectionOpen, setIsPeriodSectionOpen] = useState(false);
  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);

  // 期間を計算する関数（修正版）
  const calculatePeriod = (type: PeriodType) => {
    const now = new Date();
    let startDate: string, endDate: string;

    switch (type) {
      case "thisMonth": {
        // 今月の1日から月末まで
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        startDate = thisMonthStart.toLocaleDateString('sv-SE');
        endDate = thisMonthEnd.toLocaleDateString('sv-SE');
        break;
      }
      case "lastMonth": {
        // 先月の1日から月末まで
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        startDate = lastMonthStart.toLocaleDateString('sv-SE');
        endDate = lastMonthEnd.toLocaleDateString('sv-SE');
        break;
      }
      case "thisYear": {
        const thisYearStart = new Date(now.getFullYear(), 0, 1);
        const thisYearEnd = new Date(now.getFullYear(), 11, 31);
        startDate = thisYearStart.toLocaleDateString('sv-SE');
        endDate = thisYearEnd.toLocaleDateString('sv-SE');
        break;
      }
      case "lastYear": {
        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);
        startDate = lastYearStart.toLocaleDateString('sv-SE');
        endDate = lastYearEnd.toLocaleDateString('sv-SE');
        break;
      }
      case "last12Months": {
        const last12Start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        const last12End = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        startDate = last12Start.toLocaleDateString('sv-SE');
        endDate = last12End.toLocaleDateString('sv-SE');
        break;
      }
      case "custom":
        startDate = customStartDate;
        endDate = customEndDate;
        break;
      default: {
        const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        startDate = defaultStart.toLocaleDateString('sv-SE');
        endDate = defaultEnd.toLocaleDateString('sv-SE');
        break;
      }
    }

    return { startDate, endDate };
  };

  const { startDate, endDate } = calculatePeriod(periodType);

  // useQueryは常に同じ順序で呼ぶ必要がある
  const periodReport = useQuery(api.reports.getPeriodReport, 
    startDate && endDate && isPremium ? { startDate, endDate } : "skip"
  );
  const allUsedTags = useQuery(api.staff.getAllUsedTags);
  const staffList = useQuery(api.staff.getStaffList);

  // カスタム期間選択の処理
  const handleCustomPeriodSelect = () => {
    if (!customStartDate || !customEndDate) {
      toast.error("開始日と終了日の両方を選択してください");
      return;
    }
    
    if (customStartDate > customEndDate) {
      toast.error("開始日は終了日より前の日付を選択してください");
      return;
    }
    
    setPeriodType("custom");
    setShowCustomModal(false);
    toast.success("カスタム期間を設定しました");
  };

  const openCustomModal = () => {
    // デフォルト値を今月に設定
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    
    setCustomStartDate(customStartDate || monthStart);
    setCustomEndDate(customEndDate || monthEnd);
    setShowCustomModal(true);
  };

  // スタッフ詳細表示の処理
  const handleStaffClick = (staffId: Id<"staff">) => {
    // 今月または先月の場合のみスタッフ詳細に遷移
    if (periodType === "thisMonth" || periodType === "lastMonth") {
      setSelectedStaffId(staffId);
    }
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

  if (!isPremium) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">月次レポート表示</h1>
          <div className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-sm font-medium">
            有料プラン機能
          </div>
        </div>
        
        <div className="relative bg-white rounded-lg shadow">
          {/* ブラー効果のあるダミーコンテンツ */}
          <div className="filter blur-sm pointer-events-none p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-blue-800">総勤務時間</h3>
                <p className="text-2xl font-bold text-blue-900">168時間30分</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-green-800">出勤日数</h3>
                <p className="text-2xl font-bold text-green-900">22日</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-orange-800">残業時間</h3>
                <p className="text-2xl font-bold text-orange-900">12時間15分</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-purple-800">対象スタッフ</h3>
                <p className="text-2xl font-bold text-purple-900">8名</p>
              </div>
            </div>
            <div className="space-y-3 mb-6">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              <div className="h-4 bg-gray-200 rounded w-4/5"></div>
            </div>
            <div className="space-y-3">
              <div className="h-8 bg-gray-200 rounded"></div>
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              <div className="h-6 bg-gray-200 rounded w-1/2"></div>
              <div className="h-6 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
          
          {/* オーバーレイメッセージ */}
          <div className="absolute inset-0 flex items-center justify-center bg-white/85 rounded-lg p-6">
            <div className="text-center max-w-md mx-auto">
              <span className="text-gray-400 text-4xl">📈</span>
              <p className="text-gray-700 font-medium mt-4 mb-2">月次レポート機能は有料プランでご利用いただけます</p>
              <p className="text-gray-500 text-sm mb-4">左下の開発用スイッチで有料プランに切り替えてお試しください</p>
              <div className="mt-4 space-y-1 text-sm text-gray-600">
                <p>✓ 期間選択機能（今月、先月、今年、去年、直近1年間、カスタム期間）</p>
                <p>✓ スタッフ別詳細レポート</p>
                <p>✓ CSVエクスポート機能</p>
                <p>✓ ソート・フィルタリング機能</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // スタッフ詳細表示中の場合
  if (selectedStaffId) {
    // 期間に応じて初期表示月を決定
    let initialYear: number, initialMonth: number;
    if (periodType === "lastMonth") {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      initialYear = lastMonth.getFullYear();
      initialMonth = lastMonth.getMonth() + 1;
    } else {
      // thisMonthまたはその他の場合は今月
      const now = new Date();
      initialYear = now.getFullYear();
      initialMonth = now.getMonth() + 1;
    }

    return (
      <StaffDetail 
        staffId={selectedStaffId} 
        onBack={() => setSelectedStaffId(null)}
        isPremium={isPremium}
        initialYear={initialYear}
        initialMonth={initialMonth}
      />
    );
  }

  if (periodReport === undefined) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // ソート機能（タグフィルタリング込み）
  const sortedStaffReports = [...(periodReport?.staffReports || [])]
    .filter(staff => {
      // タグフィルタリング
      if (selectedTags.length === 0) return true;
      // スタッフ情報を取得してタグをチェック
      const staffInfo = staffList?.find(s => s.name === staff.name);
      if (!staffInfo || !staffInfo.tags) return false;
      return staffInfo.tags.some(tag => selectedTags.includes(tag));
    })
    .sort((a, b) => {
    let aValue: any, bValue: any;
    
    switch (sortBy) {
      case "name":
        aValue = a.name;
        bValue = b.name;
        break;
      case "totalHours":
        aValue = parseInt(a.totalHours.split('時間')[0]);
        bValue = parseInt(b.totalHours.split('時間')[0]);
        break;
      case "workDays":
        aValue = a.workDays;
        bValue = b.workDays;
        break;
      default:
        aValue = a.name;
        bValue = b.name;
    }

    if (sortOrder === "asc") {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const getPeriodLabel = () => {
    const labels = {
      thisMonth: "今月",
      lastMonth: "先月", 
      thisYear: "今年",
      lastYear: "去年",
      last12Months: "直近1年間",
      custom: "カスタム期間"
    };
    return labels[periodType];
  };

  const exportToCSV = () => {
    if (!periodReport?.staffReports?.length) {
      toast.error("出力するデータがありません");
      return;
    }
    
    const csvData = [
      ["期間", `${startDate} ～ ${endDate}`],
      [""],
      ["スタッフ名", "職員番号", "出勤日数", "総勤務時間", "残業時間"]
    ];
    
    sortedStaffReports.forEach(staff => {
      csvData.push([
        staff.name,
        staff.employeeId,
        staff.workDays.toString(),
        staff.totalHours,
        staff.overtimeHours
      ]);
    });
    
    // サマリー情報も追加
    csvData.push(
      [""],
      ["=== サマリー ==="],
      ["総勤務時間", periodReport.summary.totalHours],
      ["総出勤日数", `${periodReport.summary.totalWorkDays}日`],
      ["総残業時間", periodReport.summary.totalOvertimeHours],
      ["対象スタッフ数", `${periodReport.summary.totalStaff}名`]
    );
    
    const blob = new Blob([csvData.map(row => row.join(",")).join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `勤怠レポート_${getPeriodLabel()}_${startDate}_${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSVファイルをダウンロードしました");
  };

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">月次レポート表示</h1>
        <div className="flex items-center gap-2">
          <div className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-sm font-medium">
            有料プラン
          </div>
          <button
            onClick={exportToCSV}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            CSV出力
          </button>
        </div>
      </div>

      {/* 期間選択（アコーディオン） */}
      <div className="bg-white rounded-lg shadow">
        <button
          onClick={() => setIsPeriodSectionOpen(!isPeriodSectionOpen)}
          className="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-gray-50 transition-colors"
        >
          <div>
            <h2 className="text-lg font-semibold text-gray-900">期間選択</h2>
            <p className="text-sm text-gray-600 mt-1">
              対象期間: {startDate} ～ {endDate}
            </p>
          </div>
          <div className={`transform transition-transform duration-300 ease-in-out ${isPeriodSectionOpen ? 'rotate-180' : ''}`}>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
        
        <div 
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            isPeriodSectionOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="px-6 pb-6 border-t border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-4">
              {[
                { value: "thisMonth", label: "今月" },
                { value: "lastMonth", label: "先月" },
                { value: "thisYear", label: "今年" },
                { value: "lastYear", label: "去年" },
                { value: "last12Months", label: "直近1年" },
                { value: "custom", label: "カスタム" }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    if (option.value === "custom") {
                      setShowCustomModal(true);
                    } else {
                      setPeriodType(option.value as PeriodType);
                    }
                  }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    periodType === option.value
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* タグフィルター（アコーディオン） */}
      {allUsedTags && allUsedTags.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <button
            onClick={() => setIsTagFilterOpen(!isTagFilterOpen)}
            className="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-gray-50 transition-colors"
          >
            <div>
              <h3 className="text-lg font-semibold text-gray-900">タグフィルター</h3>
              <p className="text-sm text-gray-600 mt-1">
                {selectedTags.length === 0 
                  ? "すべてのスタッフを表示" 
                  : `${selectedTags.join(", ")} のスタッフを表示`
                }
              </p>
            </div>
            <div className={`transform transition-transform duration-300 ease-in-out ${isTagFilterOpen ? 'rotate-180' : ''}`}>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          
          <div 
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              isTagFilterOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="px-6 pb-6 border-t border-gray-200">
              <div className="flex flex-wrap gap-2 mt-4">
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
          </div>
        </div>
      )}

      {/* カスタム期間選択モーダル */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">カスタム期間選択</h2>
                <button
                  onClick={() => setShowCustomModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    開始日 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    終了日 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-6">
                <button
                  onClick={handleCustomPeriodSelect}
                  className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  適用
                </button>
                <button
                  onClick={() => setShowCustomModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {periodReport ? (
        <>
          {/* サマリーカード */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <span className="text-blue-600 text-xl">⏰</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">総勤務時間</p>
                  <p className="text-2xl font-bold text-gray-900">{periodReport.summary.totalHours}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <span className="text-green-600 text-xl">📊</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">総勤務日数</p>
                  <p className="text-2xl font-bold text-gray-900">{periodReport.summary.totalWorkDays}日</p>
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
                  <p className="text-2xl font-bold text-gray-900">{periodReport.summary.totalOvertimeHours}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <span className="text-purple-600 text-xl">👥</span>
                </div>
                                 <div className="ml-4">
                   <p className="text-sm font-medium text-gray-600">スタッフ数</p>
                   <p className="text-2xl font-bold text-gray-900">{periodReport.summary.totalStaff}名</p>
                 </div>
              </div>
            </div>
          </div>

          {/* スタッフ別詳細表 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">スタッフ別詳細</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportToCSV}
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                >
                  CSV出力
                </button>
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [sort, order] = e.target.value.split('-');
                    setSortBy(sort as "name" | "totalHours" | "workDays");
                    setSortOrder(order as "asc" | "desc");
                  }}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="name-asc">名前 (昇順)</option>
                  <option value="name-desc">名前 (降順)</option>
                  <option value="totalHours-asc">勤務時間 (昇順)</option>
                  <option value="totalHours-desc">勤務時間 (降順)</option>
                  <option value="workDays-asc">勤務日数 (昇順)</option>
                  <option value="workDays-desc">勤務日数 (降順)</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      スタッフ名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      総勤務時間
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      総勤務日数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      総残業時間
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      詳細
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedStaffReports.map((staff) => (
                    <tr key={staff.name} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-blue-600 font-semibold text-sm">
                              {staff.name.charAt(0)}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-gray-900">{staff.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {staff.totalHours}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {staff.workDays}日
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">
                        {staff.overtimeHours}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => {
                            const staffInfo = staffList?.find(s => s.name === staff.name);
                            if (staffInfo) {
                              setSelectedStaffId(staffInfo._id);
                            }
                          }}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          詳細表示
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">レポートを生成中...</p>
        </div>
      )}
    </div>
  );
}
