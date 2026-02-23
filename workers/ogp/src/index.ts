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

  // Simplified SVG swimlane preview elements for Satori
  // 4 lanes x 5 rows of nodes + fading rows
  const previewSvgChildren = [
    // Lane backgrounds
    {
      type: 'rect',
      props: { x: 10, y: 32, width: 178, height: 440, rx: 8, fill: '#F8F0EC', opacity: 0.4 },
    },
    {
      type: 'rect',
      props: { x: 196, y: 32, width: 178, height: 440, rx: 8, fill: '#ECF0F8', opacity: 0.4 },
    },
    {
      type: 'rect',
      props: { x: 382, y: 32, width: 178, height: 440, rx: 8, fill: '#F0ECF8', opacity: 0.4 },
    },
    {
      type: 'rect',
      props: { x: 568, y: 32, width: 178, height: 440, rx: 8, fill: '#ECF8F0', opacity: 0.4 },
    },
    // Lane header dots
    { type: 'circle', props: { cx: 22, cy: 16, r: 4.5, fill: '#E8985A' } },
    { type: 'circle', props: { cx: 208, cy: 16, r: 4.5, fill: '#5B8EC9' } },
    { type: 'circle', props: { cx: 394, cy: 16, r: 4.5, fill: '#9B6BC9' } },
    { type: 'circle', props: { cx: 580, cy: 16, r: 4.5, fill: '#5AC98A' } },
    // Color bars
    {
      type: 'rect',
      props: { x: 10, y: 28, width: 178, height: 2.5, rx: 1.25, fill: '#E8985A', opacity: 0.35 },
    },
    {
      type: 'rect',
      props: { x: 196, y: 28, width: 178, height: 2.5, rx: 1.25, fill: '#5B8EC9', opacity: 0.35 },
    },
    {
      type: 'rect',
      props: { x: 382, y: 28, width: 178, height: 2.5, rx: 1.25, fill: '#9B6BC9', opacity: 0.35 },
    },
    {
      type: 'rect',
      props: { x: 568, y: 28, width: 178, height: 2.5, rx: 1.25, fill: '#5AC98A', opacity: 0.35 },
    },
    // Row 1 nodes
    {
      type: 'rect',
      props: {
        x: 26,
        y: 46,
        width: 146,
        height: 42,
        rx: 7,
        fill: '#fff',
        stroke: '#D0CED8',
        strokeWidth: 0.7,
      },
    },
    {
      type: 'rect',
      props: {
        x: 212,
        y: 46,
        width: 146,
        height: 42,
        rx: 7,
        fill: '#fff',
        stroke: '#D0CED8',
        strokeWidth: 0.7,
      },
    },
    // Row 2 nodes
    {
      type: 'rect',
      props: {
        x: 212,
        y: 106,
        width: 146,
        height: 42,
        rx: 7,
        fill: '#fff',
        stroke: '#D0CED8',
        strokeWidth: 0.7,
      },
    },
    {
      type: 'rect',
      props: {
        x: 398,
        y: 106,
        width: 146,
        height: 42,
        rx: 7,
        fill: '#fff',
        stroke: '#D0CED8',
        strokeWidth: 0.7,
      },
    },
    // Row 3 nodes
    {
      type: 'rect',
      props: {
        x: 398,
        y: 166,
        width: 146,
        height: 42,
        rx: 7,
        fill: '#fff',
        stroke: '#D0CED8',
        strokeWidth: 0.7,
      },
    },
    {
      type: 'rect',
      props: {
        x: 584,
        y: 166,
        width: 146,
        height: 42,
        rx: 7,
        fill: '#fff',
        stroke: '#D0CED8',
        strokeWidth: 0.7,
      },
    },
    // Row 4 nodes
    {
      type: 'rect',
      props: {
        x: 26,
        y: 226,
        width: 146,
        height: 42,
        rx: 7,
        fill: '#EEF5FF',
        stroke: '#B8D0F0',
        strokeWidth: 0.7,
      },
    },
    {
      type: 'rect',
      props: {
        x: 212,
        y: 226,
        width: 146,
        height: 42,
        rx: 7,
        fill: '#fff',
        stroke: '#D0CED8',
        strokeWidth: 0.7,
      },
    },
    // Row 5 nodes
    {
      type: 'rect',
      props: {
        x: 212,
        y: 286,
        width: 146,
        height: 42,
        rx: 7,
        fill: '#fff',
        stroke: '#D0CED8',
        strokeWidth: 0.7,
      },
    },
    {
      type: 'rect',
      props: {
        x: 398,
        y: 286,
        width: 146,
        height: 42,
        rx: 7,
        fill: '#fff',
        stroke: '#D0CED8',
        strokeWidth: 0.7,
      },
    },
    {
      type: 'rect',
      props: {
        x: 584,
        y: 286,
        width: 146,
        height: 42,
        rx: 7,
        fill: '#fff',
        stroke: '#D0CED8',
        strokeWidth: 0.7,
      },
    },
    // Fading rows
    {
      type: 'rect',
      props: {
        x: 26,
        y: 346,
        width: 146,
        height: 42,
        rx: 7,
        fill: '#fff',
        stroke: '#D0CED8',
        strokeWidth: 0.7,
        opacity: 0.4,
      },
    },
    {
      type: 'rect',
      props: {
        x: 212,
        y: 346,
        width: 146,
        height: 42,
        rx: 7,
        fill: '#fff',
        stroke: '#D0CED8',
        strokeWidth: 0.7,
        opacity: 0.4,
      },
    },
    {
      type: 'rect',
      props: {
        x: 398,
        y: 346,
        width: 146,
        height: 42,
        rx: 7,
        fill: '#fff',
        stroke: '#D0CED8',
        strokeWidth: 0.7,
        opacity: 0.25,
      },
    },
    {
      type: 'rect',
      props: {
        x: 212,
        y: 406,
        width: 146,
        height: 42,
        rx: 7,
        fill: '#fff',
        stroke: '#D0CED8',
        strokeWidth: 0.7,
        opacity: 0.15,
      },
    },
    {
      type: 'rect',
      props: {
        x: 398,
        y: 406,
        width: 146,
        height: 42,
        rx: 7,
        fill: '#fff',
        stroke: '#D0CED8',
        strokeWidth: 0.7,
        opacity: 0.1,
      },
    },
    // Connection lines (simplified, no arrow markers)
    {
      type: 'line',
      props: { x1: 172, y1: 67, x2: 210, y2: 67, stroke: '#8A889A', strokeWidth: 1.2 },
    },
    {
      type: 'line',
      props: { x1: 285, y1: 88, x2: 285, y2: 104, stroke: '#8A889A', strokeWidth: 1.2 },
    },
    {
      type: 'line',
      props: { x1: 358, y1: 127, x2: 396, y2: 127, stroke: '#8A889A', strokeWidth: 1.2 },
    },
    {
      type: 'line',
      props: { x1: 471, y1: 148, x2: 471, y2: 164, stroke: '#8A889A', strokeWidth: 1.2 },
    },
    {
      type: 'line',
      props: { x1: 544, y1: 187, x2: 582, y2: 187, stroke: '#8A889A', strokeWidth: 1.2 },
    },
    {
      type: 'line',
      props: { x1: 172, y1: 247, x2: 210, y2: 247, stroke: '#8A889A', strokeWidth: 1.2 },
    },
    {
      type: 'line',
      props: { x1: 285, y1: 268, x2: 285, y2: 284, stroke: '#8A889A', strokeWidth: 1.2 },
    },
    {
      type: 'line',
      props: { x1: 358, y1: 307, x2: 396, y2: 307, stroke: '#8A889A', strokeWidth: 1.2 },
    },
    {
      type: 'line',
      props: { x1: 544, y1: 307, x2: 582, y2: 307, stroke: '#8A889A', strokeWidth: 1.2 },
    },
  ]

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
        position: 'relative',
      },
      children: [
        // Gradient orbs (background decoration)
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: '-80px',
              right: '-80px',
              width: '400px',
              height: '400px',
              borderRadius: '200px',
              background: 'radial-gradient(circle, rgba(124,92,252,0.06), transparent 70%)',
            },
          },
        },
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              bottom: '-60px',
              left: '40px',
              width: '300px',
              height: '300px',
              borderRadius: '150px',
              background: 'radial-gradient(circle, rgba(91,141,239,0.05), transparent 70%)',
            },
          },
        },

        // Top bar
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
              zIndex: 2,
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
                    background: 'linear-gradient(135deg, #7C5CFC, #5B8DEF)',
                    fontSize: '14px',
                    fontWeight: 900,
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
                    fontWeight: 800,
                    color: '#1a1a2e',
                    letterSpacing: '-0.03em',
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
              // Author avatar (top bar)
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
                    background: 'linear-gradient(135deg, #7C5CFC, #5B8DEF)',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#FFFFFF',
                  },
                  children: authorInitial,
                },
              },
              // Author name (top bar)
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
                    gap: '5px',
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

        // Body
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flex: 1,
              position: 'relative',
            },
            children: [
              // Left column
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    width: '420px',
                    padding: '40px 40px',
                    justifyContent: 'center',
                    zIndex: 3,
                  },
                  children: [
                    // Author info
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '20px',
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
                                background: 'linear-gradient(135deg, #7C5CFC, #5B8DEF)',
                                fontSize: '11px',
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
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#999',
                              },
                              children: `${authorName} が共有`,
                            },
                          },
                        ],
                      },
                    },
                    // Title band
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          fontSize: '46px',
                          fontWeight: 900,
                          color: '#1a1a2e',
                          lineHeight: 1.2,
                          letterSpacing: '-0.04em',
                          backgroundColor: 'rgba(244,244,248,0.85)',
                          padding: '8px 16px 6px',
                          borderRadius: '8px 8px 0 0',
                          overflow: 'hidden',
                          maxLines: 2,
                          textOverflow: 'ellipsis',
                        },
                        children: title,
                      },
                    },
                    // Catchcopy band
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          backgroundColor: 'rgba(244,244,248,0.85)',
                          padding: '4px 16px 10px',
                          borderRadius: '0 0 8px 8px',
                          marginBottom: '20px',
                        },
                        children: [
                          // Mini F logo
                          {
                            type: 'div',
                            props: {
                              style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '20px',
                                height: '20px',
                                borderRadius: '5px',
                                background: 'linear-gradient(135deg, #7C5CFC, #5B8DEF)',
                                fontSize: '9px',
                                fontWeight: 900,
                                color: '#FFFFFF',
                              },
                              children: 'F',
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                display: 'flex',
                                fontSize: '18px',
                                fontWeight: 700,
                                color: '#888',
                                letterSpacing: '-0.02em',
                              },
                              children: 'フローを描く。チームが動く。',
                            },
                          },
                        ],
                      },
                    },
                    // Lane color dots
                    {
                      type: 'div',
                      props: {
                        style: { display: 'flex', alignItems: 'center', gap: '4px' },
                        children: [
                          {
                            type: 'div',
                            props: {
                              style: {
                                display: 'flex',
                                width: '8px',
                                height: '8px',
                                borderRadius: '4px',
                                backgroundColor: '#E8985A',
                              },
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                display: 'flex',
                                width: '8px',
                                height: '8px',
                                borderRadius: '4px',
                                backgroundColor: '#5B8EC9',
                              },
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                display: 'flex',
                                width: '8px',
                                height: '8px',
                                borderRadius: '4px',
                                backgroundColor: '#9B6BC9',
                              },
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: {
                                display: 'flex',
                                width: '8px',
                                height: '8px',
                                borderRadius: '4px',
                                backgroundColor: '#5AC98A',
                              },
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },

              // Right column: Preview card
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px 36px 24px 0',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          flexDirection: 'column',
                          width: '100%',
                          height: '100%',
                          borderRadius: '14px',
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #E8E8EE',
                          boxShadow: '0 8px 40px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.03)',
                          overflow: 'hidden',
                          position: 'relative',
                        },
                        children: [
                          // Window chrome
                          {
                            type: 'div',
                            props: {
                              style: {
                                display: 'flex',
                                alignItems: 'center',
                                height: '36px',
                                padding: '0 14px',
                                gap: '6px',
                                borderBottom: '1px solid #F0F0F4',
                                backgroundColor: '#FAFAFC',
                              },
                              children: [
                                {
                                  type: 'div',
                                  props: {
                                    style: {
                                      display: 'flex',
                                      width: '8px',
                                      height: '8px',
                                      borderRadius: '4px',
                                      backgroundColor: '#FF6058',
                                    },
                                  },
                                },
                                {
                                  type: 'div',
                                  props: {
                                    style: {
                                      display: 'flex',
                                      width: '8px',
                                      height: '8px',
                                      borderRadius: '4px',
                                      backgroundColor: '#FFBD2E',
                                    },
                                  },
                                },
                                {
                                  type: 'div',
                                  props: {
                                    style: {
                                      display: 'flex',
                                      width: '8px',
                                      height: '8px',
                                      borderRadius: '4px',
                                      backgroundColor: '#27CA40',
                                    },
                                  },
                                },
                                { type: 'div', props: { style: { display: 'flex', flex: 1 } } },
                                {
                                  type: 'div',
                                  props: {
                                    style: {
                                      display: 'flex',
                                      fontSize: '9px',
                                      color: '#CCC',
                                      fontWeight: 500,
                                    },
                                    children: 'flowline.app',
                                  },
                                },
                              ],
                            },
                          },
                          // SVG preview
                          {
                            type: 'svg',
                            props: {
                              width: '100%',
                              height: '100%',
                              viewBox: '0 0 760 490',
                              children: previewSvgChildren,
                            },
                          },
                          // Bottom gradient fade
                          {
                            type: 'div',
                            props: {
                              style: {
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: '80px',
                                background: 'linear-gradient(transparent, #FFFFFF)',
                              },
                            },
                          },
                        ],
                      },
                    },
                  ],
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
