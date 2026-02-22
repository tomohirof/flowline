import { isBotUserAgent, generateOgpHtml } from '../api/lib/ogp'

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

async function serveIndexHtml(context: EventContext<Env, string, unknown>): Promise<Response> {
  // Serve the SPA index.html for non-bot users accessing /shared/* routes
  const url = new URL(context.request.url)
  url.pathname = '/'
  return context.env.ASSETS.fetch(new Request(url.toString(), context.request))
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const path = url.pathname

  // Only intercept /shared/:token paths
  const match = path.match(/^\/shared\/([^/]+)$/)
  if (!match) return context.next()

  const token = match[1]
  const ua = context.request.headers.get('user-agent') || ''

  // Normal users get the SPA (index.html)
  if (!isBotUserAgent(ua)) return serveIndexHtml(context)

  try {
    const db = context.env.FLOWLINE_DB

    const flow = await db
      .prepare(
        'SELECT f.id, f.title, f.share_token, u.name as author_name FROM flows f JOIN users u ON f.user_id = u.id WHERE f.share_token = ?',
      )
      .bind(token)
      .first<FlowWithAuthor>()

    if (!flow) return serveIndexHtml(context)

    const [lanesResult, nodesResult] = await db.batch([
      db.prepare('SELECT COUNT(*) as count FROM lanes WHERE flow_id = ?').bind(flow.id),
      db.prepare('SELECT COUNT(*) as count FROM nodes WHERE flow_id = ?').bind(flow.id),
    ])

    const laneCount = (lanesResult as { results: CountResult[] }).results?.[0]?.count ?? 0
    const nodeCount = (nodesResult as { results: CountResult[] }).results?.[0]?.count ?? 0

    const html = generateOgpHtml({
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
      },
    })
  } catch {
    // On error, fall through to SPA
    return serveIndexHtml(context)
  }
}
