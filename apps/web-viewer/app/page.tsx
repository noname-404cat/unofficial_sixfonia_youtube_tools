"use client"

import type React from "react"

import { useMemo, useCallback, useState } from "react"
import { createParseWorker } from "@/lib/workerUtils"
import {
  calculateDifferences,
  calculateAccelerations,
  calculateRankings,
  processCSVData,
  extractWatchedVideoIds,
} from "@/lib/calc"
import VirtualizedVideoTable from "@/components/video/VirtualizedVideoTable"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, Search, Eye, BarChart, Info, ChevronUp, ChevronDown, Users } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import type { VideoMetadata, VideoStats, ProcessedData, VideoAnalysis } from "@/types/video"
import { formatJapaneseDate, formatNumber } from "@/hooks/useVideoData"
import WatchCountFilter from "@/components/video/WatchCountFilter"
import { VIEW_COUNT_RANGES } from "@/utils/viewCountUtils"
import ChannelHome from "@/components/channel/ChannelHome"
import { VideoPerformanceTableContainer } from "@/components/video/VideoPerformanceTableContainer"
import { AnalysisUploadContainer } from "@/components/video/AnalysisUploadContainer"
import { useSnapshot } from "@/hooks/useSnapshot"
import {
  videoMap as buildVideoMap,
  displayNames as buildDisplayNames,
  filenamePrefixMap,
  toVideoMetadata,
  isStale as isSnapshotStale,
} from "@/lib/snapshot"

// チャンネル名と表示名の対応は動画マスタ（スナップショット）を唯一の正とする。
// 以前はここに直書きしていたため、チャンネルが増減するたびに複数箇所を直す必要があった。

// タグを表示するコンポーネント
const VideoTags = ({ videoId, tags }: { videoId: string; tags?: string[] }) => {
  if (!tags || tags.length === 0) {
    return <span className="text-gray-500">—</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <Badge key={`${videoId}-${tag}`} variant="secondary">
          {tag}
        </Badge>
      ))}
    </div>
  )
}

// 最新の視聴回数を取得する関数
const getLatestViewCount = (video: VideoAnalysis): number => {
  if (!video || !video.dailyMetrics) {
    return 0
  }

  // dailyMetricsから最新の日付のデータを取得
  const latestDate = Object.keys(video.dailyMetrics).sort().pop()
  if (!latestDate) {
    return 0
  }

  return video.dailyMetrics[latestDate].viewCount || 0
}

// 日毎の視聴回数を取得する関数
const getDailyViewCount = (video: VideoAnalysis, day: string): number | undefined => {
  if (!video || !video.dailyMetrics || !video.dailyMetrics[day]) {
    return undefined
  }
  return video.dailyMetrics[day].viewCount
}

// 変化量をフォーマットする関数
const formatChange = (value: number | null | undefined): string => {
  if (value === null || value === undefined) {
    return "—"
  }

  const formattedValue = formatNumber(value)
  return value > 0 ? `+${formattedValue}` : formattedValue
}

type SortDirection = "asc" | "desc"

