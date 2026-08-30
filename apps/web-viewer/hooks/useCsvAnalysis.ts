"use client"

import { useState, useCallback } from "react"
import { createParseWorker } from "@/lib/workerUtils"
import { calculateDifferences, calculateAccelerations, calculateRankings, processCSVData } from "@/lib/calc"
import { extractCharacterFromFilename, extractDateFromFilename } from "@/lib/video-utils"
import type { VideoAnalysis, ProcessedData, VideoMetadata } from "@/types/video"

/**
 * CSV分析に必要な外部依存。
 * 以前は YouTube API キーを受け取って videos.list を叩いていたが、
 * 動画マスタから引く関数を渡す形にしてキーを不要にした。
 */
export interface CsvAnalysisDeps {
  /** videoId の配列をメタデータへ変換する */
  resolveMetadata: (videoIds: string[]) => Promise<VideoMetadata[]>
  /** CSVファイル名の接頭辞 -> チャンネル表示名 */
  prefixes: Record<string, string>
}

export function useCsvAnalysis() {
  const [analysisFiles, setAnalysisFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [processedData, setProcessedData] = useState<ProcessedData[]>([])
  const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysis[]>([])
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata[]>([])
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [isFetchingDetails, setIsFetchingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)

  const handleFileChange = useCallback((files: File[]) => {
    setAnalysisFiles(files)
    setError(null)
  }, [])

  const processFiles = useCallback(
    async (deps: CsvAnalysisDeps) => {
      if (analysisFiles.length === 0) {
        setError("CSVファイルを選択してください")
        return
      }

      setIsProcessing(true)
      setProgress(0)
      setError(null)

      try {
        const parseWorker = createParseWorker()

        // ファイルを日付別にグループ化
        const filesByDate: Record<string, File[]> = {}
        const detectedCharacters = new Set<string>()

        for (const file of analysisFiles) {
          const date = extractDateFromFilename(file.name)
          if (!date) {
            console.warn(`Could not extract date from filename: ${file.name}`)
            continue
          }

          if (!filesByDate[date]) {
            filesByDate[date] = []
          }
          filesByDate[date].push(file)

          const character = extractCharacterFromFilename(file.name, deps.prefixes)
          if (character) {
            detectedCharacters.add(character)
          }
        }

        if (Object.keys(filesByDate).length === 0) {
          throw new Error(
            "有効な日付情報を持つCSVファイルが見つかりませんでした。ファイル名に日付（YYYYMMDD形式）が含まれているか確認してください。",
          )
        }

        const sortedDates = Object.keys(filesByDate).sort()
        const results: ProcessedData[] = []
        const totalFiles = analysisFiles.length
        let processedFiles = 0

        for (let i = 0; i < sortedDates.length; i++) {
          const date = sortedDates[i]
          const dateFiles = filesByDate[date]
          const label = `day${i}`

          const combinedData: any[] = []

          for (const file of dateFiles) {
            try {
              const content = await file.text()
              const parsedResult = await parseWorker.parseCSV(content)
              const parsedData = parsedResult.data || []

              if (parsedData.length === 0) {
                console.warn(`No valid data parsed from file: ${file.name}`)
                continue
              }

              const character = extractCharacterFromFilename(file.name, deps.prefixes)
              const processedRows = processCSVData(parsedData, date, character)
              combinedData.push(...processedRows)

              processedFiles++
              setProgress((processedFiles / totalFiles) * 100)
            } catch (error) {
              console.error(`Error processing file ${file.name}:`, error)
            }
          }

          if (combinedData.length === 0) {
            console.warn(`No valid data for date: ${date}`)
            continue
          }

          results.push({
            label,
            date,
            data: combinedData,
          })
        }

        if (results.length === 0) {
          throw new Error("有効なデータが見つかりませんでした。CSVファイルの形式を確認してください。")
        }

        results.sort((a, b) => a.date.localeCompare(b.date))
        setProcessedData(results)

        // 動画分析を実行
        await analyzeVideoData(results, deps)

        return { detectedCharacters: Array.from(detectedCharacters) }
      } catch (err) {
        console.error("Analysis processing error:", err)
        setError(
          err instanceof Error
            ? err.message
            : "アップロードされた分析情報CSVが無効か、正しくフォーマットされていません。",
        )
        throw err
      } finally {
        setIsProcessing(false)
        setProgress(100)
      }
    },
    [analysisFiles],
  )

  const analyzeVideoData = async (processedData: ProcessedData[], deps: CsvAnalysisDeps) => {
    if (!processedData || processedData.length === 0) {
      console.warn("No processed data to analyze")
      return
    }

    try {
      setProgress(50)

      const videoMap: Record<string, any> = {}

      processedData.forEach((dayData) => {
        if (!dayData.data || dayData.data.length === 0) {
          console.warn(`No data for day: ${dayData.label}`)
          return
        }

        dayData.data.forEach((video) => {
          if (!video.videoId) {
            console.warn("Found video entry without videoId")
            return
          }

          if (!videoMap[video.videoId]) {
            videoMap[video.videoId] = {
              videoId: video.videoId,
              videoURL: video.videoURL || `https://www.youtube.com/watch?v=${video.videoId}`,
              metrics: {},
              character: video.character,
            }
          }

          videoMap[video.videoId].metrics[dayData.label] = {
            day: dayData.label,
            viewCount: video.viewCount || 0,
            likeCount: video.likeCount || 0,
            commentCount: video.commentCount || 0,
          }
        })
      })

      if (Object.keys(videoMap).length === 0) {
        console.warn("No videos found in processed data")
        return
      }

      const videoIds = Object.keys(videoMap)
      setIsFetchingDetails(true)
      setProgress(60)

      let videoDetails: VideoMetadata[] = []

      try {
        videoDetails = await deps.resolveMetadata(videoIds)
        setProgress(80)
      } catch (lookupError) {
        console.error("動画マスタの参照でエラー:", lookupError)
        setDetailsError("動画マスタを参照できませんでした。動画の詳細情報なしで分析を続行します。")

        videoDetails = videoIds.map((id) => ({
          videoId: id,
          title: id,
          publishedAt: "",
          thumbnailUrl: "/placeholder.svg",
        }))
      }

      setVideoMetadata(videoDetails)
      setProgress(90)

      const analysis: VideoAnalysis[] = Object.values(videoMap).map((video) => {
        const dailyMetrics = video.metrics
        const differences = calculateDifferences(dailyMetrics)
        const accelerations = calculateAccelerations(differences)

        const latestViewDiffChange =
          accelerations.length > 0 ? accelerations[accelerations.length - 1].viewDiffChange : null

        const latestLikeDiffChange =
          accelerations.length > 0 ? accelerations[accelerations.length - 1].likeDiffChange : null

        const details = videoDetails.find((meta) => meta.videoId === video.videoId)

        return {
          videoId: video.videoId,
          videoURL: video.videoURL,
          dailyMetrics,
          differences,
          accelerations,
          latestViewDiffChange,
          latestLikeDiffChange,
          rank: 0,
          details: details,
          character: video.character,
          isAvailable: details?.isAvailable,
          tags: details?.tags,
          tagSource: details?.tagSource || "パフォーマンス分析",
        }
      })

      if (analysis.length === 0) {
        console.warn("No analysis data generated")
        return
      }

      const rankedVideos = calculateRankings(analysis)
      setProgress(95)

      setVideoAnalysis(rankedVideos)
      setProgress(100)
    } catch (error) {
      console.error("Error during video analysis:", error)
      setDetailsError("動画分析中にエラーが発生しました。データを確認してください。")
    } finally {
      setIsFetchingDetails(false)
    }
  }

  return {
    analysisFiles,
    isProcessing,
    processedData,
    videoAnalysis,
    videoMetadata,
    error,
    progress,
    isFetchingDetails,
    detailsError,
    handleFileChange,
    processFiles,
  }
}
