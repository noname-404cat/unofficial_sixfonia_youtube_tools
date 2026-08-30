"use client"

import { memo } from "react"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Check, Loader2 } from "lucide-react"

interface ProcessingStatusProps {
  isProcessing: boolean
  progress: number
  error: string | null
  successMessage?: string
  processingMessage?: string
}

export const ProcessingStatus = memo<ProcessingStatusProps>(function ProcessingStatus({
  isProcessing,
  progress,
  error,
  successMessage,
  processingMessage = "処理中...",
}) {
  if (error) {
    return (
      <Alert variant="destructive" role="alert" aria-live="assertive">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>エラー</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (isProcessing) {
    return (
      <div className="space-y-2" role="status" aria-live="polite">
        <div className="text-sm flex justify-between items-center">
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {processingMessage}
          </span>
          <span aria-label={`進行状況: ${Math.round(progress)}パーセント`}>{Math.round(progress)}%</span>
        </div>
        <Progress
          value={progress}
          className="h-2"
          aria-label="処理の進行状況"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
        <div className="sr-only" aria-live="polite">
          処理が{Math.round(progress)}%完了しました
        </div>
      </div>
    )
  }

  if (successMessage) {
    return (
      <Alert role="status" aria-live="polite">
        <Check className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>成功</AlertTitle>
        <AlertDescription>{successMessage}</AlertDescription>
      </Alert>
    )
  }

  return null
})
