import { supabase } from './supabase'
import type { Tables, Inserts, Updates } from './supabase'

export type WorkSetting = Tables<'work_settings'>
export type WorkSettingInsert = Inserts<'work_settings'>
export type WorkSettingUpdate = Updates<'work_settings'>

/**
 * ユーザーの勤務設定一覧を取得
 */
export async function getWorkSettings(clerkUserId: string): Promise<WorkSetting[]> {
  const { data, error } = await supabase
    .from('work_settings')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching work settings:', error)
    throw new Error('勤務設定の取得に失敗しました')
  }

  return data || []
}

/**
 * 勤務設定を作成
 */
export async function createWorkSetting(clerkUserId: string, workSettingData: Omit<WorkSettingInsert, 'clerk_user_id'>): Promise<WorkSetting> {
  const { data, error } = await supabase
    .from('work_settings')
    .insert({
      ...workSettingData,
      clerk_user_id: clerkUserId
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating work setting:', error)
    throw new Error('勤務設定の作成に失敗しました')
  }

  return data
}

/**
 * 勤務設定を更新
 */
export async function updateWorkSetting(workSettingId: string, updates: WorkSettingUpdate): Promise<WorkSetting> {
  const { data, error } = await supabase
    .from('work_settings')
    .update(updates)
    .eq('id', workSettingId)
    .select()
    .single()

  if (error) {
    console.error('Error updating work setting:', error)
    throw new Error('勤務設定の更新に失敗しました')
  }

  return data
}

/**
 * 勤務設定を削除
 */
export async function deleteWorkSetting(workSettingId: string): Promise<void> {
  const { error } = await supabase
    .from('work_settings')
    .delete()
    .eq('id', workSettingId)

  if (error) {
    console.error('Error deleting work setting:', error)
    throw new Error('勤務設定の削除に失敗しました')
  }
}

/**
 * IDから勤務設定を取得
 */
export async function getWorkSettingById(workSettingId: string): Promise<WorkSetting | null> {
  const { data, error } = await supabase
    .from('work_settings')
    .select('*')
    .eq('id', workSettingId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error fetching work setting by ID:', error)
    throw new Error('勤務設定の取得に失敗しました')
  }

  return data
}

/**
 * デフォルトの勤務設定を作成
 */
export async function createDefaultWorkSettings(clerkUserId: string): Promise<WorkSetting[]> {
  const defaultSettings = [
    {
      name: '標準勤務',
      work_hours: 8.0,
      break_hours: 1.0,
      description: '一般的な8時間勤務（休憩1時間含む）',
      clerk_user_id: clerkUserId
    },
    {
      name: '短時間勤務',
      work_hours: 4.0,
      break_hours: 0.5,
      description: 'パートタイム勤務（休憩30分含む）',
      clerk_user_id: clerkUserId
    },
    {
      name: 'フレックス勤務',
      work_hours: 7.5,
      break_hours: 1.0,
      description: 'フレックスタイム制（休憩1時間含む）',
      clerk_user_id: clerkUserId
    }
  ]

  const { data, error } = await supabase
    .from('work_settings')
    .insert(defaultSettings)
    .select()

  if (error) {
    console.error('Error creating default work settings:', error)
    throw new Error('デフォルト勤務設定の作成に失敗しました')
  }

  return data || []
} 