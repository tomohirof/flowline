export function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)

  if (minutes < 1) return 'たった今'
  if (hours < 1) return `${minutes}分前`
  if (days < 1) return `${hours}時間前`
  if (weeks < 1) return `${days}日前`
  if (months < 1) return `${weeks}週間前`
  return `${months}か月前`
}
