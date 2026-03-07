import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatRelativeTime } from '../../src/lib/relative-time'

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const rtf = new Intl.RelativeTimeFormat('ja', { numeric: 'auto' })

  it('should return relative time for less than 1 minute ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T12:00:30Z'))
    expect(formatRelativeTime('2026-01-01T12:00:00Z')).toBe(rtf.format(0, 'second'))
  })

  it('should return "N分前" for minutes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T12:05:00Z'))
    expect(formatRelativeTime('2026-01-01T12:00:00Z')).toBe(rtf.format(-5, 'minute'))
  })

  it('should return "N時間前" for hours', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T14:00:00Z'))
    expect(formatRelativeTime('2026-01-01T12:00:00Z')).toBe(rtf.format(-2, 'hour'))
  })

  it('should return "N日前" for days', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-04T12:00:00Z'))
    expect(formatRelativeTime('2026-01-01T12:00:00Z')).toBe(rtf.format(-3, 'day'))
  })

  it('should return "N週間前" for weeks', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'))
    expect(formatRelativeTime('2026-01-01T12:00:00Z')).toBe(rtf.format(-2, 'week'))
  })

  it('should return "Nか月前" for months', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-01T12:00:00Z'))
    expect(formatRelativeTime('2026-01-01T12:00:00Z')).toBe(rtf.format(-3, 'month'))
  })

  it('should support English locale', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T12:05:00Z'))
    const enRtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
    expect(formatRelativeTime('2026-01-01T12:00:00Z', 'en')).toBe(enRtf.format(-5, 'minute'))
  })
})
