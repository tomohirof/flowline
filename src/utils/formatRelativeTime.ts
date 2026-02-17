/**
 * 日付文字列を相対時間に変換する
 * - 1分未満: "たった今"
 * - 1時間未満: "N分前"
 * - 1日未満: "N時間前"
 * - 7日未満: "N日前"
 * - それ以上: "YYYY/MM/DD"
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)

  if (isNaN(date.getTime())) {
    return '-'
  }

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) {
    return 'たった今'
  }

  if (diffHours < 1) {
    return `${diffMinutes}分前`
  }

  if (diffDays < 1) {
    return `${diffHours}時間前`
  }

  if (diffDays < 7) {
    return `${diffDays}日前`
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}/${month}/${day}`
}
