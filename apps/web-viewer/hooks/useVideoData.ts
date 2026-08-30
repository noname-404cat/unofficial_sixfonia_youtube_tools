"use client"

import { useState, useMemo } from "react"
import type { VideoAnalysis, VideoMetadata } from "@/types/video"

export type SortDirection = "asc" | "desc"

export function useVideoData(
  videoAnalysis: VideoAnalysis[],
  videoMetadata: VideoMetadata[],
  activeCharacterTab: string,
  searchTerm: string,
) {
  const [sortField, setSortField] = useState<string>("latestViewDiffChange")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  // フィルタリング関数
  const getFilteredVideos = useMemo(() => {
    // 分析情報がある場合はそれを使用
    if (videoAnalysis.length > 0) {
      return videoAnalysis.filter((video) => {
        // キャラクターでフィルタリング
        if (activeCharacterTab !== "all" && video.character !== activeCharacterTab) {
          return false
        }

        // 検索語でフィルタリング
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase()
          const titleMatch = video.details?.title?.toLowerCase().includes(searchLower)
          const idMatch = video.videoId.toLowerCase().includes(searchLower)

          // タグ検索を追加
          const tagMatch = video.tags?.some((tag) => {
            const cleanTag = removeHashFromTag(tag).toLowerCase()
            return cleanTag.includes(searchLower)
          })

          return titleMatch || idMatch || tagMatch
        }

        return true
      })
    }
    // 分析情報がない場合はメタデータを使用
    else if (videoMetadata.length > 0) {
      return videoMetadata.filter((video) => {
        // キャラクターでフィルタリング
        if (activeCharacterTab !== "all" && video.character !== activeCharacterTab) {
          return false
        }

        // 検索語でフィルタリング
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase()
          const titleMatch = video.title.toLowerCase().includes(searchLower)
          const idMatch = video.videoId.toLowerCase().includes(searchLower)

          // タグ検索を追加
          const tagMatch = video.tags?.some((tag) => {
            const cleanTag = removeHashFromTag(tag).toLowerCase()
            return cleanTag.includes(searchLower)
          })

          return titleMatch || idMatch || tagMatch
        }

        return true
      })
    }

    return []
  }, [videoAnalysis, videoMetadata, activeCharacterTab, searchTerm])

  // ソート処理
  const handleSort = (field: string) => {
    if (sortField === field) {
      // 同じフィールドをクリックした場合は方向を切り替え
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      // 新しいフィールドとデフォルトの方向を設定
      setSortField(field)
      // 加速度指標はデフォルトで昇順、視聴回数はデフォルトで降順
      setSortDirection(field.includes("Diff") ? "asc" : "desc")
    }
  }

  // ソート済みの動画を取得
  const sortedVideos = useMemo(() => {
    return sortVideos(getFilteredVideos, sortField, sortDirection)
  }, [getFilteredVideos, sortField, sortDirection])

  return {
    sortField,
    sortDirection,
    sortedVideos,
    handleSort,
  }
}

// タグから # を除去する関数
export function removeHashFromTag(tag: string): string {
  return tag.startsWith("#") ? tag.substring(1) : tag
}

// 最新の視聴回数を取得
export function getLatestViewCount(video: VideoAnalysis): number {
  const days = Object.keys(video.dailyMetrics).sort()
  return days.length > 0 ? video.dailyMetrics[days[days.length - 1]].viewCount : 0
}

// 日別の視聴回数を取得（累積ではなく日別の差分）
export function getDailyViewCount(video: VideoAnalysis, dayLabel: string): number | null {
  // 日付の昇順に並べ替えられた日付ラベルを取得
  const days = Object.keys(video.dailyMetrics).sort((a, b) => {
    const numA = Number(a.replace("day", ""))
    const numB = Number(b.replace("day", ""))
    return numA - numB
  })

  const dayIndex = days.indexOf(dayLabel)

  // 該当する日のデータがない場合はnullを返す
  if (dayIndex < 0 || !video.dailyMetrics[dayLabel]) {
    return null
  }

  // day0の場合はnullを返す（表示しない）
  if (dayIndex === 0) {
    return null
  }

  // 前日との差分を返す
  const prevDay = days[dayIndex - 1]
  return video.dailyMetrics[dayLabel].viewCount - video.dailyMetrics[prevDay].viewCount
}

// 数値フォーマット関数
export function formatNumber(num: number | null): string {
  if (num === null) return "N/A"
  return num.toLocaleString()
}

export function formatChange(num: number | null): string {
  if (num === null) return "N/A"
  return (num > 0 ? "+" : "") + num.toLocaleString()
}

