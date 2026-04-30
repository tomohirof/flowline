import { describe, it, expect } from 'vitest'
import {
  parseNote,
  serializeMemo,
  measureMemoHeight,
  MEMO_W,
  splitTextWithUrls,
} from './memo-utils'
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
    // cpl=24, 'hi' width=2, 1 line → 1*17+14=31
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

  it('should account for CJK characters taking double width', () => {
    // 12 CJK chars → width 24, fits in 1 line (cpl=24)
    const cjk12 = 'あ'.repeat(12)
    const h12 = measureMemoHeight(cjk12, 152)
    // 13 CJK chars → width 26, wraps to 2 lines
    const cjk13 = 'あ'.repeat(13)
    const h13 = measureMemoHeight(cjk13, 152)
    expect(h13).toBeGreaterThan(h12)
  })
})

describe('MEMO_W', () => {
  it('should be 152', () => {
    expect(MEMO_W).toBe(152)
  })
})

describe('splitTextWithUrls', () => {
  it('returns single text segment when input has no URLs', () => {
    expect(splitTextWithUrls('hello world')).toEqual([{ type: 'text', value: 'hello world' }])
  })

  it('returns empty array for empty string', () => {
    expect(splitTextWithUrls('')).toEqual([])
  })

  it('detects a single https URL in the middle of text', () => {
    expect(splitTextWithUrls('see https://example.com here')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'url', value: 'https://example.com' },
      { type: 'text', value: ' here' },
    ])
  })

  it('detects http and multiple URLs in order', () => {
    expect(splitTextWithUrls('a http://a.com b https://b.com c')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'url', value: 'http://a.com' },
      { type: 'text', value: ' b ' },
      { type: 'url', value: 'https://b.com' },
      { type: 'text', value: ' c' },
    ])
  })

  it('preserves query and fragment', () => {
    const url = 'https://example.com/path?q=1&r=2#frag'
    expect(splitTextWithUrls(`x ${url} y`)).toEqual([
      { type: 'text', value: 'x ' },
      { type: 'url', value: url },
      { type: 'text', value: ' y' },
    ])
  })

  it('excludes trailing punctuation from the URL', () => {
    expect(splitTextWithUrls('see https://example.com.')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'url', value: 'https://example.com' },
      { type: 'text', value: '.' },
    ])
    expect(splitTextWithUrls('(https://example.com)')).toEqual([
      { type: 'text', value: '(' },
      { type: 'url', value: 'https://example.com' },
      { type: 'text', value: ')' },
    ])
  })

  it('does NOT match dangerous schemes', () => {
    expect(splitTextWithUrls('javascript:alert(1)')).toEqual([
      { type: 'text', value: 'javascript:alert(1)' },
    ])
    expect(splitTextWithUrls('data:text/html,foo')).toEqual([
      { type: 'text', value: 'data:text/html,foo' },
    ])
    expect(splitTextWithUrls('file:///etc/passwd')).toEqual([
      { type: 'text', value: 'file:///etc/passwd' },
    ])
  })

  it('does not match scheme-only without host', () => {
    expect(splitTextWithUrls('http://')).toEqual([{ type: 'text', value: 'http://' }])
  })

  it('does not span URL across newlines', () => {
    expect(splitTextWithUrls('see https://example.com\nnext line')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'url', value: 'https://example.com' },
      { type: 'text', value: '\nnext line' },
    ])
  })

  it('keeps balanced parentheses inside the URL (Wikipedia-style)', () => {
    const url = 'https://en.wikipedia.org/wiki/Python_(programming_language)'
    expect(splitTextWithUrls(`see ${url} here`)).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'url', value: url },
      { type: 'text', value: ' here' },
    ])
  })

  it('strips only unbalanced trailing close parens from a URL', () => {
    // Outer parens around URL — trailing ) is unbalanced relative to the URL's content
    expect(splitTextWithUrls('see (https://example.com) here')).toEqual([
      { type: 'text', value: 'see (' },
      { type: 'url', value: 'https://example.com' },
      { type: 'text', value: ') here' },
    ])
    // URL ends with ) AND has matching ( inside — keep the )
    expect(splitTextWithUrls('see https://en.wikipedia.org/wiki/Brace_(punctuation) here')).toEqual(
      [
        { type: 'text', value: 'see ' },
        { type: 'url', value: 'https://en.wikipedia.org/wiki/Brace_(punctuation)' },
        { type: 'text', value: ' here' },
      ],
    )
    // Outer parens around a Wikipedia URL — only the OUTER ) is unbalanced
    expect(
      splitTextWithUrls('(https://en.wikipedia.org/wiki/Python_(programming_language))'),
    ).toEqual([
      { type: 'text', value: '(' },
      { type: 'url', value: 'https://en.wikipedia.org/wiki/Python_(programming_language)' },
      { type: 'text', value: ')' },
    ])
  })

  it('treats full-width spaces and tabs as separators', () => {
    expect(splitTextWithUrls('a\thttps://example.com\tb')).toEqual([
      { type: 'text', value: 'a\t' },
      { type: 'url', value: 'https://example.com' },
      { type: 'text', value: '\tb' },
    ])
    expect(splitTextWithUrls('a　https://example.com　b')).toEqual([
      { type: 'text', value: 'a　' },
      { type: 'url', value: 'https://example.com' },
      { type: 'text', value: '　b' },
    ])
  })
})
