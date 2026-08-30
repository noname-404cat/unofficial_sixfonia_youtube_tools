import { VideoList } from "@/components/video-list"
import { bucketVideos, displayNames, getSnapshot, isStale } from "@/lib/snapshot"
import { formatJapanDate } from "@/lib/date-utils"

// スナップショットはビルド時に取り込む。動画マスタが更新されると
// Actions がコミットし、Vercel が再デプロイして反映される。
export const dynamic = "force-static"

export default function Home() {
  const snapshot = getSnapshot()
  const buckets = bucketVideos(snapshot.videos)
  const stale = isStale(snapshot.updated_at)

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="container mx-auto max-w-3xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">シクフォニ 新着動画</h1>
          <p className="mt-1 text-sm text-gray-400">
            {snapshot.channels.length}チャンネルの投稿を、昨日 / 今週 / 今月でまとめています。
          </p>
        </header>

        {stale && (
          <div className="mb-6 rounded-md border border-yellow-700 bg-yellow-950/40 p-3 text-sm text-yellow-200">
            動画マスタが36時間以上更新されていません。取得バッチが失敗している可能性があります。
          </div>
        )}

        {snapshot.videos.length === 0 ? (
          <div className="rounded-md border border-gray-700 bg-gray-900 p-6 text-sm text-gray-300">
            動画マスタがまだ生成されていません。GitHub Actions の
            <code className="mx-1 rounded bg-gray-800 px-1.5 py-0.5">Update video snapshot</code>
            を実行してください。
          </div>
        ) : (
          <VideoList buckets={buckets} displayNames={displayNames(snapshot)} />
        )}

        <footer className="mt-10 border-t border-gray-800 pt-4 text-xs text-gray-500">
          <p>動画マスタの更新: {formatJapanDate(snapshot.updated_at)}</p>
          <p className="mt-1">
            ファンが個人で作った非公式ツールです。シクフォニおよび所属各位とは関係ありません。
          </p>
        </footer>
      </div>
    </main>
  )
}
