/**
 * 日付フォーマット関数
 */
export function formatJapaneseDate(dateString: string): string {
  try {
    // 日付文字列が8桁の数字（YYYYMMDD形式）の場合
    if (dateString.length === 8 && /^\d{8}$/.test(dateString)) {
      const year = dateString.substring(0, 4)
      const month = dateString.substring(4, 6)
      const day = dateString.substring(6, 8)
      return `${year}年${Number(month)}月${Number(day)}日`
    }

    // 通常の日付文字列の場合は固定フォーマットを使用（ロケールに依存しない）
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${year}年${month}月${day}日`
  } catch (e) {
    return dateString
  }
}

export function formatShortDate(dateString: string): string {
  if (dateString.length !== 8) return dateString

  const year = dateString.substring(0, 4)
  const month = dateString.substring(4, 6)
  const day = dateString.substring(6, 8)

  return `${year}/${month}/${day}`
}

/**
 * 日付範囲取得関数
 */
export const getYesterdayDate = (): Date => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return yesterday
}

export const getLastWeekDate = (): Date => {
  const lastWeek = new Date()
  lastWeek.setDate(lastWeek.getDate() - 7)
  return lastWeek
}

export const getFirstDayOfMonth = (): Date => {
  const today = new Date()
  return new Date(today.getFullYear(), today.getMonth(), 1)
}

/**
 * 日付判定関数
 */
export const isUploadedThisMonth = (publishedAt: string): boolean => {
  if (!publishedAt) return false

  try {
    const publishDate = new Date(publishedAt)
    const firstDayOfMonth = getFirstDayOfMonth()
    const today = new Date()

    if (isNaN(publishDate.getTime())) return false

    return publishDate >= firstDayOfMonth && publishDate <= today
  } catch (e) {
    return false
  }
}

export const isUploadedYesterday = (publishedAt: string): boolean => {
  if (!publishedAt) return false

  try {
    const publishDate = new Date(publishedAt)
    const yesterday = getYesterdayDate()

    if (isNaN(publishDate.getTime())) return false

    return (
      publishDate.getDate() === yesterday.getDate() &&
      publishDate.getMonth() === yesterday.getMonth() &&
      publishDate.getFullYear() === yesterday.getFullYear()
    )
  } catch (e) {
    return false
  }
}

export const isUploadedLastWeek = (publishedAt: string): boolean => {
  if (!publishedAt) return false

  try {
    const publishDate = new Date(publishedAt)
    const lastWeek = getLastWeekDate()

    if (isNaN(publishDate.getTime())) return false

    return publishDate >= lastWeek && publishDate <= new Date()
  } catch (e) {
    return false
  }
}
