// 動画メタデータの型定義
export interface VideoMetadata {
  videoId: string
  title: string
  publishedAt: string
  thumbnailUrl: string
  channelTitle?: string
  character?: string
  isAvailable?: boolean
  tags?: string[]
  tagSource?: string
}

// パフォーマンス分析用の型定義
export interface VideoStats {
  videoId: string
  viewCount: number
  likeCount: number
  commentCount: number
  videoURL: string
}

export interface ProcessedData {
  label: string
  date: string
  data: VideoStats[]
  character?: string
}

export interface DailyMetric {
  day: string
  viewCount: number
  likeCount: number
  commentCount: number
}

export interface DailyDifference {
  fromDay: string
  toDay: string
  viewDiff: number
  likeDiff: number
  commentDiff: number
}

export interface AccelerationMetric {
  fromDiff: string
  toDiff: string
  viewDiffChange: number
  likeDiffChange: number
  commentDiffChange: number
}

export interface VideoAnalysis {
  videoId: string
  videoURL: string
  dailyMetrics: Record<string, DailyMetric>
  differences: readonly DailyDifference[]
  accelerations: readonly AccelerationMetric[]
  latestViewDiffChange: number | null
  latestLikeDiffChange: number | null
  rank: number
  details?: VideoMetadata
  character?: string
  isAvailable?: boolean
  tags?: string[]
  tagSource?: string
}

// 視聴履歴の型定義
export interface WatchHistoryEntry {
  header?: string
  title?: string
  titleUrl?: string
  subtitles?: Array<{
    name?: string
    url?: string
  }>
  time?: string
  products?: string[]
  activityControls?: string[]
}

// ソート関連の型定義
export type SortDirection = "asc" | "desc"

export interface SortState {
  field: string
  direction: SortDirection
}

// フィルター関連の型定義
export interface FilterState {
  searchTerm: string
  activeCharacter: string
  watchStatus: "all" | "watched" | "unwatched"
  watchCount: string
}
