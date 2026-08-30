"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { VideoAnalysis, ProcessedData } from "@/types/video"
import { getTableColumns } from "./VideoTableColumns"
import VideoRow from "./VideoRow"

interface VideoPerformanceTableProps {
  videos: VideoAnalysis[]
  processedData: ProcessedData[]
  sortField: string
  sortDirection: "asc" | "desc"
  onSort: (field: string) => void
  watchCountByVideoId?: Record<string, number>
}

export default function VideoPerformanceTable({
  videos,
  processedData,
  sortField,
  sortDirection,
  onSort,
  watchCountByVideoId,
}: VideoPerformanceTableProps) {
  const { headerColumns, dayColumns } = getTableColumns(processedData, sortField, sortDirection)

  return (
    <div className="rounded-md border overflow-x-auto w-full max-w-full">
      <Table>
        <TableHeader>
          <TableRow>
            {headerColumns.map((column) => (
              <TableHead
                key={column.id}
                rowSpan={column.rowSpan}
                colSpan={column.colSpan}
                className={column.className}
                onClick={column.sortable ? () => onSort(column.id) : undefined}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
          <TableRow>
            {dayColumns.map((column) => (
              <TableHead
                key={column.id}
                className={column.className}
                onClick={column.sortable ? () => onSort(column.id) : undefined}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {videos.slice(0, 20).map((video, index) => {
            const watchCount = watchCountByVideoId ? watchCountByVideoId[video.videoId] || 0 : null
            return (
              <VideoRow
                key={video.videoId}
                video={video}
                rank={index + 1}
                dayColumns={dayColumns}
                watchCount={watchCount}
              />
            )
          })}

          {videos.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={8 + (processedData.length > 1 ? processedData.length - 1 : 0)}
                className="text-center py-6 text-muted-foreground"
              >
                データがありません
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
