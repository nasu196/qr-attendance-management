import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// 勤務設定一覧を取得
export const getWorkSettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    const settings = await ctx.db
      .query("workSettings")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .collect();

    return settings;
  },
});

// 初期設定を作成
export const createInitialSettings = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    // 既存の設定があるかチェック
    const existingSettings = await ctx.db
      .query("workSettings")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .collect();

    if (existingSettings.length > 0) {
      return { success: true, message: "設定は既に存在します" };
    }

    // デフォルト設定を作成
    await ctx.db.insert("workSettings", {
      name: "日勤（8時間）",
      workHours: 8,
      breakHours: 1,
      isDefault: true,
      createdBy: userId,
    });

    await ctx.db.insert("workSettings", {
      name: "夜勤（16時間）",
      workHours: 16,
      breakHours: 2,
      createdBy: userId,
    });

    await ctx.db.insert("workSettings", {
      name: "パート（4時間）",
      workHours: 4,
      breakHours: 0,
      createdBy: userId,
    });

    return { success: true, message: "初期設定を作成しました" };
  },
});

// 勤務設定を作成
export const createWorkSetting = mutation({
  args: {
    name: v.string(),
    workHours: v.number(),
    breakHours: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    // バリデーション
    if (args.workHours <= 0 || args.workHours > 24) {
      throw new Error("労働時間は1時間以上24時間以下で入力してください");
    }

    if (args.breakHours < 0 || args.breakHours > 8) {
      throw new Error("休憩時間は0時間以上8時間以下で入力してください");
    }

    if (args.workHours + args.breakHours > 24) {
      throw new Error("労働時間と休憩時間の合計は24時間以下にしてください");
    }

    // 同名の設定がないかチェック
    const existing = await ctx.db
      .query("workSettings")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .filter((q) => q.eq(q.field("name"), args.name))
      .unique();

    if (existing) {
      throw new Error("同じ名前の勤務設定が既に存在します");
    }

    const settingId = await ctx.db.insert("workSettings", {
      name: args.name,
      workHours: args.workHours,
      breakHours: args.breakHours,
      createdBy: userId,
    });

    return { success: true, settingId };
  },
});

// 勤務設定を更新
export const updateWorkSetting = mutation({
  args: {
    settingId: v.id("workSettings"),
    name: v.string(),
    workHours: v.number(),
    breakHours: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    const setting = await ctx.db.get(args.settingId);
    if (!setting || setting.createdBy !== userId) {
      throw new Error("勤務設定が見つかりません");
    }

    // バリデーション
    if (args.workHours <= 0 || args.workHours > 24) {
      throw new Error("労働時間は1時間以上24時間以下で入力してください");
    }

    if (args.breakHours < 0 || args.breakHours > 8) {
      throw new Error("休憩時間は0時間以上8時間以下で入力してください");
    }

    if (args.workHours + args.breakHours > 24) {
      throw new Error("労働時間と休憩時間の合計は24時間以下にしてください");
    }

    // 同名の設定がないかチェック（自分以外）
    const existing = await ctx.db
      .query("workSettings")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .filter((q) => q.eq(q.field("name"), args.name))
      .unique();

    if (existing && existing._id !== args.settingId) {
      throw new Error("同じ名前の勤務設定が既に存在します");
    }

    await ctx.db.patch(args.settingId, {
      name: args.name,
      workHours: args.workHours,
      breakHours: args.breakHours,
    });

    return { success: true };
  },
});

// 勤務設定を削除
export const deleteWorkSetting = mutation({
  args: {
    settingId: v.id("workSettings"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    const setting = await ctx.db.get(args.settingId);
    if (!setting || setting.createdBy !== userId) {
      throw new Error("勤務設定が見つかりません");
    }

    // デフォルト設定は削除不可
    if (setting.isDefault) {
      throw new Error("デフォルト設定は削除できません");
    }

    await ctx.db.delete(args.settingId);
    return { success: true };
  },
});

// デフォルト設定を設定
export const setDefaultWorkSetting = mutation({
  args: {
    settingId: v.id("workSettings"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    const setting = await ctx.db.get(args.settingId);
    if (!setting || setting.createdBy !== userId) {
      throw new Error("勤務設定が見つかりません");
    }

    // 既存のデフォルト設定を解除
    const allSettings = await ctx.db
      .query("workSettings")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .collect();

    for (const s of allSettings) {
      if (s.isDefault) {
        await ctx.db.patch(s._id, { isDefault: undefined });
      }
    }

    // 新しいデフォルト設定を設定
    await ctx.db.patch(args.settingId, { isDefault: true });

    return { success: true };
  },
});

// 最適な勤務設定を自動判定
export const detectBestWorkSetting = query({
  args: {
    workMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    const settings = await ctx.db
      .query("workSettings")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .collect();

    if (settings.length === 0) {
      return null;
    }

    let bestSetting = settings[0];
    let minDiff = Infinity;

    for (const setting of settings) {
      // 総労働時間（勤務時間+休憩時間）で比較
      const settingTotalMinutes = (setting.workHours + setting.breakHours) * 60;
      const diff = Math.abs(args.workMinutes - settingTotalMinutes);

      if (diff < minDiff) {
        minDiff = diff;
        bestSetting = setting;
      }
    }

    return bestSetting;
  },
});
