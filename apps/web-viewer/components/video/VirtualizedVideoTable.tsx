"use client"

import { VideoTable } from "./VideoTable"
import type { VideoAnalysis, ProcessedData } from "@/types/video"

interface VirtualizedVideoTableProps {
  videos: VideoAnalysis[]
  processedData: ProcessedData[]
  sortField: string
  sortDirection: "asc" | "desc"
  onSort: (field: string) => void
  watchCountByVideoId?: Record<string, number>
}

export default function VirtualizedVideoTable({
  videos,
  processedData,
  sortField,
  sortDirection,
  onSort,
  watchCountByVideoId,
}: VirtualizedVideoTableProps) {
  return (
    <VideoTable
      videos={videos}
      processedData={processedData}
      sortField={sortField}
      sortDirection={sortDirection}
      onSort={onSort}
      watchCountByVideoId={watchCountByVideoId}
      maxRows={100}
    />
  )
}
