"use client"

import { memo, useMemo } from "react"
import type { VideoAnalysis, ProcessedData } from "@/types/video"
import { useVideoTableState } from "@/hooks/useVideoTableState"
import { VirtualizedTable } from "./VideoTable/VirtualizedTable"
import { VideoTableFilters } from "./VideoTableFilters"

interface VideoPerformanceTableContainerProps {
  videoAnalysis: VideoAnalysis[]
  processedData: ProcessedData[]
  watchCountByVideoId: Record<string, number>
  availableCharacters: string[]
  availableTags: string[]
}

export const VideoPerformanceTableContainer = memo<VideoPerformanceTableContainerProps>(
  function VideoPerformanceTableContainer({
    videoAnalysis,
    processedData,
    watchCountByVideoId,
    availableCharacters,
    availableTags,
  }) {
    const {
      sortState,
      filterState,
      sortedVideos,
      handleSort,
      handleSearchChange,
      handleCharacterChange,
      handleWatchStatusChange,
      handleWatchCountChange,
    } = useVideoTableState({
      videoAnalysis,
      videoMetadata: [],
      watchCountByVideoId,
    })

    // キャラクター固有のタグを取得（メモ化）
    const characterSpecificTags = useMemo(() => {
      if (filterState.activeCharacter === "all") {
        return availableTags
      }

      const characterVideos = videoAnalysis.filter((video) => video.character === filterState.activeCharacter)

      const characterTags = new Set<string>()
      characterVideos.forEach((video) => {
        if (video.tags) {
          video.tags.forEach((tag) => characterTags.add(tag))
        }
      })

      return Array.from(characterTags)
    }, [availableTags, videoAnalysis, filterState.activeCharacter])

    return (
      <div className="space-y-6 w-full max-w-full px-2">
        <VideoTableFilters
          filterState={filterState}
          availableCharacters={availableCharacters}
          availableTags={characterSpecificTags}
          onSearchChange={handleSearchChange}
          onCharacterChange={handleCharacterChange}
          onWatchStatusChange={handleWatchStatusChange}
          onWatchCountChange={handleWatchCountChange}
        />

        <VirtualizedTable
          videos={sortedVideos}
          processedData={processedData}
          sortField={sortState.field}
          sortDirection={sortState.direction}
          onSort={handleSort}
          watchCountByVideoId={watchCountByVideoId}
          itemHeight={80}
          overscanCount={10}
        />
      </div>
    )
  },
)
