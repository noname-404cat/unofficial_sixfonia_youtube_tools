// YouTube API レスポンスの型定義
export interface YouTubeVideoResponse {
  items: Array<{
    id: string
    snippet: {
      title: string
      publishedAt: string
      thumbnails: {
        default: { url: string }
        medium: { url: string }
        high: { url: string }
      }
      channelTitle: string
      description: string
      tags?: string[]
    }
    statistics?: {
      viewCount: string
      likeCount: string
      commentCount: string
    }
    status?: {
      privacyStatus: string
      uploadStatus: string
    }
  }>
}
