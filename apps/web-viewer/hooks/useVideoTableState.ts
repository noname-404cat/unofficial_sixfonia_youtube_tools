"use client"

import { useState, useMemo, useCallback } from "react"
import type { VideoAnalysis, VideoMetadata, SortState, FilterState } from "@/types/video"
import { VIEW_COUNT_RANGES } from "@/lib/constants"

interface UseVideoTableStateProps {
  videoAnalysis: VideoAnalysis[]
  videoMetadata: VideoMetadata[]
  watchCountByVideoId: Record<string, number>
}

export function useVideoTableState({ videoAnalysis, videoMetadata, watchCountByVideoId }: UseVideoTableStateProps) {
  // ソート状態
  const [sortState, setSortState] = useState<SortState>({
    field: "latestViewDiffChange",
    direction: "asc",
  })

  // フィルター状態
  const [filterState, setFilterState] = useState<FilterState>({
    searchTerm: "",
    activeCharacter: "all",
    watchStatus: "all",
    watchCount: "all",
  })

  // 基本動画リストの選択（メモ化）
  const baseVideos = useMemo(() => {
    return videoAnalysis.length > 0 ? videoAnalysis : videoMetadata
  }, [videoAnalysis, videoMetadata])

  // 検索語の正規化（メモ化）
  const normalizedSearchTerm = useMemo(() => {
    return filterState.searchTerm.toLowerCase().trim()
  }, [filterState.searchTerm])

  // キャラクターフィルタリング（メモ化）
  const characterFilteredVideos = useMemo(() => {
    if (filterState.activeCharacter === "all") {
      return baseVideos
    }

    return baseVideos.filter((video) => {
      const character = "character" in video ? video.character : undefined
      return character === filterState.activeCharacter
    })
  }, [baseVideos, filterState.activeCharacter])

  // 検索フィルタリング（メモ化）
  const searchFilteredVideos = useMemo(() => {
    if (!normalizedSearchTerm) {
      return characterFilteredVideos
    }

    return characterFilteredVideos.filter((video) => {
      const title = "details" in video ? video.details?.title : video.title
      const videoId = video.videoId
      const tags = "tags" in video ? video.tags : video.tags

      // タイトル検索
      const titleMatch = title && title.toLowerCase().includes(normalizedSearchTerm)

      // ID検索
      const idMatch = videoId.toLowerCase().includes(normalizedSearchTerm)

      // タグ検索
      const tagMatch = tags?.some((tag) => {
        const cleanTag = tag.startsWith("#") ? tag.substring(1) : tag
        return cleanTag.toLowerCase().includes(normalizedSearchTerm)
      })

      return titleMatch || idMatch || tagMatch
    })
  }, [characterFilteredVideos, normalizedSearchTerm])

  // 視聴状態フィルタリング（メモ化）
  const watchStatusFilteredVideos = useMemo(() => {
    if (filterState.watchStatus === "all") {
      return searchFilteredVideos
    }

    return searchFilteredVideos.filter((video) => {
      const watchCount = watchCountByVideoId[video.videoId] || 0
      const isWatched = watchCount > 0
      return filterState.watchStatus === "watched" ? isWatched : !isWatched
    })
  }, [searchFilteredVideos, filterState.watchStatus, watchCountByVideoId])

  // 視聴回数フィルタリング（メモ化）
  const watchCountFilteredVideos = useMemo(() => {
    if (filterState.watchCount === "all") {
      return watchStatusFilteredVideos
    }

    return watchStatusFilteredVideos.filter((video) => {
      const watchCount = watchCountByVideoId[video.videoId] || 0

      switch (filterState.watchCount) {
        case "high":
          return watchCount >= VIEW_COUNT_RANGES.HIGH
        case "medium":
          return watchCount >= VIEW_COUNT_RANGES.MEDIUM && watchCount < VIEW_COUNT_RANGES.HIGH
        case "low":
          return watchCount >= VIEW_COUNT_RANGES.LOW && watchCount < VIEW_COUNT_RANGES.MEDIUM
        case "none":
          return watchCount === 0
        default:
          return true
      }
    })
  }, [watchStatusFilteredVideos, filterState.watchCount, watchCountByVideoId])

  // ソート関数の定義（メモ化）
  const sortFunction = useMemo(() => {
    return (a: VideoAnalysis | VideoMetadata, b: VideoAnalysis | VideoMetadata) => {
      const { field, direction } = sortState

      // VideoAnalysisの場合のソート処理
      if ("dailyMetrics" in a && "dailyMetrics" in b) {
        const videoA = a as VideoAnalysis
        const videoB = b as VideoAnalysis

        let compareValue = 0

        if (field === "publishedAt") {
          const dateA = new Date(videoA.details?.publishedAt || "").getTime() || 0
          const dateB = new Date(videoB.details?.publishedAt || "").getTime() || 0
          compareValue = dateA - dateB
        } else if (field === "latestViewCount") {
          const getLatestViewCount = (video: VideoAnalysis): number => {
            const days = Object.keys(video.dailyMetrics ?? {}).sort()
            return days.length > 0 ? video.dailyMetrics?.[days[days.length - 1]]?.viewCount ?? 0 : 0
          }
          const viewCountA = getLatestViewCount(videoA)
          const viewCountB = getLatestViewCount(videoB)
          compareValue = viewCountA - viewCountB
        } else if (field === "latestViewDiffChange") {
          const valueA = videoA.latestViewDiffChange ?? Number.NEGATIVE_INFINITY
          const valueB = videoB.latestViewDiffChange ?? Number.NEGATIVE_INFINITY
          compareValue = valueA - valueB
        } else if (field === "latestLikeDiffChange") {
          const valueA = videoA.latestLikeDiffChange ?? Number.NEGATIVE_INFINITY
          const valueB = videoB.latestLikeDiffChange ?? Number.NEGATIVE_INFINITY
          compareValue = valueA - valueB
        } else if (field === "rank") {
          compareValue = videoA.rank - videoB.rank
        } else if (field.startsWith("day")) {
          const getDailyViewCount = (video: VideoAnalysis, dayLabel: string): number => {
            const days = Object.keys(video.dailyMetrics ?? {}).sort((a, b) => {
              const numA = Number(a.replace("day", ""))
              const numB = Number(b.replace("day", ""))
              return numA - numB
            })
            const dayIndex = days.indexOf(dayLabel)
            if (dayIndex < 0 || !video.dailyMetrics?.[dayLabel] || dayIndex === 0) {
              return Number.NEGATIVE_INFINITY
            }
            const prevDay = days[dayIndex - 1]
            return (video.dailyMetrics?.[dayLabel]?.viewCount ?? 0) - (video.dailyMetrics?.[prevDay]?.viewCount ?? 0)
          }

          const dayViewA = getDailyViewCount(videoA, field)
          const dayViewB = getDailyViewCount(videoB, field)
          compareValue = dayViewA - dayViewB
        }

        return direction === "asc" ? compareValue : -compareValue
      }
      // VideoMetadataの場合のソート処理
      else if (!("dailyMetrics" in a) && !("dailyMetrics" in b)) {
        const videoA = a as VideoMetadata
        const videoB = b as VideoMetadata

        let compareValue = 0

        if (field === "publishedAt") {
          const dateA = new Date(videoA.publishedAt || "").getTime() || 0
          const dateB = new Date(videoB.publishedAt || "").getTime() || 0
          compareValue = dateA - dateB
        } else if (field === "watchCount") {
          const watchCountA = watchCountByVideoId[videoA.videoId] || 0
          const watchCountB = watchCountByVideoId[videoB.videoId] || 0
          compareValue = watchCountA - watchCountB
        }

        return direction === "asc" ? compareValue : -compareValue
      }

      return 0
    }
  }, [sortState, watchCountByVideoId])

  // ソート処理（メモ化）
  const sortedVideos = useMemo(() => {
    return [...watchCountFilteredVideos].sort(sortFunction)
  }, [watchCountFilteredVideos, sortFunction])

  // ソートハンドラー（メモ化）
  const handleSort = useCallback((field: string) => {
    setSortState((prev) => ({
      field,
      direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }))
  }, [])

  // フィルターハンドラー（メモ化）
  const handleFilterChange = useCallback((key: keyof FilterState, value: string) => {
    setFilterState((prev) => ({ ...prev, [key]: value }))
  }, [])

  // 検索語変更ハンドラー（メモ化）
  const handleSearchChange = useCallback((searchTerm: string) => {
    setFilterState((prev) => ({ ...prev, searchTerm }))
  }, [])

  // キャラクター変更ハンドラー（メモ化）
  const handleCharacterChange = useCallback((character: string) => {
    setFilterState((prev) => ({ ...prev, activeCharacter: character }))
  }, [])

  // 視聴状態変更ハンドラー（メモ化）
  const handleWatchStatusChange = useCallback((status: "all" | "watched" | "unwatched") => {
    setFilterState((prev) => ({ ...prev, watchStatus: status }))
  }, [])

  // 視聴回数変更ハンドラー（メモ化）
  const handleWatchCountChange = useCallback((watchCount: string) => {
    setFilterState((prev) => ({ ...prev, watchCount }))
  }, [])

  return {
    sortState,
    filterState,
    sortedVideos,
    handleSort,
    handleFilterChange,
    handleSearchChange,
    handleCharacterChange,
    handleWatchStatusChange,
    handleWatchCountChange,
  }
}
