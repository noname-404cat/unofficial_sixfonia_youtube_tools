// data/videos.json のスキーマ。生成側は sixfonia_analytics/snapshot.py。

export interface Video {
  videoId: string
  channel: string // config.CHANNELS の name（例 "hima72"）
  title: string
  publishedAt: string // ISO8601 UTC
  durationSec: number | null
  isShort: boolean
  thumbnail: string | null
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
