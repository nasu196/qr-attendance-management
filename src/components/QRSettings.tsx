interface QRSettingsProps {
  isPremium: boolean;
}

export function QRSettings({ isPremium }: QRSettingsProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">QR設定</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
          <span className="text-gray-400 text-4xl">🔧</span>
          <p className="text-gray-500 mt-4">QR設定機能は「QR打刻ページ」に統合されました</p>
          <p className="text-gray-400 text-sm mt-2">
            左側のメニューから「QR打刻ページ」をご利用ください
          </p>
        </div>
      </div>

      {/* 使用方法の説明 */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">QRコード打刻の使用方法</h3>
        <div className="space-y-3 text-sm text-blue-800">
          <div className="flex items-start gap-2">
            <span className="bg-blue-200 text-blue-900 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">1</span>
            <p>「QR打刻ページ」でQR打刻URLを作成します</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="bg-blue-200 text-blue-900 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">2</span>
            <p>作成されたURLにアクセスすると、出勤・退勤選択画面が表示されます</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="bg-blue-200 text-blue-900 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">3</span>
            <p>打刻種別を選択後、カメラでスタッフのQRコードを読み取ります</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="bg-blue-200 text-blue-900 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">4</span>
            <p>打刻完了後、自動的に選択画面に戻り、連続打刻が可能です</p>
          </div>
        </div>
      </div>
    </div>
  );
}
