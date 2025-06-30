import { supabase } from './supabase'
import type { Tables, Inserts, Updates } from './supabase'

// 拡張されたStaff型（employee_idプロパティを含む）
export interface Staff extends Omit<Tables<'staff'>, 'employee_id'> {
  employee_id: string
}

export type StaffInsert = Inserts<'staff'>
export type StaffUpdate = Updates<'staff'>

/**
 * ユーザーのスタッフ一覧を取得（Clerk User IDを直接使用）
 */
export async function getStaff(clerkUserId: string): Promise<Staff[]> {
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching staff:', error)
    throw new Error('スタッフ一覧の取得に失敗しました')
  }

  return data || []
}

/**
 * スタッフを作成
 */
export async function createStaff(clerkUserId: string, staffData: Omit<StaffInsert, 'clerk_user_id'>): Promise<Staff> {
  const { data, error } = await supabase
    .from('staff')
    .insert({
      ...staffData,
      clerk_user_id: clerkUserId
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating staff:', error)
    throw new Error('スタッフの作成に失敗しました')
  }

  return data
}

/**
 * スタッフを更新
 */
export async function updateStaff(staffId: string, updates: StaffUpdate): Promise<Staff> {
  const { data, error } = await supabase
    .from('staff')
    .update(updates)
    .eq('id', staffId)
    .select()
    .single()

  if (error) {
    console.error('Error updating staff:', error)
    throw new Error('スタッフの更新に失敗しました')
  }

  return data
}

/**
 * スタッフを削除（論理削除）
 */
export async function deleteStaff(staffId: string): Promise<void> {
  const { error } = await supabase
    .from('staff')
    .update({ is_active: false })
    .eq('id', staffId)

  if (error) {
    console.error('Error deleting staff:', error)
    throw new Error('スタッフの削除に失敗しました')
  }
}

/**
 * 複数スタッフの一括更新
 */
export async function bulkUpdateStaff(staffIds: string[], updates: Partial<StaffUpdate>): Promise<void> {
  const { error } = await supabase
    .from('staff')
    .update(updates)
    .in('id', staffIds)

  if (error) {
    console.error('Error bulk updating staff:', error)
    throw new Error('スタッフの一括更新に失敗しました')
  }
}

/**
 * QRコードデータからスタッフを取得
 */
export async function getStaffByQRCode(qrCodeData: string): Promise<Staff | null> {
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .eq('qr_code_data', qrCodeData)
    .eq('is_active', true)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error fetching staff by QR code:', error)
    throw new Error('QRコードによるスタッフ取得に失敗しました')
  }

  return data
}

/**
 * Employee IDからスタッフを取得
 */
export async function getStaffByEmployeeId(clerkUserId: string, employeeId: string): Promise<Staff | null> {
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .eq('employee_id', employeeId)
    .eq('is_active', true)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error fetching staff by employee ID:', error)
    throw new Error('従業員IDによるスタッフ取得に失敗しました')
  }

  return data
}

/**
 * ダミーデータを作成
 */
