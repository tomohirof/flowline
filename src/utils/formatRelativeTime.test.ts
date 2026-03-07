// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatRelativeTime } from './formatRelativeTime'

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  // Helper to get expected output from Intl.RelativeTimeFormat
  const rtf = new Intl.RelativeTimeFormat('ja', { numeric: 'auto' })

  it('should return relative time for less than 1 minute ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:30Z'))

    expect(formatRelativeTime('2026-01-15T12:00:00Z')).toBe(rtf.format(0, 'second'))
  })

  it('should return "N分前" when less than 1 hour ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:05:00Z'))

    expect(formatRelativeTime('2026-01-15T12:05:00Z', 'ja')).toBe(rtf.format(0, 'second'))
    expect(formatRelativeTime('2026-01-15T12:00:00Z', 'ja')).toBe(rtf.format(-5, 'minute'))
  })

  it('should return "N時間前" when less than 1 day ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T14:00:00Z'))

    expect(formatRelativeTime('2026-01-15T12:00:00Z', 'ja')).toBe(rtf.format(-2, 'hour'))
  })

  it('should return "N日前" when less than 7 days ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-18T12:00:00Z'))

    expect(formatRelativeTime('2026-01-15T12:00:00Z', 'ja')).toBe(rtf.format(-3, 'day'))
  })

  it('should return formatted date when 7 or more days ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-22T12:00:00Z'))

    const result = formatRelativeTime('2026-01-15T12:00:00Z', 'ja')
    expect(result).toContain('2026')
    expect(result).toContain('01')
    expect(result).toContain('15')
  })

  it('should return "-" for invalid date string', () => {
    const result = formatRelativeTime('')
    expect(result).toBe('-')
  })

  it('should support English locale', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:05:00Z'))

    const enRtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
    expect(formatRelativeTime('2026-01-15T12:00:00Z', 'en')).toBe(enRtf.format(-5, 'minute'))
  })

  it('should default to ja locale', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:05:00Z'))

    expect(formatRelativeTime('2026-01-15T12:00:00Z')).toBe(
      formatRelativeTime('2026-01-15T12:00:00Z', 'ja'),
    )
  })
})
