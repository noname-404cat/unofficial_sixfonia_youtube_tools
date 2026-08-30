"use client"
import { Button } from "@/components/ui/button"
import { VIEW_COUNT_RANGES } from "@/utils/viewCountUtils"

interface WatchCountFilterProps {
  onFilterChange: (filter: string) => void
  activeFilter: string
}

export default function WatchCountFilter({ onFilterChange, activeFilter }: WatchCountFilterProps) {
  const filters = [
    { id: "all", label: "すべて", color: "default" },
    { id: "high", label: `よく見た (${VIEW_COUNT_RANGES.HIGH}回以上)`, color: "success" },
    { id: "medium", label: `複数回視聴 (${VIEW_COUNT_RANGES.MEDIUM}〜${VIEW_COUNT_RANGES.HIGH - 1}回)`, color: "info" },
    { id: "low", label: `視聴済み (${VIEW_COUNT_RANGES.LOW}〜${VIEW_COUNT_RANGES.MEDIUM - 1}回)`, color: "warning" },
    { id: "none", label: "未視聴", color: "destructive" },
  ]

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <div className="mr-2 text-sm font-medium">視聴回数フィルター：</div>
      {filters.map((filter) => (
        <Button
          key={filter.id}
          variant={activeFilter === filter.id ? "default" : "outline"}
          size="sm"
          onClick={() => onFilterChange(filter.id)}
          className={
            activeFilter === filter.id
              ? ""
              : filter.id === "high"
                ? "border-green-200 text-green-700 hover:bg-green-50"
                : filter.id === "medium"
                  ? "border-blue-200 text-blue-700 hover:bg-blue-50"
                  : filter.id === "low"
                    ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                    : filter.id === "none"
                      ? "border-red-200 text-red-700 hover:bg-red-50"
                      : ""
          }
        >
          {filter.label}
        </Button>
      ))}
    </div>
  )
}
