"use client"

import { useState, useCallback } from "react"
import { createParseWorker } from "@/lib/workerUtils"
import { extractWatchedVideoIds } from "@/lib/calc"
import { readFileAsText } from "@/lib/video-utils"

export function useWatchHistory() {
  const [watchHistoryFile, setWatchHistoryFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [watchedVideoIds, setWatchedVideoIds] = useState<Set<string>>(new Set())
  const [watchCountByVideoId, setWatchCountByVideoId] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<{ total: number; matched: number } | null>(null)

  const handleFileChange = useCallback((file: File | null) => {
    setWatchHistoryFile(file)
    setError(null)
  }, [])

  const processFile = useCallback(
    async (videoAnalysis: any[]) => {
      if (!watchHistoryFile) {
        setError("JSONファイルを選択してください")
        return
      }

      setIsProcessing(true)
      setError(null)

      try {
        const content = await readFileAsText(watchHistoryFile)

        if (!content || content.trim() === "") {
          throw new Error("JSONファイルが空です")
        }

        const parseWorker = createParseWorker()
        const watchHistory = await parseWorker.parseJSON(content)

        if (!Array.isArray(watchHistory) || watchHistory.length === 0) {
          throw new Error(
            "視聴履歴データが見つかりませんでした。正しいGoogle Takeoutの視聴履歴JSONファイルか確認してください。",
          )
        }

        console.log(`Processing ${watchHistory.length} watch history entries`)

        const { watchedIds, watchCounts } = extractWatchedVideoIds(watchHistory)
        let matchedCount = 0
        if (videoAnalysis) {
          matchedCount = Array.from(watchedIds).filter((id) =>
            videoAnalysis.some((video) => video.videoId === id),
          ).length
        }

        if (watchedIds.size === 0) {
          throw new Error(
            "視聴履歴から動画IDを抽出できませんでした。正しいGoogle Takeoutの視聴履歴JSONファイルか確認してください。",
          )
        }

        console.log(`Found ${watchedIds.size} watched videos, ${matchedCount} matched with our data`)
        setWatchedVideoIds(watchedIds)
        setWatchCountByVideoId(watchCounts)

        setStats({
          total: watchedIds.size,
          matched: matchedCount,
        })
      } catch (err) {
        console.error("Watch history processing error:", err)
        setError(
          err instanceof Error
            ? err.message
            : "JSONファイルの処理中にエラーが発生しました。正しいGoogle Takeoutの視聴履歴JSONファイルか確認してください。",
        )
      } finally {
        setIsProcessing(false)
      }
    },
    [watchHistoryFile],
  )

  return {
    watchHistoryFile,
    isProcessing,
    watchedVideoIds,
    watchCountByVideoId,
    error,
    stats,
    handleFileChange,
    processFile,
  }
}
