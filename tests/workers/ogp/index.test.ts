import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDb, createMockD1 } from '../../helpers/mock-d1'

// Mock WASM module import
vi.mock('@resvg/resvg-wasm/index_bg.wasm', () => ({
  default: {},
}))

// Mock satori — returns a fake SVG string
vi.mock('satori', () => ({
  default: vi.fn(async () => '<svg></svg>'),
}))

// Import Worker app after mocks are set up
import app, { _resetCacheForTesting } from '../../../workers/ogp/src/index'

function createEnv(sqliteDb: ReturnType<typeof Database>) {
  return { FLOWLINE_DB: createMockD1(sqliteDb) }
}

function registerUser(
  db: ReturnType<typeof Database>,
  id: string,
  email: string,
  name: string = 'Test User',
) {
  db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)').run(
    id,
    email,
    'hash',
    name,
  )
}

function insertFlowWithShareToken(
  db: ReturnType<typeof Database>,
  id: string,
  userId: string,
  title: string,
  shareToken: string,
) {
  db.prepare(
    'INSERT INTO flows (id, user_id, title, theme_id, share_token) VALUES (?, ?, ?, ?, ?)',
  ).run(id, userId, title, 'cloud', shareToken)
}

function insertLane(
  db: ReturnType<typeof Database>,
  id: string,
  flowId: string,
  name: string,
  colorIndex: number,
  position: number,
) {
  db.prepare(
    'INSERT INTO lanes (id, flow_id, name, color_index, position) VALUES (?, ?, ?, ?, ?)',
  ).run(id, flowId, name, colorIndex, position)
}

