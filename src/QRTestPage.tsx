import { useState } from "react";
import { useParams } from "react-router-dom";

export function QRTestPage() {
  const { urlId } = useParams<{ urlId: string }>();
  const [testResult, setTestResult] = useState<string>("");

  const handleTestScan = () => {
    // テスト用のダミーQRコード処理
    const testQRCode = "TEST_STAFF_001";
    setTestResult(`QRコード読み取り成功: ${testQRCode}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="text-center max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">QRテストページ</h1>
          <p className="text-gray-600 mb-6">URL ID: {urlId}</p>
          
          <div className="space-y-4">
            <button
              onClick={handleTestScan}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg text-lg font-medium hover:bg-blue-700 transition-colors"
            >
              テスト実行
            </button>
            
            {testResult && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800">{testResult}</p>
              </div>
            )}
          </div>
          
          <div className="mt-6 text-sm text-gray-500">
            <p>現在時刻: {new Date().toLocaleString('ja-JP')}</p>
            <p>ページ読み込み: 成功</p>
          </div>
        </div>
      </div>
    </div>
  );
}
