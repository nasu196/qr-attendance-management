"use client";
import { useState } from "react";
import { toast } from "sonner";

export function SignInForm() {
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    // TODO: Supabase認証の実装
    setTimeout(() => {
      toast.success("移行作業中: 認証機能はSupabase移行後に実装されます");
      setSubmitting(false);
    }, 1000);
  };

  return (
    <div className="w-full">
      {/* 移行作業中の通知 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 text-yellow-800">
          <span className="text-2xl">🚧</span>
          <div>
            <p className="font-medium">移行作業中</p>
            <p className="text-sm">認証機能はSupabase移行後に実装されます。現在はClerk認証を使用してください。</p>
          </div>
        </div>
      </div>

      <form
        className="flex flex-col gap-form-field"
        onSubmit={handleSubmit}
      >
        <input
          className="auth-input-field"
          type="email"
          name="email"
          placeholder="Email"
          required
          disabled
        />
        <input
          className="auth-input-field"
          type="password"
          name="password"
          placeholder="Password"
          required
          disabled
        />
        <button className="auth-button" type="submit" disabled>
          {flow === "signIn" ? "Sign in" : "Sign up"} (無効)
        </button>
        <div className="text-center text-sm text-secondary">
          <span>
            {flow === "signIn"
              ? "Don't have an account? "
              : "Already have an account? "}
          </span>
          <button
            type="button"
            className="text-primary hover:text-primary-hover hover:underline font-medium cursor-pointer"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
            disabled
          >
            {flow === "signIn" ? "Sign up instead" : "Sign in instead"} (無効)
          </button>
        </div>
      </form>
      <div className="flex items-center justify-center my-3">
        <hr className="my-4 grow border-gray-200" />
        <span className="mx-4 text-secondary">or</span>
        <hr className="my-4 grow border-gray-200" />
      </div>
      <button className="auth-button" disabled>
        Sign in anonymously (無効)
      </button>
      
      <div className="mt-4 text-center text-sm text-gray-500">
        <p>このフォームは移行作業中により無効化されています。</p>
        <p>Clerk認証ボタンをご利用ください。</p>
      </div>
    </div>
  );
}
