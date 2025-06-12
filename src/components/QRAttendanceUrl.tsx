import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";

interface QRAttendanceUrlProps {
  isPremium: boolean;
}

export function QRAttendanceUrl({ isPremium }: QRAttendanceUrlProps) {
  const qrUrls = useQuery(api.qrAttendanceUrl.getQRAttendanceUrls);
  const createQRUrl = useMutation(api.qrAttendanceUrl.createQRAttendanceUrl);
  const updateQRUrl = useMutation(api.qrAttendanceUrl.updateQRAttendanceUrl);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // デフォルトのQR打刻URLを自動作成
  useEffect(() => {
    const initializeDefaultUrl = async () => {
      if (qrUrls && qrUrls.length === 0) {
        try {
          await createQRUrl({
            name: "メイン打刻ページ",
            expiresAt: undefined, // 無期限
          });
        } catch (error) {
          console.error("デフォルトURL作成エラー:", error);
        }
      }
    };

    initializeDefaultUrl();
  }, [qrUrls, createQRUrl]);

  // QRコード生成
  useEffect(() => {
    const generateQRCode = async () => {
      if (qrUrls && qrUrls.length > 0) {
        const mainUrl = qrUrls[0];
        const fullUrl = `${window.location.origin}/qr/${mainUrl.urlId}`;
        try {
          const qrDataUrl = await QRCode.toDataURL(fullUrl, {
            width: 256,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          setQrCodeDataUrl(qrDataUrl);
        } catch (error) {
          console.error("QRコード生成エラー:", error);
        }
      }
    };

    generateQRCode();
  }, [qrUrls]);

  if (!qrUrls) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const mainUrl = qrUrls[0];
  const fullUrl = mainUrl ? `${window.location.origin}/qr/${mainUrl.urlId}` : "";

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("URLをクリップボードにコピーしました");
    } catch (error) {
      toast.error("コピーに失敗しました");
    }
  };

  const handleUpdateUrl = async () => {
    if (!mainUrl) return;
    
    setIsUpdating(true);
    try {
      await updateQRUrl({
        qrUrlId: mainUrl._id,
        name: mainUrl.name,
        expiresAt: undefined,
      });
      toast.success("QR打刻URLを更新しました");
      setShowUpdateModal(false);
    } catch (error) {
      toast.error("URL更新に失敗しました");
    } finally {
      setIsUpdating(false);
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeDataUrl) return;
    
    const link = document.createElement('a');
    link.download = 'qr-attendance.png';
    link.href = qrCodeDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("QRコードをダウンロードしました");
  };

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">QR打刻ページ</h1>
        <p className="text-gray-600">スタッフがQRコードで打刻するためのページです</p>
      </div>

      {/* メインQR打刻URL */}
      {mainUrl && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{mainUrl.name}</h2>
              <p className="text-sm text-gray-500 mt-1">
                作成日: {new Date(mainUrl._creationTime).toLocaleDateString("ja-JP")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                有効
              </span>
              <button
                onClick={() => setShowUpdateModal(true)}
                className="text-orange-600 hover:text-orange-800 text-sm font-medium"
              >
                URL更新
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* QRコード表示 */}
            <div className="text-center">
              <div className="bg-gray-50 rounded-lg p-6 inline-block">
                {qrCodeDataUrl ? (
                  <img 
                    src={qrCodeDataUrl} 
                    alt="QR打刻用QRコード" 
                    className="w-64 h-64 mx-auto"
                  />
                ) : (
                  <div className="w-64 h-64 bg-gray-200 rounded-lg flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                )}
              </div>
              <button
                onClick={downloadQRCode}
                disabled={!qrCodeDataUrl}
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                QRコードをダウンロード
              </button>
            </div>

            {/* URL情報 */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  QR打刻URL
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={fullUrl}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(fullUrl)}
                    className="bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm"
                  >
                    コピー
                  </button>
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>URL ID: {mainUrl.urlId}</p>
                  <p>作成者: {mainUrl.createdBy}</p>
                  <p>アクティブ: {mainUrl.isActive ? "はい" : "いいえ"}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URLアクセス方法
                </label>
                <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
                  <p className="font-medium mb-2">📱 スマートフォン・タブレットでの利用</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>上記URLにアクセス</li>
                    <li>出勤・退勤を選択</li>
                    <li>カメラでスタッフのQRコードを読み取り</li>
                    <li>打刻完了</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* URL更新確認モーダル */}
      {showUpdateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-orange-500 text-2xl">⚠️</span>
                <h2 className="text-lg font-semibold text-gray-900">URL更新の確認</h2>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-700 mb-3">
                  QR打刻URLを更新しますか？
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>注意:</strong> URLを更新すると、現在のQRコードは使用できなくなります。
                    新しいQRコードを印刷・配布する必要があります。
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleUpdateUrl}
                  disabled={isUpdating}
                  className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {isUpdating ? "更新中..." : "URLを更新する"}
                </button>
                <button
                  onClick={() => setShowUpdateModal(false)}
                  disabled={isUpdating}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
