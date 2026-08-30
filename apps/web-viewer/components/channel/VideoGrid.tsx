"use client"

import type { VideoAnalysis, VideoMetadata } from "@/types/video"
import VideoCard from "./VideoCard"

interface VideoGridProps {
  videos: (VideoAnalysis | VideoMetadata)[]
  watchCountByVideoId: Record<string, number>
  emptyMessage?: string
}

export default function VideoGrid({ videos, watchCountByVideoId, emptyMessage = "動画がありません" }: VideoGridProps) {
  if (videos.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">{emptyMessage}</div>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {videos.map((video) => (
        <VideoCard key={video.videoId} video={video} watchCount={watchCountByVideoId[video.videoId] || 0} />
      ))}
    </div>
  )
}
