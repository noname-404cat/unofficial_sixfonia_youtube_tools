import type { VideoAnalysis } from "@/types/video"

/**
 * Calculate daily differences between consecutive days
 */
export function calculateDifferences(dailyMetrics: Record<string, any>) {
  const days = Object.keys(dailyMetrics).sort()
  const differences = []

  for (let i = 0; i < days.length - 1; i++) {
    const prevDay = days[i]
    const currDay = days[i + 1]

    if (dailyMetrics[prevDay] && dailyMetrics[currDay]) {
      differences.push({
        fromDay: prevDay,
        toDay: currDay,
        viewDiff: dailyMetrics[currDay].viewCount - dailyMetrics[prevDay].viewCount,
        likeDiff: dailyMetrics[currDay].likeCount - dailyMetrics[prevDay].likeCount,
        commentDiff: dailyMetrics[currDay].commentCount - dailyMetrics[prevDay].commentCount,
      })
    }
  }

  return differences
}

/**
 * Calculate accelerations (differences of differences)
 */
export function calculateAccelerations(differences: any[]) {
  const accelerations = []

  for (let i = 0; i < differences.length - 1; i++) {
    accelerations.push({
      fromDiff: `${differences[i].fromDay}-${differences[i].toDay}`,
      toDiff: `${differences[i + 1].fromDay}-${differences[i + 1].toDay}`,
      viewDiffChange: differences[i + 1].viewDiff - differences[i].viewDiff,
      likeDiffChange: differences[i + 1].likeDiff - differences[i].likeDiff,
      commentDiffChange: differences[i + 1].commentDiff - differences[i].commentDiff,
    })
  }

  return accelerations
}

/**
 * Calculate video rankings based on view acceleration
 */
export function calculateRankings(videos: VideoAnalysis[]) {
  // Filter videos with acceleration data
  const videosWithAcceleration = videos.filter((video) => video.latestViewDiffChange !== null)

  // Sort by latest view diff change (descending)
  const sortedVideos = [...videosWithAcceleration].sort(
    (a, b) => (b.latestViewDiffChange || 0) - (a.latestViewDiffChange || 0),
  )

  // Assign ranks
  sortedVideos.forEach((video, index) => {
    video.rank = index + 1
  })

  // Handle videos without acceleration data
  const videosWithoutAcceleration = videos.filter((video) => video.latestViewDiffChange === null)
  videosWithoutAcceleration.forEach((video) => {
    video.rank = sortedVideos.length + 1
  })

  return [...sortedVideos, ...videosWithoutAcceleration]
}

/**
 * Process CSV data into daily metrics
 */
export function processCSVData(parsedData: any[], date: string, character?: string) {
  return parsedData.map((row) => ({
    videoId: row.videoId || "",
    viewCount: Number.parseInt(row.viewCount, 10) || 0,
    likeCount: Number.parseInt(row.likeCount, 10) || 0,
    commentCount: Number.parseInt(row.commentCount, 10) || 0,
    videoURL: row.videoURL || `https://www.youtube.com/watch?v=${row.videoId}`,
    character,
  }))
}

/**
 * 視聴履歴から動画IDと視聴回数を取り出す。
 *
 * - 動画IDは11文字固定で照合する。以前は /[?&]v=([^&]+)/ という緩い形で、
 *   後続パラメータを巻き込んだIDを拾うことがあった。
 * - コミュニティ投稿（/post/ 配下）は titleUrl に動画IDが無いので自然に落ちる。
 *   本文が丸ごと title に入るため、混ざると集計が壊れる。
 * - 視聴期間も返す。履歴には保存期間があり、それ以前に見た動画は
 *   「未視聴」に見えてしまうので、画面に但し書きを出すために使う。
 */
const VIDEO_ID_PATTERNS = [
  /[?&]v=([A-Za-z0-9_-]{11})/,
  /youtu\.be\/([A-Za-z0-9_-]{11})/,
  /\/shorts\/([A-Za-z0-9_-]{11})/,
  /\/live\/([A-Za-z0-9_-]{11})/,
]

export function extractVideoId(url: unknown): string | null {
  if (typeof url !== "string" || !url) return null
  for (const pattern of VIDEO_ID_PATTERNS) {
    const m = url.match(pattern)
    if (m) return m[1]
  }
  return null
}

export interface WatchHistorySummary {
  watchedIds: Set<string>
  watchCounts: Record<string, number>
  /** 履歴がカバーする期間（ISO文字列）。取れなければ null */
  firstAt: string | null
  lastAt: string | null
}

export function extractWatchedVideoIds(watchHistory: any[]): WatchHistorySummary {
  const watchedIds = new Set<string>()
  const watchCounts: Record<string, number> = {}
  let firstAt: string | null = null
  let lastAt: string | null = null

  for (const entry of watchHistory ?? []) {
    const videoId = extractVideoId(entry?.titleUrl)
    if (!videoId) continue

    watchedIds.add(videoId)
    watchCounts[videoId] = (watchCounts[videoId] || 0) + 1

    const time = typeof entry?.time === "string" ? entry.time : null
    if (time) {
      if (firstAt === null || time < firstAt) firstAt = time
      if (lastAt === null || time > lastAt) lastAt = time
    }
  }

  return { watchedIds, watchCounts, firstAt, lastAt }
}
