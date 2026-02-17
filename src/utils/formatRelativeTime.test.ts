// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatRelativeTime } from './formatRelativeTime'

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return "たった今" when less than 1 minute ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:30Z'))

    expect(formatRelativeTime('2026-01-15T12:00:00Z')).toBe('たった今')
  })

  it('should return "N分前" when less than 1 hour ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:05:00Z'))

    expect(formatRelativeTime('2026-01-15T12:00:00Z')).toBe('5分前')
  })

  it('should return "1分前" when exactly 1 minute ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:01:00Z'))

    expect(formatRelativeTime('2026-01-15T12:00:00Z')).toBe('1分前')
  })

  it('should return "59分前" when 59 minutes ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:59:00Z'))

    expect(formatRelativeTime('2026-01-15T12:00:00Z')).toBe('59分前')
  })

  it('should return "N時間前" when less than 1 day ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T14:00:00Z'))

    expect(formatRelativeTime('2026-01-15T12:00:00Z')).toBe('2時間前')
  })

  it('should return "1時間前" when exactly 1 hour ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T13:00:00Z'))

    expect(formatRelativeTime('2026-01-15T12:00:00Z')).toBe('1時間前')
  })

  it('should return "23時間前" when 23 hours ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-16T11:00:00Z'))

    expect(formatRelativeTime('2026-01-15T12:00:00Z')).toBe('23時間前')
  })

  it('should return "N日前" when less than 7 days ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-18T12:00:00Z'))

    expect(formatRelativeTime('2026-01-15T12:00:00Z')).toBe('3日前')
  })

  it('should return "1日前" when exactly 1 day ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-16T12:00:00Z'))

    expect(formatRelativeTime('2026-01-15T12:00:00Z')).toBe('1日前')
  })

  it('should return "6日前" when 6 days ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-21T12:00:00Z'))

    expect(formatRelativeTime('2026-01-15T12:00:00Z')).toBe('6日前')
  })

  it('should return "YYYY/MM/DD" when 7 or more days ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-22T12:00:00Z'))

    expect(formatRelativeTime('2026-01-15T12:00:00Z')).toBe('2026/01/15')
  })

  it('should return "YYYY/MM/DD" for very old dates', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'))

    expect(formatRelativeTime('2025-01-01T00:00:00Z')).toBe('2025/01/01')
  })

  // エッジケース: 空文字列
  it('should return "YYYY/MM/DD" format for invalid date string (empty)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'))

    // 空文字は Invalid Date → NaN になるので特殊処理
    const result = formatRelativeTime('')
    expect(result).toBe('-')
  })

  // エッジケース: 0秒前（完全一致）
  it('should return "たった今" when exactly now', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'))

    expect(formatRelativeTime('2026-01-15T12:00:00Z')).toBe('たった今')
  })
})
