/**
 * ファイル名からチャンネルの表示名を取り出す。
 * 対応表は動画マスタ（スナップショット）から渡す。コードには持たない。
 */
export const extractCharacterFromFilename = (
  filename: string,
  prefixes: Record<string, string>,
): string | null => {
  if (!filename) return null

  for (const [prefix, characterName] of Object.entries(prefixes)) {
    if (filename.startsWith(prefix)) {
      return characterName
    }
  }
  return null
}

/**
 * ファイル名から日付抽出
 */
export const extractDateFromFilename = (filename: string): string | null => {
  if (!filename) return null

  const match = filename.match(/\d{8}/)
  return match ? match[0] : null
}

/**
 * ハッシュタグを抽出する関数
 */
export const extractHashtags = (text = ""): string[] => {
  if (!text) return []

  const hashtagRegex = /#([a-zA-Z0-9_\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]+)/g

  const matches = text.match(hashtagRegex) || []

  return matches
}

/**
 * タグから # を除去する関数
 */
export function removeHashFromTag(tag: string): string {
  return tag.startsWith("#") ? tag.substring(1) : tag
}

/**
 * ファイル読み込み共通関数
 */
export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = (e) => reject(new Error("ファイルの読み込みに失敗しました"))
    reader.readAsText(file)
  })
}
