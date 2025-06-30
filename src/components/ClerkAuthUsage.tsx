// Clerk認証を使ったConvex関数の呼び出し例
import { useUser } from "@clerk/clerk-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function ClerkAuthUsage() {
  const { user } = useUser();
  
  // Clerk認証を使ったクエリの例
  const clerkUser = useQuery(
    api.clerkAuth.getClerkUser,
    user ? { clerkUserId: user.id } : "skip"
  );
  
  // Clerk認証を使ったミューテーションの例
  const createOrUpdateUser = useMutation(api.clerkAuth.createOrUpdateUserFromClerk);
  
  // Clerk認証が必要な他のConvex関数では、以下のパターンを使用：
  // 1. フロントエンドでClerk User IDを取得
  // 2. そのIDをConvex関数に渡す
  // 3. Convex関数内でClerk User IDからConvex User IDを取得
  
  return null; // 実際のUIコンポーネントではありません
}

/*
Convex関数での使用例:

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const myFunction = mutation({
  args: { 
    clerkUserId: v.string(),
    // その他の引数...
  },
  handler: async (ctx, args) => {
    // Clerk User IDからConvex User IDを取得
    const user = await ctx.db
      .query("users")
      .withIndex("clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();
    
    if (!user) {
      throw new Error("ユーザーが見つかりません");
    }
    
    // user._idを使って通常の処理を実行
    // ...
  },
});
*/ 