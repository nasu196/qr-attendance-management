import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { 
  getWorkSettings, 
  createWorkSetting, 
  updateWorkSetting, 
  deleteWorkSetting,
  createInitialWorkSettings,
  type WorkSetting 
} from "@/lib/workSettings";

interface WorkSettingsProps {
  isPremium: boolean;
}

export function WorkSettings({ isPremium }: WorkSettingsProps) {
  const { supabaseUser, loading: userLoading, updatePremiumStatus } = useSupabaseUser();
  const [workSettings, setWorkSettings] = useState<WorkSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    workHours: "",
    breakHours: "",
    description: "",
  });

  // 勤務設定を読み込み
  useEffect(() => {
    async function loadWorkSettings() {
      if (!supabaseUser) return;

      try {
        setLoading(true);
        const settings = await getWorkSettings(supabaseUser.id);
        setWorkSettings(settings);
      } catch (error) {
        console.error("Error loading work settings:", error);
        toast.error("勤務設定の読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    }

    if (!userLoading && supabaseUser) {
      void loadWorkSettings();
    }
  }, [supabaseUser, userLoading]);

  // プレミアムプラン切り替え処理
  const handlePremiumToggle = async () => {
    const newPremiumStatus = !isPremium;
    const success = await updatePremiumStatus(newPremiumStatus);
    
    if (success) {
      toast.success(newPremiumStatus ? "プレミアムプランに切り替えました" : "フリープランに切り替えました");
      
      // プレミアムプランに切り替え時、初期設定を作成
      if (newPremiumStatus && supabaseUser && workSettings.length === 0) {
        try {
          const initialSettings = await createInitialWorkSettings(supabaseUser.id);
          setWorkSettings(initialSettings);
          toast.success("初期勤務設定を作成しました");
        } catch (error) {
          console.error("Error creating initial settings:", error);
          toast.error("初期設定の作成に失敗しました");
        }
      }
    } else {
      toast.error("プランの切り替えに失敗しました");
    }
  };

  // フォームリセット
  const resetForm = () => {
    setFormData({
      name: "",
      workHours: "",
      breakHours: "",
      description: "",
    });
    setEditingId(null);
    setShowAddForm(false);
  };

  // 編集開始
  const startEdit = (setting: WorkSetting) => {
    setFormData({
      name: setting.name,
      workHours: setting.work_hours.toString(),
      breakHours: setting.break_hours.toString(),
      description: setting.description || "",
    });
    setEditingId(setting.id);
    setShowAddForm(true);
  };

  // 保存処理
  const handleSave = async () => {
    if (!supabaseUser) return;

    const workHours = parseFloat(formData.workHours);
    const breakHours = parseFloat(formData.breakHours);

    if (!formData.name.trim() || isNaN(workHours) || isNaN(breakHours)) {
      toast.error("入力内容を確認してください");
      return;
    }

    if (workHours <= 0 || breakHours < 0) {
      toast.error("勤務時間・休憩時間は正の数値で入力してください");
      return;
    }

    try {
      setSubmitting(true);

      if (editingId) {
        // 更新
        const updatedSetting = await updateWorkSetting(editingId, {
          name: formData.name.trim(),
          work_hours: workHours,
          break_hours: breakHours,
          description: formData.description.trim() || null,
        });
        
        setWorkSettings(prev => 
          prev.map(setting => 
            setting.id === editingId ? updatedSetting : setting
          )
        );
        toast.success("勤務設定を更新しました");
      } else {
        // 新規作成
        const newSetting = await createWorkSetting(supabaseUser.id, {
          name: formData.name.trim(),
          work_hours: workHours,
          break_hours: breakHours,
          description: formData.description.trim() || null,
        });
        
        setWorkSettings(prev => [...prev, newSetting]);
        toast.success("勤務設定を作成しました");
      }

      resetForm();
    } catch (error) {
      console.error("Error saving work setting:", error);
      toast.error("保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  // 削除処理
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return;

    try {
      await deleteWorkSetting(id);
      setWorkSettings(prev => prev.filter(setting => setting.id !== id));
      toast.success("勤務設定を削除しました");
    } catch (error) {
      console.error("Error deleting work setting:", error);
      toast.error("削除に失敗しました");
    }
  };

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
        <h1 className="text-2xl font-bold text-gray-900">勤務設定</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => void handlePremiumToggle()}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isPremium
                ? "bg-yellow-600 text-white hover:bg-yellow-700"
                : "bg-gray-600 text-white hover:bg-gray-700"
            }`}
          >
            {isPremium ? "💎 プレミアム" : "✨ フリー"}
          </button>
        </div>
      </div>

      {!isPremium ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center gap-2 text-blue-800">
            <span className="text-2xl">✨</span>
            <div>
              <p className="font-medium">フリープラン</p>
              <p className="text-sm">勤務設定機能はプレミアムプランでご利用いただけます</p>
              <button
                onClick={() => void handlePremiumToggle()}
                className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                プレミアムプランに切り替える
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 設定一覧 */}
          <div className="bg-white rounded-lg shadow border">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="font-medium text-gray-900">設定一覧</h2>
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                新規追加
              </button>
            </div>
            
            <div className="p-4">
              {workSettings.length === 0 ? (
                <div className="text-center py-8">
                  <span className="text-gray-400 text-4xl">⚙️</span>
                  <p className="text-gray-500 mt-4">勤務設定がありません</p>
                  <p className="text-gray-400 text-sm">「新規追加」ボタンから設定を作成してください</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {workSettings.map((setting) => (
                    <div key={setting.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{setting.name}</h3>
                          <div className="text-sm text-gray-600 mt-1">
                            <p>勤務時間: {setting.work_hours}時間</p>
                            <p>休憩時間: {setting.break_hours}時間</p>
                            {setting.description && (
                              <p className="text-gray-500 mt-1">{setting.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(setting)}
                            className="text-blue-600 hover:text-blue-700 text-sm"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => void handleDelete(setting.id, setting.name)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 追加・編集フォーム */}
          {showAddForm && (
            <div className="bg-white rounded-lg shadow border">
              <div className="p-4 border-b border-gray-200">
                <h2 className="font-medium text-gray-900">
                  {editingId ? "設定を編集" : "新しい設定を追加"}
                </h2>
              </div>
              
              <div className="p-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      設定名 *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="例: 日勤"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        勤務時間（時間）*
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={formData.workHours}
                        onChange={(e) => setFormData(prev => ({ ...prev, workHours: e.target.value }))}
                        placeholder="8"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        休憩時間（時間）*
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={formData.breakHours}
                        onChange={(e) => setFormData(prev => ({ ...prev, breakHours: e.target.value }))}
                        placeholder="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      説明
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="設定の詳細説明"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={resetForm}
                    disabled={submitting}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={() => void handleSave()}
                    disabled={submitting}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {submitting ? "保存中..." : editingId ? "更新" : "作成"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
