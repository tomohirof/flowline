export function formatRelativeTime(isoString: string, lang: string = 'ja'): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)

  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })

  if (minutes < 1) return rtf.format(0, 'second')
  if (hours < 1) return rtf.format(-minutes, 'minute')
  if (days < 1) return rtf.format(-hours, 'hour')
  if (weeks < 1) return rtf.format(-days, 'day')
  if (months < 1) return rtf.format(-weeks, 'week')
  return rtf.format(-months, 'month')
}
