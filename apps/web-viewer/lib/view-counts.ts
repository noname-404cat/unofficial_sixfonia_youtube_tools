// 再生数と再生差分の取得口。
//
// 中身はまだ無い。BigQuery に日次データが置いてあるので、YouTube API の
// スナップショットと同じく日次バッチで data/stats.json として書き出し、
// アプリはそれを読むだけにする予定。ブラウザから BigQuery は叩かない。
//
// ファイルが無い間は空を返す。BQ 側の抽出が入れば、呼び出し側を変えずに
// 値が入るようになる。

import { SNAPSHOT_BASE } from "./snapshot"

export interface ViewCountEntry {
  views: number
  /** 前日からの増加数 */
  diff1d?: number
}

/** data/stats.json の形（暫定。BQ側の抽出を作るときに確定させる） */
export interface StatsFile {
  updated_at: string
  stats: Record<string, ViewCountEntry>
}

export const STATS_URL = `${SNAPSHOT_BASE}/data/stats.json`

/**
 * videoId → 再生数。まだ配信されていなければ空の Map を返す。
 * 呼び出し側は「空でも動く」ことを前提にする。
 */
export async function fetchViewCounts(signal?: AbortSignal): Promise<Map<string, ViewCountEntry>> {
  try {
    const res = await fetch(STATS_URL, { signal })
    if (!res.ok) return new Map() // 404 = まだ用意されていない。エラーにしない
    const file = (await res.json()) as StatsFile
    return new Map(Object.entries(file.stats ?? {}))
  } catch {
    return new Map()
  }
}
