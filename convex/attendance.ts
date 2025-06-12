import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// 今日の勤怠一覧を取得
export const getTodayAttendance = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    // 今日の範囲を計算（JST基準）
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfDay = today.getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

    const attendanceRecords = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => 
        q.gte("timestamp", startOfDay).lte("timestamp", endOfDay)
      )
      .collect();

    // スタッフ一覧を取得
    const staffList = await ctx.db
      .query("staff")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // スタッフごとに勤怠をまとめる
    const staffAttendanceMap = new Map();
    
    for (const record of attendanceRecords) {
      const staff = staffList.find(s => s._id === record.staffId);
      if (!staff) continue;

      if (!staffAttendanceMap.has(record.staffId)) {
        staffAttendanceMap.set(record.staffId, {
          staff,
          clockIn: null,
          clockOut: null,
          status: "absent",
        });
      }

      const staffData = staffAttendanceMap.get(record.staffId);
      if (record.type === "clock_in") {
        staffData.clockIn = record;
        staffData.status = "present";
      } else {
        staffData.clockOut = record;
        if (staffData.clockIn) {
          staffData.status = "completed";
        }
      }
    }

    return Array.from(staffAttendanceMap.values());
  },
});

// 勤怠記録を作成（シンプル版）
export const recordAttendance = mutation({
  args: {
    staffId: v.id("staff"),
    type: v.union(v.literal("clock_in"), v.literal("clock_out")),
    timestamp: v.optional(v.number()),
    note: v.optional(v.string()),
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

    // タイムスタンプを生成（JST）
    const timestamp = args.timestamp || Date.now();

    // シンプルな記録のみ（遅刻・早退判定は廃止）
    const status = "on_time";

    const attendanceId = await ctx.db.insert("attendance", {
      staffId: args.staffId,
      type: args.type,
      timestamp,
      status,
      note: args.note,
      createdBy: userId,
    });

    return { 
      success: true, 
      attendanceId, 
      status: "on_time"
    };
  },
});

// QRコードによる勤怠記録（認証不要）
export const recordAttendanceByQR = mutation({
  args: {
    qrCode: v.string(),
    type: v.union(v.literal("clock_in"), v.literal("clock_out")),
  },
  handler: async (ctx, args) => {
    // QRコードからスタッフを検索
    const staff = await ctx.db
      .query("staff")
      .withIndex("by_qr_code", (q) => q.eq("qrCode", args.qrCode))
      .unique();

    if (!staff) {
      // 職員番号でも検索
      const staffByEmployeeId = await ctx.db
        .query("staff")
        .withIndex("by_employee_id", (q) => q.eq("employeeId", args.qrCode))
        .unique();
      
      if (!staffByEmployeeId) {
        throw new Error("スタッフが見つかりません。QRコードを確認してください。");
      }
      
      // 職員番号で見つかった場合はそれを使用（JST）
      const timestamp = Date.now();
      
      await ctx.db.insert("attendance", {
        staffId: staffByEmployeeId._id,
        type: args.type,
        timestamp,
        status: "on_time",
        createdBy: staffByEmployeeId.createdBy,
      });

      return { 
        success: true, 
        staffName: staffByEmployeeId.name,
        timestamp 
      };
    }

    if (!staff.isActive) {
      throw new Error("このスタッフは無効化されています。");
    }

    const timestamp = Date.now();

    await ctx.db.insert("attendance", {
      staffId: staff._id,
      type: args.type,
      timestamp,
      status: "on_time",
      createdBy: staff.createdBy,
    });

    return { 
      success: true, 
      staffName: staff.name,
      timestamp 
    };
  },
});

// 勤怠記録を更新
export const updateAttendance = mutation({
  args: {
    attendanceId: v.id("attendance"),
    timestamp: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    const attendance = await ctx.db.get(args.attendanceId);
    if (!attendance || attendance.createdBy !== userId) {
      throw new Error("勤怠記録が見つかりません");
    }

    // 変更履歴を記録
    await ctx.db.insert("attendanceHistory", {
      attendanceId: args.attendanceId,
      oldTimestamp: attendance.timestamp,
      newTimestamp: args.timestamp,
      oldNote: attendance.note,
      newNote: args.note,
      modifiedBy: userId,
      modifiedAt: Date.now(),
    });

    await ctx.db.patch(args.attendanceId, {
      timestamp: args.timestamp,
      note: args.note,
    });

    return { success: true };
  },
});

