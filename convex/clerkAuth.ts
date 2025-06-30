import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

// Clerk ユーザーIDとConvex ユーザーIDのマッピングを管理するためのテーブル
export const getUserByClerkId = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();
    return user;
  },
});

export const createOrUpdateUserFromClerk = mutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();

    if (existingUser) {
      // 既存ユーザーの情報を更新
      await ctx.db.patch(existingUser._id, {
        email: args.email,
        name: args.name,
      });
      return existingUser._id;
    } else {
      // 新しいユーザーを作成
      const userId = await ctx.db.insert("users", {
        clerkUserId: args.clerkUserId,
        email: args.email,
        name: args.name || args.email,
      });
      return userId;
    }
  },
});

// Clerk認証済みユーザー情報を取得するためのヘルパー
export const getClerkUser = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();
    return user;
  },
});

// Clerk認証用のヘルパー関数
export async function getClerkUserId(ctx: any, clerkUserId: string): Promise<Id<"users">> {
  if (!clerkUserId) {
    throw new Error("Clerk User ID が必要です");
  }

  // Clerk User IDからConvex User IDを取得
  const user = await ctx.db
    .query("users")
    .withIndex("clerkUserId", (q: any) => q.eq("clerkUserId", clerkUserId))
    .unique();

  if (!user) {
    // 新規Clerkユーザーは独立したデータセットでスタート
    const newUserId = await ctx.db.insert("users", {
      clerkUserId: clerkUserId,
      name: "新規ユーザー",
      email: "clerk-user@example.com", // デフォルトメール（後で更新される想定）
    });
    return newUserId;
  }

  return user._id;
}

// 統合された認証チェック関数（Clerk優先）
export async function getCurrentUserId(ctx: any, clerkUserId?: string): Promise<Id<"users">> {
  if (clerkUserId) {
    // Clerk認証モードの場合
    return await getClerkUserId(ctx, clerkUserId);
  } else {
    // Convex認証モード（後方互換性のため）
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }
    return userId;
  }
} 