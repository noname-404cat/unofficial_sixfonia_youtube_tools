"use client"

import { memo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { TrendingUp } from "lucide-react"
import { useCsvAnalysis } from "@/hooks/useCsvAnalysis"
import { useWatchHistory } from "@/hooks/useWatchHistory"
import { FileUpload } from "@/components/common/FileUpload"
import { ProcessingStatus } from "@/components/common/ProcessingStatus"
import { CSV_FORMAT_EXAMPLES } from "@/lib/constants"

interface AnalysisUploadContainerProps {
  apiKey: string
  onAnalysisComplete: (data: {
    videoAnalysis: any[]
    processedData: any[]
    detectedCharacters: string[]
  }) => void
  onWatchHistoryComplete: (data: {
    watchedVideoIds: Set<string>
    watchCountByVideoId: Record<string, number>
    stats: { total: number; matched: number }
  }) => void
}

export const AnalysisUploadContainer = memo<AnalysisUploadContainerProps>(function AnalysisUploadContainer({
  apiKey,
  onAnalysisComplete,
  onWatchHistoryComplete,
}) {
  const csvAnalysis = useCsvAnalysis()
  const watchHistory = useWatchHistory()

  const handleAnalysisProcess = async () => {
    try {
      const result = await csvAnalysis.processFiles(apiKey)
      if (result) {
        onAnalysisComplete({
          videoAnalysis: csvAnalysis.videoAnalysis,
          processedData: csvAnalysis.processedData,
          detectedCharacters: result.detectedCharacters,
        })
      }
    } catch (error) {
      console.error("Analysis processing failed:", error)
    }
  }

  const handleWatchHistoryProcess = async () => {
    try {
      await watchHistory.processFile(csvAnalysis.videoAnalysis)
      if (watchHistory.stats) {
        onWatchHistoryComplete({
          watchedVideoIds: watchHistory.watchedVideoIds,
          watchCountByVideoId: watchHistory.watchCountByVideoId,
          stats: watchHistory.stats,
        })
      }
    } catch (error) {
      console.error("Watch history processing failed:", error)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          分析情報アップロード
        </CardTitle>
        <CardDescription>
          <div className="space-y-2 text-sm leading-relaxed">
            <div>動画の再生数・高評価数・コメント数など、日別の統計情報CSVをアップロードして分析します。</div>
            <div className="text-xs bg-muted p-2 rounded mt-2">
              <div className="font-semibold">CSVファイル形式例：</div>
              <code>{CSV_FORMAT_EXAMPLES.HEADER}</code>
              <br />
              <code>{CSV_FORMAT_EXAMPLES.SAMPLE}</code>
            </div>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 分析情報CSVアップロード */}
        <FileUpload
          id="analysis-upload"
          accept=".csv"
          multiple
          files={csvAnalysis.analysisFiles}
          onFileChange={csvAnalysis.handleFileChange}
          title="1. 分析情報CSVアップロード"
          description="CSVファイルをドラッグ＆ドロップするか、クリックして選択してください"
          example="（例：video_stats_20250326.csv）"
          disabled={csvAnalysis.isProcessing}
        />

        {csvAnalysis.analysisFiles.length > 0 && (
          <Button onClick={handleAnalysisProcess} disabled={csvAnalysis.isProcessing} className="w-full">
            {csvAnalysis.isProcessing ? "処理中..." : "データを読み込む"}
          </Button>
        )}

        <ProcessingStatus
          isProcessing={csvAnalysis.isProcessing}
          progress={csvAnalysis.progress}
          error={csvAnalysis.error}
          successMessage={
            csvAnalysis.processedData.length > 0
              ? `${csvAnalysis.processedData.length}日分のデータを読み込みました`
              : undefined
          }
        />

        <ProcessingStatus
          isProcessing={csvAnalysis.isFetchingDetails}
          progress={50}
          error={csvAnalysis.detailsError}
          processingMessage="YouTube APIから動画情報を取得中..."
        />

        <Separator className="my-6" />

        {/* 視聴履歴JSONアップロード */}
        <FileUpload
          id="watch-history-upload"
          accept=".json"
          files={watchHistory.watchHistoryFile ? [watchHistory.watchHistoryFile] : []}
          onFileChange={(files) => watchHistory.handleFileChange(files[0] || null)}
          title="2. 視聴履歴JSONアップロード"
          description="JSONファイルをドラッグ＆ドロップするか、クリックして選択してください"
          example="（例：watch-history.json）"
          disabled={watchHistory.isProcessing}
        />

        {watchHistory.watchHistoryFile && (
          <Button onClick={handleWatchHistoryProcess} disabled={watchHistory.isProcessing} className="w-full">
            {watchHistory.isProcessing ? "処理中..." : "視聴履歴を読み込む"}
          </Button>
        )}

        <ProcessingStatus
          isProcessing={watchHistory.isProcessing}
          progress={50}
          error={watchHistory.error}
          successMessage={
            watchHistory.stats
              ? `✅ ${watchHistory.stats.total.toLocaleString()}件の視聴済み動画を検出しました\n🔍 そのうち${watchHistory.stats.matched.toLocaleString()}件が対象の動画と一致しました`
              : undefined
          }
        />
      </CardContent>
    </Card>
  )
})
