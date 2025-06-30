import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getCurrentUserId } from "./clerkAuth";
import { Doc, Id } from "./_generated/dataModel";

// 今日の勤怠一覧を取得 (Clerk対応版)
export const getTodayAttendance = query({
  args: {
    clerkUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx, args.clerkUserId);
    if (!userId) {
      return [];
    }
    
    // 今日の範囲をJST基準で正しく計算
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    
    // JST基準で今日の開始・終了時刻をUTCタイムスタンプに変換
    const startOfDay = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00+09:00`).getTime();
    const endOfDay = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T23:59:59+09:00`).getTime();

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

    // ペアIDベースでペアリング
    const pairsByStaff = new Map<string, Map<string, { clockIn: any, clockOut: any }>>();
    
    attendanceRecords.forEach(record => {
      const staff = staffMap.get(record.staffId);
      if (!staff) return;

      if (!pairsByStaff.has(record.staffId as string)) {
        pairsByStaff.set(record.staffId as string, new Map());
      }
      
      const staffPairs = pairsByStaff.get(record.staffId as string)!;
      const pairId = record.pairId || record._id;
      
      if (!staffPairs.has(pairId)) {
        staffPairs.set(pairId, { clockIn: null, clockOut: null });
      }
      
      const pair = staffPairs.get(pairId)!;
      if (record.type === "clock_in") {
        pair.clockIn = record;
      } else {
        pair.clockOut = record;
      }
    });

    // スタッフごとに今日の中で最も遅い出勤時刻のペアを選択
    pairsByStaff.forEach((staffPairs, staffId) => {
      const staff = staffMap.get(staffId as any);
      if (!staff) return;
      
      // 今日の出勤記録のうち、出勤日基準で最も遅い時刻のペアを選択
      let latestPair = null;
      let latestClockInTime = 0;
      
      for (const pair of staffPairs.values()) {
        if (pair.clockIn) {
          // 出勤記録の日付をJST基準で確認
          const clockInJST = new Date(pair.clockIn.timestamp + 9 * 60 * 60 * 1000);
          const clockInDateStr = `${clockInJST.getUTCFullYear()}-${String(clockInJST.getUTCMonth() + 1).padStart(2, '0')}-${String(clockInJST.getUTCDate()).padStart(2, '0')}`;
          const todayDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          
          // 今日の出勤記録のみを対象とし、その中で最も遅い時刻を選択
          if (clockInDateStr === todayDateStr) {
            // 出勤時刻（時:分）で比較するため、日付部分を除いた時刻で比較
            const timeOfDay = pair.clockIn.timestamp % (24 * 60 * 60 * 1000);
            if (timeOfDay > latestClockInTime) {
              latestClockInTime = timeOfDay;
              latestPair = pair;
            }
          }
        }
      }
      
      if (latestPair) {
        recordsByStaff.set(staffId as any, {
          staff,
          clockIn: latestPair.clockIn,
          clockOut: latestPair.clockOut,
          status: "absent"
        });
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

    let pairId = "";
    
    if (args.type === "clock_in") {
      // 出勤記録の場合
      const attendanceId = await ctx.db.insert("attendance", {
        staffId: args.staffId,
        type: args.type,
        timestamp,
        status,
        pairId: "", // 一時的に空文字
        note: args.note,
        createdBy: userId,
      });
      
      // 自分のIDをペアIDとして設定
      await ctx.db.patch(attendanceId, {
        pairId: attendanceId,
      });
      
      pairId = attendanceId;
      
      return { 
        success: true, 
        attendanceId, 
        status: "on_time",
        pairId
      };
    } else {
      // 退勤記録の場合、対応する出勤記録を探す
      const clockInRecord = await ctx.db
        .query("attendance")
        .withIndex("by_staff_and_timestamp", (q) => 
          q.eq("staffId", args.staffId).lt("timestamp", timestamp)
        )
        .filter((q) => q.eq(q.field("type"), "clock_in"))
        .order("desc")
        .first();
      
      pairId = clockInRecord ? (clockInRecord.pairId || clockInRecord._id) : "";
      
      const attendanceId = await ctx.db.insert("attendance", {
        staffId: args.staffId,
        type: args.type,
        timestamp,
        status,
        pairId,
        note: args.note,
        createdBy: userId,
      });

      return { 
        success: true, 
        attendanceId, 
        status: "on_time",
        pairId
      };
    }
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
      
      let pairId = "";
      
      if (args.type === "clock_in") {
        // 出勤記録の場合
        const attendanceId = await ctx.db.insert("attendance", {
          staffId: staffByEmployeeId._id,
          type: args.type,
          timestamp,
          status: "on_time",
          pairId: "", // 一時的に空文字
          createdBy: staffByEmployeeId.createdBy,
        });
        
        // 自分のIDをペアIDとして設定
        await ctx.db.patch(attendanceId, {
          pairId: attendanceId,
        });
        
        pairId = attendanceId;
      } else {
        // 退勤記録の場合、対応する出勤記録を探す
        const clockInRecord = await ctx.db
          .query("attendance")
          .withIndex("by_staff_and_timestamp", (q) => 
            q.eq("staffId", staffByEmployeeId._id).lt("timestamp", timestamp)
          )
          .filter((q) => q.eq(q.field("type"), "clock_in"))
          .order("desc")
          .first();
        
        pairId = clockInRecord ? (clockInRecord.pairId || clockInRecord._id) : "";
        
        await ctx.db.insert("attendance", {
          staffId: staffByEmployeeId._id,
          type: args.type,
          timestamp,
          status: "on_time",
          pairId,
          createdBy: staffByEmployeeId.createdBy,
        });
      }

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

    let pairId = "";
    
    if (args.type === "clock_in") {
      // 出勤記録の場合
      const attendanceId = await ctx.db.insert("attendance", {
        staffId: staff._id,
        type: args.type,
        timestamp,
        status: "on_time",
        pairId: "", // 一時的に空文字
        createdBy: staff.createdBy,
      });
      
      // 自分のIDをペアIDとして設定
      await ctx.db.patch(attendanceId, {
        pairId: attendanceId,
      });
      
      pairId = attendanceId;
    } else {
      // 退勤記録の場合、対応する出勤記録を探す
      const clockInRecord = await ctx.db
        .query("attendance")
        .withIndex("by_staff_and_timestamp", (q) => 
          q.eq("staffId", staff._id).lt("timestamp", timestamp)
        )
        .filter((q) => q.eq(q.field("type"), "clock_in"))
        .order("desc")
        .first();
      
      pairId = clockInRecord ? (clockInRecord.pairId || clockInRecord._id) : "";
      
      await ctx.db.insert("attendance", {
        staffId: staff._id,
        type: args.type,
        timestamp,
        status: "on_time",
        pairId,
        createdBy: staff.createdBy,
      });
    }

    return { 
      success: true, 
      staffName: staff.name,
      timestamp 
    };
  },
});

// 古いupdateAttendanceとdeleteAttendance関数を削除
// 現在はcorrectAttendanceとdeletePairを使用

// 過去30日分のダミーデータを作成 (Clerk対応版)
export const createAttendanceDummyData = mutation({
  args: {
    clerkUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx, args.clerkUserId);
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

    // 既存の勤怠データをすべて削除（このユーザーのみ）
    const allAttendance = await ctx.db
      .query("attendance")
      .filter((q) => q.eq(q.field("createdBy"), userId))
      .collect();
    
    for (const record of allAttendance) {
      await ctx.db.delete(record._id);
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
  }
});

// 2025年5月・6月のダミーデータを作成
export const create2025MayJuneDummyData = mutation({
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
      throw new Error("アクティブなスタッフが登録されていません。先にスタッフを登録してください。");
    }

    // 2025年5月・6月の既存データを削除
    const may2025Start = new Date("2025-05-01T00:00:00+09:00").getTime();
    const june2025End = new Date("2025-06-30T23:59:59+09:00").getTime();

    const existingRecords = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => 
        q.gte("timestamp", may2025Start).lte("timestamp", june2025End)
      )
      .collect();

    for (const record of existingRecords) {
      if (record.createdBy === userId) {
        await ctx.db.delete(record._id);
      }
    }

    // 5月と6月の各日のダミーデータを作成
    const may2025 = { year: 2025, month: 5, days: 31 };
    const june2025 = { year: 2025, month: 6, days: 30 };
    const months = [may2025, june2025];

    let recordsCreated = 0;

    for (const monthData of months) {
      for (let day = 1; day <= monthData.days; day++) {
        // 土日をスキップ（出勤率を現実的に）
        const date = new Date(monthData.year, monthData.month - 1, day);
        const dayOfWeek = date.getDay(); // 0: 日曜, 6: 土曜
        
        // 土日は30%の確率で出勤、平日は90%の確率で出勤
        const attendanceRate = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.3 : 0.9;
        
        for (const staff of staffList) {
          if (Math.random() <= attendanceRate) {
            // 出勤時刻のバリエーション（現実的な範囲）
            const clockInVariations = [
              { hour: 8, minStart: 30, minRange: 30 }, // 8:30-9:00
              { hour: 8, minStart: 45, minRange: 45 }, // 8:45-9:30
              { hour: 9, minStart: 0, minRange: 30 },  // 9:00-9:30
            ];
            
            const clockInVariation = clockInVariations[Math.floor(Math.random() * clockInVariations.length)];
            const clockInMinute = clockInVariation.minStart + Math.floor(Math.random() * clockInVariation.minRange);
            const actualClockInHour = clockInVariation.hour + Math.floor(clockInMinute / 60);
            const actualClockInMinute = clockInMinute % 60;

            const clockInIsoString = `${monthData.year}-${String(monthData.month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(actualClockInHour).padStart(2, '0')}:${String(actualClockInMinute).padStart(2, '0')}:00+09:00`;
            const clockInTimestamp = new Date(clockInIsoString).getTime();

            // 出勤記録を作成
            const clockInId = await ctx.db.insert("attendance", {
              staffId: staff._id,
              type: "clock_in",
              timestamp: clockInTimestamp,
              status: "on_time",
              pairId: "", // 一時的に空文字
              createdBy: userId,
            });
            
            // 自分のIDをペアIDとして設定
            await ctx.db.patch(clockInId, {
              pairId: clockInId,
            });
            
            recordsCreated++;

            // 退勤記録（95%の確率で作成）
            if (Math.random() > 0.05) {
              // 退勤時刻のバリエーション
              const clockOutVariations = [
                { hour: 17, minStart: 0, minRange: 60 },   // 17:00-18:00
                { hour: 17, minStart: 30, minRange: 90 },  // 17:30-19:00
                { hour: 18, minStart: 0, minRange: 120 },  // 18:00-20:00
              ];
              
              const clockOutVariation = clockOutVariations[Math.floor(Math.random() * clockOutVariations.length)];
              const clockOutMinute = clockOutVariation.minStart + Math.floor(Math.random() * clockOutVariation.minRange);
              const actualClockOutHour = clockOutVariation.hour + Math.floor(clockOutMinute / 60);
              const actualClockOutMinute = clockOutMinute % 60;

              const clockOutIsoString = `${monthData.year}-${String(monthData.month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(actualClockOutHour).padStart(2, '0')}:${String(actualClockOutMinute).padStart(2, '0')}:00+09:00`;
              const clockOutTimestamp = new Date(clockOutIsoString).getTime();

              // 退勤記録に同じペアIDを設定
              await ctx.db.insert("attendance", {
                staffId: staff._id,
                type: "clock_out",
                timestamp: clockOutTimestamp,
                status: "on_time",
                pairId: clockInId, // 出勤記録と同じペアID
                createdBy: userId,
              });
              recordsCreated++;
            }
          }
        }
      }
    }

    return { 
      success: true, 
      message: `2025年5月・6月のダミーデータを作成しました。（${recordsCreated}件の記録を作成）`,
      recordsCreated 
    };
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

      // 出勤記録を作成
      const clockInId = await ctx.db.insert("attendance", {
        staffId: staff._id,
        type: "clock_in",
        timestamp: clockInTimestamp,
        status: "on_time",
        pairId: "", // 一時的に空文字
        createdBy: userId,
      });
      
      // 自分のIDをペアIDとして設定
      await ctx.db.patch(clockInId, {
        pairId: clockInId,
      });

      if (scenario.clockOut) {
        // 退勤時刻をJSTとして正しく処理
        const [outH, outM] = scenario.clockOut.split(':').map(Number);
        const clockOutIsoString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}:00+09:00`;
        const clockOutTimestamp = new Date(clockOutIsoString).getTime();
        
        // 退勤記録に同じペアIDを設定
        await ctx.db.insert("attendance", {
          staffId: staff._id,
          type: "clock_out",
          timestamp: clockOutTimestamp,
          status: "on_time",
          pairId: clockInId, // 出勤記録と同じペアID
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
    pairId: v.optional(v.string()), // ペアID（出勤記録のID）
    date: v.string(), // 新しい日付
    type: v.union(v.literal("clock_in"), v.literal("clock_out")),
    time: v.string(), // 新しい時刻
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    // JST時刻として正しく解釈するためにISO文字列を使用
    const [year, month, day] = args.date.split('-').map(Number);
    const [hour, minute] = args.time.split(':').map(Number);
    const isoString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`;
    const timestamp = new Date(isoString).getTime();

    if (args.pairId) {
      // ペアID基準の修正（既存記録を更新）
      // シンプルにペアIDで対象レコードを直接特定
      const targetRecords = await ctx.db
        .query("attendance")
        .withIndex("by_pair_id", (q) => q.eq("pairId", args.pairId))
        .filter((q) => q.eq(q.field("type"), args.type))
        .collect();
      
      if (targetRecords.length === 0) {
        throw new Error(`修正対象の${args.type === "clock_in" ? "出勤" : "退勤"}記録が見つかりません`);
      }
      
      const targetRecord = targetRecords[0];
      
      // 変更履歴を記録（ペアIDベース）
      await ctx.db.insert("attendanceHistory", {
        attendanceId: targetRecord._id,
        pairId: args.pairId,
        recordType: args.type,
        oldTimestamp: targetRecord.timestamp,
        newTimestamp: timestamp,
        oldNote: targetRecord.note,
        newNote: args.reason,
        modifiedBy: userId as any,
        modifiedAt: Date.now(),
      });

      await ctx.db.patch(targetRecord._id, {
        timestamp,
        note: args.reason,
        correctedAt: Date.now(),
        correctionReason: args.reason,
      });
    } else {
      // 新規作成
      let pairId = "";
      let newAttendanceId: Id<"attendance">;
      
      if (args.type === "clock_in") {
        // 出勤記録の新規作成の場合
        newAttendanceId = await ctx.db.insert("attendance", {
          staffId: args.staffId,
          type: args.type,
          timestamp,
          status: "on_time",
          pairId: "", // 一時的に空文字を設定
          note: args.reason,
          isManualEntry: true,
          createdBy: userId,
        });
        
        pairId = newAttendanceId;
        
        // 自分のIDをペアIDとして設定
        await ctx.db.patch(newAttendanceId, {
          pairId: newAttendanceId,
        });
      } else {
        // 退勤記録の新規作成の場合、対応する出勤記録を探す
        const clockInRecord = await ctx.db
          .query("attendance")
          .withIndex("by_staff_and_timestamp", (q) => 
            q.eq("staffId", args.staffId).lt("timestamp", timestamp)
          )
          .filter((q) => q.eq(q.field("type"), "clock_in"))
          .order("desc")
          .first();
        
        pairId = clockInRecord ? (clockInRecord.pairId || clockInRecord._id) : "";
        
        newAttendanceId = await ctx.db.insert("attendance", {
          staffId: args.staffId,
          type: args.type,
          timestamp,
          status: "on_time",
          pairId,
          note: args.reason,
          isManualEntry: true,
          createdBy: userId,
        });
      }

      // 新規作成の場合も履歴を記録（ペアIDベース）
      await ctx.db.insert("attendanceHistory", {
        attendanceId: newAttendanceId,
        pairId,
        recordType: args.type,
        oldTimestamp: undefined,
        newTimestamp: timestamp,
        oldNote: undefined,
        newNote: args.reason,
        modifiedBy: userId as any,
        modifiedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// 修正履歴を取得（ペアベース）
export const getCorrectionHistory = query({
  args: {
    pairId: v.string(), // ペアID（出勤記録のID）
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const recordHistory = await ctx.db
      .query("attendanceHistory")
      .withIndex("by_pair", (q) => q.eq("pairId", args.pairId))
      .collect();

    return recordHistory.sort((a, b) => b.modifiedAt - a.modifiedAt);
  },
});

// updateAttendanceTime関数も削除（使用されていない）

// ペア削除（管理者用）
export const deletePair = mutation({
  args: {
    pairId: v.id("attendance"), // ペアID（出勤記録のID）
    reason: v.string(), // 削除理由
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    // ペアIDに基づいて関連する勤怠記録を取得
    const clockInRecord = await ctx.db.get(args.pairId);
    if (!clockInRecord) {
      throw new Error("削除対象のペアが見つかりません");
    }

    // attendanceテーブルのレコードであることを型アサーション
    const attendanceRecord = clockInRecord as any;
    if (!attendanceRecord.staffId || !attendanceRecord.timestamp || !attendanceRecord.type) {
      throw new Error("無効な勤怠記録です");
    }

    if (attendanceRecord.type !== "clock_in") {
      throw new Error("削除対象は出勤記録である必要があります");
    }

    // 対応する退勤記録をペアIDで探す
    const clockOutRecords = await ctx.db
      .query("attendance")
      .withIndex("by_pair_id", (q) => q.eq("pairId", args.pairId))
      .filter((q) => q.eq(q.field("type"), "clock_out"))
      .collect();
    
    const clockOutRecord = clockOutRecords.length > 0 ? clockOutRecords[0] : null;

    // 出勤記録の削除履歴を記録
    await ctx.db.insert("attendanceHistory", {
      attendanceId: attendanceRecord._id,
      pairId: args.pairId,
      recordType: "clock_in",
      oldTimestamp: attendanceRecord.timestamp,
      newTimestamp: undefined, // 削除を示すためundefined
      oldNote: attendanceRecord.note,
      newNote: args.reason,
      modifiedBy: userId as any,
      modifiedAt: Date.now(),
    });

    // 出勤記録を削除
    await ctx.db.delete(attendanceRecord._id);

    // 退勤記録がある場合は削除
    if (clockOutRecord) {
      // 退勤記録の削除履歴を記録
      await ctx.db.insert("attendanceHistory", {
        attendanceId: clockOutRecord._id,
        pairId: args.pairId,
        recordType: "clock_out",
        oldTimestamp: clockOutRecord.timestamp,
        newTimestamp: undefined, // 削除を示すためundefined
        oldNote: clockOutRecord.note,
        newNote: args.reason,
        modifiedBy: userId as any,
        modifiedAt: Date.now(),
      });

      await ctx.db.delete(clockOutRecord._id);
    }

    return { success: true };
  },
});

// 開発環境クリーンアップ用（本番では使用禁止）
export const cleanupDevData = mutation({
  args: {},
  handler: async (ctx, _args) => {
    // 開発環境専用のため認証チェックを一時的に無効化

    // 全ての勤怠記録を削除
    const allAttendance = await ctx.db.query("attendance").collect();
    console.log(`削除対象の勤怠記録数: ${allAttendance.length}`);
    
    for (const record of allAttendance) {
      await ctx.db.delete(record._id);
    }
    
    // 全ての勤怠履歴を削除
    const allHistory = await ctx.db.query("attendanceHistory").collect();
    console.log(`削除対象の履歴記録数: ${allHistory.length}`);
    
    for (const record of allHistory) {
      await ctx.db.delete(record._id);
    }
    
    return { 
      success: true, 
      deletedAttendance: allAttendance.length,
      deletedHistory: allHistory.length 
    };
  },
});

// 新規勤怠ペア作成（出勤・退勤同時入力）
export const createAttendancePair = mutation({
  args: {
    staffId: v.id("staff"),
    date: v.string(), // 勤務日
    clockInTime: v.string(), // 出勤時刻
    clockOutTime: v.string(), // 退勤時刻
    reason: v.string(), // 作成理由
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }
    // テスト用に有効なユーザーIDを使用
    // const userId = "k974kzmvp4waap4bawegz2k1917hjpcq" as any;

    // 出勤時刻のタイムスタンプ作成
    const [year, month, day] = args.date.split('-').map(Number);
    const [inHour, inMinute] = args.clockInTime.split(':').map(Number);
    const clockInIsoString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(inHour).padStart(2, '0')}:${String(inMinute).padStart(2, '0')}:00+09:00`;
    const clockInTimestamp = new Date(clockInIsoString).getTime();

    // 退勤時刻のタイムスタンプ作成
    const [outHour, outMinute] = args.clockOutTime.split(':').map(Number);
    let clockOutIsoString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(outHour).padStart(2, '0')}:${String(outMinute).padStart(2, '0')}:00+09:00`;
    let clockOutTimestamp = new Date(clockOutIsoString).getTime();

    // 夜勤対応：退勤時刻が出勤時刻より早い場合は翌日とみなす
    if (clockOutTimestamp <= clockInTimestamp) {
      const nextDay = new Date(year, month - 1, day + 1);
      clockOutIsoString = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}T${String(outHour).padStart(2, '0')}:${String(outMinute).padStart(2, '0')}:00+09:00`;
      clockOutTimestamp = new Date(clockOutIsoString).getTime();
    }

    // 出勤記録を作成
    const clockInId = await ctx.db.insert("attendance", {
      staffId: args.staffId,
      type: "clock_in",
      timestamp: clockInTimestamp,
      status: "on_time",
      pairId: "", // 一時的に空文字
      note: args.reason,
      isManualEntry: true,
      createdBy: userId as any,
    });
    
    // 自分のIDをペアIDとして設定
    await ctx.db.patch(clockInId, {
      pairId: clockInId,
    });

    // 退勤記録を作成（同じペアIDを設定）
    const clockOutId = await ctx.db.insert("attendance", {
      staffId: args.staffId,
      type: "clock_out",
      timestamp: clockOutTimestamp,
      status: "on_time",
      pairId: clockInId, // 出勤記録と同じペアID
      note: args.reason,
      isManualEntry: true,
      createdBy: userId as any,
    });

    // 履歴記録（出勤）
    await ctx.db.insert("attendanceHistory", {
      attendanceId: clockInId,
      pairId: clockInId, // 出勤記録のIDをペアIDとして使用
      recordType: "clock_in",
      oldTimestamp: undefined,
      newTimestamp: clockInTimestamp,
      oldNote: undefined,
      newNote: args.reason,
      modifiedBy: userId as any,
      modifiedAt: Date.now(),
    });

    // 履歴記録（退勤）
    await ctx.db.insert("attendanceHistory", {
      attendanceId: clockOutId,
      pairId: clockInId, // 同じペアIDを使用
      recordType: "clock_out",
      oldTimestamp: undefined,
      newTimestamp: clockOutTimestamp,
      oldNote: undefined,
      newNote: args.reason,
      modifiedBy: userId as any,
      modifiedAt: Date.now(),
    });

    return { 
      success: true, 
      clockInId,
      clockOutId,
      pairId: clockInId 
    };
  },
});
