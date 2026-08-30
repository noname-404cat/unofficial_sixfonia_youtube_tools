/**
 * 数値フォーマット関数
 */
export function formatNumber(num: number | null): string {
  if (num === null) return "N/A"
  return num.toLocaleString()
}

export function formatChange(num: number | null): string {
  if (num === null) return "N/A"
  return (num > 0 ? "+" : "") + num.toLocaleString()
}

export function formatViewCount(count: number | null): string {
  if (count === null) return "—"
  return count.toLocaleString()
}
