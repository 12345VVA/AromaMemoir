/**
 * 本地时区日期工具函数
 *
 * 使用 getFullYear/getMonth/getDate 而非 toISOString，
 * 避免 UTC 偏移导致中国时区（UTC+8）的"今日/本月"判断错位
 * （例：北京时间 00:30 时 toISOString 会返回前一日 16:30Z）。
 *
 * 说明：仅用于业务日期字符串（YYYY-MM-DD / YYYY-MM），
 * 数据库 datetime 字段存储仍由 TypeORM 自动处理时区。
 */

/**
 * 将 Date 格式化为本地 YYYY-MM-DD 字符串
 */
export function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 今天的 YYYY-MM-DD 字符串（本地时区）
 */
export function todayStr(): string {
  return formatDateStr(new Date());
}

/**
 * 当前月份的 YYYY-MM 字符串（本地时区）
 */
export function currentMonthStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * N 天前的 YYYY-MM-DD 字符串（n=0 即今天，n=1 即昨天）
 */
export function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDateStr(d);
}

/**
 * 本周一（自然周起点）的 YYYY-MM-DD 字符串
 * 周日 getDay()=0 视为 7，保证周一为起点
 */
export function mondayStr(): string {
  const now = new Date();
  const dayOfWeek = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1);
  return formatDateStr(monday);
}
