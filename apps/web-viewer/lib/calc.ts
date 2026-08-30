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
 * Extract video IDs from watch history
 */
export function extractWatchedVideoIds(watchHistory: any[]) {
  const watchedIds = new Set<string>()
  const watchCounts: Record<string, number> = {}

  watchHistory.forEach((entry) => {
    if (entry && entry.titleUrl) {
      const match = entry.titleUrl.match(/[?&]v=([^&]+)/)
      if (match && match[1]) {
        const videoId = match[1]
        watchedIds.add(videoId)
        watchCounts[videoId] = (watchCounts[videoId] || 0) + 1
      }
    }
  })

  return { watchedIds, watchCounts }
}
