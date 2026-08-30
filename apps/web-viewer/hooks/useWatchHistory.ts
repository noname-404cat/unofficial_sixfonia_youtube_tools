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
  // 履歴がカバーする期間。Google側の保存期間で古い分は消えるため、
  // 「未視聴」の但し書きを出すのに使う。
  const [period, setPeriod] = useState<{ from: string; to: string } | null>(null)

  const handleFileChange = useCallback((file: File | null) => {
    setWatchHistoryFile(file)
    setError(null)
  }, [])

  const processFile = useCallback(
    async (knownVideoIds: Set<string>) => {
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

        const { watchedIds, watchCounts, firstAt, lastAt } = extractWatchedVideoIds(watchHistory)
        // 母集団に含まれる videoId がいくつ視聴済みかを数える。
        // 以前は配列の some() で毎回走査していたため、
        // 数千件どうしの突合で重かった。Set で引く。
        let matchedCount = 0
        for (const id of watchedIds) {
          if (knownVideoIds.has(id)) matchedCount++
        }

        if (watchedIds.size === 0) {
          throw new Error(
            "視聴履歴から動画IDを抽出できませんでした。正しいGoogle Takeoutの視聴履歴JSONファイルか確認してください。",
          )
        }

        console.log(`Found ${watchedIds.size} watched videos, ${matchedCount} matched with our data`)
        setWatchedVideoIds(watchedIds)
        setWatchCountByVideoId(watchCounts)

        const summary = {
          watchedVideoIds: watchedIds,
          watchCountByVideoId: watchCounts,
          stats: { total: watchedIds.size, matched: matchedCount },
          period: firstAt && lastAt ? { from: firstAt, to: lastAt } : null,
        }
        setStats(summary.stats)
        setPeriod(summary.period)

        // 呼び出し側は await 直後にこの戻り値を使う。
        // フックのステートは同じクロージャでは更新されていないため、
        // watchHistory.stats を読むと初回は null のままになる。
        return summary
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
    period,
    handleFileChange,
    processFile,
  }
}
