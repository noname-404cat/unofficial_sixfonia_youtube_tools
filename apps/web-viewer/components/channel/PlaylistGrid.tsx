"use client"

import { Card, CardContent, CardFooter } from "@/components/ui/card"
import Image from "next/image"
import { List } from "lucide-react"
import type { Playlist } from "./ChannelHome"

interface PlaylistGridProps {
  playlists: Playlist[]
}

export default function PlaylistGrid({ playlists }: PlaylistGridProps) {
  if (!playlists || playlists.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">再生リストがありません</div>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {playlists.map((playlist) => (
        <PlaylistCard key={playlist.id} playlist={playlist} />
      ))}
    </div>
  )
}

function PlaylistCard({ playlist }: { playlist: Playlist }) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <a href={`#playlist-${playlist.id}`} className="block">
        <div className="relative aspect-video">
          <Image src={playlist.thumbnailUrl || "/placeholder.svg"} alt={playlist.title} fill className="object-cover" />
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 rounded text-xs font-medium text-white flex items-center">
            <List className="h-3 w-3 mr-1" />
            {playlist.videoCount}本
          </div>
        </div>
        <CardContent className="p-3">
          <h3 className="font-medium line-clamp-2 text-sm h-10">{playlist.title}</h3>
          {playlist.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{playlist.description}</p>
          )}
        </CardContent>
        <CardFooter className="p-3 pt-0 flex justify-between items-center">
          <div className="text-xs text-muted-foreground">{playlist.videoCount}本の動画</div>
        </CardFooter>
      </a>
    </Card>
  )
}
