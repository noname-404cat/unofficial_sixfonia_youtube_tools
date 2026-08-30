/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // 動画マスタは未視聴チェック（別の Vercel プロジェクト）からも読む。
  // クロスオリジンで取得できるように許可する。中身は公開YouTubeメタデータのみ。
  async headers() {
    return [
      {
        source: "/data/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
        ],
      },
    ]
  },
}

export default nextConfig
