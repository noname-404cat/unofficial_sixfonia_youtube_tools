// data/videos.json のスキーマ。生成側は sixfonia_analytics/snapshot.py。

export interface Video {
  videoId: string
  channel: string // config.CHANNELS の name（例 "hima72"）
  title: string
  publishedAt: string // ISO8601 UTC
  durationSec: number | null
  isShort: boolean
  thumbnail: string | null
  tags: string[]
  available: boolean
  // 再生数は BigQuery 由来の data/stats.json から後で入る（未実装）
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
  videos: Video[]
}
