"use client"

import type React from "react"

import { memo, useCallback, useRef, useId } from "react"
import { Upload, FileUp, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface FileUploadProps {
  id: string
  accept: string
  multiple?: boolean
  files: File[]
  onFileChange: (files: File[]) => void
  title: string
  description: string
  example?: string
  disabled?: boolean
}

export const FileUpload = memo<FileUploadProps>(function FileUpload({
  id,
  accept,
  multiple = false,
  files,
  onFileChange,
  title,
  description,
  example,
  disabled = false,
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        onFileChange(Array.from(e.target.files))
      }
    },
    [onFileChange],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()

      if (disabled) return

      const droppedFiles = Array.from(e.dataTransfer.files)
      if (droppedFiles.length > 0) {
        onFileChange(droppedFiles)
      }

      // ドロップゾーンのスタイルをリセット
      if (dropZoneRef.current) {
        dropZoneRef.current.classList.remove("border-blue-500", "bg-blue-50")
      }
    },
    [onFileChange, disabled],
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    // ドロップゾーンのスタイルを変更
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.add("border-blue-500", "bg-blue-50")
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    // ドロップゾーンのスタイルをリセット
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.remove("border-blue-500", "bg-blue-50")
    }
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if ((e.key === "Enter" || e.key === " ") && !disabled) {
        e.preventDefault()
        fileInputRef.current?.click()
      }
    },
    [disabled],
  )

  const handleRemoveFile = useCallback(
    (indexToRemove: number) => {
      const newFiles = files.filter((_, index) => index !== indexToRemove)
      onFileChange(newFiles)
    },
    [files, onFileChange],
  )

  const handleClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }, [disabled])

  return (
    <div role="region" aria-labelledby={titleId}>
      <Label id={titleId} className="text-lg font-medium mb-4 block">
        {title}
      </Label>

      <div
        ref={dropZoneRef}
        className={`border-2 border-dashed border-gray-300 rounded-lg p-10 text-center transition-colors ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-gray-400"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-disabled={disabled}
      >
        <input
          ref={fileInputRef}
          type="file"
          id={id}
          multiple={multiple}
          accept={accept}
          onChange={handleFileChange}
          className="sr-only"
          disabled={disabled}
          aria-describedby={descriptionId}
        />

        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center justify-center">
            <Upload className="h-10 w-10 text-gray-400 mb-2" aria-hidden="true" />
            <span className="text-sm font-medium" id={descriptionId}>
              {description}
            </span>
            {example && (
              <span className="text-xs text-gray-500 mt-1" aria-label={`例: ${example}`}>
                {example}
              </span>
            )}
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-4 mt-4" role="region" aria-label="選択されたファイル">
          <div className="text-sm font-medium">
            選択されたファイル ({files.length}){" "}
            <span className="sr-only">{multiple ? "複数ファイル選択可能" : "単一ファイルのみ"}</span>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-2" role="list">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between text-sm p-2 bg-muted rounded group"
                role="listitem"
              >
                <div className="flex items-center min-w-0 flex-1">
                  <FileUp className="h-4 w-4 mr-2 flex-shrink-0" aria-hidden="true" />
                  <span className="truncate flex-1" title={file.name} aria-label={`ファイル名: ${file.name}`}>
                    {file.name}
                  </span>
                  <span className="text-xs text-gray-500 ml-2 flex-shrink-0" aria-label={`ファイルサイズ`}>
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-2 opacity-0 group-hover:opacity-100 focus:opacity-100 h-6 w-6 p-0 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveFile(index)
                  }}
                  aria-label={`${file.name}を削除`}
                  disabled={disabled}
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* スクリーンリーダー用の説明 */}
      <div className="sr-only" aria-live="polite">
        {files.length > 0 && `${files.length}個のファイルが選択されています。`}
        {disabled && "ファイルアップロードは現在無効です。"}
      </div>
    </div>
  )
})
