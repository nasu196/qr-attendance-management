interface HelpProps {
  isPremium: boolean;
}

export function Help({ isPremium }: HelpProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">ヘルプ</h1>
      
      <div className="grid gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">よくある質問</h2>
          
          <div className="space-y-4">
            <div className="border-b border-gray-200 pb-4">
              <h3 className="font-medium text-gray-900 mb-2">QRコードでの打刻方法は？</h3>
              <p className="text-gray-600 text-sm">
                スタッフは自身のQRコードを事務所に設置されたタブレットやスマートフォンにかざすだけで打刻できます。
                デバイスに直接触れる必要はありません。
              </p>
            </div>
            
            <div className="border-b border-gray-200 pb-4">
              <h3 className="font-medium text-gray-900 mb-2">勤怠エラーとは何ですか？</h3>
              <p className="text-gray-600 text-sm">
                設定された勤務時間から大幅に外れた打刻や、打刻漏れなどが勤怠エラーとして表示されます。
                管理者が確認・修正する必要があります。
              </p>
            </div>
            
            <div className="border-b border-gray-200 pb-4">
              <h3 className="font-medium text-gray-900 mb-2">有料プランの機能は？</h3>
              <p className="text-gray-600 text-sm">
                月次レポート、カレンダー表示、詳細な勤怠設定などの高度な機能をご利用いただけます。
                小規模事業所でも手軽に導入できるよう、基本機能は無料でご提供しています。
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">お問い合わせ</h2>
          <p className="text-gray-600 mb-4">
            ご不明な点がございましたら、お気軽にお問い合わせください。
          </p>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            サポートに連絡
          </button>
        </div>
      </div>
    </div>
  );
}
