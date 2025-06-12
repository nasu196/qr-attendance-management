import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// スタッフ一覧を取得
export const getStaffList = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    return await ctx.db
      .query("staff")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .order("desc")
      .collect();
  },
});

// 無効化されたスタッフ一覧を取得
export const getInactiveStaffList = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    return await ctx.db
      .query("staff")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .filter((q) => q.eq(q.field("isActive"), false))
      .order("desc")
      .collect();
  },
});

// 特定のスタッフを取得
export const getStaff = query({
  args: {
    staffId: v.id("staff"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    const staff = await ctx.db.get(args.staffId);
    if (!staff || staff.createdBy !== userId) {
      throw new Error("スタッフが見つかりません");
    }

    return staff;
  },
});

// 使用されているタグ一覧を取得
export const getAllUsedTags = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    const staffList = await ctx.db
      .query("staff")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .collect();

    const allTags = new Set<string>();
    staffList.forEach(staff => {
      if (staff.tags) {
        staff.tags.forEach(tag => allTags.add(tag));
      }
    });

    return Array.from(allTags).sort();
  },
});

// スタッフを作成
export const createStaff = mutation({
  args: {
    name: v.string(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    // 職員番号を生成（現在の時刻ベース）
    const employeeId = `EMP${Date.now().toString().slice(-8)}`;
    
    // QRコード用の一意な文字列を生成
    const qrCode = `${employeeId}_${Math.random().toString(36).substring(2, 15)}`;

    return await ctx.db.insert("staff", {
      name: args.name,
      employeeId,
      qrCode,
      tags: args.tags,
      isActive: true,
      createdBy: userId,
    });
  },
});

// スタッフ情報を更新
export const updateStaff = mutation({
  args: {
    staffId: v.id("staff"),
    name: v.string(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    const staff = await ctx.db.get(args.staffId);
    if (!staff || staff.createdBy !== userId) {
      throw new Error("スタッフが見つかりません");
    }

    await ctx.db.patch(args.staffId, {
      name: args.name,
      tags: args.tags,
    });

    return { success: true };
  },
});

// スタッフを無効化
export const deactivateStaff = mutation({
  args: {
    staffIds: v.array(v.id("staff")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    for (const staffId of args.staffIds) {
      const staff = await ctx.db.get(staffId);
      if (staff && staff.createdBy === userId) {
        await ctx.db.patch(staffId, { isActive: false });
      }
    }

    return { success: true };
  },
});

// スタッフを有効化
export const reactivateStaff = mutation({
  args: {
    staffIds: v.array(v.id("staff")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    for (const staffId of args.staffIds) {
      const staff = await ctx.db.get(staffId);
      if (staff && staff.createdBy === userId) {
        await ctx.db.patch(staffId, { isActive: true });
      }
    }

    return { success: true };
  },
});

// ダミーデータ作成
export const createDummyData = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    const dummyStaff = [
      { name: "田中 太郎", tags: ["特養", "介護職員", "3階"] },
      { name: "佐藤 花子", tags: ["デイサービス", "看護師"] },
      { name: "山田 次郎", tags: ["特養", "介護職員", "2階", "夜勤可"] },
      { name: "鈴木 美咲", tags: ["デイサービス", "介護職員"] },
      { name: "高橋 健一", tags: ["特養", "ケアマネージャー"] },
    ];

    for (const staff of dummyStaff) {
      const employeeId = `EMP${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100)}`;
      const qrCode = `${employeeId}_${Math.random().toString(36).substring(2, 15)}`;

      await ctx.db.insert("staff", {
        name: staff.name,
        employeeId,
        qrCode,
        tags: staff.tags,
        isActive: true,
        createdBy: userId,
      });
    }

    return { success: true };
  },
});
