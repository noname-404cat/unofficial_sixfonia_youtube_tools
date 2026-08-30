// JST（Asia/Tokyo）での日付計算。
//
// 元実装は new Date(Date.now() + jstOffset) に対して getFullYear() などの
// ローカルタイム系メソッドを使っていた。UTC で動く Vercel 上ではたまたま
// 正しく動くが、JST の開発機では9時間ずれる。
// ここでは「9時間ずらしたうえで getUTC* で読む」形に統一する。
// JST にサマータイムは無いので、この固定オフセットで正しい。

const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** JST の暦日を表す通し番号。日付の比較はすべてこの整数で行う。 */
export function jstDayIndex(date: Date): number {
  return Math.floor((date.getTime() + JST_OFFSET_MS) / DAY_MS)
}

/** JST の年・月（0始まり）・日・曜日（0=日曜）を取り出す。 */
export function jstParts(date: Date) {
  const shifted = new Date(date.getTime() + JST_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  }
}

/** その月の1日の dayIndex。 */
export function startOfMonthIndex(date: Date): number {
  const { year, month } = jstParts(date)
  return Math.floor(Date.UTC(year, month, 1) / DAY_MS)
}

/** 月曜起点の週の初日の dayIndex。元実装のローリング7日から変更した箇所。 */
export function startOfWeekIndex(date: Date): number {
  const { weekday } = jstParts(date)
  const daysSinceMonday = (weekday + 6) % 7 // 日曜=6, 月曜=0
  return jstDayIndex(date) - daysSinceMonday
}

/** 表示用。"2026/08/30 20:00" */
export function formatJapanDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(date)
}

/** 「3日前」のような相対表記。 */
export function relativeDays(value: string | Date, now: Date = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ""
  const diff = jstDayIndex(now) - jstDayIndex(date)
  if (diff <= 0) return "今日"
  if (diff === 1) return "昨日"
  return `${diff}日前`
}
