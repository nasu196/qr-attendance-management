import { ReactNode } from "react";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Clerk環境変数のチェック
  const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  

  
  if (!clerkPubKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">設定エラー</h1>
            <p className="text-gray-600 mb-4">
              Clerk認証が設定されていません。
            </p>
            <div className="bg-gray-100 rounded-md p-4 text-left">
              <p className="text-sm text-gray-700 mb-2">
                <strong>必要な環境変数:</strong>
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• VITE_CLERK_PUBLISHABLE_KEY または NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</li>
                <li>• CLERK_SECRET_KEY</li>
              </ul>
              <div className="mt-4 text-xs text-gray-500">
                <p><strong>現在の値:</strong></p>
                <p>VITE_: {import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "未設定"}</p>
                <p>NEXT_PUBLIC_: {import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "未設定"}</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              .env.localファイルまたは環境設定でこれらの値を設定してください。
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
} 