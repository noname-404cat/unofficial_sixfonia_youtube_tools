"use client"

import type React from "react"

import { memo, useMemo, useCallback, useRef, useId } from "react"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Search, ChevronDown, ChevronUp } from "lucide-react"
import type { FilterState } from "@/types/video"
import { useState } from "react"

interface VideoTableFiltersProps {
  filterState: FilterState
  availableCharacters: string[]
  availableTags: string[]
  onSearchChange: (searchTerm: string) => void
  onCharacterChange: (character: string) => void
  onWatchStatusChange: (status: "all" | "watched" | "unwatched") => void
  onWatchCountChange: (watchCount: string) => void
}

export const VideoTableFilters = memo<VideoTableFiltersProps>(function VideoTableFilters({
  filterState,
  availableCharacters,
  availableTags,
  onSearchChange,
  onCharacterChange,
  onWatchStatusChange,
  onWatchCountChange,
}) {
  const [expandedTags, setExpandedTags] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchInputId = useId()
  const characterTabsId = useId()
  const tagsRegionId = useId()

  // 検索変更ハンドラー（メモ化）
  const handleSearchInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearchChange(e.target.value)
    },
    [onSearchChange],
  )

  // 検索クリアハンドラー（メモ化）
  const handleSearchClear = useCallback(() => {
    onSearchChange("")
    searchInputRef.current?.focus()
  }, [onSearchChange])

  // タグ展開切り替え（メモ化）
  const toggleTagExpansion = useCallback(() => {
    setExpandedTags((prev) => !prev)
  }, [])

  // 表示するタグ（メモ化）
  const { visibleTags, hiddenTagsCount } = useMemo(() => {
    const maxVisible = 20
    return {
      visibleTags: availableTags.slice(0, maxVisible),
      hiddenTagsCount: Math.max(0, availableTags.length - maxVisible),
    }
  }, [availableTags])

  // 隠れているタグ（メモ化）
  const hiddenTags = useMemo(() => availableTags.slice(20), [availableTags])

  // キーボードナビゲーション
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        handleSearchClear()
      }
    },
    [handleSearchClear],
  )

  return (
    <div className="space-y-4" role="region" aria-label="フィルターオプション">
      {/* キャラクタータブ */}
      {availableCharacters.length > 0 && (
        <div>
          <Label className="text-sm font-medium mb-2 block">チャンネル選択</Label>
          <Tabs value={filterState.activeCharacter} onValueChange={onCharacterChange} aria-labelledby={characterTabsId}>
            <TabsList className="mb-4 flex flex-wrap" role="tablist" aria-label="チャンネル選択">
              {availableCharacters.map((character) => (
                <TabsTrigger
                  key={character}
                  value={character}
                  className="mr-1 mb-1"
                  role="tab"
                  aria-selected={filterState.activeCharacter === character}
                  aria-label={`${character}チャンネル`}
                >
                  {character}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* タグフィルター */}
      {availableTags.length > 0 && (
        <div role="region" aria-labelledby={tagsRegionId}>
          <Label id={tagsRegionId} className="text-sm font-medium mb-2 block">
            タグ一覧 ({availableTags.length}個)
          </Label>
          <div className="flex flex-wrap gap-2" role="list" aria-label="利用可能なタグ">
            <Badge variant="default" className="cursor-default" role="listitem" aria-label="すべてのタグ">
              すべて
            </Badge>
            {visibleTags.map((tag, index) => (
              <Badge
                key={tag}
                variant="outline"
                className="cursor-default"
                role="listitem"
                aria-label={`タグ ${index + 1}: ${tag.startsWith("#") ? tag.substring(1) : tag}`}
              >
                {tag.startsWith("#") ? tag.substring(1) : tag}
              </Badge>
            ))}

            {hiddenTagsCount > 0 && (
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  onClick={toggleTagExpansion}
                  aria-expanded={expandedTags}
                  aria-controls="hidden-tags"
                  aria-label={`他の${hiddenTagsCount}個のタグを${expandedTags ? "非表示" : "表示"}`}
                >
                  他 {hiddenTagsCount} タグ
                  {expandedTags ? (
                    <ChevronUp className="h-3 w-3 ml-1" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-3 w-3 ml-1" aria-hidden="true" />
                  )}
                </Button>

                {expandedTags && (
                  <div
                    id="hidden-tags"
                    className="absolute z-10 mt-1 p-2 bg-white border rounded-md shadow-md w-auto max-w-sm"
                    role="region"
                    aria-label="追加のタグ"
                    aria-live="polite"
                  >
                    <div className="flex flex-wrap gap-1 max-h-60 overflow-y-auto" role="list">
                      {hiddenTags.map((tag, index) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="cursor-default"
                          role="listitem"
                          aria-label={`追加タグ ${index + 1}: ${tag.startsWith("#") ? tag.substring(1) : tag}`}
                        >
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
        <Label htmlFor={searchInputId} className="text-sm font-medium mb-2 block">
          動画検索
        </Label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
          </div>
          <Input
            ref={searchInputRef}
            id={searchInputId}
            type="text"
            placeholder="動画タイトル、ID、またはタグで検索"
            value={filterState.searchTerm}
            onChange={handleSearchInputChange}
            onKeyDown={handleSearchKeyDown}
            className="pl-10 pr-10"
            aria-label="動画検索"
            aria-describedby={`${searchInputId}-description`}
          />
          {filterState.searchTerm && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute inset-y-0 right-0 px-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              onClick={handleSearchClear}
              aria-label="検索をクリア"
            >
              ×
            </Button>
          )}
        </div>
        <div id={`${searchInputId}-description`} className="sr-only">
          動画のタイトル、ID、またはタグで検索できます。Escapeキーで検索をクリアできます。
        </div>
      </div>

      {/* 検索結果の状態表示 */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {filterState.searchTerm && `検索語「${filterState.searchTerm}」で検索中`}
        {filterState.activeCharacter !== "all" && `${filterState.activeCharacter}チャンネルでフィルタリング中`}
      </div>
    </div>
  )
})
