import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// スタッフの月次勤怠データを取得（リファクタリング版）
// JST変換の責務をフロントエンドに移譲し、バックエンドはUTCに専念する
export const getStaffMonthlyAttendance = query({
  args: {
    staffId: v.id("staff"),
    startOfMonth: v.number(), // UTCタイムスタンプ
    endOfMonth: v.number(),   // UTCタイムスタンプ
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

    // 指定されたUTC期間内の勤怠データを取得
    const attendanceRecords = await ctx.db
      .query("attendance")
      .withIndex("by_staff_and_timestamp", (q) => 
        q.eq("staffId", args.staffId)
         .gte("timestamp", args.startOfMonth)
         .lte("timestamp", args.endOfMonth)
      )
      .order("asc") // タイムスタンプ順にソート
      .collect();

    // 日付ごとのグループ化や集計はフロントエンドで行う
    return attendanceRecords;
  },
});

// 月次適用設定を取得（リファクタリング版）
export const getStaffMonthlyAppliedSettings = query({
  args: {
    staffId: v.id("staff"),
    year: v.number(),
    month: v.number(),
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

    // 月の開始日と終了日をUTCで計算 (dateは 'YYYY-MM-DD' 形式)
    const startDate = `${args.year}-${String(args.month).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(args.year, args.month, 0)).getUTCDate();
    const endDate = `${args.year}-${String(args.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    // 期間内の適用設定を取得
    const appliedSettings = await ctx.db
      .query("appliedWorkSettings")
      .withIndex("by_staff_and_date", (q) => q.eq("staffId", args.staffId))
      .filter((q) => q.gte(q.field("date"), startDate))
      .filter((q) => q.lte(q.field("date"), endDate))
      .collect();

    // 勤務設定の詳細を取得
    const settingsMap: Record<string, any> = {};
    for (const applied of appliedSettings) {
      const workSetting = await ctx.db.get(applied.workSettingId);
      settingsMap[applied.date] = {
        ...applied,
        workSetting,
      };
    }

    return settingsMap;
  },
});

// 適用設定を手動設定
export const setAppliedWorkSetting = mutation({
  args: {
    staffId: v.id("staff"),
    date: v.string(),
    workSettingId: v.union(v.id("workSettings"), v.null()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    // 既存設定を削除
    const existing = await ctx.db
      .query("appliedWorkSettings")
      .withIndex("by_staff_and_date", (q) => q.eq("staffId", args.staffId).eq("date", args.date))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    // 新しい設定を保存（nullの場合は削除のみ）
    if (args.workSettingId) {
      await ctx.db.insert("appliedWorkSettings", {
        staffId: args.staffId,
        date: args.date,
        workSettingId: args.workSettingId,
        isAutoAssigned: false,
        createdBy: userId,
      });
    }

    return { success: true };
  },
});

// 勤務設定を自動割り当て
export const autoAssignWorkSetting = mutation({
  args: {
    staffId: v.id("staff"),
    date: v.string(),
    workMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    // 既に設定がある場合は何もしない
    const existing = await ctx.db
      .query("appliedWorkSettings")
      .withIndex("by_staff_and_date", (q) => q.eq("staffId", args.staffId).eq("date", args.date))
      .unique();

    if (existing) {
      return { success: true, message: "既に設定があります" };
    }

    // 最適な勤務設定を検索
    const workSettings = await ctx.db
      .query("workSettings")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .collect();

    if (workSettings.length === 0) {
      return { success: false, message: "勤務設定がありません" };
    }

    let bestSetting = workSettings[0];
    let minDiff = Infinity;

    for (const setting of workSettings) {
      // 総労働時間（勤務時間+休憩時間）で比較
      const settingTotalMinutes = (setting.workHours + setting.breakHours) * 60;
      const diff = Math.abs(args.workMinutes - settingTotalMinutes);

      if (diff < minDiff) {
        minDiff = diff;
        bestSetting = setting;
      }
    }

    // 自動割り当て設定を保存
    await ctx.db.insert("appliedWorkSettings", {
      staffId: args.staffId,
      date: args.date,
      workSettingId: bestSetting._id,
      isAutoAssigned: true,
      createdBy: userId,
    });

    return { success: true, setting: bestSetting };
  },
});
