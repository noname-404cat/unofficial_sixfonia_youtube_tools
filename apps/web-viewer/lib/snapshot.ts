// 7チャンネルの動画マスタ。新着一覧アプリが配信している静的JSONを読む。
//
// 以前はブラウザから YouTube Data API を叩いて videoId をタイトルやサムネイルに
// 変換していたが、そのためだけに API キーをクライアントへ配る必要があった。
// マスタは日次バッチが作っているので、それを読めばキーは要らない。

import type { VideoAnalysis, VideoMetadata } from "@/types/video"

export interface SnapshotVideo {
  videoId: string
  channel: string // config.CHANNELS の name（例 "hima72"）
  title: string
  publishedAt: string // ISO8601 UTC
  durationSec: number | null
  isShort: boolean
  thumbnail: string | null
  tags: string[]
  available: boolean
  // 再生数は BigQuery 由来の data/stats.json から入る（lib/view-counts.ts）
  viewCount?: number
  viewDiff?: number
}

export interface ChannelEntry {
  name: string
  display: string
  channelId: string
}

export interface Snapshot {
  updated_at: string
  channels: ChannelEntry[]
  videos: SnapshotVideo[]
}

/** 配信元。新着一覧アプリが /data/ 以下を CORS 許可付きで配っている。 */
export const SNAPSHOT_BASE =
  process.env.NEXT_PUBLIC_SNAPSHOT_BASE ?? "https://unofficial-sixfonia-youtube-tools.vercel.app"

export const SNAPSHOT_URL = `${SNAPSHOT_BASE}/data/videos.json`

export async function fetchSnapshot(signal?: AbortSignal): Promise<Snapshot> {
  const res = await fetch(SNAPSHOT_URL, { signal })
  if (!res.ok) {
    throw new Error(`動画マスタを取得できませんでした (HTTP ${res.status})`)
  }
  return (await res.json()) as Snapshot
}

/** videoId → 動画。視聴履歴やCSVの videoId をメタデータに変換するのに使う。 */
export function videoMap(snapshot: Snapshot): Map<string, SnapshotVideo> {
  return new Map(snapshot.videos.map((v) => [v.videoId, v]))
}

/** チャンネル名 → 表示名。表示名の定義はスナップショットを唯一の正とする。 */
export function displayNames(snapshot: Snapshot): Record<string, string> {
  return Object.fromEntries(snapshot.channels.map((c) => [c.name, c.display]))
}

/**
 * 日次統計CSVのファイル名の接頭辞 → 表示名。
 * 例: "hima72_video_statistics_20260830.csv" → "暇72"
 * 以前はこの対応表をコードに直書きしていたが、チャンネルが増減するたびに
 * 複数箇所を直す必要があったのでスナップショットから作る。
 */
export function filenamePrefixMap(snapshot: Snapshot): Record<string, string> {
  return Object.fromEntries(snapshot.channels.map((c) => [`${c.name}_`, c.display]))
}

/** 既存の VideoMetadata 型へ変換する。API から取っていたものと同じ形にする。 */
export function toVideoMetadata(video: SnapshotVideo, display: string): VideoMetadata {
  return {
    videoId: video.videoId,
    title: video.title,
    publishedAt: video.publishedAt,
    thumbnailUrl: video.thumbnail ?? "/placeholder.svg",
    channelTitle: display,
    character: display,
    isAvailable: video.available,
    tags: video.tags,
    tagSource: "snapshot",
  }
}

/**
 * 一覧テーブルが期待する VideoAnalysis 形へ変換する。
 *
 * テーブルの行は CSV 由来の VideoAnalysis 専用に書かれており、
 * dailyMetrics や details が無いオブジェクトを渡すと落ちる。
 * 動画マスタには日次の再生数が無いので、その部分は空で埋める。
 * 再生数は CSV をアップロードしたときに上書きされる
 * （将来は BigQuery 由来の data/stats.json が入る）。
 */
export function toVideoAnalysis(video: SnapshotVideo, display: string): VideoAnalysis {
  return {
    videoId: video.videoId,
    videoURL: `https://www.youtube.com/watch?v=${video.videoId}`,
    dailyMetrics: {},
    differences: [],
    accelerations: [],
    latestViewDiffChange: null,
    latestLikeDiffChange: null,
    rank: 0,
    details: toVideoMetadata(video, display),
    character: display,
    isAvailable: video.available,
    tags: video.tags,
    tagSource: "snapshot",
  }
}

/** マスタが古いままかどうか。日次バッチが失敗しても気づけるようにする。 */
export function isStale(updatedAt: string, hours = 36, now: Date = new Date()): boolean {
  const updated = new Date(updatedAt)
  if (Number.isNaN(updated.getTime())) return true
  return now.getTime() - updated.getTime() > hours * 60 * 60 * 1000
}
