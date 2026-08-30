import type { YouTubeVideoResponse } from "@/types/youtube"
import type { VideoMetadata } from "@/types/video"
import { extractHashtags } from "@/lib/video-utils"

/**
 * YouTube Data API を使用して動画情報を取得
 */
export const fetchVideoDetails = async (videoIds: string[], apiKey: string): Promise<VideoMetadata[]> => {
  if (!apiKey) {
    console.warn("YouTube API キーが設定されていません。動画の詳細情報は取得できません。")
    return videoIds.map((id) => ({
      videoId: id,
      title: id,
      publishedAt: "",
      thumbnailUrl: "/placeholder.svg",
    }))
  }

  // 最大50件ずつに分割
  const chunks = []
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50))
  }

  const results: VideoMetadata[] = []

  try {
    for (const chunk of chunks) {
      const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,status&id=${chunk.join(
        ",",
      )}&key=${apiKey}`

      try {
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`YouTube API エラー: ${response.status} ${response.statusText}`)
        }

        const data: YouTubeVideoResponse = await response.json()

        for (const item of data.items) {
          const isAvailable =
            item.status?.privacyStatus !== "private" &&
            item.status?.uploadStatus !== "deleted" &&
            item.status?.uploadStatus !== "failed"

          // タグを取得
          const apiTags = item.snippet.tags || []

          // タイトルとディスクリプションからハッシュタグを抽出
          const titleHashtags = extractHashtags(item.snippet.title)
          const descriptionHashtags = extractHashtags(item.snippet.description)

          // すべてのタグを結合して重複を排除
          const combinedTags = [...new Set([...apiTags, ...titleHashtags, ...descriptionHashtags])]

          results.push({
            videoId: item.id,
            title: item.snippet.title,
            publishedAt: item.snippet.publishedAt,
            thumbnailUrl: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
            channelTitle: item.snippet.channelTitle,
            isAvailable: isAvailable,
            tags: combinedTags,
            tagSource: "YouTube API + hashtag extraction",
          })
        }
      } catch (error) {
        console.error("YouTube API エラー:", error)
        // エラーが発生した場合でも処理を続行し、最低限の情報を返す
        chunk.forEach((id) => {
          if (!results.some((item) => item.videoId === id)) {
            results.push({
              videoId: id,
              title: id,
              publishedAt: "",
              thumbnailUrl: "/placeholder.svg",
            })
          }
        })
      }
    }

    return results
  } catch (error) {
    console.error("YouTube API 処理エラー:", error)
    // 全体的なエラーが発生した場合は最低限の情報を返す
    return videoIds.map((id) => ({
      videoId: id,
      title: id,
      publishedAt: "",
      thumbnailUrl: "/placeholder.svg",
    }))
  }
}