// 勤怠記録を削除
export const deleteAttendance = mutation({
  args: {
    attendanceId: v.id("attendance"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    const attendance = await ctx.db.get(args.attendanceId);
    if (!attendance || attendance.createdBy !== userId) {
      throw new Error("勤怠記録が見つかりません");
    }

    // 削除履歴を記録
    await ctx.db.insert("attendanceHistory", {
      attendanceId: args.attendanceId,
      oldTimestamp: attendance.timestamp,
      newTimestamp: undefined,
      oldNote: attendance.note,
      newNote: "削除",
      modifiedBy: userId,
      modifiedAt: Date.now(),
    });

    await ctx.db.delete(args.attendanceId);
    return { success: true };
  },
});

// ダミーデータ作成
export const createAttendanceDummyData = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    // スタッフ一覧を取得
    const staffList = await ctx.db
      .query("staff")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    if (staffList.length === 0) {
      throw new Error("スタッフが登録されていません");
    }

    // 2025年5月のデータを含む過去30日分のダミーデータを作成（JST）
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // 各日にランダムなスタッフの勤怠を作成
      const workingStaff = staffList.filter(() => Math.random() > 0.3); // 70%の確率で出勤
      
      for (const staff of workingStaff) {
        // 出勤時刻（8:30-10:00の間でランダム）JST
        const clockInTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 8, 30 + Math.floor(Math.random() * 90), 0, 0);
        const clockInTimestamp = clockInTime.getTime();
        
        await ctx.db.insert("attendance", {
          staffId: staff._id,
          type: "clock_in",
          timestamp: clockInTimestamp,
          status: "on_time",
          createdBy: userId,
        });

        // 退勤時刻（17:00-19:00の間でランダム）JST
        if (Math.random() > 0.1) { // 90%の確率で退勤記録も作成
          const clockOutTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 17, Math.floor(Math.random() * 120), 0, 0);
          const clockOutTimestamp = clockOutTime.getTime();
          
          await ctx.db.insert("attendance", {
            staffId: staff._id,
            type: "clock_out",
            timestamp: clockOutTimestamp,
            status: "on_time",
            createdBy: userId,
          });
        }
      }
    }

    return { success: true };
  },
});

// 本日のダミーデータ作成（新機能）
export const createTodayDummyData = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    // スタッフ一覧を取得
    const staffList = await ctx.db
      .query("staff")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    if (staffList.length === 0) {
      throw new Error("スタッフが登録されていません");
    }

    // 今日の既存データを削除（JST基準）
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfDay = today.getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

    const existingRecords = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => 
        q.gte("timestamp", startOfDay).lte("timestamp", endOfDay)
      )
      .collect();

    for (const record of existingRecords) {
      if (record.createdBy === userId) {
        await ctx.db.delete(record._id);
      }
    }

    // 本日のダミーデータを作成（JST）
    const scenarios = [
      // 正常パターン
      { clockIn: "09:00", clockOut: "18:00", errors: [] },
      { clockIn: "08:30", clockOut: "17:30", errors: [] },
      { clockIn: "09:15", clockOut: "18:15", errors: [] },
      
      // エラーパターン
      { clockIn: "09:00", clockOut: "09:30", errors: ["24時間以上の勤務"] }, // 実際は短時間だが、テスト用
      { clockIn: "10:00", clockOut: null, errors: [] }, // 退勤未記録
      { clockIn: "08:00", clockOut: "20:00", errors: [] }, // 長時間勤務
      
      // 連続打刻エラー用（後で追加）
      { clockIn: "09:00", clockOut: "18:00", errors: [] },
    ];

    for (let i = 0; i < Math.min(staffList.length, scenarios.length); i++) {
      const staff = staffList[i];
      const scenario = scenarios[i];
      
      // 出勤時刻（JST）
      const [clockInHour, clockInMinute] = scenario.clockIn.split(':').map(Number);
      const clockInTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), clockInHour, clockInMinute, 0, 0);
      const clockInTimestamp = clockInTime.getTime();
      
      await ctx.db.insert("attendance", {
        staffId: staff._id,
        type: "clock_in",
        timestamp: clockInTimestamp,
        status: "on_time",
        createdBy: userId,
      });

      // 退勤時刻（ある場合）JST
      if (scenario.clockOut) {
        const [clockOutHour, clockOutMinute] = scenario.clockOut.split(':').map(Number);
        let clockOutTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), clockOutHour, clockOutMinute, 0, 0);
        let clockOutTimestamp = clockOutTime.getTime();
        
        // 24時間以上エラーのテスト用
        if (scenario.errors.includes("24時間以上の勤務")) {
          clockOutTimestamp = clockInTimestamp + 25 * 60 * 60 * 1000; // 25時間後
        }
        
        await ctx.db.insert("attendance", {
          staffId: staff._id,
          type: "clock_out",
          timestamp: clockOutTimestamp,
          status: "on_time",
          createdBy: userId,
        });
      }
    }

    // 連続打刻エラーのテスト用データ（同じスタッフで連続出勤打刻）JST
    if (staffList.length > 0) {
      const testStaff = staffList[0];
      const duplicateClockIn = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 5, 0, 0);
      const duplicateTimestamp = duplicateClockIn.getTime();
      
      await ctx.db.insert("attendance", {
        staffId: testStaff._id,
        type: "clock_in",
        timestamp: duplicateTimestamp,
        status: "on_time",
        createdBy: userId,
      });
    }

    return { success: true };
  },
});

