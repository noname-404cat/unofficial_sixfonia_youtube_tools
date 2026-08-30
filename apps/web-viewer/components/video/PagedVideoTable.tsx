"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { VideoTable } from "./VideoTable"
import type { VideoAnalysis, ProcessedData } from "@/types/video"

// 未視聴一覧は1,000件を超えることがある。全部を一度に描画すると重いので
// 100件ずつ足していく。仮想スクロールも検討したが、<table> の中に持ち込むと
// 実装が重くなるうえ依存も増えるため、この方式にした。
const PAGE_SIZE = 100

interface PagedVideoTableProps {
  videos: VideoAnalysis[]
  processedData: ProcessedData[]
  sortField: string
  sortDirection: "asc" | "desc"
  onSort: (field: string) => void
  watchCountByVideoId?: Record<string, number>
}

export default function PagedVideoTable({
  videos,
  processedData,
  sortField,
  sortDirection,
  onSort,
  watchCountByVideoId,
}: PagedVideoTableProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // 絞り込みや並び替えが変わったら先頭に戻す
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [videos, sortField, sortDirection])

  const shown = Math.min(visibleCount, videos.length)
  const remaining = videos.length - shown

  return (
    <div className="space-y-3">
      <VideoTable
        videos={videos}
        processedData={processedData}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={onSort}
        watchCountByVideoId={watchCountByVideoId}
        maxRows={visibleCount}
      />

      <div className="text-center text-sm text-muted-foreground">
        {videos.length.toLocaleString()}本中 {shown.toLocaleString()}本を表示しています
      </div>

      {remaining > 0 && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
        >
          もっと見る（残り {remaining.toLocaleString()}本）
        </Button>
      )}
    </div>
  )
}
