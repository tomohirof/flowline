import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDb } from '../helpers/mock-d1'
import { isBotUserAgent, generateOgpHtml } from '../../api/lib/ogp'

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

  // --- Bot detection (verify middleware integrates correctly with isBotUserAgent) ---

  it('should correctly determine bot vs normal user', () => {
    expect(isBotUserAgent('Twitterbot/1.0')).toBe(true)
    expect(isBotUserAgent('facebookexternalhit/1.1')).toBe(true)
    expect(isBotUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(false)
  })

  it('should treat empty user-agent as non-bot', () => {
    expect(isBotUserAgent('')).toBe(false)
  })

  it('should treat null user-agent as non-bot', () => {
    expect(isBotUserAgent(null)).toBe(false)
  })

  it('should treat undefined user-agent as non-bot', () => {
    expect(isBotUserAgent(undefined)).toBe(false)
  })

  // --- Database query + OGP HTML generation (simulating middleware logic) ---

  it('should generate correct OGP HTML for bot with DB data', () => {
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

    // Simulate middleware logic: query flow with author
    const flow = db
      .prepare(
        'SELECT f.id, f.title, f.share_token, u.name as author_name FROM flows f JOIN users u ON f.user_id = u.id WHERE f.share_token = ?',
      )
      .get('test-token') as { id: string; title: string; share_token: string; author_name: string }

    // Simulate middleware logic: count lanes and nodes
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

    const html = generateOgpHtml({
      title: flow.title,
      author: flow.author_name,
      laneCount,
      nodeCount,
      shareToken: flow.share_token,
    })

    expect(html).toContain('受注管理フロー — Flowline')
    expect(html).toContain('テスト太郎さんが作成したフロー図（2レーン、3ノード）')
    expect(html).toContain('/api/ogp/share/test-token.png')
    expect(html).toContain('og:type')
    expect(html).toContain('twitter:card')
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

    const html = generateOgpHtml({
      title: flow.title,
      author: flow.author_name,
      laneCount,
      nodeCount,
      shareToken: flow.share_token,
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

    const html = generateOgpHtml({
      title: flow.title,
      author: flow.author_name,
      laneCount,
      nodeCount,
      shareToken: flow.share_token,
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

    const html = generateOgpHtml({
      title: flow.title,
      author: flow.author_name,
      laneCount: 0,
      nodeCount: 0,
      shareToken: flow.share_token,
    })

    // User-supplied content should be escaped (not raw HTML injection)
    // Note: the page has a legitimate <script> for redirect, so we check
    // that user input is escaped in the meta tag content
    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    // The og:description meta tag should use the escaped author name
    expect(html).toContain(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;さんが作成したフロー図',
    )
  })
})
