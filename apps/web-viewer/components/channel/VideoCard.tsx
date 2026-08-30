"use client"

import { memo, useMemo } from "react"
import Image from "next/image"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { VideoAnalysis, VideoMetadata } from "@/types/video"
import { formatJapaneseDate } from "@/lib/date"
import { getViewCountColor, getViewCountLabel } from "@/lib/view-count-utils"

interface VideoCardProps {
  video: VideoAnalysis | VideoMetadata
  watchCount: number
}

const VideoCard = memo<VideoCardProps>(function VideoCard({ video, watchCount }) {
  // 動画情報の取得（メモ化）
  const videoInfo = useMemo(() => {
    const getVideoTitle = () => {
      if ("details" in video && video.details) {
        return video.details.title || video.videoId
      }
      return video.title || video.videoId
    }

    const getVideoThumbnail = () => {
      if ("details" in video && video.details) {
        return video.details.thumbnailUrl || "/placeholder.svg"
      }
      return video.thumbnailUrl || "/placeholder.svg"
    }

    const getVideoPublishedAt = () => {
      if ("details" in video && video.details) {
        return video.details.publishedAt || ""
      }
      return video.publishedAt || ""
    }

    const getVideoURL = () => {
      if ("videoURL" in video) {
        return video.videoURL
      }
      return `https://www.youtube.com/watch?v=${video.videoId}`
    }

    const getVideoCharacter = () => {
      return "character" in video ? video.character : undefined
    }

    return {
      title: getVideoTitle(),
      thumbnail: getVideoThumbnail(),
      publishedAt: getVideoPublishedAt(),
      url: getVideoURL(),
      character: getVideoCharacter(),
    }
  }, [video])

  // 視聴回数のスタイル（メモ化）
  const watchCountStyle = useMemo(() => getViewCountColor(watchCount), [watchCount])

  // 視聴回数のラベル（メモ化）
  const watchCountLabel = useMemo(() => getViewCountLabel(watchCount), [watchCount])

  // アクセシビリティ用のラベル（メモ化）
  const cardLabel = useMemo(() => {
    const parts = [
      videoInfo.title,
      `投稿日: ${formatJapaneseDate(videoInfo.publishedAt)}`,
      `視聴状況: ${watchCountLabel}`,
    ]

    if (videoInfo.character) {
      parts.push(`チャンネル: ${videoInfo.character}`)
    }

    return parts.join(", ")
  }, [videoInfo, watchCountLabel])

  if (!video) return null

  return (
    <Card
      className="overflow-hidden hover:shadow-md transition-shadow focus-within:ring-2 focus-within:ring-blue-500"
      role="article"
      aria-label={cardLabel}
    >
      <a
        href={videoInfo.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset rounded-lg"
        aria-label={`動画を開く: ${videoInfo.title}`}
      >
        <div className="relative aspect-video">
          <Image
            src={videoInfo.thumbnail || "/placeholder.svg"}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            loading="lazy"
            aria-hidden="true"
          />
          {watchCount > 0 && (
            <div
              className={`absolute bottom-2 right-2 px-2 py-1 rounded text-xs font-medium text-white ${watchCountStyle
                .replace("text-", "bg-")
                .replace("600", "500")}`}
              aria-label={`${watchCount}回視聴済み`}
            >
              {watchCount}回視聴
            </div>
          )}
        </div>

        <CardContent className="p-3">
          <h3 className="font-medium line-clamp-2 text-sm h-10" title={videoInfo.title}>
            {videoInfo.title}
          </h3>
          <div className="flex items-center justify-between mt-2">
            <time
              className="text-xs text-muted-foreground"
              dateTime={videoInfo.publishedAt}
              aria-label={`投稿日: ${formatJapaneseDate(videoInfo.publishedAt)}`}
            >
              {formatJapaneseDate(videoInfo.publishedAt)}
            </time>
            {videoInfo.character && (
              <Badge variant="outline" className="text-xs" aria-label={`チャンネル: ${videoInfo.character}`}>
                {videoInfo.character}
              </Badge>
            )}
          </div>
        </CardContent>

        <CardFooter className="p-3 pt-0 flex justify-between items-center">
          <div className={`text-xs ${watchCountStyle}`} aria-label={`視聴状況: ${watchCountLabel}`}>
            {watchCountLabel}
          </div>
          {"details" in video && video.details?.channelTitle && (
            <span
              className="text-xs text-muted-foreground truncate max-w-[150px]"
              title={video.details.channelTitle}
              aria-label={`チャンネル名: ${video.details.channelTitle}`}
            >
              {video.details.channelTitle}
            </span>
          )}
        </CardFooter>
      </a>
    </Card>
  )
})

export default VideoCard
