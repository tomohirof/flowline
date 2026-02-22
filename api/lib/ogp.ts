/**
 * OGP (Open Graph Protocol) utility functions for Flowline shared flow pages.
 *
 * Provides bot user-agent detection, HTML escaping, and OGP HTML generation.
 */

/** Bot user-agent substrings (all lowercase) used for crawler detection */
export const BOT_USER_AGENTS: readonly string[] = [
  'twitterbot',
  'facebookexternalhit',
  'linkedinbot',
  'discordbot',
  'slackbot',
  'googlebot',
  'line/',
]

/**
 * Check if a user-agent string belongs to a known bot/crawler.
 * Performs case-insensitive matching against known bot UA substrings.
 */
export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false
  const lower = ua.toLowerCase()
  return BOT_USER_AGENTS.some((bot) => lower.includes(bot))
}

/**
 * Escape HTML special characters to prevent XSS attacks.
 * Escapes: & < > " '
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Parameters for generating an OGP HTML page */
export interface OgpParams {
  title: string
  author: string
  laneCount: number
  nodeCount: number
  shareToken: string
}

/**
 * Generate a complete HTML page with OGP meta tags for shared flow pages.
 * All user-supplied strings (title, author) are HTML-escaped.
 * Includes a redirect script to forward browsers to the actual shared page.
 */
export function generateOgpHtml(params: OgpParams): string {
  const { laneCount, nodeCount, shareToken } = params
  const title = escapeHtml(params.title)
  const author = escapeHtml(params.author)

  const ogTitle = `${title} — Flowline`
  const ogDescription = `${author}さんが作成したフロー図（${laneCount}レーン、${nodeCount}ノード）`
  const twitterDescription = `${author}さんが作成したフロー図`
  const ogUrl = `https://flowline.app/shared/${shareToken}`
  const ogImage = `https://flowline.app/ogp/share/${shareToken}.png`

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>${ogTitle}</title>
<meta property="og:type" content="article">
<meta property="og:url" content="${ogUrl}">
<meta property="og:title" content="${ogTitle}">
<meta property="og:description" content="${ogDescription}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name" content="Flowline">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${ogTitle}">
<meta name="twitter:description" content="${twitterDescription}">
<meta name="twitter:image" content="${ogImage}">
<meta name="theme-color" content="#7C5CFC">
</head>
<body>
<p>リダイレクト中...</p>
<script>window.location.href = '/shared/${shareToken}';</script>
</body>
</html>`
}
