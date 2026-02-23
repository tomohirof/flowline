/**
 * OGP (Open Graph Protocol) utility functions for Flowline shared flow pages.
 *
 * Provides HTML escaping and OGP meta tag injection into index.html.
 */

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

/** Parameters for injecting OGP meta tags */
export interface OgpParams {
  title: string
  author: string
  laneCount: number
  nodeCount: number
  shareToken: string
  baseUrl: string
}

/**
 * Inject dynamic OGP meta tags into index.html for shared flow pages.
 * Replaces static OGP meta tags with flow-specific values.
 * All user-supplied strings (title, author) are HTML-escaped.
 */
export function injectOgpMeta(indexHtml: string, params: OgpParams): string {
  const { laneCount, nodeCount, shareToken } = params
  const title = escapeHtml(params.title)
  const author = escapeHtml(params.author)

  const ogTitle = `${title} — Flowline`
  const ogDescription = `${author}さんが作成したフロー図（${laneCount}レーン、${nodeCount}ノード）`
  const twitterDescription = `${author}さんが作成したフロー図`
  const safeToken = encodeURIComponent(shareToken)
  const base = params.baseUrl.replace(/\/+$/, '')
  const ogUrl = `${base}/shared/${safeToken}`
  const ogImage = `${base}/api/ogp/share/${safeToken}.png`

  let html = indexHtml

  // Replace <title> tag
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${ogTitle}</title>`)

  // Replace meta description
  html = html.replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${ogDescription}$2`)

  // Replace og:type from website to article
  html = html.replace(/(<meta\s+property="og:type"\s+content=")[^"]*(")/, '$1article$2')

  // Replace og:url
  html = html.replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/, `$1${ogUrl}$2`)

  // Replace og:title
  html = html.replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/, `$1${ogTitle}$2`)

  // Replace og:description
  html = html.replace(
    /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
    `$1${ogDescription}$2`,
  )

  // Replace og:image (but not og:image:width or og:image:height)
  html = html.replace(/(<meta\s+property="og:image"\s+content=")[^"]*(")/, `$1${ogImage}$2`)

  // Replace twitter:title
  html = html.replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/, `$1${ogTitle}$2`)

  // Replace twitter:description
  html = html.replace(
    /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,
    `$1${twitterDescription}$2`,
  )

  // Replace twitter:image
  html = html.replace(/(<meta\s+name="twitter:image"\s+content=")[^"]*(")/, `$1${ogImage}$2`)

  return html
}
