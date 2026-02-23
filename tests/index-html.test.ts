import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('index.html OGP meta tags', () => {
  const html = readFileSync(resolve(__dirname, '../index.html'), 'utf-8')

  it('should not contain flowline.app domain in any meta tag', () => {
    const metaTagPattern = /<meta[^>]*content="[^"]*flowline\.app[^"]*"[^>]*>/gi
    const matches = html.match(metaTagPattern)
    expect(matches).toBeNull()
  })

  it('should have og:url pointing to flowline.six1.jp', () => {
    expect(html).toContain('content="https://flowline.six1.jp"')
  })

  it('should have og:image pointing to flowline.six1.jp', () => {
    expect(html).toContain('content="https://flowline.six1.jp/ogp/default.png"')
  })

  it('should have twitter:image pointing to flowline.six1.jp', () => {
    expect(html).toContain(
      'name="twitter:image" content="https://flowline.six1.jp/ogp/default.png"',
    )
  })
})
