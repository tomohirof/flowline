/**
 * Format a date string as relative time, locale-aware.
 * Uses Intl.RelativeTimeFormat for proper i18n.
 */
export function formatRelativeTime(dateString: string, lang: string = 'ja'): string {
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

  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })

  if (diffMinutes < 1) {
    return rtf.format(0, 'second')
  }

  if (diffHours < 1) {
    return rtf.format(-diffMinutes, 'minute')
  }

  if (diffDays < 1) {
    return rtf.format(-diffHours, 'hour')
  }

  if (diffDays < 7) {
    return rtf.format(-diffDays, 'day')
  }

  return date.toLocaleDateString(lang, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}
