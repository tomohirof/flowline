import { Hono } from 'hono'
import satori, { init as initSatori } from 'satori/standalone'
import { Resvg, initWasm as initResvg } from '@resvg/resvg-wasm'
// Static WASM imports — wrangler bundles these as pre-compiled WebAssembly.Module
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm'
// Extracted from yoga-layout v3.2.1 (see scripts/extract-yoga-wasm.mjs)
import yogaWasm from './yoga.wasm'

// Workaround: yoga-layout (Emscripten) calls WebAssembly.instantiate() internally,
// which Cloudflare Workers blocks for dynamic compilation.
// This module-level patch intercepts calls with pre-compiled WebAssembly.Module
// and uses the synchronous WebAssembly.Instance constructor instead.
// Note: Returns {instance, module} format expected by Emscripten, not bare Instance.
const _origWasmInstantiate = WebAssembly.instantiate
WebAssembly.instantiate = ((moduleOrBytes: unknown, imports?: WebAssembly.Imports) => {
  if (moduleOrBytes instanceof WebAssembly.Module) {
    const instance = new WebAssembly.Instance(moduleOrBytes, imports)
    return Promise.resolve({ instance, module: moduleOrBytes })
  }
  return _origWasmInstantiate(moduleOrBytes as BufferSource, imports)
}) as typeof WebAssembly.instantiate

type Bindings = {
  FLOWLINE_DB: D1Database
}

// Initialize both WASM modules once (yoga for satori layout, resvg for SVG→PNG)
let wasmInitPromise: Promise<void> | null = null
function ensureWasmInitialized(): Promise<void> {
  if (!wasmInitPromise) {
    wasmInitPromise = Promise.all([initSatori(yogaWasm), initResvg(resvgWasm)])
      .then(() => undefined)
      .catch((e) => {
        wasmInitPromise = null
        throw e
      })
  }
  return wasmInitPromise
}

const app = new Hono<{ Bindings: Bindings }>()

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

function getAuthorInitial(name: string): string {
  if (!name) return 'U'
  return name.charAt(0).toUpperCase()
}

function buildOgpElement(title: string, authorName: string) {
  const authorInitial = getAuthorInitial(authorName)

  // Lightweight design: ~20 elements to stay within Workers Free plan CPU limits
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#F4F4F8',
        fontFamily: 'Noto Sans JP',
      },
      children: [
        // Top bar (white, 52px)
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              height: '52px',
              padding: '0 28px',
              gap: '14px',
              backgroundColor: '#FFFFFF',
              borderBottom: '1px solid #E8E8EE',
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
                    width: '30px',
                    height: '30px',
                    borderRadius: '7px',
                    backgroundColor: '#7C5CFC',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#FFFFFF',
                  },
                  children: 'F',
                },
              },
              // Flowline
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    fontSize: '15px',
                    fontWeight: 700,
                    color: '#1a1a2e',
                  },
                  children: 'Flowline',
                },
              },
              // Separator
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    width: '1px',
                    height: '20px',
                    backgroundColor: '#ECECF0',
                    margin: '0 4px',
                  },
                },
              },
              // Author avatar
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    height: '24px',
                    borderRadius: '12px',
                    backgroundColor: '#7C5CFC',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#FFFFFF',
                  },
                  children: authorInitial,
                },
              },
              // Author name
              {
                type: 'div',
                props: {
                  style: { display: 'flex', fontSize: '12px', fontWeight: 600, color: '#888' },
                  children: authorName,
                },
              },
              // Spacer
              { type: 'div', props: { style: { display: 'flex', flex: 1 } } },
              // "共有中" badge
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    padding: '5px 12px',
                    borderRadius: '7px',
                    backgroundColor: '#F0EBFF',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#7C5CFC',
                  },
                  children: '共有中',
                },
              },
            ],
          },
        },

        // Body: centered content
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              padding: '0 80px',
              gap: '24px',
            },
            children: [
              // Title
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    justifyContent: 'center',
                    fontSize: '52px',
                    fontWeight: 700,
                    color: '#1a1a2e',
                    maxWidth: '1000px',
                    overflow: 'hidden',
                    maxLines: 2,
                    textOverflow: 'ellipsis',
                    lineHeight: 1.2,
                  },
                  children: title,
                },
              },
              // Author sharing info
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '28px',
                          height: '28px',
                          borderRadius: '14px',
                          backgroundColor: '#7C5CFC',
                          fontSize: '12px',
                          fontWeight: 700,
                          color: '#FFFFFF',
                        },
                        children: authorInitial,
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          fontSize: '18px',
                          color: '#999',
                        },
                        children: `${authorName} が共有`,
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
              borderTop: '1px solid #E8E8EE',
              gap: '16px',
            },
            children: [
              // Catchcopy
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    fontSize: '14px',
                    color: '#AAA',
                  },
                  children: 'フローを描く。チームが動く。',
                },
              },
              // Lane color dots
              {
                type: 'div',
                props: {
                  style: { display: 'flex', alignItems: 'center', gap: '4px' },
                  children: ['#E8985A', '#5B8EC9', '#9B6BC9', '#5AC98A'].map((color) => ({
                    type: 'div',
                    props: {
                      style: {
                        display: 'flex',
                        width: '6px',
                        height: '6px',
                        borderRadius: '3px',
                        backgroundColor: color,
                      },
                    },
                  })),
                },
              },
              // Domain
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    fontSize: '14px',
                    color: '#AAA',
                  },
                  children: 'flowline.app',
                },
              },
            ],
          },
        },
      ],
    },
  }
}

// =============================================
// GET /share/:tokenPng - Generate OGP image
// =============================================
app.get('/share/:tokenPng', async (c) => {
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

    await ensureWasmInitialized()
    const fontData = await loadFont()

    const element = buildOgpElement(flow.title, flow.author_name)

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

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }))

/** Reset internal caches — for testing only */
export function _resetCacheForTesting() {
  cachedFontData = null
  wasmInitPromise = null
}

export default app