export default function CSVUploader() {
  // 共通のステート
  const [activeTab, setActiveTab] = useState("performance-analysis")
  const [searchTerm, setSearchTerm] = useState("")
  const [activeCharacterTab, setActiveCharacterTab] = useState("all")
  const [availableCharacters, setAvailableCharacters] = useState<string[]>([])
  const [availableTags, setAvailableTags] = useState<string[]>([])
  // 動画マスタ。YouTube API は呼ばない（キーは不要）。
  const { snapshot, isLoading: isLoadingSnapshot, error: snapshotError } = useSnapshot()
  const snapshotVideos = useMemo(() => (snapshot ? buildVideoMap(snapshot) : new Map()), [snapshot])
  const channelDisplay = useMemo(() => (snapshot ? buildDisplayNames(snapshot) : {}), [snapshot])
  const filenamePrefixes = useMemo(() => (snapshot ? filenamePrefixMap(snapshot) : {}), [snapshot])
  const snapshotIsStale = snapshot ? isSnapshotStale(snapshot.updated_at) : false

  // 動画メタデータ関連のステート
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata[]>([])
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false)

  const [metadataError, setMetadataError] = useState<string | null>(null)

  // パフォーマンス分析関連のステート
  const [analysisFiles, setAnalysisFiles] = useState<File[]>([])
  const [isProcessingAnalysis, setIsProcessingAnalysis] = useState(false)
  const [processedData, setProcessedData] = useState<ProcessedData[]>([])
  const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysis[]>([])
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [isFetchingDetails, setIsFetchingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)

  // 未視聴チェック関連のステート
  const [watchHistoryFile, setWatchHistoryFile] = useState<File | null>(null)
  const [isProcessingWatchHistory, setIsProcessingWatchHistory] = useState(false)
  const [watchedVideoIds, setWatchedVideoIds] = useState<Set<string>>(new Set())
  const [watchHistoryError, setWatchHistoryError] = useState<string | null>(null)
  const [watchHistoryStats, setWatchHistoryStats] = useState<{ total: number; matched: number } | null>(null)
  // 履歴がカバーする期間。保存期間の制約を画面に出すために持つ。
  const [watchHistoryPeriod, setWatchHistoryPeriod] = useState<{ from: string; to: string } | null>(null)
  const [watchStatusFilter, setWatchStatusFilter] = useState<"all" | "watched" | "unwatched">("all")
  const [unwatchedVideos, setUnwatchedVideos] = useState<VideoMetadata[]>([])
  // 視聴回数を保存するステートを追加
  const [watchCountByVideoId, setWatchCountByVideoId] = useState<Record<string, number>>({})

  // 動画ID一覧関連のステート
  const [videoIdListFile, setVideoIdListFile] = useState<File | null>(null)
  const [isProcessingVideoIdList, setIsProcessingVideoIdList] = useState(false)
  const [videoIdList, setVideoIdList] = useState<string[]>([])
  const [videoIdListMetadata, setVideoIdListMetadata] = useState<VideoMetadata[]>([])
  const [videoIdListError, setVideoIdListError] = useState<string | null>(null)

  // 全ての動画IDを保持するステート
  const [allVideoIds, setAllVideoIds] = useState<Set<string>>(new Set())

  // タグ関連のステート
  const [showAllTags, setShowAllTags] = useState<Record<string, boolean>>({})
  const [expandedTagSections, setExpandedTagSections] = useState<Record<string, boolean>>({})

  // 新しいステートを追加します（他のステート変数の近くに追加）
  const [watchCountFilter, setWatchCountFilter] = useState<string>("all")
  // Shorts の絞り込み。セクションは分けず、必要なときだけ絞る。
  const [shortsFilter, setShortsFilter] = useState<"all" | "long" | "shorts">("all")
  // リピート推奨: 視聴回数の多い順に並べる
  const [sortByWatchCount, setSortByWatchCount] = useState(false)

  // カスタムフックを使用してデータ処理とソートを行う
  const [sortField, setSortField] = useState<string>("latestViewDiffChange")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  // チャンネルの選択肢。CSVが無くても動画マスタから作れるようにする。
  const characterOptions = useMemo(() => {
    const fromSnapshot = snapshot ? snapshot.channels.map((c) => c.display) : []
    return Array.from(new Set([...fromSnapshot, ...availableCharacters]))
  }, [snapshot, availableCharacters])

  // Memoize filtered videos
  const filteredVideos = useMemo(() => {
    // Filter by character
    const characterFiltered =
      activeCharacterTab === "all"
        ? videoAnalysis
        : videoAnalysis.filter((video) => video.character === activeCharacterTab)

    // Filter by search term
    if (!searchTerm) return characterFiltered

    const searchLower = searchTerm.toLowerCase()
    return characterFiltered.filter((video) => {
      const titleMatch = video.details?.title?.toLowerCase().includes(searchLower)
      const idMatch = video.videoId.toLowerCase().includes(searchLower)
      const tagMatch = video.tags?.some((tag) => {
        const cleanTag = tag.startsWith("#") ? tag.substring(1) : tag
        return cleanTag.toLowerCase().includes(searchLower)
      })

      return titleMatch || idMatch || tagMatch
    })
  }, [videoAnalysis, activeCharacterTab, searchTerm])

  // Memoize sorted videos
  const sortedVideos = useMemo(() => {
    return [...filteredVideos].sort((a, b) => {
      if (sortField === "publishedAt") {
        const dateA = new Date(a.details?.publishedAt || "").getTime() || 0
        const dateB = new Date(b.details?.publishedAt || "").getTime() || 0
        return sortDirection === "asc" ? dateA - dateB : dateB - dateA
      } else if (sortField === "latestViewCount") {
        const viewCountA = getLatestViewCount(a)
        const viewCountB = getLatestViewCount(b)
        return sortDirection === "asc" ? viewCountA - viewCountB : viewCountB - viewCountA
      } else if (sortField === "latestViewDiffChange") {
        const valueA = a.latestViewDiffChange ?? Number.NEGATIVE_INFINITY
        const valueB = b.latestViewDiffChange ?? Number.NEGATIVE_INFINITY
        return sortDirection === "asc" ? valueA - valueB : valueB - valueA
      } else if (sortField === "latestLikeDiffChange") {
        const valueA = a.latestLikeDiffChange ?? Number.NEGATIVE_INFINITY
        const valueB = b.latestLikeDiffChange ?? Number.NEGATIVE_INFINITY
        return sortDirection === "asc" ? valueA - valueB : valueB - valueA
      } else if (sortField === "rank") {
        return sortDirection === "asc" ? a.rank - b.rank : b.rank - a.rank
      } else if (sortField.startsWith("day")) {
        const dayViewA = getDailyViewCount(a, sortField) ?? Number.NEGATIVE_INFINITY
        const dayViewB = getDailyViewCount(b, sortField) ?? Number.NEGATIVE_INFINITY
        return sortDirection === "asc" ? dayViewA - dayViewB : dayViewB - dayViewA
      }

      return 0
    })
  }, [filteredVideos, sortField, sortDirection])

  // Handle sort
  const handleSort = useCallback(
    (field: string) => {
      if (sortField === field) {
        // Toggle direction if same field
        setSortDirection(sortDirection === "asc" ? "desc" : "asc")
      } else {
        // Set new field and default direction
        setSortField(field)
        // Default to ascending for diff metrics, descending for others
        setSortDirection(field.includes("Diff") ? "asc" : "desc")
      }
    },
    [sortField, sortDirection],
  )

  // ファイル読み込み共通関数
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = (e) => reject(new Error("ファイルの読み込みに失敗しました"))
      reader.readAsText(file)
    })
  }

  // 昨日の日付を取得する関数
  const getYesterdayDate = (): Date => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday
  }

  // 1週間前の日付を取得する関数
  const getLastWeekDate = (): Date => {
    const lastWeek = new Date()
    lastWeek.setDate(lastWeek.getDate() - 7)
    return lastWeek
  }

  // 今月の初日を取得する関数
  const getFirstDayOfMonth = (): Date => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  }

  // 動画が今月投稿されたかどうかを判定する関数
  const isUploadedThisMonth = (publishedAt: string): boolean => {
    if (!publishedAt) return false

    try {
      const publishDate = new Date(publishedAt)
      const firstDayOfMonth = getFirstDayOfMonth()
      const today = new Date()

      // 日付が有効かチェック
      if (isNaN(publishDate.getTime())) return false

      // 今月の初日から今日までの範囲内かチェック
      return publishDate >= firstDayOfMonth && publishDate <= today
    } catch (e) {
      return false
    }
  }

  // 動画が昨日投稿されたかどうかを判定する関数
  const isUploadedYesterday = (publishedAt: string): boolean => {
    if (!publishedAt) return false

    try {
      const publishDate = new Date(publishedAt)
      const yesterday = getYesterdayDate()

      // 日付が有効かチェック
      if (isNaN(publishDate.getTime())) return false

      // 年月日が一致するかチェック（時間は無視）
      return (
        publishDate.getDate() === yesterday.getDate() &&
        publishDate.getMonth() === yesterday.getMonth() &&
        publishDate.getFullYear() === yesterday.getFullYear()
      )
    } catch (e) {
      return false
    }
  }

  // 動画が先週投稿されたかどうかを判定する関数
  const isUploadedLastWeek = (publishedAt: string): boolean => {
    if (!publishedAt) return false

    try {
      const publishDate = new Date(publishedAt)
      const lastWeek = getLastWeekDate()

      // 日付が有効かチェック
      if (isNaN(publishDate.getTime())) return false

      // 先週（7日前）から今日までの範囲内かチェック
      return publishDate >= lastWeek && publishDate <= new Date()
    } catch (e) {
      return false
    }
  }

  // 先週と昨日の動画を取得する関数
  const getRecentVideos = () => {
    // パフォーマンス分析と動画ID一覧の両方から動画を取得
    const combinedVideos = getCombinedVideoList()

    // 昨日投稿された動画
    const yesterdayVideos = combinedVideos.filter((video) => {
      const publishedAt = "details" in video ? video.details?.publishedAt : video.publishedAt
      return isUploadedYesterday(publishedAt || "")
    })

    // 先週投稿された動画（昨日を含む）
    const lastWeekVideos = combinedVideos.filter((video) => {
      const publishedAt = "details" in video ? video.details?.publishedAt : video.publishedAt
      return isUploadedLastWeek(publishedAt || "")
    })

    // 今月投稿された動画
    const thisMonthVideos = combinedVideos.filter((video) => {
      const publishedAt = "details" in video ? video.details?.publishedAt : video.publishedAt
      return isUploadedThisMonth(publishedAt || "")
    })

    return {
      yesterdayVideos,
      lastWeekVideos,
      thisMonthVideos,
    }
  }

  // キャラクター抽出関数
  const extractCharacterFromFilename = (filename: string): string | null => {
    if (!filename) return null

    for (const [prefix, characterName] of Object.entries(filenamePrefixes)) {
      if (filename.startsWith(prefix)) {
        return characterName
      }
    }
    return null
  }

  // 日付抽出関数
  const extractDateFromFilename = (filename: string): string | null => {
    if (!filename) return null

    const match = filename.match(/\d{8}/)
    return match ? match[0] : null
  }

  // ハッシュタグを抽出する関数
  const extractHashtags = (text = ""): string[] => {
    if (!text) return []

    // ハッシュタグを抽出する正規表現
    const hashtagRegex =
      /#([a-zA-Z0-9_\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]+)/g

    // マッチしたハッシュタグを配列として取得
    const matches = text.match(hashtagRegex) || []

    // '#'を含めたハッシュタグを返す
    return matches
  }

  // キャラクター別のタグを取得する関数
  const getCharacterSpecificTags = (): string[] => {
    if (activeCharacterTab === "all") {
      // すべてのタグを返す
      return availableTags
    }

    // 現在選択されているキャラクターに関連する動画のみをフィルタリング
    const characterVideos = [...videoAnalysis, ...videoIdListMetadata].filter(
      (video) => "character" in video && video.character === activeCharacterTab,
    )

    // キャラクター固有のタグを収集
    const characterTags = new Set<string>()
    characterVideos.forEach((video) => {
      if (video.tags) {
        video.tags.forEach((tag) => characterTags.add(tag))
      }
    })

    return Array.from(characterTags)
  }

  // 2. パフォーマンス分析CSVアップロード処理
  const handleAnalysisFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAnalysisFiles(Array.from(e.target.files))
      setAnalysisError(null)
    }
  }, [])

  const processAnalysisFiles = async () => {
    if (analysisFiles.length === 0) {
      setAnalysisError("CSVファイルを選択してください")
      return
    }

    setIsProcessingAnalysis(true)
    setAnalysisProgress(0)
    setAnalysisError(null)

    try {
      // Create worker for parsing
      const parseWorker = createParseWorker()

      // File grouping by date
      const filesByDate: Record<string, File[]> = {}
      const detectedCharacters = new Set<string>()

      for (const file of analysisFiles) {
        const date = file.name ? extractDateFromFilename(file.name) : null
        if (!date) {
          console.warn(`Could not extract date from filename: ${file.name}`)
          continue
        }

        if (!filesByDate[date]) {
          filesByDate[date] = []
        }
        filesByDate[date].push(file)

        // Extract character info
        const character = file.name ? extractCharacterFromFilename(file.name) : null
        if (character) {
          detectedCharacters.add(character)
        }
      }

      // Check if we have any valid files
      if (Object.keys(filesByDate).length === 0) {
        throw new Error(
          "有効な日付情報を持つCSVファイルが見つかりませんでした。ファイル名に日付（YYYYMMDD形式）が含まれているか確認してください。",
        )
      }

      // Update available characters
      if (detectedCharacters.size > 0) {
        setAvailableCharacters((prev) => {
          const combined = new Set([...prev, ...detectedCharacters])
          return Array.from(combined)
        })

        // Select first character by default
        if (activeCharacterTab === "all" && detectedCharacters.size > 0) {
          setActiveCharacterTab(Array.from(detectedCharacters)[0])
        }
      }

      // Sort dates
      const sortedDates = Object.keys(filesByDate).sort()
      console.log("Sorted dates:", sortedDates)

      // Process each date group
      const results: ProcessedData[] = []
      const totalFiles = analysisFiles.length
      let processedFiles = 0

      for (let i = 0; i < sortedDates.length; i++) {
        const date = sortedDates[i]
        const dateFiles = filesByDate[date]
        const label = `day${i}` // day0, day1, etc.

        // Combined data for the same date
        const combinedData: VideoStats[] = []

        for (const file of dateFiles) {
          try {
            // Read file content
            const content = await readFileAsText(file)

            // Parse CSV in worker thread
            const parsedResult = await parseWorker.parseCSV(content)
            const parsedData = parsedResult.data || []

            if (parsedData.length === 0) {
              console.warn(`No valid data parsed from file: ${file.name}`)
              continue
            }

            // Extract character info
            const character = file.name ? extractCharacterFromFilename(file.name) : null

            // Process the parsed data
            const processedRows = processCSVData(parsedData, date, character)
            combinedData.push(...processedRows)

            // Update progress
            processedFiles++
            setAnalysisProgress((processedFiles / totalFiles) * 100)
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

      // Sort by date
      results.sort((a, b) => a.date.localeCompare(b.date))

      console.log(`Processed ${results.length} days of data`)
      setProcessedData(results)

      // Analyze data
      if (results.length > 0) {
        analyzeVideoData(results)
      }
    } catch (err) {
      console.error("Analysis processing error:", err)
      setAnalysisError(
        err instanceof Error
          ? err.message
          : "アップロードされた分析情報CSVが無効か、正しくフォーマットされていません。",
      )
    } finally {
      setIsProcessingAnalysis(false)
      setAnalysisProgress(100)
    }
  }

  const parseCSV = (content: string): VideoStats[] => {
    if (!content || content.trim() === "") {
      console.warn("Empty CSV content provided to parseCSV")
      return []
    }

    const lines = content.split(/\r?\n/).filter((line) => line.trim() !== "")

    if (lines.length === 0) {
      console.warn("No data lines found in CSV")
      return []
    }

    const headers = lines[0].split(",")
    console.log("Analysis CSV headers:", headers)

    return lines
      .slice(1)
      .filter((line) => line.trim() !== "")
      .map((line, index) => {
        try {
          const values = line.split(",")

          // Ensure we have enough values
          if (values.length < 5) {
            console.warn(`Line ${index + 2} has insufficient values:`, line)
            return null
          }

          return {
            videoId: values[0] || "",
            viewCount: Number.parseInt(values[1], 10) || 0,
            likeCount: Number.parseInt(values[2], 10) || 0,
            commentCount: Number.parseInt(values[3], 10) || 0,
            videoURL: values[4] || `https://www.youtube.com/watch?v=${values[0]}`,
          }
        } catch (error) {
          console.error(`Error parsing line ${index + 2}:`, line, error)
          return null
        }
      })
      .filter((item): item is VideoStats => item !== null)
  }

  // 動画IDをメタデータへ変換する。
  //
  // 以前は videos.list を叩いていたが、そのためだけに API キーをブラウザへ
  // 配る必要があった。マスタは日次バッチが作っているのでそれを引く。
  // 旧実装の分割ループには条件が定数（0 < videoIds.length）になった
  // 無限ループのバグがあり、それもここで消えている。
  const fetchVideoDetails = async (videoIds: string[]): Promise<VideoMetadata[]> => {
    return videoIds.map((id) => {
      const video = snapshotVideos.get(id)
      if (!video) {
        // マスタに無い＝対象7チャンネル以外、または取得後に削除された動画
        return {
          videoId: id,
          title: id,
          publishedAt: "",
          thumbnailUrl: "/placeholder.svg",
          isAvailable: false,
        }
      }
      return toVideoMetadata(video, channelDisplay[video.channel] ?? video.channel)
    })
  }

  // Replace the entire analyzeVideoData function with this corrected version:

  const analyzeVideoData = async (processedData: ProcessedData[]) => {
    if (!processedData || processedData.length === 0) {
      console.warn("No processed data to analyze")
      return
    }

    try {
      // Step 1: Organize data by video ID
      setAnalysisProgress(50) // Start analysis progress at 50%

      const videoMap: Record<
        string,
        {
          videoId: string
          videoURL: string
          metrics: Record<string, { day: string; viewCount: number; likeCount: number; commentCount: number }>
          character?: string
        }
      > = {}

      // Create video map from all days' data
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

          const videoWithCharacter = video as VideoStats & { character?: string }

          if (!videoMap[video.videoId]) {
            videoMap[video.videoId] = {
              videoId: video.videoId,
              videoURL: video.videoURL || `https://www.youtube.com/watch?v=${video.videoId}`,
              metrics: {},
              character: videoWithCharacter.character,
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

      // Get video IDs
      const videoIds = Object.keys(videoMap)
      setIsFetchingDetails(true)
      setAnalysisProgress(60)

      let videoDetails: VideoMetadata[] = []

      try {
        videoDetails = await fetchVideoDetails(videoIds)
        setAnalysisProgress(80)
      } catch (lookupError) {
        console.error("動画マスタの参照でエラー:", lookupError)
        setDetailsError("動画マスタを参照できませんでした。動画の詳細情報なしで分析を続行します。")

        // Create minimal metadata on error
        videoDetails = videoIds.map((id) => ({
          videoId: id,
          title: id,
          publishedAt: "",
          thumbnailUrl: "/placeholder.svg",
        }))
      }

      setVideoMetadata(videoDetails)
      setAnalysisProgress(90)

      // Step 2: Calculate differences and accelerations for each video
      const analysis: VideoAnalysis[] = Object.values(videoMap).map((video) => {
        const dailyMetrics = video.metrics

        // Calculate differences between consecutive days
        const differences = calculateDifferences(dailyMetrics)

        // Calculate accelerations (differences of differences)
        const accelerations = calculateAccelerations(differences)

        // Get latest acceleration values
        const latestViewDiffChange =
          accelerations.length > 0 ? accelerations[accelerations.length - 1].viewDiffChange : null

        const latestLikeDiffChange =
          accelerations.length > 0 ? accelerations[accelerations.length - 1].likeDiffChange : null

        // Get video details
        const details = videoDetails.find((meta) => meta.videoId === video.videoId)

        return {
          videoId: video.videoId,
          videoURL: video.videoURL,
          dailyMetrics,
          differences,
          accelerations,
          latestViewDiffChange,
          latestLikeDiffChange,
          rank: 0, // Will be set after sorting
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

      // Step 3: Calculate rankings
      const rankedVideos = calculateRankings(analysis)
      setAnalysisProgress(95)

      console.log(
        `Analysis complete: ${rankedVideos.filter((v) => v.latestViewDiffChange !== null).length} videos with acceleration, ${rankedVideos.filter((v) => v.latestViewDiffChange === null).length} without`,
      )
      setVideoAnalysis(rankedVideos)

      // Switch to analysis results tab
      if (rankedVideos.length > 0) {
        setActiveTab("analysis-results")
        if (activeCharacterTab === "all" && availableCharacters.length > 0) {
          setActiveCharacterTab(availableCharacters[0])
        }
      }

      setAnalysisProgress(100)
    } catch (error) {
      console.error("Error during video analysis:", error)
      setDetailsError("動画分析中にエラーが発生しました。データを確認してください。")
    } finally {
      setIsFetchingDetails(false)
    }
  }

  // 3. 未視聴チェック処理
  const handleWatchHistoryFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setWatchHistoryFile(e.target.files[0])
      setWatchHistoryError(null)
    }
  }, [])

  const processWatchHistoryFile = async () => {
    if (!watchHistoryFile) {
      setWatchHistoryError("JSONファイルを選択してください")
      return
    }

    setIsProcessingWatchHistory(true)
    setWatchHistoryError(null)

    try {
      const content = await readFileAsText(watchHistoryFile)

      if (!content || content.trim() === "") {
        throw new Error("JSONファイルが空です")
      }

      // Create worker for parsing
      const parseWorker = createParseWorker()

      // Parse JSON in worker thread
      const watchHistory = await parseWorker.parseJSON(content)

      if (!Array.isArray(watchHistory) || watchHistory.length === 0) {
        throw new Error(
          "視聴履歴データが見つかりませんでした。正しいGoogle Takeoutの視聴履歴JSONファイルか確認してください。",
        )
      }

      console.log(`Processing ${watchHistory.length} watch history entries`)

      // Extract video IDs and count watches
      const { watchedIds, watchCounts } = extractWatchedVideoIds(watchHistory)
      let matchedCount = 0
      if (videoAnalysis) {
        matchedCount = Array.from(watchedIds).filter((id) => videoAnalysis.some((video) => video.videoId === id)).length
      }

      if (watchedIds.size === 0) {
        throw new Error(
          "視聴履歴から動画IDを抽出できませんでした。正しいGoogle Takeoutの視聴履歴JSONファイルか確認してください。",
        )
      }

      console.log(`Found ${watchedIds.size} watched videos, ${matchedCount} matched with our data`)
      setWatchedVideoIds(watchedIds)
      setWatchCountByVideoId(watchCounts)

      // Set statistics
      setWatchHistoryStats({
        total: watchedIds.size,
        matched: matchedCount,
      })

      // Switch to unwatched check tab
      setActiveTab("unwatched-check")
      if (activeCharacterTab === "all" && availableCharacters.length > 0) {
        setActiveCharacterTab(availableCharacters[0])
      }
      setWatchStatusFilter("all")
    } catch (err) {
      console.error("Watch history processing error:", err)
      setWatchHistoryError(
        err instanceof Error
          ? err.message
          : "JSONファイルの処理中にエラーが発生しました。正しいGoogle Takeoutの視聴履歴JSONファイルか確認してください。",
      )
    } finally {
      setIsProcessingWatchHistory(false)
    }
  }

  // 4. 動画ID一覧処理
  const handleVideoIdListFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideoIdListFile(e.target.files[0])
      setVideoIdListError(null)
    }
  }, [])

  const processVideoIdListFile = async () => {
    if (!videoIdListFile) {
      setVideoIdListError("CSVファイルを選択してください")
      return
    }

    setIsProcessingVideoIdList(true)
    setVideoIdListError(null)

    try {
      const content = await readFileAsText(videoIdListFile)

      if (!content || content.trim() === "") {
        throw new Error("CSVファイルが空です")
      }

      // CSVを解析して動画IDのリストを取得
      const lines = content.split(/\r?\n/).filter((line) => line.trim() !== "")

      // 最初の行がヘッダーかどうかを確認
      let videoIds: string[] = []
      if (lines.length > 0) {
        // 単純に各行の最初のカラムを動画IDとして扱う
        videoIds = lines
          .map((line) => {
            const columns = line.split(",")
            return columns[0].trim()
          })
          .filter((id) => id !== "" && id !== "videoId") // 空の値とヘッダー行を除外
      }

      if (videoIds.length === 0) {
        throw new Error("有効な動画IDが見つかりませんでした。CSVファイルの形式を確認してください。")
      }

      console.log(`Found ${videoIds.length} video IDs in the list`)
      setVideoIdList(videoIds)

      // YouTube APIから動画詳細を取得
      setIsFetchingDetails(true)

      try {
        const videoDetails = await fetchVideoDetails(videoIds)
        setVideoIdListMetadata(videoDetails)

        // 動画ID一覧タブに切り替え
        setActiveTab("video-id-list")
      } catch (error) {
        console.error("Error fetching video details:", error)
        setVideoIdListError("YouTube APIからの動画情報取得中にエラーが発生しました。APIキーを確認してください。")
      } finally {
        setIsFetchingDetails(false)
      }
    } catch (error) {
      console.error("Video ID list processing error:", error)
      setVideoIdListError(error instanceof Error ? error.message : "CSVファイルの処理中にエラーが発生しました。")
    } finally {
      setIsProcessingVideoIdList(false)
    }
  }

  // 統合された動画リストを取得
  const getCombinedVideoList = () => {
    const combinedVideos = new Map<string, VideoMetadata | VideoAnalysis>()

    // 動画マスタを既定の母集団にする。CSVをアップロードしなくても
    // 未視聴チェックが使えるのはこのため。
    if (snapshot) {
      for (const video of snapshot.videos) {
        combinedVideos.set(
          video.videoId,
          toVideoMetadata(video, channelDisplay[video.channel] ?? video.channel),
        )
      }
    }

    // パフォーマンス分析からの動画を追加（再生数の差分列が付くので上書きする）
    if (videoAnalysis && videoAnalysis.length > 0) {
      videoAnalysis.forEach((video) => {
        if (video && video.videoId) {
          combinedVideos.set(video.videoId, video)
        }
      })
    }

    // 動画ID一覧からの動画を追加（まだ追加されていない場合のみ）
    if (videoIdListMetadata && videoIdListMetadata.length > 0) {
      videoIdListMetadata.forEach((video) => {
        if (video && video.videoId && !combinedVideos.has(video.videoId)) {
          combinedVideos.set(video.videoId, video)
        }
      })
    }

    return Array.from(combinedVideos.values())
  }

  // 特定のチャンネルの動画リストを取得
  const getChannelVideoList = (channelName: string) => {
    const combinedList = getCombinedVideoList()

    if (channelName === "all") {
      return combinedList
    }

    return combinedList.filter((video) => {
      const character = "character" in video ? video.character : undefined
      return character === channelName
    })
  }

  // 動画ID一覧のフィルタリング
  const getFilteredVideoIdList = () => {
    if (videoIdListMetadata.length === 0) return []

    return videoIdListMetadata.filter((video) => {
      // 検索語でフィルタリング
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const titleMatch = video.title.toLowerCase().includes(searchLower)
        const idMatch = video.videoId.toLowerCase().includes(searchLower)

        // タグ検索を追加
        const tagMatch = video.tags?.some((tag) => {
          const cleanTag = tag.startsWith("#") ? tag.substring(1) : tag
          return cleanTag.toLowerCase().includes(searchLower)
        })

        return titleMatch || idMatch || tagMatch
      }

      return true
    })
  }

  // 動画ID一覧の視聴状態フィルタリング
  const getWatchStatusFilteredVideoIdList = () => {
    const filtered = getFilteredVideoIdList()

    // 視聴履歴がない場合はフィルタリングなしで返す
    if (watchedVideoIds.size === 0) return filtered

    // 視聴状態フィルターを適用
    return watchStatusFilter === "all"
      ? filtered
      : filtered.filter((video) => {
          const isWatched = watchedVideoIds.has(video.videoId)
          return watchStatusFilter === "watched" ? isWatched : !isWatched
        })
  }

  // getWatchStatusFilteredCombinedList 関数を更新して視聴回数フィルタリングを追加
  const getWatchStatusFilteredCombinedList = () => {
    const combinedList = getCombinedVideoList()

    // キャラクターでフィルタリング
    const characterFiltered =
      activeCharacterTab === "all"
        ? combinedList
        : combinedList.filter((video) => {
            if ("character" in video) {
              return video.character === activeCharacterTab
            }
            return false
          })

    // 検索語でフィルタリング
    const searchFiltered = searchTerm
      ? characterFiltered.filter((video) => {
          const searchLower = searchTerm.toLowerCase()
          const title = "details" in video ? video.details?.title : video.title
          const videoId = video.videoId

          // タグ検索を追加
          const tags = "tags" in video ? video.tags : undefined
          const tagMatch = tags?.some((tag) => {
            const cleanTag = tag.startsWith("#") ? tag.substring(1) : tag
            return cleanTag.toLowerCase().includes(searchLower)
          })

          return (
            (title && title.toLowerCase().includes(searchLower)) ||
            videoId.toLowerCase().includes(searchLower) ||
            tagMatch
          )
        })
      : characterFiltered

    // 視聴状態フィルタリング
    const watchStatusFiltered =
      watchStatusFilter === "all"
        ? searchFiltered
        : searchFiltered.filter((video) => {
            const isWatched = watchedVideoIds.has(video.videoId)
            return watchStatusFilter === "watched" ? isWatched : !isWatched
          })

    // 視聴回数フィルタリング
    if (watchCountFilter === "all") {
      return watchStatusFiltered
    } else {
      return watchStatusFiltered.filter((video) => {
        const watchCount = getWatchCount(video.videoId)

        if (watchCount === null) return watchCountFilter === "none"

        switch (watchCountFilter) {
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
    }
  }

  // 分析期間の範囲を取得
  const getDateRange = () => {
    if (processedData.length === 0) return ""

    const sortedDates = [...processedData].sort((a, b) => a.date.localeCompare(b.date))
    const firstDate = formatJapaneseDate(sortedDates[0].date)
    const lastDate = formatJapaneseDate(sortedDates[sortedDates.length - 1].date)

    return `${firstDate} 〜 ${lastDate}（${sortedDates.length}日間）`
  }

  // 未視聴動画の数を計算
  const getUnwatchedCount = () => {
    let totalCount = 0
    let unwatchedCount = 0

    // 全ての動画IDを集計
    allVideoIds.forEach((videoId) => {
      totalCount++
      if (!watchedVideoIds.has(videoId)) {
        unwatchedCount++
      }
    })

    return { totalCount, unwatchedCount }
  }

  // 動画の視聴回数を取得する関数
  const getWatchCount = (videoId: string): number | null => {
    if (!watchCountByVideoId || Object.keys(watchCountByVideoId).length === 0) {
      return null
    }
    return watchCountByVideoId[videoId] || 0
  }

  // Shorts 絞り込みと「よく見た順」をここでまとめて適用する
  const shortsById = useMemo(() => {
    const map: Record<string, boolean> = {}
    if (snapshot) for (const v of snapshot.videos) map[v.videoId] = v.isShort
    return map
  }, [snapshot])

  const sortedVideoIdList = useMemo(() => {
    let list = getWatchStatusFilteredVideoIdList()

    if (shortsFilter !== "all") {
      const wantShorts = shortsFilter === "shorts"
      list = list.filter((v: any) => Boolean(shortsById[v.videoId]) === wantShorts)
    }

    if (sortByWatchCount) {
      list = [...list].sort(
        (a: any, b: any) => (watchCountByVideoId[b.videoId] ?? 0) - (watchCountByVideoId[a.videoId] ?? 0),
      )
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    videoAnalysis, videoIdListMetadata, snapshot, watchedVideoIds, watchCountByVideoId,
    watchStatusFilter, watchCountFilter, activeCharacterTab, searchTerm,
    shortsFilter, sortByWatchCount, shortsById, sortField, sortDirection,
  ])
  const combinedVideoList = getWatchStatusFilteredCombinedList()

  // データの有無を確認する関数
  const hasPerformanceData = videoAnalysis.length > 0
  const hasWatchHistoryData = watchedVideoIds.size > 0
  const hasVideoIdListData = videoIdListMetadata.length > 0
  // 動画マスタが読めていれば、CSVが無くても一覧は成立する
  const hasCombinedData = Boolean(snapshot) || hasPerformanceData || hasVideoIdListData

  // 未視聴動画の統計
  const unwatchedStats = getUnwatchedCount()

  // タグセクションの展開状態を切り替える関数
  const toggleTagSection = (sectionId: string) => {
    setExpandedTagSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }))
  }

  // 計算式のテキスト
  const calculationFormula = "(day2 - day1) - (day1 - day0)"
  const CALCULATION_FORMULA = "(day2 - day1) - (day1 - day0)"

  // CSVファイル形式例
  const csvFormatExample1 = "videoId,viewCount,likeCount,commentCount,videoURL"
  const csvFormatExample2 = "abc123,1000,50,10,https://www.youtube.com/watch?v=abc123"

  return (
    <div className="container mx-auto py-10">
      {/* チャンネル選択セクション - タブの上に配置 */}
      {hasCombinedData && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              チャンネル選択
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={activeCharacterTab === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveCharacterTab("all")}
                className="mb-2"
              >
                すべてのチャンネル
              </Button>
              {characterOptions.map((character) => (
                <Button
                  key={character}
                  variant={activeCharacterTab === character ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveCharacterTab(character)}
                  className="mb-2"
                >
                  {character}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="performance-analysis">分析情報アップロード</TabsTrigger>
          <TabsTrigger value="analysis-results" disabled={!hasPerformanceData}>
            シクフォニ内　急上昇ランキング
          </TabsTrigger>
          <TabsTrigger value="unwatched-check" disabled={!hasWatchHistoryData || !hasCombinedData}>
            未視聴チェック
          </TabsTrigger>
          <TabsTrigger value="video-id-list" disabled={!hasCombinedData}>
            動画ID一覧
          </TabsTrigger>
          <TabsTrigger value="channel-home" disabled={!hasCombinedData}>
            チャンネルホーム
          </TabsTrigger>
        </TabsList>

        {/* 1. 分析情報アップロードタブ */}
        <TabsContent value="performance-analysis">
          <AnalysisUploadContainer
            resolveMetadata={fetchVideoDetails}
            prefixes={filenamePrefixes}
            onAnalysisComplete={({ videoAnalysis, processedData, detectedCharacters }) => {
              setVideoAnalysis(videoAnalysis)
              setProcessedData(processedData)
              setAvailableCharacters((prev) => [...new Set([...prev, ...detectedCharacters])])
              setActiveTab("analysis-results")
            }}
            onWatchHistoryComplete={({ watchedVideoIds, watchCountByVideoId, stats, period }) => {
              setWatchedVideoIds(watchedVideoIds)
              setWatchCountByVideoId(watchCountByVideoId)
              setWatchHistoryStats(stats)
              setWatchHistoryPeriod(period ?? null)
              setActiveTab("unwatched-check")
            }}
          />
        </TabsContent>

        {/* 2. 分析結果タブ */}
        <TabsContent value="analysis-results">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart className="h-5 w-5" />
                動画パフォーマンス分析（再生数の伸び順）
              </CardTitle>
              <CardDescription>
                <div className="space-y-2 text-sm leading-relaxed">
                  <div>{videoAnalysis.length}本の動画のパフォーマンスを分析しています。</div>
                  <div className="ml-4">分析対象期間：{getDateRange()}</div>
                  <div className="mt-4 font-semibold">☆加速度</div>
                  <div className="ml-4">計算式： {CALCULATION_FORMULA}</div>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VideoPerformanceTableContainer
                videoAnalysis={videoAnalysis}
                processedData={processedData}
                watchCountByVideoId={watchCountByVideoId}
                availableCharacters={characterOptions}
                availableTags={availableTags}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. 未視聴チェックタブ */}
        <TabsContent value="unwatched-check">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                未視聴チェック
              </CardTitle>
              <CardDescription>
                <div className="space-y-2 text-sm leading-relaxed">
                  <div>
                    Google Takeoutから取得した視聴履歴JSONファイルをアップロードして、未視聴の動画を確認できます。
                  </div>
                  <div className="ml-4">
                    使い方：Google Takeoutから「YouTube と YouTube
                    Music」→「履歴」→「視聴履歴」を選択してダウンロードし、解凍した「watch-history.json」ファイルをアップロードしてください。
                  </div>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!hasWatchHistoryData ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>視聴履歴が必要です</AlertTitle>
                  <AlertDescription>
                    「分析情報アップロード」タブで視聴履歴JSONファイルをアップロードしてください。
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <Alert>
                    <Check className="h-4 w-4" />
                    <AlertTitle>視聴履歴の読み込み完了</AlertTitle>
                    <AlertDescription>
                      <div>✅ {watchHistoryStats?.total.toLocaleString()}件の視聴済み動画を検出しました</div>
                      <div>🔍 そのうち{watchHistoryStats?.matched.toLocaleString()}件が対象の動画と一致しました</div>
                      <div>
                        🚫 未視聴の動画は
                        {unwatchedStats.unwatchedCount.toLocaleString()}
                        件です
                      </div>
                    </AlertDescription>
                  </Alert>

                  {/* フィルターコントロール */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <div className="mr-2 text-sm font-medium">表示フィルター：</div>
                    <Button
                      variant={watchStatusFilter === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setWatchStatusFilter("all")}
                    >
                      すべて
                    </Button>
                    <Button
                      variant={watchStatusFilter === "unwatched" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setWatchStatusFilter("unwatched")}
                    >
                      🚫 未視聴のみ
                    </Button>
                    <Button
                      variant={watchStatusFilter === "watched" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setWatchStatusFilter("watched")}
                    >
                      ✅ 視聴済みのみ
                    </Button>
                  </div>

                  {/* 履歴の保存期間についての但し書き。
                      Google側の設定で古い分は消えるため、それ以前に見た動画も
                      「未視聴」に出てしまう。黙って誤解させないよう常時出す。 */}
                  {watchHistoryPeriod && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertTitle>未視聴の判定について</AlertTitle>
                      <AlertDescription>
                        視聴履歴はGoogle側の保存期間設定により古い分から削除されます。
                        このファイルの履歴は{" "}
                        <strong>
                          {formatJapaneseDate(watchHistoryPeriod.from)} 〜{" "}
                          {formatJapaneseDate(watchHistoryPeriod.to)}
                        </strong>{" "}
                        の範囲です。それ以前に見た動画も「未視聴」に含まれます。
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* 視聴回数フィルター */}
                  <WatchCountFilter onFilterChange={setWatchCountFilter} activeFilter={watchCountFilter} />

                  {/* Shorts の絞り込みと並び替え */}
                  <div className="flex flex-wrap items-center gap-2 my-4">
                    <div className="mr-2 text-sm font-medium">動画の種類：</div>
                    {([
                      ["all", "すべて"],
                      ["long", "長尺のみ"],
                      ["shorts", "Shortsのみ"],
                    ] as const).map(([value, label]) => (
                      <Button
                        key={value}
                        variant={shortsFilter === value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShortsFilter(value)}
                      >
                        {label}
                      </Button>
                    ))}
                    <Button
                      variant={sortByWatchCount ? "default" : "outline"}
                      size="sm"
                      className="ml-4"
                      onClick={() => setSortByWatchCount((v) => !v)}
                    >
                      🔁 よく見た順
                    </Button>
                  </div>

                  {/* キャラクタータブ */}
                  {characterOptions.length > 0 && (
                    <Tabs value={activeCharacterTab} onValueChange={setActiveCharacterTab} className="w-full">
                      <TabsList className="mb-4 flex flex-wrap">
                        {characterOptions.map((character) => (
                          <TabsTrigger key={character} value={character} className="mr-1 mb-1">
                            {character}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  )}

                  {/* タグフィルター */}
                  {getCharacterSpecificTags().length > 0 && (
                    <div className="mb-4">
                      <div className="text-sm font-medium mb-2">タグ一覧:</div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="default" className="cursor-default">
                          すべて
                        </Badge>
                        {getCharacterSpecificTags()
                          .slice(0, 20)
                          .map((tag) => (
                            <Badge key={tag} variant="outline" className="cursor-default">
                              {tag.startsWith("#") ? tag.substring(1) : tag}
                            </Badge>
                          ))}
                        {getCharacterSpecificTags().length > 20 && (
                          <div className="relative">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center text-xs"
                              onClick={() => toggleTagSection("unwatched-character-tags")}
                            >
                              他 {getCharacterSpecificTags().length - 20} タグ
                              {expandedTagSections["unwatched-character-tags"] ? (
                                <ChevronUp className="h-3 w-3 ml-1" />
                              ) : (
                                <ChevronDown className="h-3 w-3 ml-1" />
                              )}
                            </Button>
                            {expandedTagSections["unwatched-character-tags"] && (
                              <div className="absolute z-10 mt-1 p-2 bg-white border rounded-md shadow-md w-auto max-w-sm">
                                <div className="flex flex-wrap gap-1 max-h-60 overflow-y-auto">
                                  {getCharacterSpecificTags()
                                    .slice(20)
                                    .map((tag) => (
                                      <Badge key={tag} variant="outline" className="cursor-default">
                                        {tag.startsWith("#") ? tag.substring(1) : tag}
                                      </Badge>
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 検索フィルター */}
                  <div className="relative mb-4">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <Input
                      type="text"
                      placeholder="動画タイトル、ID、またはタグで検索"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* テーブルコンポーネント */}
                  {sortedVideoIdList.length > 0 ? (
                    <VirtualizedVideoTable
                      videos={sortedVideoIdList}
                      processedData={processedData}
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      watchCountByVideoId={watchCountByVideoId}
                    />
                  ) : (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertTitle>動画が見つかりませんでした</AlertTitle>
                      <AlertDescription>条件に一致する動画が見つかりませんでした。</AlertDescription>
                    </Alert>
                  )}

                  {sortedVideoIdList.length > 20 && (
                    <div className="text-center text-sm text-muted-foreground">
                      {sortedVideoIdList.length}本中、上位20本を表示しています
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. チャンネルホームタブ */}
        <TabsContent value="channel-home">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                チャンネルホーム
              </CardTitle>
              <CardDescription>
                <div className="space-y-2 text-sm leading-relaxed">
                  <div>選択されたチャンネルの最新動画を表示します。</div>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* キャラクタータブ */}
              {characterOptions.length > 0 && (
                <Tabs value={activeCharacterTab} onValueChange={setActiveCharacterTab} className="w-full">
                  <TabsList className="mb-4 flex flex-wrap">
                    {characterOptions.map((character) => (
                      <TabsTrigger key={character} value={character} className="mr-1 mb-1">
                        {character}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              )}

              {/* 検索フィルター */}
              <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <Input
                  type="text"
                  placeholder="動画タイトル、ID、またはタグで検索"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* フィルターコントロール */}
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="mr-2 text-sm font-medium">表示フィルター：</div>
                <Button
                  variant={watchStatusFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setWatchStatusFilter("all")}
                >
                  すべて
                </Button>
                <Button
                  variant={watchStatusFilter === "unwatched" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setWatchStatusFilter("unwatched")}
                >
                  🚫 未視聴のみ
                </Button>
                <Button
                  variant={watchStatusFilter === "watched" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setWatchStatusFilter("watched")}
                >
                  ✅ 視聴済みのみ
                </Button>
              </div>

              {/* タグフィルター */}
              {getCharacterSpecificTags().length > 0 && (
                <div className="mb-4">
                  <div className="text-sm font-medium mb-2">タグ一覧:</div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="default" className="cursor-default">
                      すべて
                    </Badge>
                    {getCharacterSpecificTags()
                      .slice(0, 20)
                      .map((tag) => (
                        <Badge key={tag} variant="outline" className="cursor-default">
                          {tag.startsWith("#") ? tag.substring(1) : tag}
                        </Badge>
                      ))}
                    {getCharacterSpecificTags().length > 20 && (
                      <div className="relative">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center text-xs"
                          onClick={() => toggleTagSection("channel-home-character-tags")}
                        >
                          他 {getCharacterSpecificTags().length - 20} タグ
                          {expandedTagSections["channel-home-character-tags"] ? (
                            <ChevronUp className="h-3 w-3 ml-1" />
                          ) : (
                            <ChevronDown className="h-3 w-3 ml-1" />
                          )}
                        </Button>
                        {expandedTagSections["channel-home-character-tags"] && (
                          <div className="absolute z-10 mt-1 p-2 bg-white border rounded-md shadow-md w-auto max-w-sm">
                            <div className="flex flex-wrap gap-1 max-h-60 overflow-y-auto">
                              {getCharacterSpecificTags()
                                .slice(20)
                                .map((tag) => (
                                  <Badge key={tag} variant="outline" className="cursor-default">
                                    {tag.startsWith("#") ? tag.substring(1) : tag}
                                  </Badge>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {combinedVideoList.length > 0 ? (
                <ChannelHome
                  videos={combinedVideoList}
                  watchCountByVideoId={watchCountByVideoId}
                  channelTitle={activeCharacterTab === "all" ? "すべてのチャンネル" : activeCharacterTab}
                />
              ) : (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>動画が見つかりませんでした</AlertTitle>
                  <AlertDescription>条件に一致する動画が見つかりませんでした。</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