function insertNode(
  db: ReturnType<typeof Database>,
  id: string,
  flowId: string,
  laneId: string,
  rowIndex: number,
  label: string,
  note: string | null,
  orderIndex: number,
) {
  db.prepare(
    'INSERT INTO nodes (id, flow_id, lane_id, row_index, label, note, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, flowId, laneId, rowIndex, label, note, orderIndex)
}

function getRequest(path: string, env: object) {
  return app.request(path, {}, env)
}

describe('OGP Worker', () => {
  let db: ReturnType<typeof Database>
  let env: ReturnType<typeof createEnv>

  const USER_ID = 'user-1'
  const USER_EMAIL = 'test@example.com'

  beforeEach(() => {
    db = createTestDb()
    env = createEnv(db)
    registerUser(db, USER_ID, USER_EMAIL, 'Test Author')

    // Mock global fetch for font loading (returns empty ArrayBuffer)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new ArrayBuffer(100), { status: 200 }),
    )
  })

  afterEach(() => {
    db.close()
    vi.restoreAllMocks()
  })

  // ========================================
  // GET /share/:tokenPng
  // ========================================
  describe('GET /share/:tokenPng', () => {
    it('should return 200 with content-type image/png for valid share token', async () => {
      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'My Flow', 'abc123')

      const res = await getRequest('/share/abc123.png', env)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('image/png')
    })

    it('should set cache-control header for valid response', async () => {
      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'My Flow', 'abc123')

      const res = await getRequest('/share/abc123.png', env)
      expect(res.status).toBe(200)
      expect(res.headers.get('cache-control')).toBe('public, max-age=86400')
    })

    it('should return valid PNG data with correct PNG signature bytes', async () => {
      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'My Flow', 'abc123')

      const res = await getRequest('/share/abc123.png', env)
      expect(res.status).toBe(200)

      const arrayBuffer = await res.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      // PNG signature: 137 80 78 71
      expect(bytes[0]).toBe(137)
      expect(bytes[1]).toBe(80)
      expect(bytes[2]).toBe(78)
      expect(bytes[3]).toBe(71)
    })

    it('should return 404 for non-existent share token', async () => {
      const res = await getRequest('/share/nonexistent.png', env)
      expect(res.status).toBe(404)
    })

    it('should handle flow with no lanes and no nodes (0 lanes, 0 nodes)', async () => {
      insertFlowWithShareToken(db, 'flow-empty', USER_ID, 'Empty Flow', 'empty-token')

      const res = await getRequest('/share/empty-token.png', env)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('image/png')
    })

    it('should not require authentication', async () => {
      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'Public Flow', 'public-token')

      // No auth cookie provided — should still succeed
      const res = await app.request('/share/public-token.png', {}, env)
      expect(res.status).toBe(200)
    })

    it('should handle flow with lanes and nodes', async () => {
      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'Detailed Flow', 'detail-token')
      insertLane(db, 'lane-1', 'flow-1', 'Lane A', 0, 0)
      insertLane(db, 'lane-2', 'flow-1', 'Lane B', 1, 1)
      insertNode(db, 'node-1', 'flow-1', 'lane-1', 0, 'Task 1', null, 0)
      insertNode(db, 'node-2', 'flow-1', 'lane-1', 1, 'Task 2', 'Note', 1)
      insertNode(db, 'node-3', 'flow-1', 'lane-2', 0, 'Task 3', null, 0)

      const res = await getRequest('/share/detail-token.png', env)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('image/png')
    })

    it('should handle token without .png extension', async () => {
      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'My Flow', 'abc123')

      // Without .png suffix, the route still matches (Hono :tokenPng captures any string)
      // .replace(/\.png$/, '') on 'abc123' returns 'abc123' — which is a valid token
      const res = await getRequest('/share/abc123', env)
      expect(res.status).toBe(200)
    })

    it('should return 404 for empty token (.png only)', async () => {
      const res = await getRequest('/share/.png', env)
      expect(res.status).toBe(404)
    })

    it('should return 500 with error message when font loading fails', async () => {
      // Reset caches so loadFont actually calls fetch
      _resetCacheForTesting()
      vi.restoreAllMocks()
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))

      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'My Flow', 'font-fail')

      const res = await getRequest('/share/font-fail.png', env)
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body).toHaveProperty('error')
    })

    it('should return 500 with error message when font fetch returns non-OK status', async () => {
      // Reset caches so loadFont actually calls fetch
      _resetCacheForTesting()
      vi.restoreAllMocks()
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Not Found', { status: 404 }),
      )

      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'My Flow', 'font-404')

      const res = await getRequest('/share/font-404.png', env)
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body).toHaveProperty('error')
    })

    it('should use flowline.six1.jp as branding text in generated image', async () => {
      const satori = await import('satori')
      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'My Flow', 'brand-check')

      await getRequest('/share/brand-check.png', env)

      // satori が呼ばれた時の引数を検証
      const satoriMock = vi.mocked(satori.default)
      const lastCall = satoriMock.mock.calls[satoriMock.mock.calls.length - 1]

      // 要素ツリーからブランディングテキスト（文字列childrenを持つ末尾要素）を再帰的に探索
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function findBrandingText(node: Record<string, any>): string | null {
        if (!node?.props) return null
        const { children } = node.props
        if (Array.isArray(children)) {
          // 末尾の子要素から探索（ボトムバーは最後にある）
          for (let i = children.length - 1; i >= 0; i--) {
            const result = findBrandingText(children[i])
            if (result) return result
          }
        }
        // borderTop を持つ div の直接テキスト children がブランディングテキスト
        if (node.props.style?.borderTop && typeof children === 'string') {
          return children
        }
        return null
      }

      const brandingText = findBrandingText(lastCall[0] as Record<string, never>)
      expect(brandingText).toBe('flowline.six1.jp')
    })

    it('should return 500 with error message when SVG generation (satori) fails', async () => {
      const satori = await import('satori')
      vi.mocked(satori.default).mockRejectedValueOnce(new Error('SVG generation failed'))

      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'My Flow', 'satori-fail')

      const res = await getRequest('/share/satori-fail.png', env)
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body).toHaveProperty('error')
    })

    it('should return 500 with error message when Resvg render fails', async () => {
      const resvgModule = await import('@resvg/resvg-wasm')
      vi.spyOn(resvgModule, 'Resvg').mockImplementationOnce(function () {
        return {
          render() {
            throw new Error('PNG render failed')
          },
        } as unknown as InstanceType<typeof resvgModule.Resvg>
      } as unknown as typeof resvgModule.Resvg)

      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'My Flow', 'resvg-fail')

      const res = await getRequest('/share/resvg-fail.png', env)
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body).toHaveProperty('error')
    })
  })

  // ========================================
  // GET /health
  // ========================================
  describe('GET /health', () => {
    it('should return 200 with status ok', async () => {
      const res = await app.request('/health', {}, env)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toEqual({ status: 'ok' })
    })
  })
})
