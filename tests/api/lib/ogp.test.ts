import { describe, it, expect } from 'vitest'
import { BOT_USER_AGENTS, isBotUserAgent, escapeHtml, generateOgpHtml } from '../../../api/lib/ogp'

describe('OGP Utility', () => {
  // ========================================
  // BOT_USER_AGENTS
  // ========================================
  describe('BOT_USER_AGENTS', () => {
    it('should contain known bot user agent substrings', () => {
      expect(BOT_USER_AGENTS).toContain('twitterbot')
      expect(BOT_USER_AGENTS).toContain('facebookexternalhit')
      expect(BOT_USER_AGENTS).toContain('linkedinbot')
      expect(BOT_USER_AGENTS).toContain('discordbot')
      expect(BOT_USER_AGENTS).toContain('slackbot')
      expect(BOT_USER_AGENTS).toContain('googlebot')
      expect(BOT_USER_AGENTS).toContain('line/')
    })

    it('should store all substrings in lowercase', () => {
      for (const ua of BOT_USER_AGENTS) {
        expect(ua).toBe(ua.toLowerCase())
      }
    })
  })

  // ========================================
  // isBotUserAgent
  // ========================================
  describe('isBotUserAgent', () => {
    it('should return true when UA contains Twitterbot', () => {
      expect(isBotUserAgent('Twitterbot/1.0')).toBe(true)
    })

    it('should return true when UA contains facebookexternalhit', () => {
      expect(isBotUserAgent('facebookexternalhit/1.1')).toBe(true)
    })

    it('should return true when UA contains LinkedInBot', () => {
      expect(isBotUserAgent('LinkedInBot/1.0 (compatible; Mozilla/5.0)')).toBe(true)
    })

    it('should return true when UA contains Discordbot', () => {
      expect(isBotUserAgent('Mozilla/5.0 (compatible; Discordbot/2.0)')).toBe(true)
    })

    it('should return true when UA contains Slackbot', () => {
      expect(isBotUserAgent('Slackbot-LinkExpanding 1.0')).toBe(true)
    })

    it('should return true when UA contains Googlebot', () => {
      expect(isBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true)
    })

    it('should return true when UA contains LINE/', () => {
      expect(isBotUserAgent('Line/2.0')).toBe(true)
    })

    it('should return false when UA is a normal browser', () => {
      expect(
        isBotUserAgent(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0',
        ),
      ).toBe(false)
    })

    it('should return false when UA is empty string', () => {
      expect(isBotUserAgent('')).toBe(false)
    })

    it('should return false when UA is null', () => {
      expect(isBotUserAgent(null)).toBe(false)
    })

    it('should return false when UA is undefined', () => {
      expect(isBotUserAgent(undefined)).toBe(false)
    })

    it('should perform case-insensitive matching', () => {
      expect(isBotUserAgent('TWITTERBOT/1.0')).toBe(true)
      expect(isBotUserAgent('twitterbot/1.0')).toBe(true)
      expect(isBotUserAgent('TwitterBot/1.0')).toBe(true)
    })
  })

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
  // generateOgpHtml
  // ========================================
  describe('generateOgpHtml', () => {
    const defaultParams = {
      title: 'テストフロー',
      author: '田中太郎',
      laneCount: 3,
      nodeCount: 10,
      shareToken: 'abc123',
    }

    it('should include correct og:title meta tag', () => {
      const html = generateOgpHtml(defaultParams)
      expect(html).toContain('<meta property="og:title" content="テストフロー — Flowline">')
    })

    it('should include correct HTML title tag', () => {
      const html = generateOgpHtml(defaultParams)
      expect(html).toContain('<title>テストフロー — Flowline</title>')
    })

    it('should include og:type article', () => {
      const html = generateOgpHtml(defaultParams)
      expect(html).toContain('<meta property="og:type" content="article">')
    })

    it('should include og:url with share token', () => {
      const html = generateOgpHtml(defaultParams)
      expect(html).toContain(
        '<meta property="og:url" content="https://flowline.app/shared/abc123">',
      )
    })

    it('should include og:description with author, lane count and node count', () => {
      const html = generateOgpHtml(defaultParams)
      expect(html).toContain(
        '<meta property="og:description" content="田中太郎さんが作成したフロー図（3レーン、10ノード）">',
      )
    })

    it('should include dynamic og:image URL with share token', () => {
      const html = generateOgpHtml(defaultParams)
      expect(html).toContain(
        '<meta property="og:image" content="https://flowline.app/ogp/share/abc123.png">',
      )
    })

    it('should include og:image dimensions 1200x630', () => {
      const html = generateOgpHtml(defaultParams)
      expect(html).toContain('<meta property="og:image:width" content="1200">')
      expect(html).toContain('<meta property="og:image:height" content="630">')
    })

    it('should include og:site_name Flowline', () => {
      const html = generateOgpHtml(defaultParams)
      expect(html).toContain('<meta property="og:site_name" content="Flowline">')
    })

    it('should include og:locale ja_JP', () => {
      const html = generateOgpHtml(defaultParams)
      expect(html).toContain('<meta property="og:locale" content="ja_JP">')
    })

    it('should include twitter:card summary_large_image', () => {
      const html = generateOgpHtml(defaultParams)
      expect(html).toContain('<meta name="twitter:card" content="summary_large_image">')
    })

    it('should include twitter:title', () => {
      const html = generateOgpHtml(defaultParams)
      expect(html).toContain('<meta name="twitter:title" content="テストフロー — Flowline">')
    })

    it('should include twitter:description', () => {
      const html = generateOgpHtml(defaultParams)
      expect(html).toContain(
        '<meta name="twitter:description" content="田中太郎さんが作成したフロー図">',
      )
    })

    it('should include twitter:image', () => {
      const html = generateOgpHtml(defaultParams)
      expect(html).toContain(
        '<meta name="twitter:image" content="https://flowline.app/ogp/share/abc123.png">',
      )
    })

    it('should include theme-color meta tag', () => {
      const html = generateOgpHtml(defaultParams)
      expect(html).toContain('<meta name="theme-color" content="#7C5CFC">')
    })

    it('should include redirect script to shared page', () => {
      const html = generateOgpHtml(defaultParams)
      expect(html).toContain("<script>window.location.href = '/shared/abc123';</script>")
    })

    it('should HTML-escape title to prevent XSS', () => {
      const html = generateOgpHtml({
        ...defaultParams,
        title: '<script>alert("xss")</script>',
      })
      expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
      expect(html).not.toContain('<script>alert("xss")</script> — Flowline</title>')
    })

    it('should HTML-escape author to prevent XSS', () => {
      const html = generateOgpHtml({
        ...defaultParams,
        author: '"><img src=x onerror=alert(1)>',
      })
      expect(html).not.toContain('"><img src=x onerror=alert(1)>')
      expect(html).toContain('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;')
    })

    it('should use different share token in URLs', () => {
      const html = generateOgpHtml({
        ...defaultParams,
        shareToken: 'xyz789',
      })
      expect(html).toContain('https://flowline.app/shared/xyz789')
      expect(html).toContain('https://flowline.app/ogp/share/xyz789.png')
      expect(html).toContain("'/shared/xyz789'")
    })

    it('should handle zero counts in description', () => {
      const html = generateOgpHtml({
        ...defaultParams,
        laneCount: 0,
        nodeCount: 0,
      })
      expect(html).toContain('（0レーン、0ノード）')
    })

    it('should be a complete HTML document', () => {
      const html = generateOgpHtml(defaultParams)
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('<html')
      expect(html).toContain('</html>')
      expect(html).toContain('<head>')
      expect(html).toContain('</head>')
      expect(html).toContain('<body>')
      expect(html).toContain('</body>')
    })
  })
})