export async function createDummyStaff(clerkUserId: string): Promise<Staff[]> {
  const dummyStaffData = [
    {
      name: '田中 太郎',
      qr_code_data: `QR_TANAKA_${Date.now()}`,
      employee_id: 'EMP-0001',
      tags: ['営業部', '正社員'],
      clerk_user_id: clerkUserId
    },
    {
      name: '佐藤 花子',
      qr_code_data: `QR_SATO_${Date.now()}`,
      employee_id: 'EMP-0002',
      tags: ['開発部', 'パート'],
      clerk_user_id: clerkUserId
    },
    {
      name: '鈴木 次郎',
      qr_code_data: `QR_SUZUKI_${Date.now()}`,
      employee_id: 'EMP-0003',
      tags: ['デザイン部', '契約社員'],
      clerk_user_id: clerkUserId
    },
    {
      name: '高橋 美咲',
      qr_code_data: `QR_TAKAHASHI_${Date.now()}`,
      employee_id: 'EMP-0004',
      tags: ['人事部', 'フリーランス'],
      clerk_user_id: clerkUserId
    },
    {
      name: '伊藤 健一',
      qr_code_data: `QR_ITO_${Date.now()}`,
      employee_id: 'EMP-0005',
      tags: ['マーケティング部', 'アルバイト'],
      clerk_user_id: clerkUserId
    },
    {
      name: '渡辺 さくら',
      qr_code_data: `QR_WATANABE_${Date.now()}`,
      employee_id: 'EMP-0006',
      tags: ['営業部', 'インターン'],
      clerk_user_id: clerkUserId
    },
    {
      name: '山田 大輔',
      qr_code_data: `QR_YAMADA_${Date.now()}`,
      employee_id: 'EMP-0007',
      tags: ['開発部', '正社員'],
      clerk_user_id: clerkUserId
    },
    {
      name: '中村 愛',
      qr_code_data: `QR_NAKAMURA_${Date.now()}`,
      employee_id: 'EMP-0008',
      tags: ['デザイン部', 'パート'],
      clerk_user_id: clerkUserId
    },
    {
      name: '小林 翔太',
      qr_code_data: `QR_KOBAYASHI_${Date.now()}`,
      employee_id: 'EMP-0009',
      tags: ['人事部', '正社員'],
      clerk_user_id: clerkUserId
    },
    {
      name: '加藤 恵',
      qr_code_data: `QR_KATO_${Date.now()}`,
      employee_id: 'EMP-0010',
      tags: ['マーケティング部', '契約社員'],
      clerk_user_id: clerkUserId
    }
  ]

  const { data, error } = await supabase
    .from('staff')
    .insert(dummyStaffData)
    .select()

  if (error) {
    console.error('Error creating dummy staff:', error)
    throw new Error('ダミーデータの作成に失敗しました')
  }

  return data || []
}

/**
 * ダミー勤怠データを作成（2025年6月）
 */
export async function createDummyAttendanceData(clerkUserId: string): Promise<void> {
  const staff = await getStaff(clerkUserId)
  
  if (staff.length === 0) {
    throw new Error('スタッフが見つかりません。先にスタッフを作成してください。')
  }

  const attendanceData = []
  const year = 2025
  const month = 6
  const daysInMonth = new Date(year, month, 0).getDate() // 2025年6月の日数

  for (const staffMember of staff) {
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day)
      const isWeekend = date.getDay() === 0 || date.getDay() === 6
      
      // 平日80%、土日20%の確率で出勤
      const shouldAttend = Math.random() < (isWeekend ? 0.2 : 0.8)
      
      if (shouldAttend) {
        // 出勤時刻: 8:30〜10:00のランダム
        const clockInHour = 8 + Math.floor(Math.random() * 2)
        const clockInMinute = Math.floor(Math.random() * 60)
        const clockInTime = new Date(year, month - 1, day, clockInHour, clockInMinute)
        
        const pairId = crypto.randomUUID()
        
        // 出勤記録
        attendanceData.push({
          clerk_user_id: clerkUserId,
          staff_id: staffMember.id,
          type: 'clock_in',
          timestamp: clockInTime.toISOString(),
          pair_id: pairId,
          qr_code_data: staffMember.qr_code_data
        })
        
        // 退勤記録を80%の確率で追加
        if (Math.random() < 0.8) {
          // 退勤時刻: 17:00〜21:00のランダム
          const clockOutHour = 17 + Math.floor(Math.random() * 4)
          const clockOutMinute = Math.floor(Math.random() * 60)
          const clockOutTime = new Date(year, month - 1, day, clockOutHour, clockOutMinute)
          
          attendanceData.push({
            clerk_user_id: clerkUserId,
            staff_id: staffMember.id,
            type: 'clock_out',
            timestamp: clockOutTime.toISOString(),
            pair_id: pairId,
            qr_code_data: staffMember.qr_code_data
          })
        }
      }
    }
  }

  if (attendanceData.length > 0) {
    const { error } = await supabase
      .from('attendance')
      .insert(attendanceData)

    if (error) {
      console.error('Error creating dummy attendance data:', error)
      throw new Error('ダミー勤怠データの作成に失敗しました')
    }
  }
} 