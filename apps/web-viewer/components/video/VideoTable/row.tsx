"use client"

import { memo, useMemo } from "react"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { TableCell, TableRow } from "@/components/ui/table"
import type { VideoAnalysis } from "@/types/video"
import type { DayColumn } from "./columns"
import { formatNumber, formatChange } from "@/lib/number"
import { formatJapaneseDate } from "@/lib/date"
import { VideoTableTags } from "./tags"

interface VideoTableRowProps {
  video: VideoAnalysis
  rank: number
  dayColumns: DayColumn[]
  watchCount: number | null
  isFocused?: boolean
}

export const VideoTableRow = memo<VideoTableRowProps>(function VideoTableRow({
  video,
  rank,
  dayColumns,
  watchCount,
  isFocused = false,
}) {
  // 最新の視聴回数を取得（メモ化）
  const latestViewCount = useMemo(() => {
    const days = Object.keys(video.dailyMetrics).sort()
    return days.length > 0 ? video.dailyMetrics[days[days.length - 1]].viewCount : 0
  }, [video.dailyMetrics])

  // 日別の視聴回数を取得する関数（メモ化）
  const getDailyViewCount = useMemo(() => {
    const days = Object.keys(video.dailyMetrics).sort((a, b) => {
      const numA = Number(a.replace("day", ""))
      const numB = Number(b.replace("day", ""))
      return numA - numB
    })

    return (dayLabel: string): number | null => {
      const dayIndex = days.indexOf(dayLabel)

      if (dayIndex < 0 || !video.dailyMetrics[dayLabel]) {
        return null
      }

      if (dayIndex === 0) {
        return null
      }

      const prevDay = days[dayIndex - 1]
      return video.dailyMetrics[dayLabel].viewCount - video.dailyMetrics[prevDay].viewCount
    }
  }, [video.dailyMetrics])

  // ランクバッジのバリアント（メモ化）
  const rankBadgeVariant = useMemo(() => (rank <= 3 ? "default" : "outline"), [rank])

  // 再生数変化のスタイル（メモ化）
  const viewDiffChangeStyle = useMemo(() => {
    if (video.latestViewDiffChange === null) return ""
    if (video.latestViewDiffChange > 0) return "text-green-600"
    if (video.latestViewDiffChange < 0) return "text-red-600"
    return ""
  }, [video.latestViewDiffChange])

  // 高評価数変化のスタイル（メモ化）
  const likeDiffChangeStyle = useMemo(() => {
    if (video.latestLikeDiffChange === null) return ""
    if (video.latestLikeDiffChange > 0) return "text-green-600"
    if (video.latestLikeDiffChange < 0) return "text-red-600"
    return ""
  }, [video.latestLikeDiffChange])

  // 動画詳細情報（メモ化）
  const videoDetails = useMemo(
    () => ({
      title: video.details?.title,
      thumbnailUrl: video.details?.thumbnailUrl || "/placeholder.svg",
      publishedAt: video.details?.publishedAt,
    }),
    [video.details],
  )

  // 日別データのレンダリング（メモ化）
  const dailyDataCells = useMemo(
    () =>
      dayColumns.map((day) => {
        const dailyCount = getDailyViewCount(day.dayLabel)
        return (
          <TableCell
            key={`${video.videoId}-${day.dayLabel}`}
            className="text-right"
            role="cell"
            aria-label={`${day.dayLabel}の再生数: ${dailyCount !== null ? formatNumber(dailyCount) : "データなし"}`}
          >
            {dailyCount !== null ? formatNumber(dailyCount) : "—"}
          </TableCell>
        )
      }),
    [dayColumns, getDailyViewCount, video.videoId],
  )

  // アクセシビリティ用のラベル（メモ化）
  const rowLabel = useMemo(() => {
    const title = videoDetails.title || video.videoId
    const rankText = `${rank}位`
    const viewCountText = `再生数${formatNumber(latestViewCount)}`
    const changeText =
      video.latestViewDiffChange !== null ? `変化量${formatChange(video.latestViewDiffChange)}` : "変化量データなし"

    return `${rankText}, ${title}, ${viewCountText}, ${changeText}`
  }, [rank, videoDetails.title, video.videoId, latestViewCount, video.latestViewDiffChange])

  return (
    <TableRow
      className={isFocused ? "bg-blue-50 ring-2 ring-blue-500" : ""}
      role="row"
      aria-label={rowLabel}
      id={`row-${rank - 1}`}
    >
      <TableCell role="cell" aria-label={`順位: ${rank}位`}>
        <Badge variant={rankBadgeVariant} aria-label={`${rank}位`}>
          {rank}
        </Badge>
      </TableCell>

      <TableCell role="cell">
        <div className="flex gap-2 w-[300px]">
          {videoDetails.title ? (
            <a
              href={video.videoURL}
              target="_blank"
              rel="noopener noreferrer"
              className="relative h-10 w-16 flex-shrink-0 overflow-hidden rounded block focus:ring-2 focus:ring-blue-500 focus:outline-none"
              aria-label={`動画を開く: ${videoDetails.title}`}
              tabIndex={0}
            >
              <Image
                src={videoDetails.thumbnailUrl || "/placeholder.svg"}
                alt=""
                fill
                className="object-cover"
                sizes="64px"
                loading="lazy"
                aria-hidden="true"
              />
            </a>
          ) : (
            <Skeleton className="h-10 w-16 rounded" aria-label="サムネイル読み込み中" />
          )}
          <div className="flex flex-col justify-center w-[220px]">
            <div className="font-medium text-sm line-clamp-2">
              {videoDetails.title ? (
                <a
                  href={video.videoURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline focus:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                  title={videoDetails.title}
                  tabIndex={0}
                  aria-label={`動画タイトル: ${videoDetails.title}`}
                >
                  {videoDetails.title}
                </a>
              ) : (
                <Skeleton className="h-4 w-40" aria-label="タイトル読み込み中" />
              )}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {video.character && (
                <span
                  className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded"
                  aria-label={`チャンネル: ${video.character}`}
                >
                  {video.character}
                </span>
              )}
            </div>
          </div>
        </div>
      </TableCell>

      <TableCell
        className="whitespace-nowrap"
        role="cell"
        aria-label={`投稿日: ${videoDetails.publishedAt ? formatJapaneseDate(videoDetails.publishedAt) : "不明"}`}
      >
        {videoDetails.publishedAt ? (
          formatJapaneseDate(videoDetails.publishedAt)
        ) : (
          <Skeleton className="h-4 w-20" aria-label="投稿日読み込み中" />
        )}
      </TableCell>

      <TableCell
        className="text-right font-medium"
        role="cell"
        data-value={latestViewCount}
        aria-label={`最新再生数: ${formatNumber(latestViewCount)}`}
      >
        {formatNumber(latestViewCount)}
      </TableCell>

      <TableCell
        className="text-right"
        role="cell"
        aria-label={`再生数の変化: ${
          video.latestViewDiffChange !== null ? formatChange(video.latestViewDiffChange) : "データなし"
        }`}
      >
        <span
          className={viewDiffChangeStyle}
          data-negative={video.latestViewDiffChange !== null && video.latestViewDiffChange < 0}
          data-value={video.latestViewDiffChange}
          aria-label={
            video.latestViewDiffChange !== null
              ? video.latestViewDiffChange > 0
                ? "増加"
                : video.latestViewDiffChange < 0
                  ? "減少"
                  : "変化なし"
              : "データなし"
          }
        >
          {formatChange(video.latestViewDiffChange)}
        </span>
      </TableCell>

      {dailyDataCells}

      <TableCell
        className="text-right"
        role="cell"
        aria-label={`高評価数の変化: ${
          video.latestLikeDiffChange !== null ? formatChange(video.latestLikeDiffChange) : "データなし"
        }`}
      >
        <span
          className={likeDiffChangeStyle}
          data-negative={video.latestLikeDiffChange !== null && video.latestLikeDiffChange < 0}
          data-value={video.latestLikeDiffChange}
          aria-label={
            video.latestLikeDiffChange !== null
              ? video.latestLikeDiffChange > 0
                ? "増加"
                : video.latestLikeDiffChange < 0
                  ? "減少"
                  : "変化なし"
              : "データなし"
          }
        >
          {formatChange(video.latestLikeDiffChange)}
        </span>
      </TableCell>

      <TableCell role="cell" aria-label="タグ">
        <VideoTableTags videoId={video.videoId} tags={video.tags} />
      </TableCell>
    </TableRow>
  )
})
