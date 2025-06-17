import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import React from "react";
import { Id } from "../../convex/_generated/dataModel";

interface WorkSettingsProps {
  isPremium: boolean;
}

export function WorkSettings({ isPremium }: WorkSettingsProps) {
  const workSettings = useQuery(api.workSettings.getWorkSettings);
  const createWorkSetting = useMutation(api.workSettings.createWorkSetting);
  const updateWorkSetting = useMutation(api.workSettings.updateWorkSetting);
  const deleteWorkSetting = useMutation(api.workSettings.deleteWorkSetting);
  const setDefaultWorkSetting = useMutation(api.workSettings.setDefaultWorkSetting);
  const createInitialSettings = useMutation(api.workSettings.createInitialSettings);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<Id<"workSettings"> | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    workHours: 8,
    breakHours: 1,
  });

  // 初期設定を作成
  useEffect(() => {
    if (isPremium && workSettings && workSettings.length === 0) {
      createInitialSettings().catch(() => {
        // エラーは無視（既に設定がある場合など）
      });
    }
  }, [isPremium, workSettings, createInitialSettings]);

  // プロプランでない場合はティザー表示
  if (!isPremium) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">勤務設定</h1>
          <div className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-sm font-medium">
            有料プラン機能
          </div>
        </div>
        
        <div className="relative bg-white rounded-lg shadow p-6">
          <div className="filter blur-sm pointer-events-none">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {i === 0 ? "日勤" : i === 1 ? "夜勤" : "パート"}
                    </h3>
                    {i === 0 && (
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                        デフォルト
                      </span>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 flex items-center gap-1">
                        <span>⏰</span> 労働時間
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {i === 0 ? "8時間" : i === 1 ? "10時間" : "4時間"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 flex items-center gap-1">
                        <span>☕</span> 休憩時間
                      </span>
                      <span className="text-sm font-medium text-gray-900">1時間</span>
                    </div>
                    <div className="flex justify-between items-center border-t pt-2">
                      <span className="text-sm text-gray-600 flex items-center gap-1">
                        <span>📊</span> 総勤務時間
                      </span>
                      <span className="text-sm font-semibold text-blue-600">
                        {i === 0 ? "9時間" : i === 1 ? "11時間" : "5時間"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* オーバーレイメッセージ */}
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
            <div className="text-center">
              <span className="text-gray-400 text-4xl">⚙️</span>
              <p className="text-gray-700 font-medium mt-4">勤務設定機能は有料プランでご利用いただけます</p>
              <p className="text-gray-500 text-sm mt-2">労働時間と休憩時間を設定して、残業時間を正確に計算できます</p>
              <p className="text-gray-500 text-sm mt-1">左下の開発用スイッチで有料プランに切り替えてお試しください</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const resetForm = () => {
    setFormData({
      name: "",
      workHours: 8,
      breakHours: 1,
    });
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("設定名を入力してください");
      return;
    }

    if (formData.workHours <= 0 || formData.workHours > 24) {
      toast.error("労働時間は1時間以上24時間以下で入力してください");
      return;
    }

    if (formData.breakHours < 0 || formData.breakHours > 8) {
      toast.error("休憩時間は0時間以上8時間以下で入力してください");
      return;
    }

    if (formData.workHours + formData.breakHours > 24) {
      toast.error("労働時間と休憩時間の合計は24時間以下にしてください");
      return;
    }

    try {
      if (editingId) {
        await updateWorkSetting({
          settingId: editingId,
          name: formData.name,
          workHours: formData.workHours,
          breakHours: formData.breakHours,
        });
        toast.success("勤務設定を更新しました");
      } else {
        await createWorkSetting({
          name: formData.name,
          workHours: formData.workHours,
          breakHours: formData.breakHours,
        });
        toast.success("勤務設定を作成しました");
      }
      resetForm();
    } catch (error: any) {
      toast.error(error.message || "保存に失敗しました");
    }
  };

  const handleEdit = (setting: any) => {
    setFormData({
      name: setting.name,
      workHours: setting.workHours,
      breakHours: setting.breakHours,
    });
    setEditingId(setting._id);
    setShowAddForm(true);
  };

  const handleDelete = async (settingId: Id<"workSettings">) => {
    if (!confirm("この勤務設定を削除しますか？")) return;
    
    try {
      await deleteWorkSetting({ settingId });
      toast.success("勤務設定を削除しました");
    } catch (error: any) {
      toast.error(error.message || "削除に失敗しました");
    }
  };

  const handleSetDefault = async (settingId: Id<"workSettings">) => {
    try {
      await setDefaultWorkSetting({ settingId });
      toast.success("デフォルト設定を変更しました");
    } catch (error: any) {
      toast.error(error.message || "設定に失敗しました");
    }
  };

  if (!workSettings) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">勤務設定</h1>
            <div className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-sm font-medium">
              有料プラン
            </div>
          </div>
          <p className="text-gray-600 mt-2">
            労働時間と休憩時間を設定して、残業時間を正確に計算します
          </p>
          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>💡 使い方:</strong> 勤務時間に応じて最適な設定が自動選択され、残業時間が計算されます
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          新しい設定を追加
        </button>
      </div>

      {/* 設定一覧 */}
      {workSettings.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-gray-400 text-4xl">⚙️</span>
          <p className="text-gray-500 mt-4">勤務設定がありません</p>
          <p className="text-gray-400 text-sm mt-2">「新しい設定を追加」ボタンから設定を作成してください</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workSettings.map((setting) => (
            <div key={setting._id} className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">{setting.name}</h3>
                  {setting.isDefault && (
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                      デフォルト
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(setting)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    編集
                  </button>
                  {!setting.isDefault && (
                    <button
                      onClick={() => void handleDelete(setting._id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium ml-2"
                    >
                      削除
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 flex items-center gap-1">
                    <span>⏰</span> 労働時間
                  </span>
                  <span className="text-sm font-medium text-gray-900">{setting.workHours}時間</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 flex items-center gap-1">
                    <span>☕</span> 休憩時間
                  </span>
                  <span className="text-sm font-medium text-gray-900">{setting.breakHours}時間</span>
                </div>
                <div className="flex justify-between items-center border-t pt-2">
                  <span className="text-sm text-gray-600 flex items-center gap-1">
                    <span>📊</span> 総勤務時間
                  </span>
                  <span className="text-sm font-semibold text-blue-600">{setting.workHours + setting.breakHours}時間</span>
                </div>
              </div>

              {!setting.isDefault && (
                <button
                  onClick={() => void handleSetDefault(setting._id)}
                  className="w-full mt-4 bg-gray-100 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-200 transition-colors font-medium"
                >
                  デフォルトに設定
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 追加・編集フォーム */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingId ? "勤務設定を編集" : "新しい勤務設定"}
                </h2>
                <button
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    設定名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="例: 日勤、夜勤、パート"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    労働時間（時間） <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    max="24"
                    step="0.5"
                    value={formData.workHours}
                    onChange={(e) => setFormData({ ...formData, workHours: parseFloat(e.target.value) || 8 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">実際の作業時間（休憩時間は含まない）</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    休憩時間（時間） <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="8"
                    step="0.5"
                    value={formData.breakHours}
                    onChange={(e) => setFormData({ ...formData, breakHours: parseFloat(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">昼休み等の休憩時間</p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-blue-600">📊</span>
                    <p className="text-sm font-medium text-blue-800">計算結果</p>
                  </div>
                  <div className="space-y-1 text-sm text-blue-700">
                    <p><strong>総勤務時間:</strong> {formData.workHours + formData.breakHours}時間</p>
                    <p><strong>残業判定:</strong> {formData.workHours + formData.breakHours}時間を超えた分が残業</p>
                  </div>
                  <p className="text-xs text-blue-600 mt-2">
                    💡 勤務時間に応じて最適な設定が自動選択されます
                  </p>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    {editingId ? "更新" : "作成"}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition-colors font-medium"
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
