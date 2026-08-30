"use client"

import type { VideoAnalysis, VideoMetadata } from "@/types/video"
import { formatNumber } from "@/hooks/useVideoData"
import { VIEW_COUNT_RANGES } from "@/utils/viewCountUtils"

interface ChannelStatsProps {
  videos: (VideoAnalysis | VideoMetadata)[]
  watchCountByVideoId: Record<string, number>
}

export default function ChannelStats({ videos, watchCountByVideoId }: ChannelStatsProps) {
  if (!videos || videos.length === 0) {
    return <div className="text-center py-4 text-muted-foreground">このチャンネルの統計情報はありません</div>
  }

  // 現在表示されているチャンネル内の動画IDのみを対象にする
  const channelVideoIds = videos.map((video) => video.videoId)

  // 総視聴回数（チャンネル内のみ）
  const totalWatchCount = channelVideoIds.reduce((sum, videoId) => {
    return sum + (watchCountByVideoId[videoId] || 0)
  }, 0)

  // 視聴済み動画数（チャンネル内のみ）
  const watchedVideosCount = channelVideoIds.filter(
    (videoId) => watchCountByVideoId[videoId] && watchCountByVideoId[videoId] > 0,
  ).length

  // 未視聴動画数（チャンネル内のみ）
  const unwatchedVideosCount = videos.length - watchedVideosCount

  // よく見た動画数（10回以上）（チャンネル内のみ）
  const frequentlyWatchedCount = channelVideoIds.filter(
    (videoId) => watchCountByVideoId[videoId] && watchCountByVideoId[videoId] >= VIEW_COUNT_RANGES.HIGH,
  ).length

  // 視聴率（チャンネル内のみ）
  const watchRate = videos.length > 0 ? Math.round((watchedVideosCount / videos.length) * 100) : 0

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="text-sm text-muted-foreground">総視聴回数</div>
        <div className="text-2xl font-bold">{formatNumber(totalWatchCount)}</div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="text-sm text-muted-foreground">視聴済み動画</div>
        <div className="text-2xl font-bold">
          {watchedVideosCount} <span className="text-sm font-normal text-muted-foreground">/ {videos.length}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">視聴率 {watchRate}%</div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="text-sm text-muted-foreground">未視聴動画</div>
        <div className="text-2xl font-bold">{unwatchedVideosCount}</div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="text-sm text-muted-foreground">よく見た動画</div>
        <div className="text-2xl font-bold">{frequentlyWatchedCount}</div>
        <div className="text-xs text-muted-foreground mt-1">{VIEW_COUNT_RANGES.HIGH}回以上視聴</div>
      </div>
    </div>
  )
}
