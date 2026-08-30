import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "シクフォニ 新着動画",
  description: "7チャンネルの投稿を 昨日 / 今週 / 今月 でまとめて表示する非公式ツール",
}

// テーマ切替のUIを持たない暗色固定のアプリなので next-themes は使わない。
// ThemeProvider はハイドレーション前に <html> へ color-scheme を注入するため、
// サーバーHTMLとクライアントで属性がずれ、コンソールに警告が出ていた。
// color-scheme はここで静的に指定する（スクロールバーやフォーム部品が暗色になる）。
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" className="dark" style={{ colorScheme: "dark" }}>
      <body className={`${inter.className} bg-black text-white`}>{children}</body>
    </html>
  )
}
