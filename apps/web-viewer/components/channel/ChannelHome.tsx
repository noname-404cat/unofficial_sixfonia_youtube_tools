"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info } from "lucide-react"
import type { VideoAnalysis, VideoMetadata } from "@/types/video"
import VideoGrid from "./VideoGrid"
import VideoCarousel from "./VideoCarousel"
import ChannelStats from "./ChannelStats"
import PlaylistGrid from "./PlaylistGrid"
import { formatJapaneseDate } from "@/hooks/useVideoData"

// 仮の再生リスト型定義
export interface Playlist {
  id: string
  title: string
  description?: string
  thumbnailUrl: string
  videoCount: number
  videos?: (VideoAnalysis | VideoMetadata)[]
}

interface ChannelHomeProps {
  videos: (VideoAnalysis | VideoMetadata)[]
  watchCountByVideoId: Record<string, number>
  channelTitle?: string
}

export default function ChannelHome({ videos, watchCountByVideoId, channelTitle = "チャンネル" }: ChannelHomeProps) {
  const [activeTab, setActiveTab] = useState("popular")

  // データがない場合の処理
  if (!videos || videos.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>データがありません</AlertTitle>
        <AlertDescription>
          動画データがありません。「分析情報アップロード」タブで動画データをアップロードしてください。
        </AlertDescription>
      </Alert>
    )
  }

  // 視聴回数データがない場合のデフォルト値を設定
  const safeWatchCountByVideoId = watchCountByVideoId || {}

  // 最近の動画（過去30日以内）
  const recentVideos = videos.filter((video) => {
    try {
      const publishedAt = "details" in video ? video.details?.publishedAt : video.publishedAt
      if (!publishedAt) return false

      const publishDate = new Date(publishedAt)
      // 日付が無効な場合はスキップ
      if (isNaN(publishDate.getTime())) return false

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      return publishDate >= thirtyDaysAgo
    } catch (e) {
      return false
    }
  })

  // 人気の動画（視聴回数順）
  const popularVideos = [...videos].sort((a, b) => {
    const watchCountA = safeWatchCountByVideoId[a.videoId] || 0
    const watchCountB = safeWatchCountByVideoId[b.videoId] || 0
    return watchCountB - watchCountA
  })

  // 未視聴の動画
  const unwatchedVideos = videos.filter(
    (video) => !safeWatchCountByVideoId[video.videoId] || safeWatchCountByVideoId[video.videoId] === 0,
  )

  // 仮の再生リストデータ
  // 実際のアプリケーションでは、APIから取得するか、親コンポーネントから渡されるべき
  const playlists: Playlist[] = [
    {
      id: "playlist1",
      title: "人気動画まとめ",
      description: "チャンネルの人気動画をまとめたプレイリスト",
      thumbnailUrl: popularVideos[0]
        ? "details" in popularVideos[0]
          ? popularVideos[0].details?.thumbnailUrl || "/placeholder.svg"
          : popularVideos[0].thumbnailUrl || "/placeholder.svg"
        : "/placeholder.svg",
      videoCount: Math.min(10, popularVideos.length),
      videos: popularVideos.slice(0, 10),
    },
    {
      id: "playlist2",
      title: "最新動画",
      description: "最近アップロードされた動画",
      thumbnailUrl: recentVideos[0]
        ? "details" in recentVideos[0]
          ? recentVideos[0].details?.thumbnailUrl || "/placeholder.svg"
          : recentVideos[0].thumbnailUrl || "/placeholder.svg"
        : "/placeholder.svg",
      videoCount: Math.min(10, recentVideos.length),
      videos: recentVideos.slice(0, 10),
    },
    {
      id: "playlist3",
      title: "未視聴の動画",
      description: "まだ視聴していない動画",
      thumbnailUrl: unwatchedVideos[0]
        ? "details" in unwatchedVideos[0]
          ? unwatchedVideos[0].details?.thumbnailUrl || "/placeholder.svg"
          : unwatchedVideos[0].thumbnailUrl || "/placeholder.svg"
        : "/placeholder.svg",
      videoCount: Math.min(10, unwatchedVideos.length),
      videos: unwatchedVideos.slice(0, 10),
    },
  ]

  return (
    <div className="space-y-8">
      {/* チャンネル情報 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl">{channelTitle}</CardTitle>
          <CardDescription>
            {videos.length}本の動画 • 最終更新: {formatJapaneseDate(new Date().toISOString().split("T")[0])}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChannelStats videos={videos} watchCountByVideoId={safeWatchCountByVideoId} />
        </CardContent>
      </Card>

      {/* 最近の動画（カルーセル） */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">最近の動画</h2>
        <VideoCarousel videos={recentVideos} watchCountByVideoId={safeWatchCountByVideoId} />
      </div>

      {/* タブ付きコンテンツ - タブ構成を変更 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="popular">人気の動画</TabsTrigger>
          <TabsTrigger value="unwatched">未視聴の動画</TabsTrigger>
          <TabsTrigger value="playlists">再生リスト</TabsTrigger>
        </TabsList>

        <TabsContent value="popular" className="space-y-4">
          <VideoGrid
            videos={popularVideos.slice(0, 12)}
            watchCountByVideoId={safeWatchCountByVideoId}
            emptyMessage="人気の動画はありません"
          />
        </TabsContent>

        <TabsContent value="unwatched" className="space-y-4">
          <VideoGrid
            videos={unwatchedVideos.slice(0, 12)}
            watchCountByVideoId={safeWatchCountByVideoId}
            emptyMessage="未視聴の動画はありません"
          />
        </TabsContent>

        <TabsContent value="playlists" className="space-y-4">
          <PlaylistGrid playlists={playlists} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
