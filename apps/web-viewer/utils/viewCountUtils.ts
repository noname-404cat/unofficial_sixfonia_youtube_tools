// 視聴回数に基づいた色とラベルを取得するユーティリティ関数

// 視聴回数の範囲を定義
export const VIEW_COUNT_RANGES = {
  HIGH: 10, // 10回以上は「よく見た」
  MEDIUM: 5, // 5-9回は「複数回視聴」
  LOW: 1, // 1-4回は「視聴済み」
  NONE: 0, // 0回は「未視聴」
}

// 視聴回数に基づいた色を返す関数
export function getViewCountColor(count: number | null): string {
  if (count === null) return "text-gray-400"
  if (count >= VIEW_COUNT_RANGES.HIGH) return "text-green-600 font-bold"
  if (count >= VIEW_COUNT_RANGES.MEDIUM) return "text-blue-600"
  if (count >= VIEW_COUNT_RANGES.LOW) return "text-amber-600"
  return "text-red-600"
}

// 視聴回数に基づいたラベルを返す関数
export function getViewCountLabel(count: number | null): string {
  if (count === null) return "—"
  if (count >= VIEW_COUNT_RANGES.HIGH) return "よく見た"
  if (count >= VIEW_COUNT_RANGES.MEDIUM) return "複数回視聴"
  if (count >= VIEW_COUNT_RANGES.LOW) return "視聴済み"
  return "未視聴"
}

// 視聴回数に基づいたバッジの種類を返す関数
export function getViewCountBadgeVariant(count: number | null): "default" | "secondary" | "outline" | "destructive" {
  if (count === null) return "outline"
  if (count >= VIEW_COUNT_RANGES.HIGH) return "default"
  if (count >= VIEW_COUNT_RANGES.MEDIUM) return "secondary"
  if (count >= VIEW_COUNT_RANGES.LOW) return "outline"
  return "destructive"
}

// 視聴回数のフォーマット関数
export function formatViewCount(count: number | null): string {
  if (count === null) return "—"
  return count.toLocaleString()
}
