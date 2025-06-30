import { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { toast } from "sonner";

interface StaffListProps {
  onStaffSelect: (staffId: string) => void;
  isPremium: boolean;
}

export function StaffList({ onStaffSelect, isPremium }: StaffListProps) {
  const { user } = useUser();
  const clerkUserId = user?.id;
  
  // TODO: Supabaseクエリでデータを取得
  const staffList = [
    { _id: '1', name: 'サンプル太郎', qrCodeData: 'sample1', tags: ['正社員'], isActive: true },
    { _id: '2', name: 'テスト花子', qrCodeData: 'sample2', tags: ['パート'], isActive: true }
  ];
  
  const inactiveStaffList: any[] = [];
  const allUsedTags = ['正社員', 'パート', 'アルバイト'];
  
  const [showInactive, setShowInactive] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    qrCodeData: "",
    tags: [] as string[],
  });

  const resetForm = () => {
    setFormData({
      name: "",
      qrCodeData: "",
      tags: [],
    });
    setShowAddForm(false);
    setEditingStaff(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("スタッフ名を入力してください");
      return;
    }

    if (!formData.qrCodeData.trim()) {
      toast.error("QRコードデータを入力してください");
      return;
    }

    // TODO: Supabaseでの保存処理
    console.log('TODO: Supabaseに保存', formData);
    toast.success(editingStaff ? "スタッフ情報を更新しました" : "スタッフを登録しました");
    resetForm();
  };

  const handleEdit = (staff: any) => {
    setFormData({
      name: staff.name,
      qrCodeData: staff.qrCodeData,
      tags: staff.tags || [],
    });
    setEditingStaff(staff);
    setShowAddForm(true);
  };

  const handleDeactivate = (staffId: string) => {
    if (!confirm("このスタッフを無効にしますか？")) return;
    
    // TODO: Supabaseでの無効化処理
    console.log('TODO: Supabaseで無効化', staffId);
    toast.success("スタッフを無効にしました");
  };

  const handleReactivate = (staffId: string) => {
    // TODO: Supabaseでの有効化処理
    console.log('TODO: Supabaseで有効化', staffId);
    toast.success("スタッフを有効にしました");
  };

  const filteredStaff = staffList.filter(staff => {
    const matchesSearch = staff.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTags = selectedTags.length === 0 || 
      selectedTags.some(tag => staff.tags?.includes(tag));
    return matchesSearch && matchesTags;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">スタッフ管理</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          新しいスタッフを追加
        </button>
      </div>

      {/* 移行作業中の通知 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-yellow-800">
          <span className="text-2xl">🚧</span>
          <div>
            <p className="font-medium">移行作業中</p>
            <p className="text-sm">スタッフ管理機能はSupabase移行後に完全実装されます。現在はデモ表示中です。</p>
          </div>
        </div>
      </div>

      {/* 検索・フィルター */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              スタッフ名で検索
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="スタッフ名を入力..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
      </div>

      {/* スタッフリスト */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              アクティブなスタッフ ({filteredStaff.length}名)
            </h2>
            <button
              onClick={() => setShowInactive(!showInactive)}
              className="text-gray-600 hover:text-gray-800 text-sm"
            >
              {showInactive ? "非アクティブを非表示" : "非アクティブを表示"}
            </button>
          </div>
        </div>

        <div className="p-4">
          {filteredStaff.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-gray-400 text-4xl">👥</span>
              <p className="text-gray-500 mt-4">条件に一致するスタッフが見つかりません</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStaff.map((staff) => (
                <div key={staff._id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{staff.name}</h3>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(staff)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => onStaffSelect(staff._id)}
                        className="text-green-600 hover:text-green-800 text-sm ml-2"
                      >
                        詳細
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">QR: {staff.qrCodeData}</p>
                  <div className="flex flex-wrap gap-1">
                    {staff.tags?.map((tag: string) => (
                      <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 非アクティブなスタッフ */}
      {showInactive && inactiveStaffList.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-600">
              非アクティブなスタッフ ({inactiveStaffList.length}名)
            </h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inactiveStaffList.map((staff) => (
                <div key={staff._id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-600">{staff.name}</h3>
                    <button
                      onClick={() => handleReactivate(staff._id)}
                      className="text-green-600 hover:text-green-800 text-sm"
                    >
                      有効化
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mb-2">QR: {staff.qrCodeData}</p>
                  <div className="flex flex-wrap gap-1">
                    {staff.tags?.map((tag: string) => (
                      <span key={tag} className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 追加・編集フォーム */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingStaff ? "スタッフ情報を編集" : "新しいスタッフを追加"}
                </h2>
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 text-xl">
                  ✕
                </button>
              </div>
              
                             <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    スタッフ名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="山田太郎"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    QRコードデータ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.qrCodeData}
                    onChange={(e) => setFormData({ ...formData, qrCodeData: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="staff_001"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    QRコードに含まれる識別子（英数字、アンダースコア、ハイフンのみ）
                  </p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>移行作業中:</strong> 実際の保存機能はSupabase移行後に実装されます。
                  </p>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    {editingStaff ? "更新（デモ）" : "追加（デモ）"}
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
