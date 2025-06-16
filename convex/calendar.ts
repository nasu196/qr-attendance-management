import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// 月次カレンダーデータを取得
export const getMonthlyCalendar = query({
  args: {
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    // 月の範囲を計算（JST基準）
    const startOfMonth = new Date(`${args.year}-${String(args.month).padStart(2, '0')}-01T00:00:00+09:00`).getTime();
    const endOfMonth = new Date(`${args.year}-${String(args.month).padStart(2, '0')}-${new Date(args.year, args.month, 0).getDate()}T23:59:59+09:00`).getTime();

    // スタッフ一覧を取得
    const staffList = await ctx.db
      .query("staff")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // 月次勤怠データを取得
    const attendanceRecords = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => 
        q.gte("timestamp", startOfMonth).lte("timestamp", endOfMonth)
      )
      .filter((q) => q.eq(q.field("createdBy"), userId))
      .collect();

    // 日付ごとのデータを生成
    const dailyData: Record<string, { attendanceCount: number; staffList: any[] }> = {};
    let totalWorkDays = 0;
    let totalAttendanceCount = 0;
    let maxAttendance = 0;

    // 出勤・退勤記録を分離
    const clockInRecords = attendanceRecords.filter(record => record.type === "clock_in");
    const clockOutRecords = attendanceRecords.filter(record => record.type === "clock_out");

    // 退勤記録をマップ化
    const clockOutMap = new Map<string, any>();
    clockOutRecords.forEach(record => {
      // UTCタイムスタンプをJSTに変換してから日付を計算
      const jstDate = new Date(record.timestamp + 9 * 60 * 60 * 1000);
      const dateKey = `${jstDate.getUTCFullYear()}-${String(jstDate.getUTCMonth() + 1).padStart(2, '0')}-${String(jstDate.getUTCDate()).padStart(2, '0')}`;
      const key = `${record.staffId}-${dateKey}`;
      clockOutMap.set(key, record);
    });

    // 日付ごとにグループ化
    const recordsByDate = new Map<string, any[]>();
    clockInRecords.forEach(record => {
      // UTCタイムスタンプをJSTに変換してから日付を計算
      const jstDate = new Date(record.timestamp + 9 * 60 * 60 * 1000);
      const dateKey = `${jstDate.getUTCFullYear()}-${String(jstDate.getUTCMonth() + 1).padStart(2, '0')}-${String(jstDate.getUTCDate()).padStart(2, '0')}`;
      
      if (!recordsByDate.has(dateKey)) {
        recordsByDate.set(dateKey, []);
      }
      recordsByDate.get(dateKey)!.push(record);
    });

    // 各日のデータを処理
    for (const [dateKey, records] of recordsByDate.entries()) {
      const attendingStaff = [];
      
      for (const record of records) {
        const staff = staffList.find(s => s._id === record.staffId);
        if (staff) {
          // 対応する退勤記録を探す
          const clockOutKey = `${record.staffId}-${dateKey}`;
          const clockOutRecord = clockOutMap.get(clockOutKey);
          
          attendingStaff.push({
            staffId: staff._id,
            name: staff.name,
            employeeId: staff.employeeId,
            clockIn: {
              timestamp: record.timestamp,
              status: record.status || "on_time",
            },
            clockOut: clockOutRecord ? {
              timestamp: clockOutRecord.timestamp,
              status: clockOutRecord.status || "on_time",
            } : null,
          });
        }
      }

      if (attendingStaff.length > 0) {
        dailyData[dateKey] = {
          attendanceCount: attendingStaff.length,
          staffList: attendingStaff.sort((a, b) => a.clockIn.timestamp - b.clockIn.timestamp),
        };

        totalWorkDays++;
        totalAttendanceCount += attendingStaff.length;
        maxAttendance = Math.max(maxAttendance, attendingStaff.length);
      }
    }

    const averageAttendance = totalWorkDays > 0 
      ? Math.round((totalAttendanceCount / totalWorkDays) * 10) / 10 
      : 0;

    return {
      dailyData,
      summary: {
        totalWorkDays,
        averageAttendance,
        maxAttendance,
      },
    };
  },
});

export const getMonthlyAttendanceStatus = query({
  args: {
    startOfMonth: v.number(), // UTCタイムスタンプ
    endOfMonth: v.number(),   // UTCタイムスタンプ
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    const attendanceRecords = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) =>
        q.gte("timestamp", args.startOfMonth).lte("timestamp", args.endOfMonth)
      )
      .filter((q) => q.eq(q.field("createdBy"), userId))
      .collect();
      
    return attendanceRecords;
  },
});
