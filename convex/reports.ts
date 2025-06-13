import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// 期間レポートを取得
export const getPeriodReport = query({
  args: {
    startDate: v.string(), // YYYY-MM-DD形式
    endDate: v.string(),   // YYYY-MM-DD形式
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("認証が必要です");
    }

    const startOfPeriod = new Date(args.startDate + 'T00:00:00').getTime();
    const endOfPeriod = new Date(args.endDate + 'T23:59:59').getTime();

    // スタッフ一覧を取得
    const staffList = await ctx.db
      .query("staff")
      .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // 期間内勤怠データを取得
    const attendanceRecords = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => 
        q.gte("timestamp", startOfPeriod).lte("timestamp", endOfPeriod)
      )
      .collect();

    // スタッフ別レポートを生成
    const staffReports = [];
    let totalHours = 0;
    let totalWorkDays = 0;
    let totalOvertimeHours = 0;
    let totalLateEarly = 0;

    for (const staff of staffList) {
      const staffAttendance = attendanceRecords.filter(a => a.staffId === staff._id);
      
      // 日付ごとにグループ化
      const dailyRecords = new Map();
      staffAttendance.forEach(record => {
        const date = new Date(record.timestamp);
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        
        if (!dailyRecords.has(dateKey)) {
          dailyRecords.set(dateKey, { date: dateKey, clockIn: null, clockOut: null });
        }
        
        const dayRecord = dailyRecords.get(dateKey);
        if (record.type === "clock_in") {
          dayRecord.clockIn = record;
        } else {
          dayRecord.clockOut = record;
        }
      });

      // 統計を計算
      let workDays = 0;
      let staffTotalMinutes = 0;
      let staffOvertimeMinutes = 0;

      Array.from(dailyRecords.values()).forEach(day => {
        if (day.clockIn && day.clockOut) {
          const dayMinutes = (day.clockOut.timestamp - day.clockIn.timestamp) / (1000 * 60);
          
          // 負の値や異常値のデータはスキップ
          if (dayMinutes < 0 || dayMinutes > 1440) { // 1440分 = 24時間
            return; // このdayの処理をスキップ
          }
          
          workDays++;
          staffTotalMinutes += dayMinutes;
          
          // 8時間を超える場合は残業
          if (dayMinutes > 480) {
            staffOvertimeMinutes += dayMinutes - 480;
          }
        }
      });

      const staffTotalHours = Math.floor(staffTotalMinutes / 60);
      const staffTotalMins = Math.floor(staffTotalMinutes % 60);
      const staffOvertimeHrs = Math.floor(staffOvertimeMinutes / 60);
      const staffOvertimeMins = Math.floor(staffOvertimeMinutes % 60);

      staffReports.push({
        staffId: staff._id,
        name: staff.name,
        employeeId: staff.employeeId,
        workDays,
        totalHours: `${staffTotalHours}時間${staffTotalMins}分`,
        overtimeHours: `${staffOvertimeHrs}時間${staffOvertimeMins}分`,
        lateCount: 0, // 遅刻判定は廃止
        earlyCount: 0, // 早退判定は廃止
      });

      // 全体統計に加算
      totalHours += staffTotalMinutes;
      totalWorkDays += workDays;
      totalOvertimeHours += staffOvertimeMinutes;
    }

    // 全体統計をフォーマット
    const totalHrs = Math.floor(totalHours / 60);
    const totalMins = Math.floor(totalHours % 60);
    const totalOvertimeHrs = Math.floor(totalOvertimeHours / 60);
    const totalOvertimeMins = Math.floor(totalOvertimeHours % 60);

    return {
      summary: {
        totalHours: `${totalHrs}時間${totalMins}分`,
        totalWorkDays,
        totalOvertimeHours: `${totalOvertimeHrs}時間${totalOvertimeMins}分`,
        totalLateEarly: 0, // 遅刻・早退判定は廃止
        totalStaff: staffList.length,
        averageVacationDays: 0, // 有給機能は今回は簡略化
      },
      staffReports,
      period: {
        startDate: args.startDate,
        endDate: args.endDate,
      },
    };
  },
});
