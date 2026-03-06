import { describe, it, expect } from 'vitest'
import { parseNote, serializeMemo, measureMemoHeight, MEMO_W } from './memo-utils'
import type { MemoData } from './types'

describe('parseNote', () => {
  it('should parse plain string as text with default right offset for left-half lane', () => {
    expect(parseNote('hello', 0, 4)).toEqual({ text: 'hello', dx: 50, dy: 46 })
  })

  it('should parse plain string with left offset for right-half lane', () => {
    expect(parseNote('hello', 3, 4)).toEqual({ text: 'hello', dx: -50, dy: 46 })
  })

  it('should parse JSON MemoData format', () => {
    const json = '{"text":"note","dx":30,"dy":60}'
    expect(parseNote(json, 0, 4)).toEqual({ text: 'note', dx: 30, dy: 60 })
  })

  it('should return null for null input', () => {
    expect(parseNote(null, 0, 4)).toBeNull()
  })

  it('should return null for empty string', () => {
    expect(parseNote('', 0, 4)).toBeNull()
  })

  it('should treat invalid JSON as plain text', () => {
    expect(parseNote('{invalid', 1, 4)).toEqual({
      text: '{invalid',
      dx: 50,
      dy: 46,
    })
  })

  it('should treat JSON without required fields as plain text', () => {
    expect(parseNote('{"foo":"bar"}', 0, 4)).toEqual({
      text: '{"foo":"bar"}',
      dx: 50,
      dy: 46,
    })
  })
})

describe('serializeMemo', () => {
  it('should serialize MemoData to JSON string', () => {
    const memo: MemoData = { text: 'test', dx: 50, dy: 46 }
    const result = serializeMemo(memo)
    expect(JSON.parse(result!)).toEqual(memo)
  })

  it('should return null for empty text', () => {
    expect(serializeMemo({ text: '', dx: 50, dy: 46 })).toBeNull()
  })
})

describe('measureMemoHeight', () => {
  it('should return minimum height for empty text', () => {
    expect(measureMemoHeight('', 152)).toBe(30)
  })

  it('should return minimum height for short text', () => {
    // cpl=12, 1 line → 1*17+14=31
    expect(measureMemoHeight('hi', 152)).toBe(31)
  })

  it('should grow height for long text', () => {
    const longText = 'a'.repeat(100)
    expect(measureMemoHeight(longText, 152)).toBeGreaterThan(30)
  })

  it('should handle multiline text', () => {
    const multiline = 'line1\nline2\nline3'
    expect(measureMemoHeight(multiline, 152)).toBeGreaterThan(30)
  })
})

describe('MEMO_W', () => {
  it('should be 152', () => {
    expect(MEMO_W).toBe(152)
  })
})
