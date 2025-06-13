import { formatInTimeZone, toDate } from 'date-fns-tz';

const TIME_ZONE = 'Asia/Tokyo';

/**
 * UTCタイムスタンプを指定したフォーマットのJST文字列に変換します。
 * @param timestamp - UTCのタイムスタンプ（数値）またはDateオブジェクト
 * @param formatStr - 書式 (例: 'yyyy/MM/dd HH:mm:ss')
 * @returns JSTに変換された日付/時刻文字列
 */
export const formatToJST = (timestamp: number | Date, formatStr: string): string => {
  return formatInTimeZone(timestamp, TIME_ZONE, formatStr);
};

/**
 * JSTの日付文字列/DateオブジェクトをUTCタイムスタンプ（数値）に変換します。
 * @param date - JSTの日付を表す文字列またはDateオブジェクト
 * @returns UTCのタイムスタンプ（数値）
 */
export const convertToUTC = (date: string | Date): number => {
  // toDateはタイムゾーンを考慮してDateオブジェクトに変換してくれる
  // 文字列の場合はローカルタイムゾーンとして解釈されるため注意が必要だが、
  // このプロジェクトではブラウザのタイムゾーンがJSTであることを前提とする。
  // より厳密には、完全なISO文字列（YYYY-MM-DDTHH:mm:ss）を渡すのが望ましい。
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return toDate(dateObj, { timeZone: TIME_ZONE }).getTime();
};

/**
 * JSTの特定の日付の開始時刻（00:00:00）のUTCタイムスタンプを取得します。
 * @param date - Dateオブジェクトまたはタイムスタンプ
 * @returns その日の始まりのUTCタイムスタンプ
 */
export const getStartOfJSTDay = (date: Date | number): number => {
    const jstDateStr = formatInTimeZone(date, TIME_ZONE, 'yyyy-MM-dd');
    return toDate(`${jstDateStr}T00:00:00`, { timeZone: TIME_ZONE }).getTime();
};

/**
 * JSTの特定の日付の終了時刻（23:59:59.999）のUTCタイムスタンプを取得します。
 * @param date - Dateオブジェクトまたはタイムスタンプ
 * @returns その日の終わりのUTCタイムスタンプ
 */
export const getEndOfJSTDay = (date: Date | number): number => {
    const jstDateStr = formatInTimeZone(date, TIME_ZONE, 'yyyy-MM-dd');
    return toDate(`${jstDateStr}T23:59:59.999`, { timeZone: TIME_ZONE }).getTime();
}; 