import { useState } from "react";
import { toast } from "sonner";

// 移行作業中のダミーコンポーネント
export function StaffDetail({ staffId, onBack }: { staffId: string; onBack: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">スタッフ詳細</h1>
        <button
          onClick={onBack}
          className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
        >
          戻る
        </button>
      </div>

      {/* 移行作業中の通知 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-yellow-800">
          <span className="text-2xl">🚧</span>
          <div>
            <p className="font-medium">移行作業中</p>
            <p className="text-sm">スタッフ詳細機能はSupabase移行後に完全実装されます。現在はデモ表示中です。</p>
          </div>
        </div>
      </div>

      {/* ダミーコンテンツ */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">👤</div>
          <h3 className="text-xl font-semibold mb-2">移行作業中</h3>
          <p>スタッフ詳細機能はSupabase移行後に実装されます</p>
          <div className="mt-6 text-sm text-gray-400">
            <p>実装予定機能:</p>
            <ul className="mt-2 space-y-1">
              <li>• スタッフ基本情報表示</li>
              <li>• 勤怠履歴表示</li>
              <li>• QRコード管理</li>
              <li>• 詳細設定</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
} 