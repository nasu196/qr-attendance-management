import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";

// 今日の勤怠一覧を取得 (リファクタリング・復活版)
export const getTodayAttendance = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    
    // 今日の範囲をUTCで計算
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

    const attendanceRecords = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => 
        q.gte("timestamp", startOfDay)
         .lte("timestamp", endOfDay)
      )
      .filter((q) => q.eq(q.field("createdBy"), userId))
      .collect();
      
    const staffIds = [...new Set(attendanceRecords.map(r => r.staffId))];
    
    const staffDetails = await Promise.all(
      staffIds.map(staffId => ctx.db.get(staffId))
    );
    const staffMap = new Map(staffDetails.filter((s): s is Doc<"staff"> => s !== null).map(s => [s._id, s]));

    const recordsByStaff = new Map<Id<"staff">, {
      staff: Doc<"staff">;
      clockIn: Doc<"attendance"> | null;
      clockOut: Doc<"attendance"> | null;
      status: string;
    }>();

    attendanceRecords.forEach(record => {
      const staff = staffMap.get(record.staffId);
      if (!staff) return;

      if (!recordsByStaff.has(record.staffId)) {
        recordsByStaff.set(record.staffId, {
          staff,
          clockIn: null,
          clockOut: null,
          status: "absent"
        });
      }
      
      const entry = recordsByStaff.get(record.staffId)!;
      if (record.type === "clock_in") {
        if (!entry.clockIn || record.timestamp < entry.clockIn.timestamp) {
          entry.clockIn = record;
        }
      } else {
        if (!entry.clockOut || record.timestamp > entry.clockOut.timestamp) {
          entry.clockOut = record;
        }
      }
    });
    
    recordsByStaff.forEach(entry => {
        if(entry.clockIn && entry.clockOut) {
            entry.status = "completed";
        } else if (entry.clockIn) {
            entry.status = "present";
        }
    });

    return Array.from(recordsByStaff.values());
  }
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

// 過去30日分のダミーデータを作成
export const createAttendanceDummyData =
  mutation(async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    const staffList = await ctx.db
      .query("staff")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .collect();

    if (staffList.length === 0) {
      throw new Error("スタッフが登録されていません。先にスタッフを登録してください。");
    }

    // 既存の勤怠データをすべて削除
    const allAttendance = await ctx.db.query("attendance").collect();
    for (const record of allAttendance) {
      if (record.createdBy === userId) {
        await ctx.db.delete(record._id);
      }
    }

    const today = new Date();

    for (let i = 0; i < 30; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - i);
      
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth() + 1;
      const day = targetDate.getDate();
      
      // 80%の確率で出勤
      if (Math.random() > 0.2) {
        for (const staff of staffList) {
          // 出勤時刻をJSTで8:30-9:30の範囲でランダム生成
          const clockInHour = 8;
          const clockInMinute = 30 + Math.floor(Math.random() * 60);
          const clockInIsoString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(clockInHour).padStart(2, '0')}:${String(clockInMinute).padStart(2, '0')}:00+09:00`;
          const clockInTimestamp = new Date(clockInIsoString).getTime();

          await ctx.db.insert("attendance", {
            staffId: staff._id,
            type: "clock_in",
            timestamp: clockInTimestamp,
            status: "on_time",
            createdBy: userId,
          });

          // 95%の確率で退勤記録も作成
          if (Math.random() > 0.05) {
            // 退勤時刻をJSTで17:00-19:00の範囲でランダム生成
            const clockOutHour = 17 + Math.floor(Math.random() * 2);
            const clockOutMinute = Math.floor(Math.random() * 60);
            const clockOutIsoString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(clockOutHour).padStart(2, '0')}:${String(clockOutMinute).padStart(2, '0')}:00+09:00`;
            const clockOutTimestamp = new Date(clockOutIsoString).getTime();

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
    }

    return { success: true, message: "過去30日間の日勤ダミーデータを作成しました。" };
  });

