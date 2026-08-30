"use client"

import { memo } from "react"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { VideoAnalysis, ProcessedData } from "@/types/video"
import { VideoTableColumns } from "./columns"
import { VideoTableRow } from "./row"

interface VideoTableProps {
  videos: VideoAnalysis[]
  processedData: ProcessedData[]
  sortField: string
  sortDirection: "asc" | "desc"
  onSort: (field: string) => void
  watchCountByVideoId?: Record<string, number>
  maxRows?: number
}

export const VideoTable = memo<VideoTableProps>(function VideoTable({
  videos,
  processedData,
  sortField,
  sortDirection,
  onSort,
  watchCountByVideoId,
  maxRows = 20,
}) {
  const { headerColumns, dayColumns } = VideoTableColumns({
    processedData,
    sortField,
    sortDirection,
  })

  const displayVideos = videos.slice(0, maxRows)

  return (
    <div className="w-full overflow-x-auto rounded-md border">
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
                scope="col"
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
                scope="col"
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayVideos.map((video, index) => (
            <VideoTableRow
              key={video.videoId}
              video={video}
              rank={index + 1}
              dayColumns={dayColumns}
              watchCount={watchCountByVideoId?.[video.videoId] || null}
            />
          ))}

          {displayVideos.length === 0 && (
            <TableRow>
              <td
                colSpan={7 + (processedData.length > 1 ? processedData.length - 1 : 0)}
                className="text-center py-6 text-muted-foreground"
              >
                データがありません
              </td>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {displayVideos.length > 0 && videos.length > maxRows && (
        <div className="text-center text-sm text-muted-foreground p-2">
          {videos.length}本中、上位{maxRows}本を表示しています
        </div>
      )}
    </div>
  )
})
