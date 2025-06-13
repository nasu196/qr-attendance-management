import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { api } from "../convex/_generated/api";
import { useState } from "react";
import { AttendanceDashboard } from "./components/AttendanceDashboard";
import { StaffList } from "./components/StaffList";
import { MonthlyCalendar } from "./components/MonthlyCalendar";
import { MonthlyReport } from "./components/MonthlyReport";
import { WorkSettings } from "./components/WorkSettings";
import { QRAttendanceUrl } from "./components/QRAttendanceUrl";
import { Help } from "./components/Help";

type MenuItem = "dashboard" | "staff" | "qr-url" | "report" | "calendar" | "work-settings" | "help";

export default function App() {
  const [activeMenu, setActiveMenu] = useState<MenuItem>("dashboard");
  const [isPremium, setIsPremium] = useState(false);
  const user = useQuery(api.auth.loggedInUser);

  const menuItems = [
    { id: "dashboard" as MenuItem, label: "勤怠管理ボード", icon: "📊", premium: false },
    { id: "staff" as MenuItem, label: "スタッフ一覧", icon: "👥", premium: false },
    { id: "qr-url" as MenuItem, label: "QR打刻ページ", icon: "📱", premium: false },
    { id: "report" as MenuItem, label: "月次レポート表示", icon: "📈", premium: true },
    { id: "calendar" as MenuItem, label: "月次カレンダー表示", icon: "📅", premium: true },
    { id: "work-settings" as MenuItem, label: "勤務設定", icon: "⚙️", premium: true },
    { id: "help" as MenuItem, label: "ヘルプ", icon: "❓", premium: false },
  ];

  const renderContent = () => {
    switch (activeMenu) {
      case "dashboard":
        return <AttendanceDashboard isPremium={isPremium} />;
      case "staff":
        return <StaffList isPremium={isPremium} />;
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

  return (
    <main className="min-h-screen bg-gray-50">
      <Unauthenticated>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="max-w-md w-full mx-4">
            <div className="bg-white rounded-lg shadow-xl p-8">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">勤怠管理システム</h1>
                <p className="text-gray-600">スタッフの勤怠を効率的に管理</p>
              </div>
              <SignInForm />
            </div>
          </div>
        </div>
      </Unauthenticated>
      
      <Authenticated>
        <div className="flex h-screen">
          {/* サイドバー */}
          <div className="w-64 bg-white shadow-lg flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h1 className="text-xl font-bold text-gray-900">勤怠管理システム</h1>
              {user && (
                <p className="text-sm text-gray-600 mt-1">
                  {user.name || user.email}
                </p>
              )}
            </div>
            
            <nav className="flex-1 p-4">
              <ul className="space-y-2">
                {menuItems.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => setActiveMenu(item.id)}
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
              <SignOutButton />
            </div>
          </div>
          
          {/* メインコンテンツ */}
          <div className="flex-1 overflow-auto">
            <div className="p-8">
              {renderContent()}
            </div>
          </div>
        </div>
      </Authenticated>
    </main>
  );
}
