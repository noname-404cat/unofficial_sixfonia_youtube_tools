"use client"

import type React from "react"

import { memo, useMemo, useCallback, useRef, useEffect, useState } from "react"
import { FixedSizeList as List, type ListChildComponentProps } from "react-window"
import AutoSizer from "react-virtualized-auto-sizer"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { VideoAnalysis, ProcessedData } from "@/types/video"
import { VideoTableColumns } from "./columns"
import { VideoTableRow } from "./row"
import type { DayColumn } from "./columns"

interface VirtualizedTableProps {
  videos: VideoAnalysis[]
  processedData: ProcessedData[]
  sortField: string
  sortDirection: "asc" | "desc"
  onSort: (field: string) => void
  watchCountByVideoId?: Record<string, number>
  itemHeight?: number
  overscanCount?: number
}

// 仮想化された行コンポーネント（メモ化）
const VirtualizedRow = memo<
  ListChildComponentProps & {
    videos: VideoAnalysis[]
    dayColumns: DayColumn[]
    watchCountByVideoId?: Record<string, number>
  }
>(function VirtualizedRow({ index, style, videos, dayColumns, watchCountByVideoId }) {
  const video = videos[index]
  const watchCount = watchCountByVideoId?.[video.videoId] || null

  return (
    <div style={style} role="row" aria-rowindex={index + 2}>
      <Table>
        <TableBody>
          <VideoTableRow video={video} rank={index + 1} dayColumns={dayColumns} watchCount={watchCount} />
        </TableBody>
      </Table>
    </div>
  )
})