// 勤怠記録を修正（管理者用）
export const correctAttendance = mutation({
  args: {
    staffId: v.id("staff"),
    date: v.string(),
    type: v.union(v.literal("clock_in"), v.literal("clock_out")),
    time: v.string(),
    reason: v.string(),
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

    // 日付範囲を計算（JST基準）
    const [year, month, day] = args.date.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    const startOfDay = targetDate.getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

    // 該当日の既存記録を検索
    const existingRecords = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => 
        q.gte("timestamp", startOfDay).lte("timestamp", endOfDay)
      )
      .filter((q) => q.eq(q.field("staffId"), args.staffId))
      .filter((q) => q.eq(q.field("type"), args.type))
      .collect();

    // 日本時間（JST）として入力された時刻をそのまま使用
    const [timeYear, timeMonth, timeDay] = args.date.split('-').map(Number);
    const [hour, minute] = args.time.split(':').map(Number);
    const dateTime = new Date(timeYear, timeMonth - 1, timeDay, hour, minute, 0, 0);
    const timestamp = dateTime.getTime();

    if (existingRecords.length > 0) {
      // 既存記録を更新
      const record = existingRecords[0];
      
      // 変更履歴を記録
      await ctx.db.insert("attendanceHistory", {
        attendanceId: record._id,
        oldTimestamp: record.timestamp,
        newTimestamp: timestamp,
        oldNote: record.note,
        newNote: args.reason,
        modifiedBy: userId,
        modifiedAt: Date.now(),
      });

      await ctx.db.patch(record._id, {
        timestamp,
        note: args.reason,
        correctedAt: Date.now(),
        correctionReason: args.reason,
      });
    } else {
      // 新規作成
      const attendanceId = await ctx.db.insert("attendance", {
        staffId: args.staffId,
        type: args.type,
        timestamp,
        status: "on_time",
        note: args.reason,
        isManualEntry: true,
        createdBy: userId,
      });
    }

    return { success: true };
  },
});

// 修正履歴を取得
export const getCorrectionHistory = query({
  args: {
    staffId: v.id("staff"),
    date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    if (!args.date) return [];

    const [year, month, day] = args.date.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    const startOfDay = targetDate.getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

    const attendanceRecords = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => 
        q.gte("timestamp", startOfDay).lte("timestamp", endOfDay)
      )
      .filter((q) => q.eq(q.field("staffId"), args.staffId))
      .collect();

    const allHistory = [];
    for (const record of attendanceRecords) {
      const recordHistory = await ctx.db
        .query("attendanceHistory")
        .withIndex("by_attendance", (q) => q.eq("attendanceId", record._id))
        .collect();
      allHistory.push(...recordHistory);
    }

    return allHistory.sort((a, b) => b.modifiedAt - a.modifiedAt);
  },
});
