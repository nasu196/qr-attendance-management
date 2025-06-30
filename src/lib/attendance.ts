import { supabase } from './supabase'
import type { Tables, Inserts, Updates } from './supabase'

export type Attendance = Tables<'attendance'>
export type AttendanceInsert = Inserts<'attendance'>
export type AttendanceUpdate = Updates<'attendance'>

export interface AttendancePair {
  id: string
  staff_id: string
  date: string // YYYY-MM-DD
  clock_in?: Attendance
  clock_out?: Attendance
  total_hours?: number
  break_hours?: number
  overtime_hours?: number
}

export interface MonthlyAttendance {
  staff_id: string
  year: number
  month: number
  pairs: AttendancePair[]
  total_work_hours: number
  total_break_hours: number
  total_overtime_hours: number
  total_work_days: number
}

export interface AttendanceCorrection {
  id: string
  attendance_id: string
  old_timestamp: string
  new_timestamp: string
  reason: string
  corrected_by: string
  corrected_at: string
}

/**
 * 勤怠記録を作成
 */
export async function createAttendance(clerkUserId: string, attendanceData: Omit<AttendanceInsert, 'clerk_user_id'>): Promise<Attendance> {
  const { data, error } = await supabase
    .from('attendance')
    .insert({
      ...attendanceData,
      clerk_user_id: clerkUserId
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating attendance:', error)
    throw new Error('勤怠記録の作成に失敗しました')
  }

  return data
}

/**
 * QR打刻による勤怠記録
 */
export async function clockInOut(clerkUserId: string, qrCodeData: string, type: 'clock_in' | 'clock_out'): Promise<Attendance> {
  const pairId = type === 'clock_in' ? crypto.randomUUID() : undefined

  // QRコードからスタッフIDを取得
  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .select('id')
    .eq('qr_code_data', qrCodeData)
    .eq('is_active', true)
    .single()

  if (staffError || !staff) {
    throw new Error('有効なQRコードが見つかりません')
  }

  // 退勤の場合、最新の出勤記録を取得
  let finalPairId = pairId
  if (type === 'clock_out') {
    const { data: lastClockIn, error: lastError } = await supabase
      .from('attendance')
      .select('pair_id')
      .eq('clerk_user_id', clerkUserId)
      .eq('staff_id', staff.id)
      .eq('type', 'clock_in')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single()

    if (lastError || !lastClockIn) {
      throw new Error('対応する出勤記録が見つかりません')
    }

    finalPairId = lastClockIn.pair_id
  }

  const { data, error } = await supabase
    .from('attendance')
    .insert({
      clerk_user_id: clerkUserId,
      staff_id: staff.id,
      type,
      timestamp: new Date().toISOString(),
      pair_id: finalPairId,
      qr_code_data: qrCodeData
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating clock record:', error)
    throw new Error('打刻に失敗しました')
  }

  return data
}

/**
 * スタッフの月次勤怠データを取得
 */
export async function getStaffMonthlyAttendance(params: {
  clerkUserId: string
  staffId: string
  startOfMonth: string
  endOfMonth: string
}): Promise<MonthlyAttendance> {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('clerk_user_id', params.clerkUserId)
    .eq('staff_id', params.staffId)
    .gte('timestamp', params.startOfMonth)
    .lte('timestamp', params.endOfMonth)
    .order('timestamp', { ascending: true })

  if (error) {
    console.error('Error fetching monthly attendance:', error)
    throw new Error('月次勤怠データの取得に失敗しました')
  }

  // データをペアにグループ化
  const pairMap = new Map<string, AttendancePair>()
  
  for (const record of data) {
    const date = record.timestamp.split('T')[0]
    const pairKey = record.pair_id || `${record.staff_id}_${date}`
    
    if (!pairMap.has(pairKey)) {
      pairMap.set(pairKey, {
        id: pairKey,
        staff_id: record.staff_id,
        date: date
      })
    }
    
    const pair = pairMap.get(pairKey)!
    if (record.type === 'clock_in') {
      pair.clock_in = record
    } else {
      pair.clock_out = record
    }
  }

  // 勤務時間を計算
  const pairs = Array.from(pairMap.values())
  let totalWorkHours = 0
  let totalBreakHours = 0
  let totalOvertimeHours = 0
  let totalWorkDays = 0

  for (const pair of pairs) {
    if (pair.clock_in && pair.clock_out) {
      const clockInTime = new Date(pair.clock_in.timestamp)
      const clockOutTime = new Date(pair.clock_out.timestamp)
      const workHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60)
      
      pair.total_hours = workHours
      pair.break_hours = workHours > 6 ? 1 : 0 // 6時間超の場合1時間休憩
      pair.overtime_hours = Math.max(0, workHours - 8) // 8時間超の部分を残業
      
      totalWorkHours += workHours
      totalBreakHours += pair.break_hours
      totalOvertimeHours += pair.overtime_hours
      totalWorkDays++
    }
  }

  const date = new Date(params.startOfMonth)
  return {
    staff_id: params.staffId,
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    pairs: pairs.sort((a, b) => a.date.localeCompare(b.date)),
    total_work_hours: totalWorkHours,
    total_break_hours: totalBreakHours,
    total_overtime_hours: totalOvertimeHours,
    total_work_days: totalWorkDays
  }
}

/**
 * 勤怠記録を修正
 */
export async function correctAttendance(params: {
  attendanceId: string
  newTimestamp: string
  reason: string
  correctedBy: string
}): Promise<Attendance> {
  const { data, error } = await supabase
    .from('attendance')
    .update({
      timestamp: params.newTimestamp,
      is_corrected: true,
      correction_reason: params.reason,
      corrected_by: params.correctedBy,
      corrected_at: new Date().toISOString()
    })
    .eq('id', params.attendanceId)
    .select()
    .single()

  if (error) {
    console.error('Error correcting attendance:', error)
    throw new Error('勤怠記録の修正に失敗しました')
  }

  return data
}

/**
 * 勤怠ペアを削除
 */
export async function deletePair(pairId: string): Promise<void> {
  const { error } = await supabase
    .from('attendance')
    .delete()
    .eq('pair_id', pairId)

  if (error) {
    console.error('Error deleting attendance pair:', error)
    throw new Error('勤怠ペアの削除に失敗しました')
  }
}

/**
 * 新しい勤怠ペアを作成
 */
export async function createAttendancePair(params: {
  clerkUserId: string
  staffId: string
  clockInTime: string
  clockOutTime?: string
  qrCodeData: string
}): Promise<AttendancePair> {
  const pairId = crypto.randomUUID()
  const attendanceData = []

  // 出勤記録
  attendanceData.push({
    clerk_user_id: params.clerkUserId,
    staff_id: params.staffId,
    type: 'clock_in' as const,
    timestamp: params.clockInTime,
    pair_id: pairId,
    qr_code_data: params.qrCodeData
  })

  // 退勤記録（もしあれば）
  if (params.clockOutTime) {
    attendanceData.push({
      clerk_user_id: params.clerkUserId,
      staff_id: params.staffId,
      type: 'clock_out' as const,
      timestamp: params.clockOutTime,
      pair_id: pairId,
      qr_code_data: params.qrCodeData
    })
  }

  const { data, error } = await supabase
    .from('attendance')
    .insert(attendanceData)
    .select()

  if (error) {
    console.error('Error creating attendance pair:', error)
    throw new Error('勤怠ペアの作成に失敗しました')
  }

  // レスポンスをペア形式に変換
  const pair: AttendancePair = {
    id: pairId,
    staff_id: params.staffId,
    date: params.clockInTime.split('T')[0]
  }

  for (const record of data) {
    if (record.type === 'clock_in') {
      pair.clock_in = record
    } else {
      pair.clock_out = record
    }
  }

  return pair
}

/**
 * 修正履歴を取得
 */
export async function getCorrectionHistory(clerkUserId: string, staffId: string): Promise<AttendanceCorrection[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .eq('staff_id', staffId)
    .eq('is_corrected', true)
    .order('corrected_at', { ascending: false })

  if (error) {
    console.error('Error fetching correction history:', error)
    throw new Error('修正履歴の取得に失敗しました')
  }

  return data.map(record => ({
    id: record.id,
    attendance_id: record.id,
    old_timestamp: '', // 元の時刻は保存していない
    new_timestamp: record.timestamp,
    reason: record.correction_reason || '',
    corrected_by: record.corrected_by || '',
    corrected_at: record.corrected_at || ''
  }))
}

/**
 * 勤怠データの検証
 */
export function validateAttendanceData(pairs: AttendancePair[]): {
  errors: Array<{
    pairId: string
    date: string
    message: string
    type: 'warning' | 'error'
  }>
} {
  const errors = []

  for (const pair of pairs) {
    // 24時間以上の勤務チェック
    if (pair.total_hours && pair.total_hours > 24) {
      errors.push({
        pairId: pair.id,
        date: pair.date,
        message: '24時間以上の勤務時間が記録されています',
        type: 'error' as const
      })
    }

    // 出勤のみで退勤がないチェック
    if (pair.clock_in && !pair.clock_out) {
      errors.push({
        pairId: pair.id,
        date: pair.date,
        message: '退勤記録がありません',
        type: 'warning' as const
      })
    }

    // 短時間勤務チェック（1時間未満）
    if (pair.total_hours && pair.total_hours < 1) {
      errors.push({
        pairId: pair.id,
        date: pair.date,
        message: '勤務時間が1時間未満です',
        type: 'warning' as const
      })
    }
  }

  return { errors }
} 