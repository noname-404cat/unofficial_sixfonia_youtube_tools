"use client"

import { useState, memo, useCallback, useRef, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tag, ChevronDown, ChevronUp } from "lucide-react"
import { removeHashFromTag } from "@/lib/video-utils"

interface VideoTableTagsProps {
  videoId: string
  tags?: string[]
}

export const VideoTableTags = memo<VideoTableTagsProps>(function VideoTableTags({ videoId, tags }) {
  const [expandedTagSections, setExpandedTagSections] = useState<Record<string, boolean>>({})
  const expandButtonRef = useRef<HTMLButtonElement>(null)
  const expandedContentRef = useRef<HTMLDivElement>(null)

  const toggleTagSection = useCallback((sectionId: string) => {
    setExpandedTagSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }))
  }, [])

  // Escape キーでタグセクションを閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExpandedTagSections({})
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  if (!tags || tags.length === 0) {
    return (
      <span className="text-gray-500" aria-label="タグなし">
        —
      </span>
    )
  }

  const sectionId = `tags-${videoId}`
  const isExpanded = expandedTagSections[sectionId] || false
  const visibleTags = tags.slice(0, 3)
  const hiddenTags = tags.slice(3)
  const hiddenTagsCount = hiddenTags.length

  return (
    <div className="flex flex-col gap-1" role="region" aria-label="動画タグ">
      <div className="flex flex-wrap gap-1 items-center">
        <Tag className="h-3 w-3 text-gray-400" aria-hidden="true" />
        {visibleTags.map((tag, index) => (
          <Badge
            key={tag}
            variant="outline"
            className="text-xs"
            aria-label={`タグ ${index + 1}: ${removeHashFromTag(tag)}`}
          >
            {removeHashFromTag(tag)}
          </Badge>
        ))}
        {hiddenTagsCount > 0 && (
          <Button
            ref={expandButtonRef}
            variant="ghost"
            size="sm"
            className="h-5 px-1 text-xs flex items-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              toggleTagSection(sectionId)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                e.stopPropagation()
                toggleTagSection(sectionId)
              }
            }}
            aria-expanded={isExpanded}
            aria-controls={`expanded-tags-${videoId}`}
            aria-label={`他の${hiddenTagsCount}個のタグを${isExpanded ? "非表示" : "表示"}`}
          >
            他 {hiddenTagsCount} タグ
            {isExpanded ? (
              <ChevronUp className="h-3 w-3 ml-1" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3 w-3 ml-1" aria-hidden="true" />
            )}
          </Button>
        )}
      </div>

      {hiddenTagsCount > 0 && isExpanded && (
        <div
          ref={expandedContentRef}
          id={`expanded-tags-${videoId}`}
          className="flex flex-wrap gap-1 pl-5 mt-1 max-h-40 overflow-y-auto focus-within:ring-2 focus-within:ring-blue-500 rounded"
          role="region"
          aria-label="追加のタグ"
          aria-live="polite"
        >
          {hiddenTags.map((tag, index) => (
            <Badge
              key={tag}
              variant="outline"
              className="text-xs"
              aria-label={`追加タグ ${index + 1}: ${removeHashFromTag(tag)}`}
            >
              {removeHashFromTag(tag)}
            </Badge>
          ))}
        </div>
      )}

      {/* スクリーンリーダー用の説明 */}
      <div className="sr-only" aria-live="polite">
        {tags.length > 0 && `この動画には${tags.length}個のタグがあります。`}
        {isExpanded && hiddenTagsCount > 0 && `追加の${hiddenTagsCount}個のタグが表示されています。`}
      </div>
    </div>
  )
})
