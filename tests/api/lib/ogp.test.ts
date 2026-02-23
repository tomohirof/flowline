import { describe, it, expect } from 'vitest'
import { escapeHtml, injectOgpMeta } from '../../../api/lib/ogp'

// Minimal index.html template matching the real structure
const SAMPLE_INDEX_HTML = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>Flowline — フローを描く。チームが動く。</title>
    <meta name="description" content="業務プロセスを視覚化するスイムレーンエディタ。" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://flowline.six1.jp" />
    <meta property="og:title" content="Flowline — フローを描く。チームが動く。" />
    <meta property="og:description" content="業務プロセスを視覚化するスイムレーンエディタ。" />
    <meta property="og:image" content="https://flowline.six1.jp/ogp/default.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="Flowline" />
    <meta property="og:locale" content="ja_JP" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Flowline — フローを描く。チームが動く。" />
    <meta name="twitter:description" content="業務プロセスを視覚化するスイムレーンエディタ" />
    <meta name="twitter:image" content="https://flowline.six1.jp/ogp/default.png" />
    <meta name="theme-color" content="#7C5CFC" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`

describe('OGP Utility', () => {
  // ========================================
  // escapeHtml
  // ========================================
  describe('escapeHtml', () => {
    it('should escape ampersand', () => {
      expect(escapeHtml('a&b')).toBe('a&amp;b')
    })

    it('should escape less-than sign', () => {
      expect(escapeHtml('a<b')).toBe('a&lt;b')
    })

    it('should escape greater-than sign', () => {
      expect(escapeHtml('a>b')).toBe('a&gt;b')
    })

    it('should escape double quotes', () => {
      expect(escapeHtml('a"b')).toBe('a&quot;b')
    })

    it('should escape single quotes', () => {
      expect(escapeHtml("a'b")).toBe('a&#39;b')
    })

    it('should escape multiple special characters in one string', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
      )
    })

    it('should return empty string when input is empty', () => {
      expect(escapeHtml('')).toBe('')
    })

    it('should return string unchanged when no special characters', () => {
      expect(escapeHtml('Hello World 123')).toBe('Hello World 123')
    })

    it('should handle string with only special characters', () => {
      expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;')
    })
  })

  // ========================================
  // injectOgpMeta
  // ========================================
  describe('injectOgpMeta', () => {
    const defaultParams = {
      title: 'テストフロー',
      author: '田中太郎',
      laneCount: 3,
      nodeCount: 10,
      shareToken: 'abc123',
      baseUrl: 'https://flowline.six1.jp',
    }

    it('should replace title tag with flow title', () => {
      const result = injectOgpMeta(SAMPLE_INDEX_HTML, defaultParams)
      expect(result).toContain('<title>テストフロー — Flowline</title>')
      expect(result).not.toContain('フローを描く。チームが動く。</title>')
    })

    it('should replace og:title with flow title', () => {
      const result = injectOgpMeta(SAMPLE_INDEX_HTML, defaultParams)
      expect(result).toContain('og:title" content="テストフロー — Flowline"')
    })

    it('should replace og:description with author and stats', () => {
      const result = injectOgpMeta(SAMPLE_INDEX_HTML, defaultParams)
      expect(result).toContain(
        'og:description" content="田中太郎さんが作成したフロー図（3レーン、10ノード）"',
      )
    })

    it('should replace og:url with shared URL', () => {
      const result = injectOgpMeta(SAMPLE_INDEX_HTML, defaultParams)
      expect(result).toContain('og:url" content="https://flowline.six1.jp/shared/abc123"')
    })

    it('should replace og:image with dynamic OGP image URL', () => {
      const result = injectOgpMeta(SAMPLE_INDEX_HTML, defaultParams)
      expect(result).toContain(
        'og:image" content="https://flowline.six1.jp/api/ogp/share/abc123.png"',
      )
    })

    it('should change og:type from website to article', () => {
      const result = injectOgpMeta(SAMPLE_INDEX_HTML, defaultParams)
      expect(result).toContain('og:type" content="article"')
      expect(result).not.toContain('og:type" content="website"')
    })

    it('should replace twitter:title with flow title', () => {
      const result = injectOgpMeta(SAMPLE_INDEX_HTML, defaultParams)
      expect(result).toContain('twitter:title" content="テストフロー — Flowline"')
    })

    it('should replace twitter:description with author info', () => {
      const result = injectOgpMeta(SAMPLE_INDEX_HTML, defaultParams)
      expect(result).toContain('twitter:description" content="田中太郎さんが作成したフロー図"')
    })

    it('should replace twitter:image with dynamic OGP image URL', () => {
      const result = injectOgpMeta(SAMPLE_INDEX_HTML, defaultParams)
      expect(result).toContain(
        'twitter:image" content="https://flowline.six1.jp/api/ogp/share/abc123.png"',
      )
    })

    it('should preserve og:image:width and og:image:height', () => {
      const result = injectOgpMeta(SAMPLE_INDEX_HTML, defaultParams)
      expect(result).toContain('og:image:width" content="1200"')
      expect(result).toContain('og:image:height" content="630"')
    })

    it('should preserve og:site_name and og:locale', () => {
      const result = injectOgpMeta(SAMPLE_INDEX_HTML, defaultParams)
      expect(result).toContain('og:site_name" content="Flowline"')
      expect(result).toContain('og:locale" content="ja_JP"')
    })

    it('should preserve SPA script tag and root div', () => {
      const result = injectOgpMeta(SAMPLE_INDEX_HTML, defaultParams)
      expect(result).toContain('<div id="root"></div>')
      expect(result).toContain('<script type="module" src="/src/main.tsx"></script>')
    })

    it('should NOT contain redirect script', () => {
      const result = injectOgpMeta(SAMPLE_INDEX_HTML, defaultParams)
      expect(result).not.toContain('window.location.href')
      expect(result).not.toContain('リダイレクト中')
    })

    it('should HTML-escape title to prevent XSS', () => {
      const result = injectOgpMeta(SAMPLE_INDEX_HTML, {
        ...defaultParams,
        title: '<script>alert("xss")</script>',
      })
      expect(result).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; — Flowline')
      expect(result).not.toContain('<script>alert("xss")</script> — Flowline')
    })

    it('should HTML-escape author to prevent XSS', () => {
      const result = injectOgpMeta(SAMPLE_INDEX_HTML, {
        ...defaultParams,
        author: '"><img src=x onerror=alert(1)>',
      })
      expect(result).toContain('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;さんが作成したフロー図')
    })

    it('should handle zero lane and node counts', () => {
      const result = injectOgpMeta(SAMPLE_INDEX_HTML, {
        ...defaultParams,
        laneCount: 0,
        nodeCount: 0,
      })
      expect(result).toContain('（0レーン、0ノード）')
    })

    it('should use provided baseUrl for URLs', () => {
      const result = injectOgpMeta(SAMPLE_INDEX_HTML, {
        ...defaultParams,
        baseUrl: 'https://custom.example.com',
      })
      expect(result).toContain('https://custom.example.com/shared/abc123')
      expect(result).toContain('https://custom.example.com/api/ogp/share/abc123.png')
    })

    it('should handle baseUrl with trailing slash', () => {
      const result = injectOgpMeta(SAMPLE_INDEX_HTML, {
        ...defaultParams,
        baseUrl: 'https://example.com/',
      })
      expect(result).toContain('https://example.com/shared/abc123')
      expect(result).not.toContain('https://example.com//shared/')
    })

    it('should encode special characters in shareToken for URLs', () => {
      const result = injectOgpMeta(SAMPLE_INDEX_HTML, {
        ...defaultParams,
        shareToken: 'token with spaces&special',
      })
      expect(result).toContain('token%20with%20spaces%26special')
    })

    it('should replace meta description tag', () => {
      const result = injectOgpMeta(SAMPLE_INDEX_HTML, defaultParams)
      expect(result).toContain(
        'name="description" content="田中太郎さんが作成したフロー図（3レーン、10ノード）"',
      )
      expect(result).not.toContain(
        'name="description" content="業務プロセスを視覚化するスイムレーンエディタ。"',
      )
    })

    it('should handle $ metacharacter in title without replacement pattern expansion', () => {
      const result = injectOgpMeta(SAMPLE_INDEX_HTML, {
        ...defaultParams,
        title: '$& project',
      })
      expect(result).toContain('<title>$&amp; project — Flowline</title>')
    })

    it('should handle $1 in author name without capture group expansion', () => {
      const result = injectOgpMeta(SAMPLE_INDEX_HTML, {
        ...defaultParams,
        author: '$1 予算チーム',
      })
      expect(result).toContain('$1 予算チームさんが作成したフロー図')
    })
  })
})
