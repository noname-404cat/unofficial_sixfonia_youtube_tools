"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tag, ChevronDown, ChevronUp } from "lucide-react"
import { removeHashFromTag } from "@/hooks/useVideoData"

interface VideoTagsProps {
  videoId: string
  tags?: string[]
}

export default function VideoTags({ videoId, tags }: VideoTagsProps) {
  const [expandedTagSections, setExpandedTagSections] = useState<Record<string, boolean>>({})

  // タグセクションの展開状態を切り替える関数
  const toggleTagSection = (sectionId: string) => {
    setExpandedTagSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }))
  }

  if (!tags || tags.length === 0) return null

  const sectionId = `tags-${videoId}`
  const isExpanded = expandedTagSections[sectionId] || false

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1 items-center">
        <Tag className="h-3 w-3 text-gray-400" />
        {tags.slice(0, 3).map((tag) => (
          <Badge key={tag} variant="outline" className="text-xs">
            {removeHashFromTag(tag)}
          </Badge>
        ))}
        {tags.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1 text-xs flex items-center"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              toggleTagSection(sectionId)
            }}
          >
            他 {tags.length - 3} タグ
            {isExpanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
          </Button>
        )}
      </div>

      {tags.length > 3 && isExpanded && (
        <div className="flex flex-wrap gap-1 pl-5 mt-1 max-h-40 overflow-y-auto">
          {tags.slice(3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {removeHashFromTag(tag)}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
