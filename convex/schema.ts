import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  staff: defineTable({
    name: v.string(),
    employeeId: v.string(),
    qrCode: v.optional(v.string()),
    email: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isActive: v.boolean(),
    createdBy: v.id("users"),
  })
    .index("by_created_by", ["createdBy"])
    .index("by_employee_id", ["employeeId"])
    .index("by_qr_code", ["qrCode"]),

  attendance: defineTable({
    staffId: v.id("staff"),
    type: v.union(v.literal("clock_in"), v.literal("clock_out")),
    timestamp: v.number(),
    status: v.union(
      v.literal("on_time"),
      v.literal("late"), // 既存データとの互換性のため（削除予定）
      v.literal("early"), // 既存データとの互換性のため（削除予定）
      v.literal("out_of_range"), // 既存データとの互換性のため（削除予定）
      v.literal("needs_review"), // 既存データとの互換性のため（削除予定）
      v.literal("normal") // 既存データとの互換性のため
    ),
    pairId: v.optional(v.string()), // 出勤・退勤のペアを識別するID
    note: v.optional(v.string()),
    isManualEntry: v.optional(v.boolean()),
    correctedAt: v.optional(v.number()),
    correctionReason: v.optional(v.string()),
    createdBy: v.id("users"),
  })
    .index("by_staff", ["staffId"])
    .index("by_date", ["timestamp"])
    .index("by_created_by", ["createdBy"])
    .index("by_staff_and_timestamp", ["staffId", "timestamp"])
    .index("by_pair_id", ["pairId"]),

  attendanceHistory: defineTable({
    attendanceId: v.id("attendance"),
    pairId: v.optional(v.string()),
    recordType: v.optional(v.union(v.literal("clock_in"), v.literal("clock_out"))),
    oldTimestamp: v.optional(v.number()),
    newTimestamp: v.optional(v.number()),
    oldNote: v.optional(v.string()),
    newNote: v.optional(v.string()),
    modifiedBy: v.id("users"),
    modifiedAt: v.number(),
  })
    .index("by_attendance", ["attendanceId"])
    .index("by_pair", ["pairId"])
    .index("by_modified_by", ["modifiedBy"]),

  qrAttendanceUrls: defineTable({
    name: v.string(),
    urlId: v.string(),
    isActive: v.boolean(),
    createdBy: v.id("users"),
  })
    .index("by_created_by", ["createdBy"])
    .index("by_url_id", ["urlId"]),

  workSettings: defineTable({
    name: v.string(),
    workHours: v.number(),
    breakHours: v.number(),
    isDefault: v.optional(v.boolean()),
    createdBy: v.id("users"),
  })
    .index("by_created_by", ["createdBy"])
    .index("by_name", ["name"]),

  appliedWorkSettings: defineTable({
    staffId: v.id("staff"),
    date: v.string(), // YYYY-MM-DD format
    workSettingId: v.id("workSettings"),
    isAutoAssigned: v.boolean(),
    createdBy: v.id("users"),
  })
    .index("by_staff_and_date", ["staffId", "date"])
    .index("by_created_by", ["createdBy"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
