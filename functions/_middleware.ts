import { isBotUserAgent, generateOgpHtml } from '../api/lib/ogp'

interface Env {
  FLOWLINE_DB: D1Database
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

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const path = url.pathname

  // Only intercept /shared/:token paths
  const match = path.match(/^\/shared\/([^/]+)$/)
  if (!match) return context.next()

  const token = match[1]
  const ua = context.request.headers.get('user-agent') || ''

  // Only intercept bots — normal users get the SPA
  if (!isBotUserAgent(ua)) return context.next()

  try {
    const db = context.env.FLOWLINE_DB

    const flow = await db
      .prepare(
        'SELECT f.id, f.title, f.share_token, u.name as author_name FROM flows f JOIN users u ON f.user_id = u.id WHERE f.share_token = ?',
      )
      .bind(token)
      .first<FlowWithAuthor>()

    if (!flow) return context.next()

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
    })

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    // On error, fall through to SPA
    return context.next()
  }
}
