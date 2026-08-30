"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import type { Playlist } from "./ChannelHome"
import VideoGrid from "./VideoGrid"

interface PlaylistDetailProps {
  playlist: Playlist
  watchCountByVideoId: Record<string, number>
  onBack: () => void
}

export default function PlaylistDetail({ playlist, watchCountByVideoId, onBack }: PlaylistDetailProps) {
  if (!playlist) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          戻る
        </Button>
        <h2 className="text-xl font-bold">{playlist.title}</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{playlist.title}</CardTitle>
          {playlist.description && <CardDescription>{playlist.description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">{playlist.videoCount}本の動画</div>
          {playlist.videos && playlist.videos.length > 0 ? (
            <VideoGrid videos={playlist.videos} watchCountByVideoId={watchCountByVideoId} />
          ) : (
            <div className="text-center py-6 text-muted-foreground">この再生リストには動画がありません</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
