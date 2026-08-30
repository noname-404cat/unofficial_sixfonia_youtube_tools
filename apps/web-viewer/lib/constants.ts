// チャンネル名と表示名の対応は動画マスタ（data/videos.json）が唯一の正。
// ここに持たせると、チャンネルの増減のたびに複数箇所を直すことになる。

// 視聴回数の範囲を定義
export const VIEW_COUNT_RANGES = {
  HIGH: 10, // 10回以上は「よく見た」
  MEDIUM: 5, // 5-9回は「複数回視聴」
  LOW: 1, // 1-4回は「視聴済み」
  NONE: 0, // 0回は「未視聴」
} as const

// CSVファイル形式例
export const CSV_FORMAT_EXAMPLES = {
  HEADER: "videoId,viewCount,likeCount,commentCount,videoURL",
  SAMPLE: "abc123,1000,50,10,https://www.youtube.com/watch?v=abc123",
} as const

// 計算式のテキスト
export const CALCULATION_FORMULA = "(day2 - day1) - (day1 - day0)" as const