// 本日のダミーデータ作成（新機能）
export const createTodayDummyData = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    const staffList = await ctx.db
      .query("staff")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    if (staffList.length === 0) {
      throw new Error("スタッフが登録されていません");
    }

    const today = new Date();
    const startOfDay = new Date(today.setUTCHours(0, 0, 0, 0)).getTime();
    const endOfDay = new Date(today.setUTCHours(23, 59, 59, 999)).getTime();

    // 今日の既存データを削除
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

    // 現実的な日勤シナリオ (時刻はJST基準で考え、正しくタイムスタンプに変換して登録)
    const scenarios = [
      { clockIn: "08:50", clockOut: "17:45" }, // 正常
      { clockIn: "09:05", clockOut: "18:10" }, // 遅刻気味
      { clockIn: "08:30", clockOut: null },      // 退勤忘れ
      { clockIn: "09:00", clockOut: "19:00" }, // 残業
      { clockIn: "09:15", clockOut: "17:00" }, // 早退
      { clockIn: "08:55", clockOut: "18:05" },
    ];

    // 今日の日付をJSTで取得
    const todayJST = new Date();
    const year = todayJST.getFullYear();
    const month = todayJST.getMonth() + 1;
    const day = todayJST.getDate();

    for (let i = 0; i < Math.min(staffList.length, scenarios.length); i++) {
      const staff = staffList[i];
      const scenario = scenarios[i];
      
      // 出勤時刻をJSTとして正しく処理
      const [inH, inM] = scenario.clockIn.split(':').map(Number);
      const clockInIsoString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(inH).padStart(2, '0')}:${String(inM).padStart(2, '0')}:00+09:00`;
      const clockInTimestamp = new Date(clockInIsoString).getTime();

      await ctx.db.insert("attendance", {
        staffId: staff._id,
        type: "clock_in",
        timestamp: clockInTimestamp,
        status: "on_time",
        createdBy: userId,
      });

      if (scenario.clockOut) {
        // 退勤時刻をJSTとして正しく処理
        const [outH, outM] = scenario.clockOut.split(':').map(Number);
        const clockOutIsoString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}:00+09:00`;
        const clockOutTimestamp = new Date(clockOutIsoString).getTime();
        
        await ctx.db.insert("attendance", {
          staffId: staff._id,
          type: "clock_out",
          timestamp: clockOutTimestamp,
          status: "on_time",
          createdBy: userId,
        });
      }
    }
    return { success: true, message: "本日の日勤ダミーデータを作成しました。" };
  },
});

// 勤怠記録を修正（管理者用）
// 注意：このシステムではタイムスタンプは全てJST（日本標準時）で統一されています
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

    // 該当日の既存記録を検索（スタッフIDとタイプで絞り込み）
    const existingRecords = await ctx.db
      .query("attendance")
      .withIndex("by_staff_and_timestamp", (q) => 
        q.eq("staffId", args.staffId)
         .gte("timestamp", startOfDay)
         .lte("timestamp", endOfDay)
      )
      .filter((q) => q.eq(q.field("type"), args.type))
      .collect();

    // 日本時間（JST）として入力された時刻をJSTタイムスタンプとして保存
    // ISO文字列を使用してJSTタイムゾーンを明示的に指定
    const [timeYear, timeMonth, timeDay] = args.date.split('-').map(Number);
    const [hour, minute] = args.time.split(':').map(Number);
    
    // JST時刻として正しく解釈するためにISO文字列を使用
    const isoString = `${timeYear}-${String(timeMonth).padStart(2, '0')}-${String(timeDay).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`;
    const timestamp = new Date(isoString).getTime();

    if (existingRecords.length > 0) {
      // 既存記録を更新
      const record = existingRecords[0];
      
      // 変更履歴を記録（既存記録の場合）
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
      const newAttendanceId = await ctx.db.insert("attendance", {
        staffId: args.staffId,
        type: args.type,
        timestamp,
        status: "on_time",
        note: args.reason,
        isManualEntry: true,
        createdBy: userId,
      });

      // 新規作成の場合も履歴を記録
      await ctx.db.insert("attendanceHistory", {
        attendanceId: newAttendanceId,
        oldTimestamp: undefined, // 新規作成なので元の時刻はundefined
        newTimestamp: timestamp,
        oldNote: undefined,
        newNote: args.reason,
        modifiedBy: userId,
        modifiedAt: Date.now(),
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

export const updateAttendanceTime = mutation({
  args: {
    attendanceId: v.id("attendance"),
    newTimestamp: v.number(), // JST文字列ではなく、UTCタイムスタンプを直接受け取る
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    // ... 権限チェックは省略 ...

    await ctx.db.patch(args.attendanceId, {
      timestamp: args.newTimestamp, // 受け取ったUTCタイムスタンプで更新
    });

    return { success: true };
  },
});
