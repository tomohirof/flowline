import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDb, createMockD1 } from '../helpers/mock-d1'
import { injectOgpMeta } from '../../api/lib/ogp'
import { onRequest } from '../../functions/_middleware'

describe('Shared page middleware logic', () => {
  let db: ReturnType<typeof Database>

  beforeEach(() => {
    db = createTestDb()
    db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)').run(
      'user-1',
      'test@example.com',
      'hash',
      'テスト太郎',
    )
  })

  afterEach(() => {
    db.close()
  })

  // --- Path matching tests ---

  it('should extract token from /shared/:token path', () => {
    const path = '/shared/abc-123-def'
    const match = path.match(/^\/shared\/([^/]+)$/)
    expect(match).not.toBeNull()
    expect(match![1]).toBe('abc-123-def')
  })

  it('should not match /flows path', () => {
    expect('/flows'.match(/^\/shared\/([^/]+)$/)).toBeNull()
  })

  it('should not match /api/shared/token path', () => {
    expect('/api/shared/token'.match(/^\/shared\/([^/]+)$/)).toBeNull()
  })

  it('should not match /shared without token', () => {
    expect('/shared'.match(/^\/shared\/([^/]+)$/)).toBeNull()
  })

  it('should not match /shared/ with trailing slash and no token', () => {
    expect('/shared/'.match(/^\/shared\/([^/]+)$/)).toBeNull()
  })

  it('should not match /shared/token/extra nested path', () => {
    expect('/shared/token/extra'.match(/^\/shared\/([^/]+)$/)).toBeNull()
  })

  it('should match token with special characters like UUID', () => {
    const path = '/shared/550e8400-e29b-41d4-a716-446655440000'
    const match = path.match(/^\/shared\/([^/]+)$/)
    expect(match).not.toBeNull()
    expect(match![1]).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  // --- Middleware now serves OGP to ALL users (no bot check) ---

  it('should serve OGP meta tags to normal browser user agents', () => {
    db.prepare(
      'INSERT INTO flows (id, user_id, title, theme_id, share_token) VALUES (?, ?, ?, ?, ?)',
    ).run('flow-1', 'user-1', 'テストフロー', 'cloud', 'test-token')
    db.prepare(
      'INSERT INTO lanes (id, flow_id, name, color_index, position) VALUES (?, ?, ?, ?, ?)',
    ).run('lane-1', 'flow-1', 'Lane 1', 0, 0)
    db.prepare(
      'INSERT INTO nodes (id, flow_id, lane_id, row_index, label, note, order_index) VALUES (?, ?, ?, ?, ?, NULL, ?)',
    ).run('node-1', 'flow-1', 'lane-1', 0, 'Task 1', 0)

    const flow = db
      .prepare(
        'SELECT f.id, f.title, f.share_token, u.name as author_name FROM flows f JOIN users u ON f.user_id = u.id WHERE f.share_token = ?',
      )
      .get('test-token') as { id: string; title: string; share_token: string; author_name: string }

    const laneCount = (
      db.prepare('SELECT COUNT(*) as count FROM lanes WHERE flow_id = ?').get(flow.id) as {
        count: number
      }
    ).count
    const nodeCount = (
      db.prepare('SELECT COUNT(*) as count FROM nodes WHERE flow_id = ?').get(flow.id) as {
        count: number
      }
    ).count

    const indexHtml = `<!doctype html>
<html lang="ja">
<head>
<title>Flowline — フローを描く。チームが動く。</title>
<meta property="og:type" content="website" />
<meta property="og:url" content="https://flowline.six1.jp" />
<meta property="og:title" content="Flowline — フローを描く。チームが動く。" />
<meta property="og:description" content="業務プロセスを視覚化するスイムレーンエディタ。" />
<meta property="og:image" content="https://flowline.six1.jp/ogp/default.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Flowline — フローを描く。チームが動く。" />
<meta name="twitter:description" content="業務プロセスを視覚化するスイムレーンエディタ" />
<meta name="twitter:image" content="https://flowline.six1.jp/ogp/default.png" />
</head>
<body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>`

    const html = injectOgpMeta(indexHtml, {
      title: flow.title,
      author: flow.author_name,
      laneCount,
      nodeCount,
      shareToken: flow.share_token,
      baseUrl: 'https://flowline.six1.jp',
    })

    // OGP meta tags should be injected
    expect(html).toContain('テストフロー — Flowline')
    expect(html).toContain('テスト太郎さんが作成したフロー図（1レーン、1ノード）')
    expect(html).toContain('/api/ogp/share/test-token.png')
    expect(html).toContain('og:type" content="article"')
    expect(html).toContain('twitter:card')
    // SPA should still be present (no redirect)
    expect(html).toContain('<div id="root"></div>')
    expect(html).toContain('src="/src/main.tsx"')
    expect(html).not.toContain('window.location.href')
  })

  // --- Database query + OGP injection (simulating middleware logic) ---

  it('should inject correct OGP meta for flow with DB data', () => {
    db.prepare(
      'INSERT INTO flows (id, user_id, title, theme_id, share_token) VALUES (?, ?, ?, ?, ?)',
    ).run('flow-1', 'user-1', '受注管理フロー', 'cloud', 'test-token')
    db.prepare(
      'INSERT INTO lanes (id, flow_id, name, color_index, position) VALUES (?, ?, ?, ?, ?)',
    ).run('lane-1', 'flow-1', 'Lane 1', 0, 0)
    db.prepare(
      'INSERT INTO lanes (id, flow_id, name, color_index, position) VALUES (?, ?, ?, ?, ?)',
    ).run('lane-2', 'flow-1', 'Lane 2', 1, 1)
    db.prepare(
      'INSERT INTO nodes (id, flow_id, lane_id, row_index, label, note, order_index) VALUES (?, ?, ?, ?, ?, NULL, ?)',
    ).run('node-1', 'flow-1', 'lane-1', 0, 'Task 1', 0)
    db.prepare(
      'INSERT INTO nodes (id, flow_id, lane_id, row_index, label, note, order_index) VALUES (?, ?, ?, ?, ?, NULL, ?)',
    ).run('node-2', 'flow-1', 'lane-1', 1, 'Task 2', 1)
    db.prepare(
      'INSERT INTO nodes (id, flow_id, lane_id, row_index, label, note, order_index) VALUES (?, ?, ?, ?, ?, NULL, ?)',
    ).run('node-3', 'flow-1', 'lane-2', 0, 'Task 3', 0)

    const flow = db
      .prepare(
        'SELECT f.id, f.title, f.share_token, u.name as author_name FROM flows f JOIN users u ON f.user_id = u.id WHERE f.share_token = ?',
      )
      .get('test-token') as { id: string; title: string; share_token: string; author_name: string }

    const laneCount = (
      db.prepare('SELECT COUNT(*) as count FROM lanes WHERE flow_id = ?').get(flow.id) as {
        count: number
      }
    ).count
    const nodeCount = (
      db.prepare('SELECT COUNT(*) as count FROM nodes WHERE flow_id = ?').get(flow.id) as {
        count: number
      }
    ).count

    const indexHtml =
      '<title>Flowline</title><meta property="og:title" content="Flowline" /><meta property="og:description" content="default" /><meta property="og:image" content="default.png" /><meta property="og:url" content="https://flowline.six1.jp" /><meta property="og:type" content="website" /><meta name="twitter:title" content="Flowline" /><meta name="twitter:description" content="default" /><meta name="twitter:image" content="default.png" /><meta name="description" content="default" />'

    const html = injectOgpMeta(indexHtml, {
      title: flow.title,
      author: flow.author_name,
      laneCount,
      nodeCount,
      shareToken: flow.share_token,
      baseUrl: 'https://flowline.six1.jp',
    })

    expect(html).toContain('受注管理フロー — Flowline')
    expect(html).toContain('テスト太郎さんが作成したフロー図（2レーン、3ノード）')
    expect(html).toContain('/api/ogp/share/test-token.png')
    expect(html).toContain('og:type" content="article"')
  })

  it('should return undefined for non-existent share token', () => {
    const flow = db
      .prepare(
        'SELECT f.id, f.title, f.share_token, u.name as author_name FROM flows f JOIN users u ON f.user_id = u.id WHERE f.share_token = ?',
      )
      .get('nonexistent-token')
    expect(flow).toBeUndefined()
  })

  // --- Edge cases for DB data ---

  it('should handle flow with 0 lanes and 0 nodes', () => {
    db.prepare(
      'INSERT INTO flows (id, user_id, title, theme_id, share_token) VALUES (?, ?, ?, ?, ?)',
    ).run('flow-empty', 'user-1', '空のフロー', 'cloud', 'empty-token')

    const flow = db
      .prepare(
        'SELECT f.id, f.title, f.share_token, u.name as author_name FROM flows f JOIN users u ON f.user_id = u.id WHERE f.share_token = ?',
      )
      .get('empty-token') as { id: string; title: string; share_token: string; author_name: string }

    const laneCount = (
      db.prepare('SELECT COUNT(*) as count FROM lanes WHERE flow_id = ?').get(flow.id) as {
        count: number
      }
    ).count
    const nodeCount = (
      db.prepare('SELECT COUNT(*) as count FROM nodes WHERE flow_id = ?').get(flow.id) as {
        count: number
      }
    ).count

    expect(laneCount).toBe(0)
    expect(nodeCount).toBe(0)

    const indexHtml =
      '<title>Flowline</title><meta property="og:title" content="Flowline" /><meta property="og:description" content="default" /><meta property="og:image" content="default.png" /><meta property="og:url" content="https://flowline.six1.jp" /><meta property="og:type" content="website" /><meta name="twitter:title" content="Flowline" /><meta name="twitter:description" content="default" /><meta name="twitter:image" content="default.png" /><meta name="description" content="default" />'

    const html = injectOgpMeta(indexHtml, {
      title: flow.title,
      author: flow.author_name,
      laneCount,
      nodeCount,
      shareToken: flow.share_token,
      baseUrl: 'https://flowline.six1.jp',
    })

    expect(html).toContain('空のフロー — Flowline')
    expect(html).toContain('テスト太郎さんが作成したフロー図（0レーン、0ノード）')
  })

  it('should handle flow with 1 lane and 1 node', () => {
    db.prepare(
      'INSERT INTO flows (id, user_id, title, theme_id, share_token) VALUES (?, ?, ?, ?, ?)',
    ).run('flow-min', 'user-1', 'ミニフロー', 'cloud', 'min-token')
    db.prepare(
      'INSERT INTO lanes (id, flow_id, name, color_index, position) VALUES (?, ?, ?, ?, ?)',
    ).run('lane-min', 'flow-min', 'Single Lane', 0, 0)
    db.prepare(
      'INSERT INTO nodes (id, flow_id, lane_id, row_index, label, note, order_index) VALUES (?, ?, ?, ?, ?, NULL, ?)',
    ).run('node-min', 'flow-min', 'lane-min', 0, 'Single Task', 0)

    const flow = db
      .prepare(
        'SELECT f.id, f.title, f.share_token, u.name as author_name FROM flows f JOIN users u ON f.user_id = u.id WHERE f.share_token = ?',
      )
      .get('min-token') as { id: string; title: string; share_token: string; author_name: string }

    const laneCount = (
      db.prepare('SELECT COUNT(*) as count FROM lanes WHERE flow_id = ?').get(flow.id) as {
        count: number
      }
    ).count
    const nodeCount = (
      db.prepare('SELECT COUNT(*) as count FROM nodes WHERE flow_id = ?').get(flow.id) as {
        count: number
      }
    ).count

    expect(laneCount).toBe(1)
    expect(nodeCount).toBe(1)

    const indexHtml =
      '<title>Flowline</title><meta property="og:title" content="Flowline" /><meta property="og:description" content="default" /><meta property="og:image" content="default.png" /><meta property="og:url" content="https://flowline.six1.jp" /><meta property="og:type" content="website" /><meta name="twitter:title" content="Flowline" /><meta name="twitter:description" content="default" /><meta name="twitter:image" content="default.png" /><meta name="description" content="default" />'

    const html = injectOgpMeta(indexHtml, {
      title: flow.title,
      author: flow.author_name,
      laneCount,
      nodeCount,
      shareToken: flow.share_token,
      baseUrl: 'https://flowline.six1.jp',
    })

    expect(html).toContain('ミニフロー — Flowline')
    expect(html).toContain('テスト太郎さんが作成したフロー図（1レーン、1ノード）')
  })

  it('should escape HTML special characters in title and author', () => {
    db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)').run(
      'user-xss',
      'xss@example.com',
      'hash',
      '<script>alert("xss")</script>',
    )
    db.prepare(
      'INSERT INTO flows (id, user_id, title, theme_id, share_token) VALUES (?, ?, ?, ?, ?)',
    ).run('flow-xss', 'user-xss', '<img src=x onerror=alert(1)>', 'cloud', 'xss-token')

    const flow = db
      .prepare(
        'SELECT f.id, f.title, f.share_token, u.name as author_name FROM flows f JOIN users u ON f.user_id = u.id WHERE f.share_token = ?',
      )
      .get('xss-token') as { id: string; title: string; share_token: string; author_name: string }

    const indexHtml =
      '<title>Flowline</title><meta property="og:title" content="Flowline" /><meta property="og:description" content="default" /><meta property="og:image" content="default.png" /><meta property="og:url" content="https://flowline.six1.jp" /><meta property="og:type" content="website" /><meta name="twitter:title" content="Flowline" /><meta name="twitter:description" content="default" /><meta name="twitter:image" content="default.png" /><meta name="description" content="default" />'

    const html = injectOgpMeta(indexHtml, {
      title: flow.title,
      author: flow.author_name,
      laneCount: 0,
      nodeCount: 0,
      shareToken: flow.share_token,
      baseUrl: 'https://flowline.six1.jp',
    })

    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).toContain(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;さんが作成したフロー図',
    )
  })

  // --- onRequest end-to-end: response headers and HTML for shared pages (issue #342) ---

  function buildContext(
    request: Request,
    sqliteDb: ReturnType<typeof Database>,
    indexHtml: string,
  ) {
    const assets = {
      fetch: async () =>
        new Response(indexHtml, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
    }
    return {
      request,
      env: { FLOWLINE_DB: createMockD1(sqliteDb), ASSETS: assets },
      next: async () =>
        new Response('next-fallthrough', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        }),
      // Pages function fields below are unused by our middleware; cast handles types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  }

  const MINI_INDEX = `<!doctype html>
<html lang="ja">
<head>
<title>Flowline — フローを描く。チームが動く。</title>
<meta name="description" content="default" />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://flowline.six1.jp" />
<meta property="og:title" content="Flowline" />
<meta property="og:description" content="default" />
<meta property="og:image" content="https://flowline.six1.jp/ogp/default.png" />
<meta name="twitter:title" content="Flowline" />
<meta name="twitter:description" content="default" />
<meta name="twitter:image" content="https://flowline.six1.jp/ogp/default.png" />
</head>
<body><div id="root"></div></body>
</html>`

  it('should set X-Robots-Tag noindex header on /shared/:token response (issue #342)', async () => {
    db.prepare(
      'INSERT INTO flows (id, user_id, title, theme_id, share_token) VALUES (?, ?, ?, ?, ?)',
    ).run('flow-noindex', 'user-1', 'noindexテスト', 'cloud', 'noindex-token')

    const ctx = buildContext(
      new Request('https://flowline.six1.jp/shared/noindex-token'),
      db,
      MINI_INDEX,
    )
    const res = await onRequest(ctx)

    expect(res.status).toBe(200)
    const robotsTag = res.headers.get('x-robots-tag')
    expect(robotsTag).toBeTruthy()
    expect(robotsTag).toMatch(/noindex/i)
    expect(robotsTag).toMatch(/nofollow/i)
  })

  it('should include robots noindex meta tag in /shared/:token HTML body (issue #342)', async () => {
    db.prepare(
      'INSERT INTO flows (id, user_id, title, theme_id, share_token) VALUES (?, ?, ?, ?, ?)',
    ).run('flow-noindex-html', 'user-1', 'noindex本文', 'cloud', 'noindex-html-token')

    const ctx = buildContext(
      new Request('https://flowline.six1.jp/shared/noindex-html-token'),
      db,
      MINI_INDEX,
    )
    const res = await onRequest(ctx)
    const body = await res.text()

    expect(body).toMatch(/<meta\s+name="robots"\s+content="noindex,\s*nofollow"/i)
  })

  it('should NOT add X-Robots-Tag header on non-shared paths (passes through)', async () => {
    const ctx = buildContext(new Request('https://flowline.six1.jp/'), db, MINI_INDEX)
    const res = await onRequest(ctx)
    // Non-shared paths fall through to context.next() and should not be tagged by this middleware
    expect(res.headers.get('x-robots-tag')).toBeNull()
  })
})
