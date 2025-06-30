import { useState, useRef, useEffect } from "react";
import { toast, Toaster } from "sonner";
import { useParams } from "react-router-dom";
import QrScanner from "qr-scanner";

export function QRAttendanceStandalone() {
  const { urlId } = useParams<{ urlId: string }>();
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const addDebugInfo = (info: string) => {
    console.log(`[QR Debug] ${info}`); // コンソールにも出力
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${info}`]);
  };

  const addErrorInfo = (error: string, details?: any) => {
    console.error(`[QR Error] ${error}`, details); // コンソールにエラー出力
    addDebugInfo(`❌ ERROR: ${error}`);
    if (details) {
      addDebugInfo(`Details: ${JSON.stringify(details, null, 2)}`);
    }
  };

  useEffect(() => {
    addDebugInfo(`URLパラメータ取得: ${urlId || 'なし'}`);
    addDebugInfo(`User Agent: ${navigator.userAgent}`);
    addDebugInfo(`画面サイズ: ${window.innerWidth}x${window.innerHeight}`);
    
    // ブラウザサポートチェック
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      addErrorInfo("このブラウザはカメラアクセスをサポートしていません");
      setCameraError("カメラアクセス非対応ブラウザ");
    } else {
      addDebugInfo("✅ カメラAPI対応ブラウザ");
    }
  }, [urlId]);
  
  // TODO: Supabaseクエリでデータを取得
  const qrUrlData = urlId ? { urlId, isActive: true, organizationName: "デモ組織" } : null;
  
  useEffect(() => {
    if (qrUrlData !== undefined) {
      addDebugInfo(`データ取得結果: ${qrUrlData ? 'データあり' : 'データなし'}`);
    }
  }, [qrUrlData]);

  // エラーハンドリング
  useEffect(() => {
    if (!urlId) {
      setError("URLパラメータが見つかりません");
      addDebugInfo("エラー: URLパラメータなし");
    }
  }, [urlId]);
  
  const [attendanceType, setAttendanceType] = useState<"clock_in" | "clock_out" | null>(null);
  const [lastResult, setLastResult] = useState<{ staffName: string; type: string; time: string } | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const qrScannerRef = useRef<QrScanner | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const scanCooldownRef = useRef<boolean>(false);

  // QRコードスキャナーの初期化
  useEffect(() => {
    if (isScanning && attendanceType) {
      void startScanner();
    }
    
    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.stop();
        qrScannerRef.current.destroy();
      }
    };
  }, [isScanning, attendanceType]);

  const startScanner = async () => {
    try {
      addDebugInfo("カメラ起動開始...");
      
      // カメラ権限チェック
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop()); // すぐに停止
        addDebugInfo("✅ カメラ権限取得成功");
      } catch (permissionError) {
        addErrorInfo("カメラ権限エラー", permissionError);
        setCameraError("カメラへのアクセス権限が必要です。ブラウザの設定を確認してください。");
        setIsScanning(false);
        return;
      }
      
      const videoElement = document.getElementById("qr-video") as HTMLVideoElement;
      if (!videoElement) {
        addErrorInfo("ビデオ要素が見つかりません");
        setIsScanning(false);
        return;
      }
      
      // OPPO端末対応のQRスキャナー設定
      const qrScanner = new QrScanner(
        videoElement,
        (result: QrScanner.ScanResult) => {
          void onScanSuccess(result.data);
        },
        {
          // OPPO端末での安定性を重視した設定
          preferredCamera: 'environment', // 背面カメラ優先
          maxScansPerSecond: 3, // スキャン頻度を下げて安定性向上
          highlightScanRegion: true, // スキャン領域をハイライト
          highlightCodeOutline: true, // QRコードの輪郭をハイライト
          returnDetailedScanResult: true,
        }
      );
      
      qrScannerRef.current = qrScanner;
      
      addDebugInfo("QRスキャナー開始...");
      await qrScanner.start();
      addDebugInfo("✅ カメラ起動成功");
      
    } catch (err: any) {
      addErrorInfo("カメラの起動に失敗しました", err);
      const errorMessage = err?.message || "不明なエラー";
      toast.error(`カメラの起動に失敗しました: ${errorMessage}`);
      setCameraError(`カメラエラー: ${errorMessage}`);
      setIsScanning(false);
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    // クールダウン中は処理をスキップ
    if (scanCooldownRef.current || isProcessing) {
      return;
    }
    
    // 同じQRコードの連続スキャンを防ぐ
    const now = Date.now();
    if (now - lastScanTimeRef.current < 2000) {
      return;
    }
    
    lastScanTimeRef.current = now;
    scanCooldownRef.current = true;
    setIsProcessing(true);
    addDebugInfo(`QRコード読み取り: ${decodedText}`);
    
    try {
      if (qrScannerRef.current) {
        qrScannerRef.current.stop();
      }
      
      // TODO: Supabaseでの打刻処理
      await new Promise(resolve => setTimeout(resolve, 1000)); // デモ用の遅延
      
      // 現在の日本時間を表示
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      
      setLastResult({
        staffName: "デモユーザー",
        type: attendanceType === "clock_in" ? "出勤" : "退勤",
        time: `${hours}:${minutes}`,
      });
      
      setIsScanning(false);
      addDebugInfo("✅ 打刻成功（デモ）");
      toast.success("打刻しました（デモ動作）");
      
    } catch (error: any) {
      addErrorInfo("打刻エラー", error);
      toast.error(error.message || "打刻に失敗しました");
      setIsScanning(false);
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        scanCooldownRef.current = false;
      }, 3000);
    }
  };

  const handleTypeSelect = (type: "clock_in" | "clock_out") => {
    setAttendanceType(type);
    setIsScanning(true);
    setLastResult(null);
    scanCooldownRef.current = false;
    lastScanTimeRef.current = 0;
    addDebugInfo(`打刻タイプ選択: ${type} - スキャン開始`);
  };

  const handleBack = () => {
    setIsScanning(false);
    setAttendanceType(null);
    setLastResult(null);
    addDebugInfo("メニューに戻る");
    
    // QRスキャナーを停止
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      qrScannerRef.current.destroy();
      qrScannerRef.current = null;
    }
  };

  const handleBackToMenu = () => {
    window.location.href = "/";
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md text-center">
          <span className="text-red-400 text-4xl">❌</span>
          <h2 className="text-xl font-bold text-gray-900 mt-4 mb-2">エラーが発生しました</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={handleBackToMenu}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            メニューに戻る
          </button>
        </div>
      </div>
    );
  }

  if (!qrUrlData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">データを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" />
      
      {/* 移行作業中の通知バナー */}
      <div className="bg-yellow-50 border-b border-yellow-200 p-3">
        <div className="flex items-center justify-center gap-2 text-yellow-800">
          <span className="text-lg">🚧</span>
          <p className="text-sm font-medium">
            移行作業中: QR出勤機能はSupabase移行後に完全実装されます（現在はデモ動作）
          </p>
        </div>
      </div>
      
      <div className="p-4">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-bold text-lg">Q</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">QR出勤システム</h1>
                <p className="text-sm text-gray-600">{qrUrlData.organizationName}</p>
              </div>
            </div>
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="text-gray-400 hover:text-gray-600 text-xs"
            >
              DEBUG
            </button>
          </div>
        </div>

        {/* メインコンテンツ */}
        {!attendanceType && !lastResult && (
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <span className="text-blue-500 text-5xl">📱</span>
            <h2 className="text-xl font-bold text-gray-900 mt-4 mb-2">出勤・退勤を選択してください</h2>
            <p className="text-gray-600 mb-8">QRコードをスキャンして打刻します</p>
            
            <div className="space-y-4">
              <button
                onClick={() => handleTypeSelect("clock_in")}
                className="w-full bg-green-600 text-white py-4 px-6 rounded-lg text-lg font-medium hover:bg-green-700 transition-colors"
              >
                🕐 出勤
              </button>
              <button
                onClick={() => handleTypeSelect("clock_out")}
                className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg text-lg font-medium hover:bg-blue-700 transition-colors"
              >
                🕕 退勤
              </button>
            </div>
          </div>
        )}

        {/* QRスキャナー */}
        {isScanning && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {attendanceType === "clock_in" ? "出勤" : "退勤"}のQRコードをスキャン
              </h2>
              <p className="text-gray-600">カメラでQRコードを読み取ってください</p>
            </div>

            {cameraError ? (
              <div className="text-center py-8">
                <span className="text-red-400 text-4xl">📷</span>
                <p className="text-red-600 mt-4 mb-6">{cameraError}</p>
                <button
                  onClick={handleBack}
                  className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  戻る
                </button>
              </div>
            ) : (
              <div className="relative">
                <video
                  id="qr-video"
                  className="w-full h-64 bg-black rounded-lg object-cover"
                  playsInline
                  muted
                ></video>
                
                {isProcessing && (
                  <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                    <div className="bg-white rounded-lg p-4 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <p className="text-gray-700">処理中...</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex justify-center">
              <button
                onClick={handleBack}
                className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
                disabled={isProcessing}
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* 結果表示 */}
        {lastResult && (
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <span className="text-green-500 text-5xl">✅</span>
            <h2 className="text-xl font-bold text-gray-900 mt-4 mb-2">打刻完了</h2>
            
            <div className="bg-gray-50 rounded-lg p-4 my-6">
              <p className="text-lg font-semibold text-gray-900">{lastResult.staffName}さん</p>
              <p className="text-gray-600">{lastResult.type}: {lastResult.time}</p>
            </div>
            
            <button
              onClick={handleBack}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              続けて打刻する
            </button>
          </div>
        )}

        {/* デバッグ情報 */}
        {showDebug && (
          <div className="mt-4 bg-gray-900 text-green-400 rounded-lg p-4 text-xs font-mono max-h-40 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-300 font-bold">DEBUG LOG</span>
              <button
                onClick={() => setDebugInfo([])}
                className="text-green-300 hover:text-green-100 text-xs"
              >
                CLEAR
              </button>
            </div>
            {debugInfo.map((info, index) => (
              <div key={index} className="mb-1">{info}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
