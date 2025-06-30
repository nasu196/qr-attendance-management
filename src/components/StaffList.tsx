import { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { toast } from "sonner";
import StaffDetail from "./StaffDetail";
import { TagInput } from "./TagInput";
import { supabase } from "../lib/supabase";
import QRCode from "qrcode";
import jsPDF from "jspdf";

interface Staff {
  id: string;
  name: string;
  employee_id: string;
  qr_code_data: string;
  tags: string[] | null;
  is_active: boolean;
  user_id: string;
  clerk_user_id: string;
  created_at: string;
  updated_at: string;
}

interface StaffListProps {
  isPremium: boolean;
  onShowStaffDetail?: (staffId: string) => void;
}

export function StaffList({ isPremium, onShowStaffDetail }: StaffListProps) {
  const { user } = useUser();
  const clerkUserId = user?.id;

  // State
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [inactiveStaffList, setInactiveStaffList] = useState<Staff[]>([]);
  const [allUsedTags, setAllUsedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [selectedInactiveStaff, setSelectedInactiveStaff] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInactiveList, setShowInactiveList] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [viewingStaffId, setViewingStaffId] = useState<string | null>(null);
  const [showBulkTagModal, setShowBulkTagModal] = useState(false);
  const [bulkTags, setBulkTags] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    tags: [] as string[],
  });

  // Data fetching
  const fetchStaffData = async () => {
    if (!clerkUserId) return;

    try {
      setLoading(true);

      // アクティブスタッフ取得
      const { data: activeStaff, error: activeError } = await supabase
        .from('staff')
        .select('*')
        .eq('is_active', true)
        .eq('clerk_user_id', clerkUserId)
        .order('created_at', { ascending: false });

      if (activeError) throw activeError;

      // 非アクティブスタッフ取得
      const { data: inactiveStaff, error: inactiveError } = await supabase
        .from('staff')
        .select('*')
        .eq('is_active', false)
        .eq('clerk_user_id', clerkUserId)
        .order('created_at', { ascending: false });

      if (inactiveError) throw inactiveError;

      setStaffList(activeStaff || []);
      setInactiveStaffList(inactiveStaff || []);

      // 全タグ取得
      const allStaff = [...(activeStaff || []), ...(inactiveStaff || [])];
      const tags = new Set<string>();
      allStaff.forEach(staff => {
        if (staff.tags) {
          staff.tags.forEach((tag: string) => tags.add(tag));
        }
      });
      setAllUsedTags(Array.from(tags));

    } catch (error) {
      console.error('Error fetching staff data:', error);
      toast.error('スタッフデータの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStaffData();
  }, [clerkUserId]);

  // Event handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStaff(staffList.map(staff => staff.id));
    } else {
      setSelectedStaff([]);
    }
  };

  const handleSelectStaff = (staffId: string, checked: boolean) => {
    if (checked) {
      setSelectedStaff([...selectedStaff, staffId]);
    } else {
      setSelectedStaff(selectedStaff.filter(id => id !== staffId));
    }
  };

  const handleSelectAllInactive = (checked: boolean) => {
    if (checked) {
      setSelectedInactiveStaff(inactiveStaffList.map(staff => staff.id));
    } else {
      setSelectedInactiveStaff([]);
    }
  };

  const handleSelectInactiveStaff = (staffId: string, checked: boolean) => {
    if (checked) {
      setSelectedInactiveStaff([...selectedInactiveStaff, staffId]);
    } else {
      setSelectedInactiveStaff(selectedInactiveStaff.filter(id => id !== staffId));
    }
  };

  const handleCreateDummyData = async () => {
    if (!clerkUserId) {
      toast.error('ユーザー認証が必要です');
      return;
    }

    try {
      const dummyStaff = [
        { name: '田中太郎', department: '営業部', tags: ['正社員', '営業部'] },
        { name: '佐藤花子', department: '開発部', tags: ['正社員', '開発部'] },
        { name: '山田次郎', department: 'デザイン部', tags: ['正社員', 'デザイン部'] },
        { name: '鈴木美咲', department: '人事部', tags: ['正社員', '人事部'] },
        { name: '高橋健一', department: 'マーケティング部', tags: ['正社員', 'マーケティング部'] },
        { name: '渡辺さくら', department: '営業部', tags: ['パート', '営業部'] },
        { name: '伊藤大輔', department: '開発部', tags: ['契約社員', '開発部'] },
        { name: '中村麻衣', department: 'デザイン部', tags: ['フリーランス', 'デザイン部'] },
        { name: '小林雄介', department: '人事部', tags: ['アルバイト', '人事部'] },
        { name: '加藤愛', department: 'マーケティング部', tags: ['インターン', 'マーケティング部'] }
      ];

      // スタッフデータの作成
      const staffRecords = dummyStaff.map(staff => ({
        name: staff.name,
        qr_code_data: `QR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tags: staff.tags,
        is_active: true,
        clerk_user_id: clerkUserId,
      }));

      const { data: createdStaff, error: staffError } = await supabase
        .from('staff')
        .insert(staffRecords)
        .select();

      if (staffError) {
        console.error('Staff creation error:', staffError);
        toast.error('スタッフの作成に失敗しました');
        return;
      }

      // 2025年6月の勤怠記録ダミーデータ作成
      const attendanceRecords = [];
      const startDate = new Date(2025, 5, 1); // 2025年6月1日
      const endDate = new Date(2025, 5, 30); // 2025年6月30日

      for (const staff of createdStaff) {
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
          const dayOfWeek = date.getDay(); // 0: 日曜日, 6: 土曜日
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          
          // 平日80%、土日20%の確率で出勤
          const shouldWork = isWeekend ? Math.random() < 0.2 : Math.random() < 0.8;
          
          if (shouldWork) {
            // 出勤時刻: 8:30-10:00の間でランダム
            const clockInHour = 8 + Math.floor(Math.random() * 2);
            const clockInMinute = Math.floor(Math.random() * 60);
            const clockInTime = new Date(date);
            clockInTime.setHours(clockInHour, clockInMinute, 0, 0);

            attendanceRecords.push({
              staff_id: staff.id,
              type: 'clock_in',
              timestamp: clockInTime.toISOString(),
              clerk_user_id: clerkUserId,
            });

            // 退勤時刻: 17:00-21:00の間でランダム（80%の確率で退勤記録あり）
            if (Math.random() < 0.8) {
              const clockOutHour = 17 + Math.floor(Math.random() * 4);
              const clockOutMinute = Math.floor(Math.random() * 60);
              const clockOutTime = new Date(date);
              clockOutTime.setHours(clockOutHour, clockOutMinute, 0, 0);

              attendanceRecords.push({
                staff_id: staff.id,
                type: 'clock_out',
                timestamp: clockOutTime.toISOString(),
                clerk_user_id: clerkUserId,
              });
            }
          }
        }
      }

      // 勤怠記録の一括挿入
      if (attendanceRecords.length > 0) {
        const { error: attendanceError } = await supabase
          .from('attendance')
          .insert(attendanceRecords);

        if (attendanceError) {
          console.error('Attendance creation error:', attendanceError);
          toast.error('勤怠記録の作成に失敗しました');
          return;
        }
      }

      toast.success(`${dummyStaff.length}名のスタッフと${attendanceRecords.length}件の勤怠記録を作成しました`);
      await fetchStaffData();

    } catch (error) {
      console.error('Error creating dummy data:', error);
      toast.error('ダミーデータの作成に失敗しました');
    }
  };

  const handleDeactivateSelected = async () => {
    if (selectedStaff.length === 0) return;

    try {
      const { error } = await supabase
        .from('staff')
        .update({ is_active: false })
        .in('id', selectedStaff);

      if (error) throw error;

      toast.success(`${selectedStaff.length}名のスタッフを無効化しました`);
      setSelectedStaff([]);
      await fetchStaffData();
    } catch (error) {
      console.error('Error deactivating staff:', error);
      toast.error("エラーが発生しました");
    }
  };

  const handleReactivateSelected = async () => {
    if (selectedInactiveStaff.length === 0) return;

    try {
      const { error } = await supabase
        .from('staff')
        .update({ is_active: true })
        .in('id', selectedInactiveStaff);

      if (error) throw error;

      toast.success(`${selectedInactiveStaff.length}名のスタッフを再有効化しました`);
      setSelectedInactiveStaff([]);
      await fetchStaffData();
    } catch (error) {
      console.error('Error reactivating staff:', error);
      toast.error("エラーが発生しました");
    }
  };

  const handleSingleReactivate = async (staffId: string) => {
    try {
      const { error } = await supabase
        .from('staff')
        .update({ is_active: true })
        .eq('id', staffId);

      if (error) throw error;

      toast.success("スタッフを再有効化しました");
      await fetchStaffData();
    } catch (error) {
      console.error('Error reactivating staff:', error);
      toast.error("エラーが発生しました");
    }
  };

  const handleQRCode = async (staffIds: string[]) => {
    const allStaff = [...staffList, ...inactiveStaffList];
    const data = allStaff.filter(s => staffIds.includes(s.id));
    const pdf = new jsPDF();

    // 名刺サイズ: 55mm × 91mm
    const cardWidth = 91; // mm
    const cardHeight = 55; // mm
    const margin = 5; // mm

    // A4サイズでの配置計算
    const pageWidth = 210; // A4幅
    const pageHeight = 297; // A4高さ
    const cardsPerRow = Math.floor((pageWidth - margin) / (cardWidth + margin));
    const cardsPerCol = Math.floor((pageHeight - margin) / (cardHeight + margin));
    const cardsPerPage = cardsPerRow * cardsPerCol;

    for (let i = 0; i < data.length; i++) {
      const staff = data[i];

      // 新しいページが必要かチェック
      if (i > 0 && i % cardsPerPage === 0) {
        pdf.addPage();
      }

      const cardIndex = i % cardsPerPage;
      const col = cardIndex % cardsPerRow;
      const row = Math.floor(cardIndex / cardsPerRow);

      const x = margin + col * (cardWidth + margin);
      const y = margin + row * (cardHeight + margin);

      // QRコード生成
      const qrCodeUrl = `${window.location.origin}/qr/${staff.qr_code_data}`;
      const qrCode = await QRCode.toDataURL(qrCodeUrl, { width: 300 });

      // PDF描画 - QRコードを中央に大きく、その下にIDを表示
      pdf.rect(x, y, cardWidth, cardHeight);
      
      // QRコードを中央に大きく配置（40mm x 40mm）
      const qrSize = 40;
      const qrX = x + (cardWidth - qrSize) / 2;
      const qrY = y + 5;
      pdf.addImage(qrCode, 'PNG', qrX, qrY, qrSize, qrSize);
      
      // IDを下部中央に小さく表示
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100); // グレー色
      const textWidth = pdf.getTextWidth(`ID: ${staff.employee_id}`);
      const textX = x + (cardWidth - textWidth) / 2;
      const textY = qrY + qrSize + 5;
      pdf.text(`ID: ${staff.employee_id}`, textX, textY);
      
      // テキスト色をリセット
      pdf.setTextColor(0, 0, 0);
    }

    pdf.save('staff-qr-codes.pdf');
  };

  const handleBulkTagEdit = () => {
    const staffData = staffList.filter(s => selectedStaff.includes(s.id));
    const commonTags = staffData.length > 0 ? staffData[0].tags || [] : [];
    setBulkTags(commonTags);
    setShowBulkTagModal(true);
  };

  const handleBulkTagSave = async () => {
    if (selectedStaff.length === 0) return;

    try {
      const { error } = await supabase
        .from('staff')
        .update({ tags: bulkTags })
        .in('id', selectedStaff);

      if (error) throw error;

      toast.success(`${selectedStaff.length}名のスタッフのタグを更新しました`);
      setShowBulkTagModal(false);
      setBulkTags([]);
      setSelectedStaff([]);
      await fetchStaffData();
    } catch (error) {
      console.error('Error updating tags:', error);
      toast.error("エラーが発生しました");
    }
  };

  const handleSubmitStaff = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("名前は必須です");
      return;
    }

    try {
      // 連番IDを生成
      const { data: idData, error: idError } = await supabase
        .rpc('generate_staff_id');
      
      if (idError) throw idError;

      const { error } = await supabase
        .from('staff')
        .insert({
          name: formData.name.trim(),
          qr_code_data: idData,
          tags: formData.tags.length > 0 ? formData.tags : null,
          is_active: true,
          clerk_user_id: clerkUserId
        });

      if (error) throw error;

      toast.success("スタッフを追加しました");
      setShowAddModal(false);
      setFormData({ name: "", tags: [] });
      await fetchStaffData();
    } catch (error) {
      console.error('Error creating staff:', error);
      toast.error("エラーが発生しました");
    }
  };

  const openEditModal = (staff: Staff) => {
    setEditingStaffId(staff.id);
    setFormData({
      name: staff.name,
      tags: staff.tags || [],
    });
    setShowEditModal(true);
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !editingStaffId) {
      toast.error("名前は必須です");
      return;
    }

    try {
      const { error } = await supabase
        .from('staff')
        .update({
          name: formData.name.trim(),
          tags: formData.tags.length > 0 ? formData.tags : null,
        })
        .eq('id', editingStaffId);

      if (error) throw error;

      toast.success("スタッフを更新しました");
      closeEditModal();
      await fetchStaffData();
    } catch (error) {
      console.error('Error updating staff:', error);
      toast.error("エラーが発生しました");
    }
  };

  const closeModal = () => {
    setShowAddModal(false);
    setFormData({ name: "", tags: [] });
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setFormData({ name: "", tags: [] });
    setEditingStaffId(null);
  };

  const handleTagsChange = (tags: string[]) => {
    setFormData({ ...formData, tags });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">スタッフ一覧</h1>
        <div className="flex gap-2">
          {staffList.length === 0 && (
            <button
              onClick={() => void handleCreateDummyData()}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              ダミーデータ作成
            </button>
          )}
          <button
            onClick={() => setShowInactiveList(!showInactiveList)}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            {showInactiveList ? "有効スタッフ表示" : "無効スタッフ表示"}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            新規スタッフ追加
          </button>
        </div>
      </div>

      {/* 新規追加モーダル */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">新規スタッフ追加</h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={(e) => void handleSubmitStaff(e)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    名前 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="田中 太郎"
                    required
                  />
                </div>

                <TagInput
                  tags={formData.tags}
                  onTagsChange={handleTagsChange}
                  availableTags={allUsedTags}
                />

                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    追加
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
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

      {/* 編集モーダル */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">スタッフ編集</h2>
                <button
                  onClick={closeEditModal}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={(e) => void handleUpdateStaff(e)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    名前 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="田中 太郎"
                    required
                  />
                </div>

                <TagInput
                  tags={formData.tags}
                  onTagsChange={handleTagsChange}
                  availableTags={allUsedTags}
                />

                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    更新
                  </button>
                  <button
                    type="button"
                    onClick={closeEditModal}
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

      {/* 一括操作バー */}
      {!showInactiveList && selectedStaff.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-blue-800 font-medium">
              {selectedStaff.length}名のスタッフが選択されています
            </span>
            <div className="flex gap-2">
              <button 
                onClick={() => void handleQRCode(selectedStaff)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                QRコード一括生成
              </button>
              <button
                onClick={handleBulkTagEdit}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                タグ一括編集
              </button>
              <button
                onClick={() => void handleDeactivateSelected()}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                一括無効化
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 無効スタッフの一括操作バー */}
      {showInactiveList && selectedInactiveStaff.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-green-800 font-medium">
              {selectedInactiveStaff.length}名の無効スタッフが選択されています
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => void handleReactivateSelected()}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                一括再有効化
              </button>
            </div>
          </div>
        </div>
      )}

      {/* バルクタグ編集モーダル */}
      {showBulkTagModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-lg font-semibold mb-4">タグ一括編集({selectedStaff.length}名)</h2>
            <TagInput tags={bulkTags} onTagsChange={setBulkTags} availableTags={allUsedTags} />

            <div className="flex gap-2 pt-4">
              <button onClick={() => void handleBulkTagSave()} className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg">
                適用
              </button>
              <button onClick={() => setShowBulkTagModal(false)} className="flex-1 bg-gray-300 text-gray-700 px-6 py-2 rounded-lg">
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 全選択チェックボックス */}
      {!showInactiveList && staffList.length > 0 && (
        <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg">
          <input
            type="checkbox"
            checked={selectedStaff.length === staffList.length}
            onChange={(e) => handleSelectAll(e.target.checked)}
            className="rounded border-gray-300"
          />
          <label className="text-sm text-gray-700">
            全て選択 ({staffList.length}名)
          </label>
        </div>
      )}

      {showInactiveList && inactiveStaffList.length > 0 && (
        <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg">
          <input
            type="checkbox"
            checked={selectedInactiveStaff.length === inactiveStaffList.length}
            onChange={(e) => handleSelectAllInactive(e.target.checked)}
            className="rounded border-gray-300"
          />
          <label className="text-sm text-gray-700">
            全て選択 ({inactiveStaffList.length}名)
          </label>
        </div>
      )}

      {/* スタッフリスト */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {showInactiveList ? (
          inactiveStaffList.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-gray-400 text-4xl">😴</span>
              <p className="text-gray-500 mt-4">無効化されたスタッフはいません</p>
            </div>
          ) : (
            inactiveStaffList.map((staff) => (
              <div key={staff.id} className="p-6 hover:bg-gray-50 transition-colors bg-gray-50 border-b border-gray-200 last:border-b-0">
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    checked={selectedInactiveStaff.includes(staff.id)}
                    onChange={(e) => handleSelectInactiveStaff(staff.id, e.target.checked)}
                    className="rounded border-gray-300"
                  />

                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-gray-500 font-semibold text-lg">
                      {staff.name.charAt(0)}
                    </span>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <h3 className="text-lg font-medium text-gray-600">{staff.name}</h3>
                      <span className="text-sm text-gray-500">ID: {staff.employee_id}</span>
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">無効</span>
                    </div>

                    {staff.tags && staff.tags.length > 0 && (
                      <div className="mt-2 flex gap-1">
                        {staff.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-block bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => void handleSingleReactivate(staff.id)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      再有効化
                    </button>
                  </div>
                </div>
              </div>
            ))
          )
        ) : (
          staffList.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-gray-400 text-4xl">👥</span>
              <p className="text-gray-500 mt-4">スタッフがまだ登録されていません</p>
              <p className="text-gray-400 text-sm mt-2">右上の「新規スタッフ追加」ボタンから追加できます</p>
            </div>
          ) : (
            staffList.map((staff) => (
              <div key={staff.id} className="p-6 hover:bg-gray-50 transition-colors border-b border-gray-200 last:border-b-0">
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    checked={selectedStaff.includes(staff.id)}
                    onChange={(e) => handleSelectStaff(staff.id, e.target.checked)}
                    className="rounded border-gray-300"
                  />

                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold text-lg">
                      {staff.name.charAt(0)}
                    </span>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <h3 className="text-lg font-medium text-gray-900">{staff.name}</h3>
                      <span className="text-sm text-gray-500">ID: {staff.employee_id}</span>
                    </div>

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

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (onShowStaffDetail) {
                          // 独立ページへの遷移
                          onShowStaffDetail(staff.id);
                        } else {
                          // 従来のモーダル表示（後方互換性のため）
                          setViewingStaffId(staff.id);
                        }
                      }}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      詳細
                    </button>
                    <button
                      onClick={() => void handleQRCode([staff.id])}
                      className="text-green-600 hover:text-green-800 text-sm font-medium"
                    >
                      QRコード
                    </button>
                    <button
                      onClick={() => openEditModal(staff)}
                      className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                    >
                      編集
                    </button>
                  </div>
                </div>
              </div>
            ))
          )
        )}
      </div>

      {/* スタッフ詳細モーダル（独立ページ使用時は表示しない） */}
      {viewingStaffId && !onShowStaffDetail && (
        <StaffDetail
          staffId={viewingStaffId}
          onBack={() => setViewingStaffId(null)}
          isPremium={isPremium}
        />
      )}
    </div>
  );
}
