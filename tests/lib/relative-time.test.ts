import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatRelativeTime } from '../../src/lib/relative-time'

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return "たった今" for less than 1 minute ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T12:00:30Z'))
    expect(formatRelativeTime('2026-01-01T12:00:00Z')).toBe('たった今')
  })

  it('should return "N分前" for minutes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T12:05:00Z'))
    expect(formatRelativeTime('2026-01-01T12:00:00Z')).toBe('5分前')
  })

  it('should return "N時間前" for hours', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T14:00:00Z'))
    expect(formatRelativeTime('2026-01-01T12:00:00Z')).toBe('2時間前')
  })

  it('should return "N日前" for days', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-04T12:00:00Z'))
    expect(formatRelativeTime('2026-01-01T12:00:00Z')).toBe('3日前')
  })

  it('should return "N週間前" for weeks', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'))
    expect(formatRelativeTime('2026-01-01T12:00:00Z')).toBe('2週間前')
  })

  it('should return "Nか月前" for months', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-01T12:00:00Z'))
    expect(formatRelativeTime('2026-01-01T12:00:00Z')).toBe('3か月前')
  })
})
