import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// QR打刻URL一覧を取得
export const getQRAttendanceUrls = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    return await ctx.db
      .query("qrAttendanceUrls")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .order("desc")
      .collect();
  },
});

// URLIDでQR打刻URLを取得（認証不要）
export const getQRAttendanceUrlByUrlId = query({
  args: {
    urlId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("qrAttendanceUrls")
      .withIndex("by_url_id", (q) => q.eq("urlId", args.urlId))
      .unique();
  },
});

// QR打刻URLを作成
export const createQRAttendanceUrl = mutation({
  args: {
    name: v.string(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    // ランダムなURLIDを生成
    const urlId = Math.random().toString(36).substring(2, 15) + 
                  Math.random().toString(36).substring(2, 15);

    return await ctx.db.insert("qrAttendanceUrls", {
      name: args.name,
      urlId,
      isActive: true,
      expiresAt: args.expiresAt,
      createdBy: userId,
    });
  },
});

// QR打刻URLを削除
export const deleteQRAttendanceUrl = mutation({
  args: {
    urlId: v.id("qrAttendanceUrls"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    const qrUrl = await ctx.db.get(args.urlId);
    if (!qrUrl || qrUrl.createdBy !== userId) {
      throw new Error("QR打刻URLが見つかりません");
    }

    await ctx.db.delete(args.urlId);
    return { success: true };
  },
});

// QR打刻URLを更新（新しいURLIDを生成）
export const updateQRAttendanceUrl = mutation({
  args: {
    qrUrlId: v.id("qrAttendanceUrls"),
    name: v.string(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    const qrUrl = await ctx.db.get(args.qrUrlId);
    if (!qrUrl || qrUrl.createdBy !== userId) {
      throw new Error("QR打刻URLが見つかりません");
    }

    // 新しいランダムなURLIDを生成
    const newUrlId = Math.random().toString(36).substring(2, 15) + 
                     Math.random().toString(36).substring(2, 15);

    await ctx.db.patch(args.qrUrlId, {
      name: args.name,
      urlId: newUrlId,
      expiresAt: args.expiresAt,
      isActive: true,
    });

    return { success: true, newUrlId };
  },
});

// QR打刻URLの有効/無効を切り替え
export const toggleQRAttendanceUrl = mutation({
  args: {
    urlId: v.id("qrAttendanceUrls"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    const qrUrl = await ctx.db.get(args.urlId);
    if (!qrUrl || qrUrl.createdBy !== userId) {
      throw new Error("QR打刻URLが見つかりません");
    }

    await ctx.db.patch(args.urlId, {
      isActive: !qrUrl.isActive,
    });

    return { success: true };
  },
});
