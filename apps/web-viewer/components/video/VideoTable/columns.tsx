"use client"

import type React from "react"
import { useMemo } from "react"
import type { ProcessedData } from "@/types/video"
import { formatShortDate } from "@/lib/date"

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

interface VideoTableColumnsProps {
  processedData: ProcessedData[]
  sortField: string
  sortDirection: "asc" | "desc"
}

export function VideoTableColumns({ processedData, sortField, sortDirection }: VideoTableColumnsProps) {
  // ソートアイコンの生成（メモ化）
  const getSortIcon = useMemo(
    () => (field: string) =>
      sortField === field ? (
        <span className="ml-1" aria-label={`${sortDirection === "asc" ? "昇順" : "降順"}でソート中`}>
          {sortDirection === "asc" ? "↑" : "↓"}
        </span>
      ) : null,
    [sortField, sortDirection],
  )

  // ヘッダー列の定義（メモ化）
  const headerColumns: VideoTableColumn[] = useMemo(
    () => [
      {
        id: "rank",
        header: (
          <>
            順位
            {getSortIcon("rank")}
          </>
        ),
        rowSpan: 2,
        className: "w-[60px] cursor-pointer hover:bg-gray-50 select-none",
        sortable: true,
      },
      {
        id: "video",
        header: "動画",
        rowSpan: 2,
        className: "w-[300px]",
      },
      {
        id: "publishedAt",
        header: (
          <>
            投稿日
            {getSortIcon("publishedAt")}
          </>
        ),
        rowSpan: 2,
        className: "w-[120px] cursor-pointer hover:bg-gray-50 select-none",
        sortable: true,
      },
      {
        id: "latestViewCount",
        header: (
          <>
            最新再生数
            {getSortIcon("latestViewCount")}
          </>
        ),
        rowSpan: 2,
        className: "text-right cursor-pointer hover:bg-gray-50 select-none",
        sortable: true,
      },
      {
        id: "latestViewDiffChange",
        header: (
          <>
            再生数の上昇率
            {getSortIcon("latestViewDiffChange")}
          </>
        ),
        rowSpan: 2,
        className: "text-right cursor-pointer hover:bg-gray-50 select-none",
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
            {getSortIcon("latestLikeDiffChange")}
          </>
        ),
        rowSpan: 2,
        className: "text-right cursor-pointer hover:bg-gray-50 select-none",
        sortable: true,
      },
      {
        id: "tags",
        header: "タグ",
        rowSpan: 2,
        className: "min-w-[200px]",
      },
    ],
    [processedData.length, getSortIcon],
  )

  // 日別列の定義（メモ化）
  const dayColumns: DayColumn[] = useMemo(
    () =>
      processedData
        .filter((day) => {
          const dayNum = Number(day.label.replace("day", ""))
          return dayNum > 0
        })
        .map((day) => ({
          id: day.label,
          dayLabel: day.label,
          date: day.date,
          header: (
            <>
              {day.label}（{formatShortDate(day.date)}）{getSortIcon(day.label)}
            </>
          ),
          className: "text-right whitespace-nowrap cursor-pointer hover:bg-gray-50 select-none",
          sortable: true,
        })),
    [processedData, getSortIcon],
  )

  return { headerColumns, dayColumns }
}
