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
    pairId: v.optional(v.string()), // ペアID（出勤記録のID）
    attendanceId: v.optional(v.id("attendance")), // 修正対象の具体的な記録ID
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
      let targetRecord = null;
      
      if (args.attendanceId) {
        // 具体的な記録IDが指定されている場合は、それを直接使用
        targetRecord = await ctx.db.get(args.attendanceId);
        if (!targetRecord) {
          throw new Error("修正対象の記録が見つかりません");
        }
        
        // 型と整合性をチェック
        if ((targetRecord as any).type !== args.type) {
          throw new Error(`修正対象の記録タイプ（${(targetRecord as any).type}）と指定されたタイプ（${args.type}）が一致しません`);
        }
        
        // スタッフIDの整合性をチェック
        if ((targetRecord as any).staffId !== args.staffId) {
          throw new Error("修正対象の記録のスタッフIDが一致しません");
        }
      } else {
        // 従来の方法（後方互換性のため）
        if (args.type === "clock_in") {
          // 出勤修正の場合：ペアIDと一致する出勤記録を探す
          targetRecord = await ctx.db.get(args.pairId as Id<"attendance">);
          if (!targetRecord || (targetRecord as any).type !== "clock_in") {
            throw new Error("修正対象の出勤記録が見つかりません");
          }
        } else {
          // 退勤修正の場合：ペアIDに対応する退勤記録を探す
          const clockInRecord = await ctx.db.get(args.pairId as Id<"attendance">);
          if (!clockInRecord) {
            throw new Error("ペアの出勤記録が見つかりません");
          }
          
          // そのペアの退勤記録を探す（同じスタッフの、出勤時刻より後の最初の退勤記録）
          targetRecord = await ctx.db
            .query("attendance")
            .withIndex("by_staff_and_timestamp", (q) => 
              q.eq("staffId", args.staffId).gt("timestamp", (clockInRecord as any).timestamp)
            )
            .filter((q) => q.eq(q.field("type"), "clock_out"))
            .order("asc")
            .first();
            
          if (!targetRecord) {
            throw new Error("修正対象の退勤記録が見つかりません");
          }
        }
      }
      
      // 変更履歴を記録（ペアIDベース）
      await ctx.db.insert("attendanceHistory", {
        attendanceId: targetRecord._id as Id<"attendance">,
        pairId: args.pairId,
        recordType: args.type,
        oldTimestamp: (targetRecord as any).timestamp,
        newTimestamp: timestamp,
        oldNote: (targetRecord as any).note,
        newNote: args.reason,
        modifiedBy: userId,
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
      const newAttendanceId = await ctx.db.insert("attendance", {
        staffId: args.staffId,
        type: args.type,
        timestamp,
        status: "on_time",
        note: args.reason,
        isManualEntry: true,
        createdBy: userId,
      });

      // 新規作成の場合のペアID決定
      let pairId = "";
      if (args.type === "clock_in") {
        pairId = newAttendanceId;
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
        
        pairId = clockInRecord ? clockInRecord._id : newAttendanceId;
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
        modifiedBy: userId,
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

    // 対応する退勤記録を探す
    const clockOutRecord = await ctx.db
      .query("attendance")
      .withIndex("by_staff_and_timestamp", (q) => 
        q.eq("staffId", attendanceRecord.staffId).gt("timestamp", attendanceRecord.timestamp)
      )
      .filter((q) => q.eq(q.field("type"), "clock_out"))
      .order("asc")
      .first();

    // 出勤記録の削除履歴を記録
    await ctx.db.insert("attendanceHistory", {
      attendanceId: attendanceRecord._id,
      pairId: args.pairId,
      recordType: "clock_in",
      oldTimestamp: attendanceRecord.timestamp,
      newTimestamp: undefined, // 削除を示すためundefined
      oldNote: attendanceRecord.note,
      newNote: args.reason,
      modifiedBy: userId,
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
        modifiedBy: userId,
        modifiedAt: Date.now(),
      });

      await ctx.db.delete(clockOutRecord._id);
    }

    return { success: true };
  },
});
