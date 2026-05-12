import { injectOgpMeta } from '../api/lib/ogp'

interface Env {
  FLOWLINE_DB: D1Database
  ASSETS: Fetcher
}

interface FlowWithAuthor {
  id: string
  title: string
  share_token: string
  author_name: string
}

interface CountResult {
  count: number
}

async function fetchIndexHtml(context: EventContext<Env, string, unknown>): Promise<Response> {
  const url = new URL(context.request.url)
  url.pathname = '/'
  return context.env.ASSETS.fetch(new Request(url.toString(), context.request))
}

function withNoindex(res: Response): Response {
  const headers = new Headers(res.headers)
  headers.set('X-Robots-Tag', 'noindex, nofollow')
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const path = url.pathname

  // Only intercept /shared/:token paths
  const match = path.match(/^\/shared\/([^/]+)$/)
  if (!match) return context.next()

  const token = match[1]

  try {
    const db = context.env.FLOWLINE_DB

    const flow = await db
      .prepare(
        'SELECT f.id, f.title, f.share_token, u.name as author_name FROM flows f JOIN users u ON f.user_id = u.id WHERE f.share_token = ?',
      )
      .bind(token)
      .first<FlowWithAuthor>()

    if (!flow) return withNoindex(await fetchIndexHtml(context))

    const [lanesResult, nodesResult] = await db.batch([
      db.prepare('SELECT COUNT(*) as count FROM lanes WHERE flow_id = ?').bind(flow.id),
      db.prepare('SELECT COUNT(*) as count FROM nodes WHERE flow_id = ?').bind(flow.id),
    ])

    const laneCount = (lanesResult as { results: CountResult[] }).results?.[0]?.count ?? 0
    const nodeCount = (nodesResult as { results: CountResult[] }).results?.[0]?.count ?? 0

    // Fetch the SPA index.html and inject dynamic OGP meta tags
    const indexResponse = await fetchIndexHtml(context)
    const indexHtml = await indexResponse.text()

    const html = injectOgpMeta(indexHtml, {
      title: flow.title,
      author: flow.author_name,
      laneCount,
      nodeCount,
      shareToken: flow.share_token,
      baseUrl: url.origin,
    })

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    })
  } catch {
    // On error, fall through to SPA but still mark as noindex (shared path).
    return withNoindex(await fetchIndexHtml(context))
  }
}
