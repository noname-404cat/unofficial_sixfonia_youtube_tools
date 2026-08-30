// 動画マスタのスナップショットを読み、期間ごとに振り分ける。
//
// YouTube Data API は呼ばない。元実装は search.list を7チャンネル分、
// ページを開くたびに叩いていた（100 units × 7 = 700 units/表示）。
// スナップショットは GitHub Actions が1日1回だけ生成する。

import raw from "../public/data/videos.json"
import { jstDayIndex, startOfMonthIndex, startOfWeekIndex } from "./date-utils"
import type { Snapshot, Video } from "@/types/video"

const snapshot = raw as Snapshot

export type BucketKey = "yesterday" | "thisWeek" | "thisMonth"

export interface Buckets {
  yesterday: Video[]
  thisWeek: Video[]
  thisMonth: Video[]
}

export const BUCKET_LABELS: Record<BucketKey, string> = {
  yesterday: "昨日",
  thisWeek: "今週",
  thisMonth: "今月",
}

export function getSnapshot(): Snapshot {
  return snapshot
}

/** スナップショットが古いままかどうか。Actions が失敗しても気づけるように使う。 */
export function isStale(updatedAt: string, hours = 36, now: Date = new Date()): boolean {
  const updated = new Date(updatedAt)
  if (Number.isNaN(updated.getTime())) return true
  return now.getTime() - updated.getTime() > hours * 60 * 60 * 1000
}

/**
 * 投稿日で3区分に振り分ける。
 *
 *   昨日 : 昨日1日ぶん
 *   今週 : 月曜起点。昨日を除く（今日ぶんが万一あればここに入る）
 *   今月 : 月初から今週の月曜の前日まで
 *
 * 「今日」の区分は作らない。今日の動画は YouTube を開けばすぐ見られるうえ、
 * スナップショットは夜のバッチなのでその日の分をまだ持っていない。
 *
 * 公開予約・プレミア公開で publishedAt が未来のものは除外する。
 */
export function bucketVideos(videos: Video[], now: Date = new Date()): Buckets {
  const today = jstDayIndex(now)
  const yesterday = today - 1
  const weekStart = startOfWeekIndex(now)
  const monthStart = startOfMonthIndex(now)

  const buckets: Buckets = { yesterday: [], thisWeek: [], thisMonth: [] }

  for (const video of videos) {
    if (!video.publishedAt) continue
    const published = new Date(video.publishedAt)
    if (Number.isNaN(published.getTime())) continue

    const day = jstDayIndex(published)
    if (day > today) continue // 未公開（予約・プレミア）

    if (day === yesterday) buckets.yesterday.push(video)
    else if (day >= weekStart) buckets.thisWeek.push(video)
    else if (day >= monthStart) buckets.thisMonth.push(video)
  }

  const byNewest = (a: Video, b: Video) =>
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  buckets.yesterday.sort(byNewest)
  buckets.thisWeek.sort(byNewest)
  buckets.thisMonth.sort(byNewest)

  return buckets
}

/** チャンネル名（config の name）→ 表示名。 */
export function displayNames(snap: Snapshot): Record<string, string> {
  return Object.fromEntries(snap.channels.map((c) => [c.name, c.display]))
}
