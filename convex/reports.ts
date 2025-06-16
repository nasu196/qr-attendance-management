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

    // JST基準で期間の開始・終了を計算
    const startOfPeriod = new Date(args.startDate + 'T00:00:00+09:00').getTime();
    const endOfPeriod = new Date(args.endDate + 'T23:59:59+09:00').getTime();

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

    for (const staff of staffList) {
      const staffAttendance = attendanceRecords.filter(a => a.staffId === staff._id);
      
      // ペアIDベースでペアリング
      const pairRecords = new Map();
      staffAttendance.forEach(record => {
        const pairId = record.pairId || record._id;
        
        if (!pairRecords.has(pairId)) {
          pairRecords.set(pairId, { clockIn: null, clockOut: null });
        }
        
        const pair = pairRecords.get(pairId);
        if (record.type === "clock_in") {
          pair.clockIn = record;
        } else {
          pair.clockOut = record;
        }
      });

      // 統計を計算
      let workDays = 0;
      let staffTotalMinutes = 0;
      let staffOvertimeMinutes = 0;

      Array.from(pairRecords.values()).forEach(pair => {
        if (pair.clockIn && pair.clockOut) {
          const dayMinutes = (pair.clockOut.timestamp - pair.clockIn.timestamp) / (1000 * 60);
          
          // 負の値や異常値をチェック
          if (dayMinutes < 0 || dayMinutes > 24 * 60) {
            // データエラーの場合はスキップ
            return;
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
        totalStaff: staffList.length,
      },
      staffReports,
      period: {
        startDate: args.startDate,
        endDate: args.endDate,
      },
    };
  },
});
