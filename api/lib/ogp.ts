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

  // Use arrow functions in replace() to avoid $-metacharacter expansion in user input
  html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${ogTitle}</title>`)
  html = html.replace(
    /(<meta\s+name="description"\s+content=")[^"]*(")/,
    (_, p1, p2) => `${p1}${ogDescription}${p2}`,
  )
  html = html.replace(
    /(<meta\s+property="og:type"\s+content=")[^"]*(")/,
    (_, p1, p2) => `${p1}article${p2}`,
  )
  html = html.replace(
    /(<meta\s+property="og:url"\s+content=")[^"]*(")/,
    (_, p1, p2) => `${p1}${ogUrl}${p2}`,
  )
  html = html.replace(
    /(<meta\s+property="og:title"\s+content=")[^"]*(")/,
    (_, p1, p2) => `${p1}${ogTitle}${p2}`,
  )
  html = html.replace(
    /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
    (_, p1, p2) => `${p1}${ogDescription}${p2}`,
  )
  html = html.replace(
    /(<meta\s+property="og:image"\s+content=")[^"]*(")/,
    (_, p1, p2) => `${p1}${ogImage}${p2}`,
  )
  html = html.replace(
    /(<meta\s+name="twitter:title"\s+content=")[^"]*(")/,
    (_, p1, p2) => `${p1}${ogTitle}${p2}`,
  )
  html = html.replace(
    /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,
    (_, p1, p2) => `${p1}${twitterDescription}${p2}`,
  )
  html = html.replace(
    /(<meta\s+name="twitter:image"\s+content=")[^"]*(")/,
    (_, p1, p2) => `${p1}${ogImage}${p2}`,
  )

  // Exclude shared pages from search engines. Inserted just before </head>
  // so it survives re-injection (idempotent: replace if already present).
  const robotsMeta = '<meta name="robots" content="noindex, nofollow" />'
  if (/<meta\s+name="robots"[^>]*>/i.test(html)) {
    html = html.replace(/<meta\s+name="robots"[^>]*>/i, robotsMeta)
  } else {
    html = html.replace(/<\/head>/i, `  ${robotsMeta}\n  </head>`)
  }

  return html
}
