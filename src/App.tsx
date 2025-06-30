import { useUser, SignedIn, SignedOut } from "@clerk/clerk-react";
import { ClerkSignIn } from "./components/ClerkSignIn";
import { ClerkUserButton } from "./components/ClerkUserButton";
import { useState } from "react";
import { AttendanceDashboard } from "./components/AttendanceDashboard";
import { StaffList } from "./components/StaffList";
import { StaffDetail } from "./components/StaffDetail";
import { MonthlyCalendar } from "./components/MonthlyCalendar";
import { MonthlyReport } from "./components/MonthlyReport";
import { WorkSettings } from "./components/WorkSettings";
import { QRAttendanceUrl } from "./components/QRAttendanceUrl";
import Help from "./components/Help";
import { AIChat } from "./components/AIChat";

type MenuItem = "dashboard" | "staff" | "qr-url" | "report" | "calendar" | "work-settings" | "help" | "staff-detail";

export default function App() {
  const [activeMenu, setActiveMenu] = useState<MenuItem>("dashboard");
  const [isPremium, setIsPremium] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  
  // スタッフ詳細表示用のstate
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  
  // Clerk認証
  const { user: clerkUser } = useUser();

  const menuItems = [
    { id: "dashboard" as MenuItem, label: "勤怠管理ボード", icon: "📊", premium: false },
    { id: "staff" as MenuItem, label: "スタッフ一覧", icon: "👥", premium: false },
    { id: "qr-url" as MenuItem, label: "QR打刻ページ", icon: "📱", premium: false },
    { id: "report" as MenuItem, label: "月次レポート表示", icon: "📈", premium: true },
    { id: "calendar" as MenuItem, label: "月次カレンダー表示", icon: "📅", premium: true },
    { id: "work-settings" as MenuItem, label: "勤務設定", icon: "⚙️", premium: true },
    { id: "help" as MenuItem, label: "ヘルプ", icon: "❓", premium: false },
  ];

  const handleMenuClick = (menuId: MenuItem) => {
    setActiveMenu(menuId);
    setIsMobileMenuOpen(false); // モバイルメニューを閉じる
    
    // スタッフ詳細以外のページに遷移する場合、選択されたスタッフをクリア
    if (menuId !== "staff-detail") {
      setSelectedStaffId(null);
    }
  };

  // スタッフ詳細ページに遷移する関数
  const showStaffDetail = (staffId: string) => {
    setSelectedStaffId(staffId);
    setActiveMenu("staff-detail");
    setIsMobileMenuOpen(false);
  };

  // スタッフ詳細ページから戻る関数
  const backFromStaffDetail = () => {
    setSelectedStaffId(null);
    setActiveMenu("staff");
  };

  const renderContent = () => {
    switch (activeMenu) {
      case "dashboard":
        return <AttendanceDashboard isPremium={isPremium} />;
      case "staff":
        return <StaffList isPremium={isPremium} onShowStaffDetail={showStaffDetail} />;
      case "staff-detail":
        return selectedStaffId ? (
          <StaffDetail 
            staffId={selectedStaffId} 
            onBack={backFromStaffDetail}
            isPremium={isPremium}
          />
        ) : (
          <div className="text-center py-12">
            <span className="text-gray-400 text-4xl">❌</span>
            <p className="text-gray-500 mt-4">スタッフが選択されていません</p>
            <button
              onClick={() => setActiveMenu("staff")}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              スタッフ一覧に戻る
            </button>
          </div>
        );
      case "qr-url":
        return <QRAttendanceUrl isPremium={isPremium} />;
      case "work-settings":
        return <WorkSettings isPremium={isPremium} />;
      case "report":
        return <MonthlyReport isPremium={isPremium} />;
      case "calendar":
        return <MonthlyCalendar isPremium={isPremium} />;
      case "help":
        return <Help isPremium={isPremium} />;
      default:
        return <AttendanceDashboard isPremium={isPremium} />;
    }
  };

  const currentMenuItem = menuItems.find(item => item.id === activeMenu) || 
    (activeMenu === "staff-detail" ? { id: "staff-detail" as MenuItem, label: "スタッフ詳細", icon: "👤", premium: false } : null);

  // 現在のユーザー情報を取得（Clerk認証のみ）
  const currentUser = clerkUser ? { name: clerkUser.fullName || clerkUser.firstName, email: clerkUser.emailAddresses[0]?.emailAddress } : null;

  return (
    <main className="min-h-screen bg-gray-50">
      <SignedOut>
        <ClerkSignIn />
      </SignedOut>
      
      <SignedIn>
        <div className="flex h-screen">
          {/* デスクトップ用サイドバー */}
          <div className="hidden md:flex w-64 bg-white shadow-lg flex-col">
            <div className="p-6 border-b border-gray-200">
              <h1 className="text-xl font-bold text-gray-900">勤怠管理システム</h1>
              {currentUser && (
                <p className="text-sm text-gray-600 mt-1">
                  {currentUser.name || currentUser.email}
                </p>
              )}
            </div>
            
            <nav className="flex-1 p-4">
              <ul className="space-y-2">
                {menuItems.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => handleMenuClick(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                        activeMenu === item.id
                          ? "bg-blue-100 text-blue-700 font-medium"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span className="flex-1">{item.label}</span>
                      {item.premium && !isPremium && (
                        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full">
                          Pro
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            
            <div className="p-4 border-t border-gray-200">
              {/* 開発用プレミアムスイッチ */}
              <div className="mb-4">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={isPremium}
                    onChange={(e) => setIsPremium(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  開発用: 有料プラン
                </label>
              </div>
              <div className="flex items-center justify-center">
                <ClerkUserButton />
              </div>
            </div>
          </div>

          {/* モバイル用オーバーレイメニュー */}
          {isMobileMenuOpen && (
            <div className="md:hidden fixed inset-0 z-50 flex">
              {/* オーバーレイ背景 */}
              <div 
                className="flex-1 bg-black bg-opacity-50"
                onClick={() => setIsMobileMenuOpen(false)}
              ></div>
              
              {/* メニューパネル */}
              <div className="w-64 bg-white shadow-lg flex flex-col">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <h1 className="text-xl font-bold text-gray-900">勤怠管理システム</h1>
                      {currentUser && (
                        <p className="text-sm text-gray-600 mt-1">
                          {currentUser.name || currentUser.email}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="text-gray-400 hover:text-gray-600 text-2xl"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                
                <nav className="flex-1 p-4">
                  <ul className="space-y-2">
                    {menuItems.map((item) => (
                      <li key={item.id}>
                        <button
                          onClick={() => handleMenuClick(item.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                            activeMenu === item.id
                              ? "bg-blue-100 text-blue-700 font-medium"
                              : "text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          <span className="text-lg">{item.icon}</span>
                          <span className="flex-1">{item.label}</span>
                          {item.premium && !isPremium && (
                            <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full">
                              Pro
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </nav>
                
                <div className="p-4 border-t border-gray-200">
                  {/* 開発用プレミアムスイッチ */}
                  <div className="mb-4">
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={isPremium}
                        onChange={(e) => setIsPremium(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      開発用: 有料プラン
                    </label>
                  </div>
                  <div className="flex items-center justify-center">
                    <ClerkUserButton />
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* メインコンテンツエリア全体 */}
          <div className="flex-1 flex overflow-hidden">
            {/* 左側: メインコンテンツ */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* モバイル用ヘッダー */}
              <div className="md:hidden bg-white shadow-sm border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{currentMenuItem?.icon}</span>
                  <h1 className="text-lg font-semibold text-gray-900">{currentMenuItem?.label}</h1>
                  {currentMenuItem?.premium && !isPremium && (
                    <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full">
                      Pro
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* AI チャットスイッチ（モバイル） */}
                  <button
                    onClick={() => setIsAiChatOpen(!isAiChatOpen)}
                    className={`p-2 rounded-lg transition-colors ${
                      isAiChatOpen 
                        ? "bg-purple-100 text-purple-600" 
                        : "text-gray-600 hover:text-gray-800 hover:bg-gray-100"
                    }`}
                    title="AIアシスタント"
                  >
                    🤖
                  </button>
                  <ClerkUserButton />
                  <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="text-gray-600 hover:text-gray-800 p-2"
                  >
                    <div className="space-y-1">
                      <div className="w-5 h-0.5 bg-current"></div>
                      <div className="w-5 h-0.5 bg-current"></div>
                      <div className="w-5 h-0.5 bg-current"></div>
                    </div>
                  </button>
                </div>
              </div>

              {/* デスクトップ用右上コントロール */}
              <div className="hidden md:flex absolute top-4 right-4 z-10 items-center gap-3">
                <ClerkUserButton />
                <button
                  onClick={() => setIsAiChatOpen(!isAiChatOpen)}
                  className={`p-3 rounded-lg shadow-lg transition-colors ${
                    isAiChatOpen 
                      ? "bg-purple-100 text-purple-600 shadow-purple-200" 
                      : "bg-white text-gray-600 hover:text-gray-800 hover:bg-gray-50 shadow-gray-200"
                  }`}
                  title="AIアシスタント"
                >
                  <span className="text-xl">🤖</span>
                </button>
              </div>

              {/* メインコンテンツ */}
              <div className="flex-1 overflow-auto">
                <div className="p-4 md:p-8">
                  {renderContent()}
                </div>
              </div>
            </div>

            {/* 右側: AIチャットカラム */}
            {isAiChatOpen && (
              <div className={`
                ${isAiChatOpen ? 'w-96' : 'w-0'}
                transition-all duration-300 ease-in-out
                md:relative absolute md:top-0 top-0 right-0 bottom-0 z-50
                md:z-auto
              `}>
                <AIChat isPremium={isPremium} />
              </div>
            )}
          </div>
        </div>
      </SignedIn>
    </main>
  );
}
