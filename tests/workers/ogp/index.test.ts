import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDb, createMockD1 } from '../../helpers/mock-d1'

// Mock WASM module imports (resvg + yoga)
vi.mock('@resvg/resvg-wasm/index_bg.wasm', () => ({
  default: {},
}))
vi.mock('../../../workers/ogp/src/yoga.wasm', () => ({
  default: {},
}))

// Mock pre-rendered preview PNG
vi.mock('../../../workers/ogp/src/preview-base64', () => ({
  PREVIEW_PNG_DATA_URI: 'data:image/png;base64,TESTPREVIEWDATA',
}))

// Mock satori/standalone — returns a fake SVG string and no-op init
vi.mock('satori/standalone', () => ({
  default: vi.fn(async () => '<svg></svg>'),
  init: vi.fn(async () => {}),
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
    // Shared helper: recursively search element tree for text
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function findText(node: Record<string, any>, target: string): boolean {
      if (!node?.props) return false
      const { children } = node.props
      if (typeof children === 'string' && children.includes(target)) return true
      if (children === target) return true
      if (Array.isArray(children)) {
        return children.some((child: Record<string, never>) => findText(child, target))
      }
      return false
    }

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

    it('should include catchcopy text in generated image', async () => {
      const satori = await import('satori/standalone')
      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'My Flow', 'brand-check')

      await getRequest('/share/brand-check.png', env)

      const satoriMock = vi.mocked(satori.default)
      const lastCall = satoriMock.mock.calls[satoriMock.mock.calls.length - 1]

      // 要素ツリーから「フローを描く。チームが動く。」テキストを再帰探索
      expect(findText(lastCall[0] as Record<string, never>, 'フローを描く。チームが動く。')).toBe(
        true,
      )
    })

    it('should include author initial in avatar', async () => {
      const satori = await import('satori/standalone')
      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'My Flow', 'initial-check')

      await getRequest('/share/initial-check.png', env)

      const satoriMock = vi.mocked(satori.default)
      const lastCall = satoriMock.mock.calls[satoriMock.mock.calls.length - 1]

      // 要素ツリーから author initial 'T' (Test Author の頭文字) を探す
      expect(findText(lastCall[0] as Record<string, never>, 'T')).toBe(true)
    })

    it('should include sharing badge in top bar', async () => {
      const satori = await import('satori/standalone')
      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'My Flow', 'badge-check')

      await getRequest('/share/badge-check.png', env)

      const satoriMock = vi.mocked(satori.default)
      const lastCall = satoriMock.mock.calls[satoriMock.mock.calls.length - 1]

      expect(findText(lastCall[0] as Record<string, never>, '共有中')).toBe(true)
    })

    it('should include flowline.app in preview window chrome', async () => {
      const satori = await import('satori/standalone')
      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'My Flow', 'chrome-check')

      await getRequest('/share/chrome-check.png', env)

      const satoriMock = vi.mocked(satori.default)
      const lastCall = satoriMock.mock.calls[satoriMock.mock.calls.length - 1]

      expect(findText(lastCall[0] as Record<string, never>, 'flowline.app')).toBe(true)
    })

    it('should include pre-rendered preview as img element', async () => {
      const satori = await import('satori/standalone')
      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'My Flow', 'preview-check')

      await getRequest('/share/preview-check.png', env)

      const satoriMock = vi.mocked(satori.default)
      const lastCall = satoriMock.mock.calls[satoriMock.mock.calls.length - 1]

      // 要素ツリーからimg要素のsrcにbase64プレビューデータが含まれることを確認
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function findImgSrc(node: Record<string, any>, srcSubstring: string): boolean {
        if (!node?.props) return false
        if (
          node.type === 'img' &&
          typeof node.props.src === 'string' &&
          node.props.src.includes(srcSubstring)
        )
          return true
        const { children } = node.props
        if (Array.isArray(children)) {
          return children.some((child: Record<string, never>) => findImgSrc(child, srcSubstring))
        }
        return false
      }

      expect(findImgSrc(lastCall[0] as Record<string, never>, 'data:image/png;base64,')).toBe(true)
    })

    it('should have title overlay positioned absolutely with z-index for swimlane overlap', async () => {
      const satori = await import('satori/standalone')
      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'My Flow', 'layout-check')

      await getRequest('/share/layout-check.png', env)

      const satoriMock = vi.mocked(satori.default)
      const lastCall = satoriMock.mock.calls[satoriMock.mock.calls.length - 1]

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function findAbsoluteTitle(node: Record<string, any>): boolean {
        if (!node?.props) return false
        const { style, children } = node.props
        // Title overlay should be absolutely positioned with z-index >= 10
        if (
          style?.position === 'absolute' &&
          style?.zIndex >= 10 &&
          typeof children !== 'undefined'
        ) {
          // Check if this node or its descendants contain the title text
          if (typeof children === 'string' && children === 'My Flow') return true
          if (Array.isArray(children)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const hasTitle = children.some((c: any) => findText(c, 'My Flow'))
            if (hasTitle) return true
          }
        }
        if (Array.isArray(children)) {
          return children.some((child: Record<string, never>) => findAbsoluteTitle(child))
        }
        return false
      }

      expect(findAbsoluteTitle(lastCall[0] as Record<string, never>)).toBe(true)
    })

    it('should position title overlay at top 128px to overlap swimlane preview', async () => {
      const satori = await import('satori/standalone')
      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'My Flow', 'position-check')

      await getRequest('/share/position-check.png', env)

      const satoriMock = vi.mocked(satori.default)
      const lastCall = satoriMock.mock.calls[satoriMock.mock.calls.length - 1]

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function findTitleOverlayTop(node: Record<string, any>): string | number | null {
        if (!node?.props) return null
        const { style, children } = node.props
        if (style?.position === 'absolute' && style?.zIndex >= 10) {
          if (findText(node, 'My Flow')) return style.top
        }
        if (Array.isArray(children)) {
          for (const child of children) {
            const result = findTitleOverlayTop(child as Record<string, never>)
            if (result !== null) return result
          }
        }
        return null
      }

      const top = findTitleOverlayTop(lastCall[0] as Record<string, never>)
      // Title overlay should be at top: 128 (body-relative) to overlap the swimlane preview
      expect(top).toBe(128)
    })

    it('should use maxWidth on title overlay instead of fixed width', async () => {
      const satori = await import('satori/standalone')
      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'My Flow', 'maxwidth-check')

      await getRequest('/share/maxwidth-check.png', env)

      const satoriMock = vi.mocked(satori.default)
      const lastCall = satoriMock.mock.calls[satoriMock.mock.calls.length - 1]

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function findTitleOverlayStyle(node: Record<string, any>): Record<string, any> | null {
        if (!node?.props) return null
        const { style, children } = node.props
        if (style?.position === 'absolute' && style?.zIndex >= 10) {
          if (findText(node, 'My Flow')) return style
        }
        if (Array.isArray(children)) {
          for (const child of children) {
            const result = findTitleOverlayStyle(child as Record<string, never>)
            if (result !== null) return result
          }
        }
        return null
      }

      const style = findTitleOverlayStyle(lastCall[0] as Record<string, never>)
      expect(style).not.toBeNull()
      expect(style!.maxWidth).toBeDefined()
      expect(style!.width).toBeUndefined()
    })

    it('should not have bottom gradient fade in preview card', async () => {
      const satori = await import('satori/standalone')
      insertFlowWithShareToken(db, 'flow-1', USER_ID, 'My Flow', 'no-fade-check')

      await getRequest('/share/no-fade-check.png', env)

      const satoriMock = vi.mocked(satori.default)
      const lastCall = satoriMock.mock.calls[satoriMock.mock.calls.length - 1]

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function hasGradientFade(node: Record<string, any>): boolean {
        if (!node?.props) return false
        const { style, children } = node.props
        if (
          style?.background &&
          typeof style.background === 'string' &&
          style.background.includes('linear-gradient') &&
          style.background.includes('#FFFFFF')
        )
          return true
        if (Array.isArray(children)) {
          return children.some((child: Record<string, never>) => hasGradientFade(child))
        }
        return false
      }

      expect(hasGradientFade(lastCall[0] as Record<string, never>)).toBe(false)
    })

    it('should return 500 with error message when SVG generation (satori) fails', async () => {
      const satori = await import('satori/standalone')
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
