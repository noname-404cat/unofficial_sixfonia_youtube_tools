import type React from "react"
import type { ProcessedData } from "@/types/video"
import { formatShortDate } from "@/hooks/useVideoData"

export interface VideoTableColumn {
  id: string
  header: string | React.ReactNode
  rowSpan?: number
  colSpan?: number
  className?: string
  sortable?: boolean
}

export interface DayColumn extends VideoTableColumn {
  dayLabel: string
  date: string
}

export function getTableColumns(
  processedData: ProcessedData[],
  sortField: string,
  sortDirection: "asc" | "desc",
): {
  headerColumns: VideoTableColumn[]
  dayColumns: DayColumn[]
} {
  // メインの列定義
  const headerColumns: VideoTableColumn[] = [
    {
      id: "rank",
      header: (
        <>
          順位
          {sortField === "rank" && <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>}
        </>
      ),
      rowSpan: 2,
      className: "w-[60px] cursor-pointer hover:bg-gray-50",
      sortable: true,
    },
    {
      id: "video",
      header: "動画",
      rowSpan: 2,
      className: "w-[300px]", // 固定幅に設定
    },
    {
      id: "publishedAt",
      header: (
        <>
          投稿日
          {sortField === "publishedAt" && <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>}
        </>
      ),
      rowSpan: 2,
      className: "w-[120px] cursor-pointer hover:bg-gray-50",
      sortable: true,
    },
    {
      id: "latestViewCount",
      header: (
        <>
          最新再生数
          {sortField === "latestViewCount" && <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>}
        </>
      ),
      rowSpan: 2,
      className: "text-right cursor-pointer hover:bg-gray-50",
      sortable: true,
    },
    {
      id: "latestViewDiffChange",
      header: (
        <>
          再生数の上昇率
          {sortField === "latestViewDiffChange" && <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>}
        </>
      ),
      rowSpan: 2,
      className: "text-right cursor-pointer hover:bg-gray-50",
      sortable: true,
    },
    {
      id: "dailyViewCounts",
      header: "日別の再生数",
      colSpan: processedData.length > 1 ? processedData.length - 1 : 0,
      className: "text-center border-b",
    },
    {
      id: "latestLikeDiffChange",
      header: (
        <>
          高評価数の上昇率
          {sortField === "latestLikeDiffChange" && <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>}
        </>
      ),
      rowSpan: 2,
      className: "text-right cursor-pointer hover:bg-gray-50",
      sortable: true,
    },
    {
      id: "tags",
      header: "タグ",
      rowSpan: 2,
      className: "min-w-[200px]",
    },
  ]

  // 日別の列定義
  const dayColumns: DayColumn[] = processedData
    .filter((day) => {
      // day0を除外
      const dayNum = Number(day.label.replace("day", ""))
      return dayNum > 0
    })
    .map((day) => ({
      id: day.label,
      dayLabel: day.label,
      date: day.date,
      header: (
        <>
          {day.label}（{formatShortDate(day.date)}）
          {sortField === day.label && <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>}
        </>
      ),
      className: "text-right whitespace-nowrap cursor-pointer hover:bg-gray-50",
      sortable: true,
    }))

  return { headerColumns, dayColumns }
}
