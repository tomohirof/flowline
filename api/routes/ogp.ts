import { Hono } from 'hono'
import type { Bindings } from '../app'
import satori from 'satori'
import { initWasm, Resvg } from '@resvg/resvg-wasm'
// @ts-expect-error -- wasm binary import for Cloudflare Workers bundler
import resvgWasm from '../../node_modules/@resvg/resvg-wasm/index_bg.wasm'

let wasmInitPromise: Promise<void> | null = null

function ensureWasmInitialized(): Promise<void> {
  if (!wasmInitPromise) {
    wasmInitPromise = initWasm(resvgWasm).catch((e) => {
      if (e instanceof Error && e.message.includes('Already initialized')) {
        return
      }
      wasmInitPromise = null
      throw e
    })
  }
  return wasmInitPromise
}

/** Cached font data to avoid re-fetching on every request */
let cachedFontData: ArrayBuffer | null = null

async function loadFont(): Promise<ArrayBuffer> {
  if (cachedFontData) return cachedFontData
  const res = await fetch(
    'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-jp@latest/japanese-400-normal.woff',
  )
  if (!res.ok) {
    throw new Error(`Font fetch failed: ${res.status}`)
  }
  cachedFontData = await res.arrayBuffer()
  return cachedFontData
}

interface FlowWithAuthor {
  id: string
  user_id: string
  title: string
  theme_id: string
  share_token: string
  author_name: string
  created_at: string
  updated_at: string
}

function buildOgpElement(title: string, authorName: string, laneCount: number, nodeCount: number) {
  // satori uses React-like element objects: { type, props: { style, children } }
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#0F0B2E',
        color: '#FFFFFF',
        fontFamily: 'Noto Sans JP',
      },
      children: [
        // Top bar
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              padding: '24px 40px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              gap: '12px',
            },
            children: [
              // F logo
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    backgroundColor: '#7C5CFC',
                    borderRadius: '8px',
                    fontSize: '20px',
                    fontWeight: 700,
                  },
                  children: 'F',
                },
              },
              // Flowline text
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '20px',
                    fontWeight: 700,
                    color: '#FFFFFF',
                  },
                  children: 'Flowline',
                },
              },
              // Separator
              {
                type: 'div',
                props: {
                  style: {
                    width: '1px',
                    height: '24px',
                    backgroundColor: 'rgba(255,255,255,0.3)',
                    marginLeft: '8px',
                    marginRight: '8px',
                  },
                  children: [],
                },
              },
              // Author info
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '16px',
                    color: 'rgba(255,255,255,0.7)',
                  },
                  children: [
                    // Author avatar circle
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '28px',
                          height: '28px',
                          backgroundColor: '#7C5CFC',
                          borderRadius: '14px',
                          fontSize: '14px',
                          color: '#FFFFFF',
                        },
                        children: authorName.charAt(0).toUpperCase(),
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: { fontSize: '16px' },
                        children: `by ${authorName}`,
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        // Middle area - main content
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              padding: '0 60px',
              gap: '24px',
            },
            children: [
              // Flow title
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '48px',
                    fontWeight: 700,
                    textAlign: 'center',
                    maxWidth: '1000px',
                    overflow: 'hidden',
                    lineClamp: 2,
                  },
                  children: title,
                },
              },
              // Badges
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    gap: '16px',
                  },
                  children: [
                    // Lane badge
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          padding: '8px 20px',
                          backgroundColor: 'rgba(124,92,252,0.2)',
                          borderRadius: '20px',
                          border: '1px solid rgba(124,92,252,0.4)',
                          fontSize: '18px',
                          color: '#B8A5FF',
                        },
                        children: `${laneCount} レーン`,
                      },
                    },
                    // Node badge
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          padding: '8px 20px',
                          backgroundColor: 'rgba(124,92,252,0.2)',
                          borderRadius: '20px',
                          border: '1px solid rgba(124,92,252,0.4)',
                          fontSize: '18px',
                          color: '#B8A5FF',
                        },
                        children: `${nodeCount} ノード`,
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        // Bottom bar
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '20px 40px',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              fontSize: '16px',
              color: 'rgba(255,255,255,0.5)',
            },
            // Branding text shown in the PNG image (intentionally static, not baseUrl)
            children: 'flowline.app',
          },
        },
      ],
    },
  }
}

const ogp = new Hono<{ Bindings: Bindings }>()

// =============================================
// GET /share/:tokenPng - Generate OGP image
// =============================================
ogp.get('/share/:tokenPng', async (c) => {
  const tokenPng = c.req.param('tokenPng')

  // Strip .png extension to get share token
  const token = tokenPng.replace(/\.png$/, '')
  if (!token) {
    return c.json({ error: 'Invalid token' }, 404)
  }

  try {
    const db = c.env.FLOWLINE_DB

    // Query flow with author name
    const flow = await db
      .prepare(
        'SELECT f.*, u.name as author_name FROM flows f JOIN users u ON f.user_id = u.id WHERE f.share_token = ?',
      )
      .bind(token)
      .first<FlowWithAuthor>()

    if (!flow) {
      return c.json({ error: '共有フローが見つかりません' }, 404)
    }

    const laneCount = await db
      .prepare('SELECT COUNT(*) as count FROM lanes WHERE flow_id = ?')
      .bind(flow.id)
      .first<{ count: number }>('count')

    const nodeCount = await db
      .prepare('SELECT COUNT(*) as count FROM nodes WHERE flow_id = ?')
      .bind(flow.id)
      .first<{ count: number }>('count')

    await ensureWasmInitialized()
    const fontData = await loadFont()

    const element = buildOgpElement(
      flow.title,
      flow.author_name,
      Number(laneCount ?? 0),
      Number(nodeCount ?? 0),
    )

    const svg = await satori(element as unknown as React.ReactNode, {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Noto Sans JP',
          data: fontData,
          weight: 400,
          style: 'normal' as const,
        },
      ],
    })

    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width' as const, value: 1200 },
    })
    const pngData = resvg.render()
    const pngBuffer = pngData.asPng()

    return new Response(pngBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (e) {
    console.error('OGP image generation failed:', e)
    return c.json({ error: 'OGP画像の生成に失敗しました' }, 500)
  }
})

/** Reset internal caches — for testing only */
function _resetOgpCacheForTesting() {
  wasmInitPromise = null
  cachedFontData = null
}

export { ogp, _resetOgpCacheForTesting }
