import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { VideoCard } from "@/components/video-card"
import { BUCKET_LABELS, type BucketKey, type Buckets } from "@/lib/snapshot"
import type { Video } from "@/types/video"

interface VideoListProps {
  buckets: Buckets
  displayNames: Record<string, string>
}

const ORDER: BucketKey[] = ["yesterday", "thisWeek", "thisMonth"]

function channelSummary(videos: Video[], displayNames: Record<string, string>): string {
  const names = Array.from(new Set(videos.map((v) => displayNames[v.channel] ?? v.channel)))
  return names.length > 0 ? names.join("、") : "なし"
}

export function VideoList({ buckets, displayNames }: VideoListProps) {
  const isEmpty = ORDER.every((key) => buckets[key].length === 0)

  if (isEmpty) {
    return (
      <div className="rounded-md border border-gray-700 bg-gray-900 py-10 text-center">
        <p className="text-gray-300">この期間の投稿はありません</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {ORDER.map((key) => {
        const videos = buckets[key]
        // 月初が今週の中に入る週は「今月」が空になる。見出しごと出さない。
        if (videos.length === 0) return null
        return (
          <Card key={key} className="border-gray-700 bg-gray-900">
            <CardHeader>
              <CardTitle className="text-white">
                {BUCKET_LABELS[key]}の動画（{videos.length}件）
              </CardTitle>
              <div className="text-sm text-gray-400">
                チャンネル: {channelSummary(videos, displayNames)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {videos.map((video) => (
                  <VideoCard
                    key={video.videoId}
                    video={video}
                    channelTitle={displayNames[video.channel] ?? video.channel}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