export const VirtualizedTable = memo<VirtualizedTableProps>(function VirtualizedTable({
  videos,
  processedData,
  sortField,
  sortDirection,
  onSort,
  watchCountByVideoId,
  itemHeight = 80,
  overscanCount = 5,
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<List>(null)
  const [containerHeight, setContainerHeight] = useState(600)
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null)

  // 列定義の取得（メモ化）
  const { headerColumns, dayColumns } = useMemo(
    () => VideoTableColumns({ processedData, sortField, sortDirection }),
    [processedData, sortField, sortDirection],
  )

  // 表示する動画数の制限（メモ化）
  const displayVideos = useMemo(
    () => videos.slice(0, 1000), // 最大1000件まで表示
    [videos],
  )

  // コンテナの高さを測定
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const availableHeight = window.innerHeight - rect.top - 100 // 余白を考慮
        setContainerHeight(Math.max(300, Math.min(800, availableHeight)))
      }
    }

    updateHeight()
    window.addEventListener("resize", updateHeight)
    return () => window.removeEventListener("resize", updateHeight)
  }, [])

  // キーボードナビゲーション
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!displayVideos.length) return

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setFocusedRowIndex((prev) => {
            const newIndex = prev === null ? 0 : Math.min(prev + 1, displayVideos.length - 1)
            listRef.current?.scrollToItem(newIndex, "smart")
            return newIndex
          })
          break
        case "ArrowUp":
          e.preventDefault()
          setFocusedRowIndex((prev) => {
            const newIndex = prev === null ? 0 : Math.max(prev - 1, 0)
            listRef.current?.scrollToItem(newIndex, "smart")
            return newIndex
          })
          break
        case "Home":
          e.preventDefault()
          setFocusedRowIndex(0)
          listRef.current?.scrollToItem(0, "start")
          break
        case "End":
          e.preventDefault()
          setFocusedRowIndex(displayVideos.length - 1)
          listRef.current?.scrollToItem(displayVideos.length - 1, "end")
          break
        case "PageDown":
          e.preventDefault()
          setFocusedRowIndex((prev) => {
            const pageSize = Math.floor(containerHeight / itemHeight)
            const newIndex = prev === null ? 0 : Math.min(prev + pageSize, displayVideos.length - 1)
            listRef.current?.scrollToItem(newIndex, "smart")
            return newIndex
          })
          break
        case "PageUp":
          e.preventDefault()
          setFocusedRowIndex((prev) => {
            const pageSize = Math.floor(containerHeight / itemHeight)
            const newIndex = prev === null ? 0 : Math.max(prev - pageSize, 0)
            listRef.current?.scrollToItem(newIndex, "smart")
            return newIndex
          })
          break
      }
    },
    [displayVideos.length, containerHeight, itemHeight],
  )

  // 行レンダラー（メモ化）
  const renderRow = useCallback(
    (props: ListChildComponentProps) => (
      <VirtualizedRow
        {...props}
        videos={displayVideos}
        dayColumns={dayColumns}
        watchCountByVideoId={watchCountByVideoId}
      />
    ),
    [displayVideos, dayColumns, watchCountByVideoId],
  )

  // 空の状態の表示（メモ化）
  const emptyState = useMemo(
    () => (
      <div className="text-center py-12 text-muted-foreground" role="status" aria-live="polite">
        <p>データがありません</p>
      </div>
    ),
    [],
  )

  // 統計情報の表示（メモ化）
  const statsInfo = useMemo(() => {
    if (displayVideos.length === 0) return null

    const totalVideos = videos.length
    const displayedVideos = displayVideos.length

    return (
      <div className="text-center text-sm text-muted-foreground p-2 border-t" role="status" aria-live="polite">
        {totalVideos > displayedVideos
          ? `${totalVideos.toLocaleString()}本中、上位${displayedVideos.toLocaleString()}本を表示しています`
          : `${totalVideos.toLocaleString()}本の動画を表示しています`}
      </div>
    )
  }, [videos.length, displayVideos.length])

  // ソートハンドラー（アクセシビリティ対応）
  const handleSort = useCallback(
    (field: string) => {
      onSort(field)
      // ソート後にフォーカスをリセット
      setFocusedRowIndex(null)
    },
    [onSort],
  )

  if (displayVideos.length === 0) {
    return (
      <div className="w-full overflow-x-auto rounded-md border" role="region" aria-label="動画テーブル">
        <Table role="table" aria-label="動画一覧">
          <TableHeader>
            <TableRow role="row">
              {headerColumns.map((column, index) => (
                <TableHead
                  key={column.id}
                  rowSpan={column.rowSpan}
                  colSpan={column.colSpan}
                  className={column.className}
                  onClick={column.sortable ? () => handleSort(column.id) : undefined}
                  scope="col"
                  role="columnheader"
                  aria-sort={
                    column.sortable && sortField === column.id
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : column.sortable
                        ? "none"
                        : undefined
                  }
                  tabIndex={column.sortable ? 0 : undefined}
                  onKeyDown={
                    column.sortable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            handleSort(column.id)
                          }
                        }
                      : undefined
                  }
                  aria-label={
                    column.sortable
                      ? `${typeof column.header === "string" ? column.header : `列${index + 1}`}でソート`
                      : undefined
                  }
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
            <TableRow role="row">
              {dayColumns.map((column, index) => (
                <TableHead
                  key={column.id}
                  className={column.className}
                  onClick={column.sortable ? () => handleSort(column.id) : undefined}
                  scope="col"
                  role="columnheader"
                  aria-sort={
                    column.sortable && sortField === column.id
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : column.sortable
                        ? "none"
                        : undefined
                  }
                  tabIndex={column.sortable ? 0 : undefined}
                  onKeyDown={
                    column.sortable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            handleSort(column.id)
                          }
                        }
                      : undefined
                  }
                  aria-label={`${column.dayLabel}の再生数でソート`}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        </Table>
        {emptyState}
      </div>
    )
  }

  return (
    <div
      className="w-full overflow-x-auto rounded-md border"
      ref={containerRef}
      role="region"
      aria-label="動画テーブル"
    >
      {/* ヘッダー部分 */}
      <Table role="table" aria-label="動画一覧" aria-rowcount={displayVideos.length + 2}>
        <TableHeader>
          <TableRow role="row" aria-rowindex={1}>
            {headerColumns.map((column, index) => (
              <TableHead
                key={column.id}
                rowSpan={column.rowSpan}
                colSpan={column.colSpan}
                className={column.className}
                onClick={column.sortable ? () => handleSort(column.id) : undefined}
                scope="col"
                role="columnheader"
                aria-sort={
                  column.sortable && sortField === column.id
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : column.sortable
                      ? "none"
                      : undefined
                }
                tabIndex={column.sortable ? 0 : undefined}
                onKeyDown={
                  column.sortable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          handleSort(column.id)
                        }
                      }
                    : undefined
                }
                aria-label={
                  column.sortable
                    ? `${typeof column.header === "string" ? column.header : `列${index + 1}`}でソート`
                    : undefined
                }
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
          <TableRow role="row" aria-rowindex={2}>
            {dayColumns.map((column) => (
              <TableHead
                key={column.id}
                className={column.className}
                onClick={column.sortable ? () => handleSort(column.id) : undefined}
                scope="col"
                role="columnheader"
                aria-sort={
                  column.sortable && sortField === column.id
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : column.sortable
                      ? "none"
                      : undefined
                }
                tabIndex={column.sortable ? 0 : undefined}
                onKeyDown={
                  column.sortable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          handleSort(column.id)
                        }
                      }
                    : undefined
                }
                aria-label={`${column.dayLabel}の再生数でソート`}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
      </Table>

      {/* 仮想化されたボディ部分 */}
      <div
        style={{ height: containerHeight }}
        role="rowgroup"
        aria-label="動画データ"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-activedescendant={focusedRowIndex !== null ? `row-${focusedRowIndex}` : undefined}
      >
        <AutoSizer>
          {({ height, width }) => (
            <List
              ref={listRef}
              height={height}
              width={width}
              itemCount={displayVideos.length}
              itemSize={itemHeight}
              overscanCount={overscanCount}
              itemData={{
                videos: displayVideos,
                dayColumns,
                watchCountByVideoId,
                focusedRowIndex,
              }}
            >
              {renderRow}
            </List>
          )}
        </AutoSizer>
      </div>

      {/* 統計情報 */}
      {statsInfo}

      {/* スクリーンリーダー用の操作説明 */}
      <div className="sr-only" aria-live="polite">
        テーブルの操作方法:
        矢印キーで行を移動、Home/Endで最初/最後の行へ移動、PageUp/PageDownでページ単位の移動ができます。
      </div>
    </div>
  )
})
