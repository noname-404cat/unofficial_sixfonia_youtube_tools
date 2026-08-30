import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { TableCell, TableRow } from "@/components/ui/table"
import type { VideoAnalysis } from "@/types/video"
import type { DayColumn } from "./VideoTableColumns"
import {
  formatNumber,
  formatChange,
  formatJapaneseDate,
  getDailyViewCount,
  getLatestViewCount,
} from "@/hooks/useVideoData"
import VideoTags from "./VideoTags"

interface VideoRowProps {
  video: VideoAnalysis
  rank: number
  dayColumns: DayColumn[]
  watchCount?: number | null
}

export default function VideoRow({ video, rank, dayColumns, watchCount }: VideoRowProps) {
  return (
    <TableRow key={video.videoId}>
      <TableCell>
        <Badge variant={rank <= 3 ? "default" : "outline"}>{rank}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex gap-2 w-[300px]">
          {video.details ? (
            <a
              href={video.videoURL}
              target="_blank"
              rel="noopener noreferrer"
              className="relative h-10 w-16 flex-shrink-0 overflow-hidden rounded block"
            >
              <Image
                src={video.details.thumbnailUrl || "/placeholder.svg"}
                alt={video.details.title}
                fill
                className="object-cover"
              />
            </a>
          ) : (
            <Skeleton className="h-10 w-16 rounded" />
          )}
          <div className="flex flex-col justify-center w-[220px]">
            <div className="font-medium text-sm line-clamp-2">
              {video.details ? video.details.title : <Skeleton className="h-4 w-40" />}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {video.character && (
                <span className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded">{video.character}</span>
              )}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {video.details ? formatJapaneseDate(video.details.publishedAt) : <Skeleton className="h-4 w-20" />}
      </TableCell>
      <TableCell className="text-right font-medium">{formatNumber(getLatestViewCount(video))}</TableCell>
      <TableCell className="text-right">
        <span
          className={
            video.latestViewDiffChange === null
              ? ""
              : video.latestViewDiffChange > 0
                ? "text-green-600"
                : video.latestViewDiffChange < 0
                  ? "text-red-600"
                  : ""
          }
        >
          {formatChange(video.latestViewDiffChange)}
        </span>
      </TableCell>
      {dayColumns.map((day) => (
        <TableCell key={`${video.videoId}-${day.dayLabel}`} className="text-right">
          {getDailyViewCount(video, day.dayLabel) !== null ? formatNumber(getDailyViewCount(video, day.dayLabel)) : "—"}
        </TableCell>
      ))}
      <TableCell className="text-right">
        <span
          className={
            video.latestLikeDiffChange === null
              ? ""
              : video.latestLikeDiffChange > 0
                ? "text-green-600"
                : video.latestLikeDiffChange < 0
                  ? "text-red-600"
                  : ""
          }
        >
          {formatChange(video.latestLikeDiffChange)}
        </span>
      </TableCell>
      <TableCell>
        <VideoTags videoId={video.videoId} tags={video.tags} />
      </TableCell>
    </TableRow>
  )
}
