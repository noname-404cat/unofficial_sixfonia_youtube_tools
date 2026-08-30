"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { VideoAnalysis, VideoMetadata } from "@/types/video"
import VideoCard from "./VideoCard"

interface VideoCarouselProps {
  videos: (VideoAnalysis | VideoMetadata)[]
  watchCountByVideoId: Record<string, number>
}

export default function VideoCarousel({ videos, watchCountByVideoId }: VideoCarouselProps) {
  const carouselRef = useRef<HTMLDivElement>(null)
  const [scrollPosition, setScrollPosition] = useState(0)

  if (!videos || videos.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">最近の動画はありません</div>
  }

  // 投稿日でソート（新しい順）
  const sortedVideos = [...videos].sort((a, b) => {
    const dateA = new Date("details" in a ? a.details?.publishedAt || "" : a.publishedAt || "").getTime() || 0
    const dateB = new Date("details" in b ? b.details?.publishedAt || "" : b.publishedAt || "").getTime() || 0
    return dateB - dateA // 降順（新しい順）
  })

  const scroll = (direction: "left" | "right") => {
    if (carouselRef.current) {
      const { scrollLeft, clientWidth } = carouselRef.current
      const scrollTo = direction === "left" ? scrollLeft - clientWidth / 2 : scrollLeft + clientWidth / 2

      carouselRef.current.scrollTo({
        left: scrollTo,
        behavior: "smooth",
      })

      setScrollPosition(scrollTo)
    }
  }

  const handleScroll = () => {
    if (carouselRef.current) {
      setScrollPosition(carouselRef.current.scrollLeft)
    }
  }

  const canScrollLeft = scrollPosition > 0
  const canScrollRight = carouselRef.current
    ? scrollPosition < carouselRef.current.scrollWidth - carouselRef.current.clientWidth
    : false

  return (
    <div className="relative group">
      <div
        ref={carouselRef}
        className="flex overflow-x-auto space-x-4 pb-4 scrollbar-hide"
        onScroll={handleScroll}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {sortedVideos.map((video) => (
          <div key={video.videoId} className="flex-none w-[250px]">
            <VideoCard video={video} watchCount={watchCountByVideoId[video.videoId] || 0} />
          </div>
        ))}
      </div>

      {canScrollLeft && (
        <Button
          variant="outline"
          size="icon"
          className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-white rounded-full shadow-md opacity-80 hover:opacity-100"
          onClick={() => scroll("left")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      {canScrollRight && (
        <Button
          variant="outline"
          size="icon"
          className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-white rounded-full shadow-md opacity-80 hover:opacity-100"
          onClick={() => scroll("right")}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
