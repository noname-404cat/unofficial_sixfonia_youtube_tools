import Image from "next/image"
import type { Video } from "@/types/video"
import { formatJapanDate, relativeDays } from "@/lib/date-utils"

interface VideoCardProps {
  video: Video
  channelTitle: string
}

export function VideoCard({ video, channelTitle }: VideoCardProps) {
  const href = `https://www.youtube.com/watch?v=${video.videoId}`

  return (
    <div className="flex gap-4 rounded-md border border-gray-700 p-4 hover:bg-gray-800">
      <a href={href} target="_blank" rel="noopener noreferrer" className="shrink-0">
        <div className="relative h-[90px] w-40 overflow-hidden rounded-md bg-gray-800">
          <Image
            src={video.thumbnail || "/placeholder.svg?height=90&width=160"}
            alt={video.title || "サムネイル"}
            fill
            sizes="160px"
            className="object-cover"
          />
        </div>
      </a>
      <div className="flex min-w-0 flex-col justify-between gap-1">
        <a
          href={href}
          className="line-clamp-2 font-medium text-white hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {video.title || "タイトル不明"}
        </a>
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
          <span className="text-gray-300">{channelTitle}</span>
          <span aria-hidden="true">·</span>
          <span>{relativeDays(video.publishedAt)}</span>
          <span aria-hidden="true">·</span>
          <span>{formatJapanDate(video.publishedAt)}</span>
          {video.isShort && (
            <span className="rounded border border-gray-600 px-1.5 py-0.5 text-xs text-gray-300">
              Shorts
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