// 日付フォーマット関数
export function formatJapaneseDate(dateString: string): string {
  try {
    // 日付文字列が8桁の数字（YYYYMMDD形式）の場合
    if (dateString.length === 8 && /^\d{8}$/.test(dateString)) {
      const year = dateString.substring(0, 4)
      const month = dateString.substring(4, 6)
      const day = dateString.substring(6, 8)
      return `${year}年${Number(month)}月${Number(day)}日`
    }

    // 通常の日付文字列の場合は固定フォーマットを使用（ロケールに依存しない）
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${year}年${month}月${day}日`
  } catch (e) {
    return dateString
  }
}

export function formatShortDate(dateString: string): string {
  if (dateString.length !== 8) return dateString

  const year = dateString.substring(0, 4)
  const month = dateString.substring(4, 6)
  const day = dateString.substring(6, 8)

  return `${year}/${month}/${day}`
}

// ソート処理を共通化した関数
function sortVideos(videos: (VideoAnalysis | VideoMetadata)[], sortField: string, sortDirection: SortDirection) {
  if (videos.length === 0) return videos

  return [...videos].sort((a, b) => {
    // 分析情報がある場合
    if ("dailyMetrics" in a && "dailyMetrics" in b) {
      const videoA = a as VideoAnalysis
      const videoB = b as VideoAnalysis

      if (sortField === "publishedAt") {
        // 投稿日でソート
        if (videoA.details?.publishedAt && videoB.details?.publishedAt) {
          return sortDirection === "asc"
            ? new Date(videoA.details.publishedAt).getTime() - new Date(videoB.details.publishedAt).getTime()
            : new Date(videoB.details.publishedAt).getTime() - new Date(videoA.details.publishedAt).getTime()
        }
        return 0
      } else if (sortField === "latestViewCount") {
        // 最新再生数でソート
        const viewCountA = getLatestViewCount(videoA)
        const viewCountB = getLatestViewCount(videoB)
        return sortDirection === "asc" ? viewCountA - viewCountB : viewCountB - viewCountA
      } else if (sortField === "latestViewDiffChange") {
        // 再生数の加速度でソート
        const valueA = videoA.latestViewDiffChange ?? Number.NEGATIVE_INFINITY
        const valueB = videoB.latestViewDiffChange ?? Number.NEGATIVE_INFINITY
        return sortDirection === "asc" ? valueA - valueB : valueB - valueA
      } else if (sortField === "latestLikeDiffChange") {
        // 高評価数の加速度でソート
        const valueA = videoA.latestLikeDiffChange ?? Number.NEGATIVE_INFINITY
        const valueB = videoB.latestLikeDiffChange ?? Number.NEGATIVE_INFINITY
        return sortDirection === "asc" ? valueA - valueB : valueB - valueA
      } else if (sortField === "rank") {
        // ランクでソート
        return sortDirection === "asc" ? videoA.rank - videoB.rank : videoB.rank - videoA.rank
      } else if (sortField.startsWith("day")) {
        // 特定の日の再生数でソート
        const dayViewA = getDailyViewCount(videoA, sortField) ?? Number.NEGATIVE_INFINITY
        const dayViewB = getDailyViewCount(videoB, sortField) ?? Number.NEGATIVE_INFINITY
        return sortDirection === "asc" ? dayViewA - dayViewB : dayViewB - dayViewA
      }
    }
    // メタデータのみの場合
    else if (!("dailyMetrics" in a) && !("dailyMetrics" in b)) {
      const videoA = a as VideoMetadata
      const videoB = b as VideoMetadata

      // 視聴回数でソート
      if (sortField === "watchCount") {
        const watchCountA = getWatchCount(videoA.videoId) || 0
        const watchCountB = getWatchCount(videoB.videoId) || 0
        return sortDirection === "asc" ? watchCountA - watchCountB : watchCountB - watchCountA
      }

      if (sortField === "publishedAt") {
        // 投稿日でソート
        const dateA = new Date(videoA.publishedAt || "").getTime() || 0
        const dateB = new Date(videoB.publishedAt || "").getTime() || 0
        return sortDirection === "asc" ? dateA - dateB : dateB - dateA
      }
    }
    // 混在している場合
    else {
      // 分析情報を持つ動画を優先
      if ("dailyMetrics" in a && !("dailyMetrics" in b)) {
        return -1
      } else if (!("dailyMetrics" in a) && "dailyMetrics" in b) {
        return 1
      }

      // 投稿日でソート
      if (sortField === "publishedAt") {
        const dateA =
          "details" in a
            ? new Date(a.details?.publishedAt || "").getTime() || 0
            : new Date(a.publishedAt || "").getTime() || 0

        const dateB =
          "details" in b
            ? new Date(b.details?.publishedAt || "").getTime() || 0
            : new Date(b.publishedAt || "").getTime() || 0

        return sortDirection === "asc" ? dateA - dateB : dateB - dateA
      }
    }

    return 0
  })
}

export function getWatchCount(videoId: string, watchCountByVideoId?: Record<string, number>): number | null {
  if (!watchCountByVideoId || Object.keys(watchCountByVideoId).length === 0) {
    return null
  }
  return watchCountByVideoId[videoId] || 0
}
