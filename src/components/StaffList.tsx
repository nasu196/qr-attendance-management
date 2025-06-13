import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";
import { StaffDetail } from "./StaffDetail";
import { TagInput } from "./TagInput";

import QRCode from "qrcode";
import jsPDF from "jspdf";

interface StaffListProps {
  isPremium: boolean;
}

export function StaffList({ isPremium }: StaffListProps) {
  const staffList = useQuery(api.staff.getStaffList);
  const inactiveStaffList = useQuery(api.staff.getInactiveStaffList);
  const allUsedTags = useQuery(api.staff.getAllUsedTags);
  const createDummyData = useMutation(api.staff.createDummyData);
  const createAttendanceDummyData = useMutation(api.attendance.createAttendanceDummyData);
  const createStaff = useMutation(api.staff.createStaff);
  const updateStaff = useMutation(api.staff.updateStaff);
  const deactivateStaff = useMutation(api.staff.deactivateStaff);
  const reactivateStaff = useMutation(api.staff.reactivateStaff);
  
  const [selectedStaff, setSelectedStaff] = useState<Id<"staff">[]>([]);
  const [selectedInactiveStaff, setSelectedInactiveStaff] = useState<Id<"staff">[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInactiveList, setShowInactiveList] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<Id<"staff"> | null>(null);
  const [viewingStaffId, setViewingStaffId] = useState<Id<"staff"> | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    tags: [] as string[],
  });


  if (staffList === undefined || inactiveStaffList === undefined) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStaff(staffList.map(staff => staff._id));
    } else {
      setSelectedStaff([]);
    }
  };

  const handleSelectStaff = (staffId: Id<"staff">, checked: boolean) => {
    if (checked) {
      setSelectedStaff([...selectedStaff, staffId]);
    } else {
      setSelectedStaff(selectedStaff.filter(id => id !== staffId));
    }
  };

  const handleSelectAllInactive = (checked: boolean) => {
    if (checked) {
      setSelectedInactiveStaff(inactiveStaffList.map(staff => staff._id));
    } else {
      setSelectedInactiveStaff([]);
    }
  };

  const handleSelectInactiveStaff = (staffId: Id<"staff">, checked: boolean) => {
    if (checked) {
      setSelectedInactiveStaff([...selectedInactiveStaff, staffId]);
    } else {
      setSelectedInactiveStaff(selectedInactiveStaff.filter(id => id !== staffId));
    }
  };

  const handleCreateDummyData = async () => {
    try {
      await createDummyData({});
      await createAttendanceDummyData({});
      toast.success("ダミーデータを作成しました");
    } catch (error) {
      toast.error("エラーが発生しました");
    }
  };

  const handleDeactivateSelected = async () => {
    if (selectedStaff.length === 0) return;
    
    if (confirm(`選択した${selectedStaff.length}名のスタッフを無効化しますか？`)) {
      try {
        await deactivateStaff({ staffIds: selectedStaff });
        toast.success(`${selectedStaff.length}名のスタッフを無効化しました`);
        setSelectedStaff([]);
      } catch (error) {
        toast.error("エラーが発生しました");
      }
    }
  };

  const handleReactivateSelected = async () => {
    if (selectedInactiveStaff.length === 0) return;
    
    if (confirm(`選択した${selectedInactiveStaff.length}名のスタッフを有効化しますか？`)) {
      try {
        await reactivateStaff({ staffIds: selectedInactiveStaff });
        toast.success(`${selectedInactiveStaff.length}名のスタッフを有効化しました`);
        setSelectedInactiveStaff([]);
      } catch (error) {
        toast.error("エラーが発生しました");
      }
    }
  };

  const handleQRCode = async (staffIds: Id<"staff">[]) => {
    const allStaff = [...staffList, ...inactiveStaffList];
    const data = allStaff.filter(s => staffIds.includes(s._id));
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
      const qr = await QRCode.toDataURL(staff.qrCode || staff.employeeId, { 
        width: 200,
        margin: 1
      });
      
      // カード枠
      pdf.rect(x, y, cardWidth, cardHeight);
      
      // QRコード配置（中央）
      const qrSize = 35; // mm
      const qrX = x + (cardWidth - qrSize) / 2;
      const qrY = y + 5;
      pdf.addImage(qr, 'PNG', qrX, qrY, qrSize, qrSize);
      
      // 職員番号のみ表示（QRコードの下）
      pdf.setFontSize(8);
      pdf.text(staff.employeeId, x + cardWidth / 2, y + qrSize + 12, { align: 'center' });
    }
    
    pdf.save(data.length === 1 ? `${data[0].employeeId}_QRコード.pdf` : `QRコード_${data.length}名分.pdf`);
    toast.success("QRコードPDFを生成しました");
  };

  const handleTagsChange = (tags: string[]) => {
    setFormData({
      ...formData,
      tags,
    });
  };

  const handleSingleReactivate = async (staffId: Id<"staff">) => {
    try {
      await reactivateStaff({ staffIds: [staffId] });
      toast.success("スタッフを有効化しました");
    } catch (error) {
      toast.error("エラーが発生しました");
    }
  };

  const handleSubmitStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("氏名は必須です");
      return;
    }

    try {
      await createStaff({
        name: formData.name.trim(),
        tags: formData.tags.length > 0 ? formData.tags : undefined,
      });
      
      toast.success("スタッフを追加しました");
      setShowAddModal(false);
      setFormData({ name: "", tags: [] });
    } catch (error) {
      toast.error("エラーが発生しました");
    }
  };

  const closeModal = () => {
    setShowAddModal(false);
    setFormData({ name: "", tags: [] });
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingStaffId(null);
    setFormData({ name: "", tags: [] });
  };

  const openEditModal = (staff: any) => {
    setEditingStaffId(staff._id);
    setFormData({
      name: staff.name,
      tags: staff.tags || [],
    });
    setShowEditModal(true);
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !editingStaffId) {
      toast.error("氏名は必須です");
      return;
    }

    try {
      await updateStaff({
        staffId: editingStaffId,
        name: formData.name.trim(),
        tags: formData.tags.length > 0 ? formData.tags : undefined,
      });
      
      toast.success("スタッフ情報を更新しました");
      closeEditModal();
    } catch (error) {
      toast.error("エラーが発生しました");
    }
  };

  if (viewingStaffId) {
    return (
      <StaffDetail 
        staffId={viewingStaffId} 
        onBack={() => setViewingStaffId(null)}
        isPremium={isPremium}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">スタッフ一覧</h1>
        <div className="flex gap-2">
          {staffList.length === 0 && (
            <button
              onClick={handleCreateDummyData}
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
                  ✕
                </button>
              </div>
              
              <form onSubmit={handleSubmitStaff} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    氏名 <span className="text-red-500">*</span>
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
                  availableTags={allUsedTags || []}
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
                <h2 className="text-lg font-semibold text-gray-900">スタッフ情報編集</h2>
                <button
                  onClick={closeEditModal}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={handleUpdateStaff} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    氏名 <span className="text-red-500">*</span>
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
                  availableTags={allUsedTags || []}
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
                onClick={() => handleQRCode(selectedStaff)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                QRコード一括印刷
              </button>
              <button
                onClick={handleDeactivateSelected}
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
                onClick={handleReactivateSelected}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                一括有効化
              </button>
            </div>
          </div>
        </div>
      )}

      {/* スタッフリスト */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <input
              type="checkbox"
              checked={
                showInactiveList 
                  ? selectedInactiveStaff.length === inactiveStaffList.length && inactiveStaffList.length > 0
                  : selectedStaff.length === staffList.length && staffList.length > 0
              }
              onChange={(e) => showInactiveList ? handleSelectAllInactive(e.target.checked) : handleSelectAll(e.target.checked)}
              className="rounded border-gray-300"
            />
            <h2 className="text-lg font-semibold text-gray-900">
              {showInactiveList 
                ? `無効スタッフ一覧 (${inactiveStaffList.length}名)`
                : `有効スタッフ一覧 (${staffList.length}名)`
              }
            </h2>
          </div>
        </div>
        
        <div className="divide-y divide-gray-200">
          {showInactiveList ? (
            inactiveStaffList.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-gray-400 text-4xl">🗂️</span>
                <p className="text-gray-500 mt-4">無効化されたスタッフはいません</p>
              </div>
            ) : (
              inactiveStaffList.map((staff) => (
                <div key={staff._id} className="p-6 hover:bg-gray-50 transition-colors bg-gray-50">
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={selectedInactiveStaff.includes(staff._id)}
                      onChange={(e) => handleSelectInactiveStaff(staff._id, e.target.checked)}
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
                        <span className="text-sm text-gray-500">ID: {staff.employeeId}</span>
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
                        onClick={() => handleSingleReactivate(staff._id)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        有効化
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
                <p className="text-gray-500 mt-4">登録されているスタッフがありません</p>
                <p className="text-gray-400 text-sm mt-2">
                  「ダミーデータ作成」ボタンでサンプルデータを作成できます
                </p>
              </div>
            ) : (
              staffList.map((staff) => (
                <div key={staff._id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={selectedStaff.includes(staff._id)}
                      onChange={(e) => handleSelectStaff(staff._id, e.target.checked)}
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
                        <span className="text-sm text-gray-500">ID: {staff.employeeId}</span>
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
                        onClick={() => setViewingStaffId(staff._id)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        詳細
                      </button>
                      <button 
                        onClick={() => handleQRCode([staff._id])}
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
      </div>
    </div>
  );
}
