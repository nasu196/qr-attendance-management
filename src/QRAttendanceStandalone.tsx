import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
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
  
  const qrUrlData = useQuery(api.qrAttendanceUrl.getQRAttendanceUrlByUrlId, 
    urlId ? { urlId } : "skip"
  );
  const recordAttendance = useMutation(api.attendance.recordAttendanceByQR);

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
      
      const result = await recordAttendance({
        qrCode: decodedText,
        type: attendanceType!,
      });
      
      // 現在の日本時間を表示
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      
      setLastResult({
        staffName: result.staffName,
        type: attendanceType === "clock_in" ? "出勤" : "退勤",
        time: `${hours}:${minutes}`,
      });
      
      setIsScanning(false);
      addDebugInfo("✅ 打刻成功");
      
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
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      qrScannerRef.current.destroy();
    }
    setIsScanning(false);
    setAttendanceType(null);
    setLastResult(null);
    setIsProcessing(false);
    scanCooldownRef.current = false;
    addDebugInfo("スキャン終了");
  };

  const handleBackToMenu = () => {
    setLastResult(null);
    setAttendanceType(null);
    setIsScanning(false);
    setIsProcessing(false);
    scanCooldownRef.current = false;
    addDebugInfo("メニューに戻る");
  };

  // エラー表示
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="text-center max-w-md w-full">
          <div className="bg-white rounded-lg shadow-xl p-6">
            <span className="text-gray-400 text-6xl">❌</span>
            <h1 className="text-xl font-bold text-gray-900 mt-4">エラーが発生しました</h1>
            <p className="text-gray-600 mt-2 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // データ未取得時のローディング
  if (qrUrlData === undefined) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="text-center max-w-md w-full">
          <div className="bg-white rounded-lg shadow-xl p-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <h1 className="text-xl font-bold text-gray-900 mt-4">読み込み中...</h1>
          </div>
        </div>
      </div>
    );
  }

  // QRURLが見つからない場合
  if (!qrUrlData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="text-center max-w-md w-full">
          <div className="bg-white rounded-lg shadow-xl p-6">
            <span className="text-gray-400 text-6xl">🔍</span>
            <h1 className="text-xl font-bold text-gray-900 mt-4">ページが見つかりません</h1>
            <p className="text-gray-600 mt-2 text-sm">指定されたQR打刻URLは存在しません。</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (!qrUrlData.isActive) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="text-center max-w-md w-full">
          <div className="bg-white rounded-lg shadow-xl p-6">
            <span className="text-gray-400 text-6xl">⏰</span>
            <h1 className="text-xl font-bold text-gray-900 mt-4">
              このURLは無効になっています
            </h1>
            <p className="text-gray-600 mt-2 text-sm">管理者にお問い合わせください。</p>
          </div>
        </div>
      </div>
    );
  }

  // 成功画面
  if (lastResult) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center px-4">
        <Toaster position="top-center" />
        <div className="text-center max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-green-600 text-4xl">✅</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">打刻完了</h1>
            <div className="space-y-3 mb-6">
              <p className="text-xl font-semibold text-gray-900">{lastResult.staffName}さん</p>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-lg text-gray-700">{lastResult.type}打刻</p>
                <p className="text-sm text-gray-500">{lastResult.time}</p>
              </div>
            </div>
            <button
              onClick={handleBackToMenu}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg text-lg font-medium hover:bg-blue-700 transition-colors"
            >
              続けて打刻する
            </button>
            
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="mt-4 text-blue-600 text-sm underline"
            >
              デバッグ情報を{showDebug ? '隠す' : '表示'}
            </button>
            
            {showDebug && (
              <div className="mt-4 bg-gray-100 rounded p-3 text-left text-xs">
                {debugInfo.map((info, i) => (
                  <div key={i} className="text-gray-700">{info}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // QRコードスキャン画面
  if (isScanning && attendanceType) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <Toaster position="top-center" />
        
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 bg-gray-800 text-white safe-area-top">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-white hover:text-gray-300 text-lg"
            disabled={isProcessing}
          >
            ← 戻る
          </button>
          <h1 className="text-lg font-semibold">
            {attendanceType === "clock_in" ? "出勤" : "退勤"}打刻
          </h1>
          <div className="w-16"></div>
        </div>
        
        {/* スキャナー */}
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="text-center w-full max-w-sm">
            <div className="w-full aspect-square max-w-80 mx-auto border-4 border-white rounded-2xl overflow-hidden mb-6">
              <video 
                id="qr-video" 
                className="w-full h-full object-cover"
                playsInline
                muted
              ></video>
            </div>
            
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 mb-6">
              <p className="text-white text-lg font-medium mb-2">
                スタッフのQRコードを読み取ってください
              </p>
              <p className="text-gray-300 text-sm">
                QRコードをカメラの枠内に合わせてください
              </p>
            </div>

            {isProcessing && (
              <div className="bg-blue-600 text-white rounded-lg p-3 mb-4">
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>処理中...</span>
                </div>
              </div>
            )}
            
            {/* フォールバック: ファイル入力 */}
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && !isProcessing && !scanCooldownRef.current) {
                    void (async () => {
                      try {
                        const result = await QrScanner.scanImage(file);
                        void onScanSuccess(result);
                      } catch (err) {
                        toast.error("画像からQRコードを読み取れませんでした");
                      }
                    })();
                  }
                }}
                className="hidden"
                id="qr-file-input"
                disabled={isProcessing || scanCooldownRef.current}
              />
              <label
                htmlFor="qr-file-input"
                className={`inline-block text-white px-4 py-2 rounded-lg text-sm border border-white/30 ${
                  isProcessing || scanCooldownRef.current ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10 cursor-pointer'
                }`}
              >
                📷 画像から読み取り
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // メイン選択画面（スマホ最適化）
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <Toaster position="top-center" />
      <div className="text-center max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="mb-8">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-blue-600 text-4xl">📱</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">QR打刻システム</h1>
            <p className="text-gray-600">{qrUrlData.name}</p>
          </div>
          
          {/* カメラエラー警告 */}
          {cameraError && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-red-600">⚠️</span>
                <h3 className="text-red-800 font-medium">カメラアクセスエラー</h3>
              </div>
              <p className="text-red-700 text-sm mb-3">{cameraError}</p>
              <div className="text-xs text-red-600 space-y-1">
                <p>【対処法】</p>
                <p>• ブラウザの設定でカメラ権限を許可してください</p>
                <p>• HTTPSサイトまたはローカルホストでアクセスしてください</p>
                <p>• 他のアプリでカメラが使用中でないか確認してください</p>
              </div>
            </div>
          )}
          
          <div className="space-y-4 mb-8">
            <button
              onClick={() => handleTypeSelect("clock_in")}
              className="w-full bg-green-600 text-white py-4 px-6 rounded-xl text-lg font-semibold hover:bg-green-700 transition-colors shadow-lg"
            >
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl">🌅</span>
                <span>出勤打刻</span>
              </div>
            </button>
            
            <button
              onClick={() => handleTypeSelect("clock_out")}
              className="w-full bg-orange-600 text-white py-4 px-6 rounded-xl text-lg font-semibold hover:bg-orange-700 transition-colors shadow-lg"
            >
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl">🌙</span>
                <span>退勤打刻</span>
              </div>
            </button>
          </div>
          
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <p className="text-blue-800 text-sm font-medium mb-1">使用方法</p>
            <p className="text-blue-700 text-xs">
              打刻種別を選択後、カメラでスタッフのQRコードを読み取ってください
            </p>
          </div>

          <button
            onClick={() => setShowDebug(!showDebug)}
            className="text-blue-600 text-sm underline"
          >
            デバッグ情報を{showDebug ? '隠す' : '表示'}
          </button>
          
          {showDebug && (
            <div className="mt-4 bg-gray-100 rounded p-3 text-left text-xs max-h-64 overflow-y-auto">
              <div className="mb-2 font-medium text-gray-800">
                デバッグログ（コンソールにも出力されています）
              </div>
              {debugInfo.map((info, i) => (
                <div key={i} className="text-gray-700 mb-1 break-words">{info}</div>
              ))}
              {debugInfo.length === 0 && (
                <div className="text-gray-500">まだログがありません</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
