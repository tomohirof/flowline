import { describe, it, expect } from 'vitest'
import { routeAllArrows, routeAllArrowsWithJumpers } from './edge-router'
import type { ArrowResolveContext } from './edge-router'
import type { Bbox } from './arrow-routing'

const makeCtx = (
  fx: number,
  fy: number,
  tx: number,
  ty: number,
  nodeObstacles: Bbox[] = [],
): ArrowResolveContext => ({
  from: { x: fx, y: fy },
  to: { x: tx, y: ty },
  config: { hw: 50, hh: 25, rh: 100 },
  nodeObstacles,
})

describe('routeAllArrows', () => {
  it('returns empty array for empty arrows', () => {
    expect(routeAllArrows([], () => null)).toEqual([])
  })

  it('returns single ArrowPathResult for single arrow', () => {
    const arrows = [{ id: 'a1', from: 'A', to: 'B' }]
    const result = routeAllArrows(arrows, (a) => (a.id === 'a1' ? makeCtx(0, 100, 200, 100) : null))
    expect(result).toHaveLength(1)
    expect(result[0]).not.toBeNull()
    // exitPt shifts start to node boundary (from.x + hw = 0 + 50 = 50)
    expect(result[0]?.d).toContain('M50,100')
  })

  it('null context produces null result (no impact on subsequent arrows)', () => {
    const arrows = [
      { id: 'a1', from: 'A', to: 'B' },
      { id: 'a2', from: 'C', to: 'D' },
    ]
    const result = routeAllArrows(arrows, (a) => (a.id === 'a2' ? makeCtx(0, 100, 200, 100) : null))
    expect(result[0]).toBeNull()
    expect(result[1]).not.toBeNull()
  })

  it('second arrow does NOT detour around first arrow thin segments (jumper-side handles crossings)', () => {
    // 段階4 (ジャンパー) 導入後、薄いエッジセグメントは迂回判定の障害物に含めない。
    // a1 と a2 が H × V 交差する位置関係でも、a2 は alone と同一ルートを取り、
    // 交差点は routeAllArrowsWithJumpers の 2nd pass で弧表現される。
    const arrows = [
      { id: 'a1', from: 'A', to: 'B' },
      { id: 'a2', from: 'C', to: 'D' },
    ]
    const result = routeAllArrows(arrows, (a) =>
      a.id === 'a1' ? makeCtx(0, 100, 300, 100) : makeCtx(50, 100, 250, 100),
    )

    // The same a2 routed alone (without a1 as obstacle)
    const arrowsAlone = [{ id: 'a2', from: 'C', to: 'D' }]
    const alone = routeAllArrows(arrowsAlone, () => makeCtx(50, 100, 250, 100))

    // a1 の薄いセグメントは a2 の迂回判定に影響しないので、ルートは同一
    expect(result[1]?.d).toBe(alone[0]?.d)
    expect(result[1]).not.toBeNull()
  })

  it('arrows sharing from-endpoint do NOT treat each other as obstacles', () => {
    const arrows = [
      { id: 'a1', from: 'A', to: 'B' },
      { id: 'a2', from: 'A', to: 'C' },
    ]
    const result = routeAllArrows(arrows, (a) =>
      a.id === 'a1' ? makeCtx(0, 100, 200, 100) : makeCtx(0, 100, 200, 200),
    )
    const arrowsAlone = [{ id: 'a2', from: 'A', to: 'C' }]
    const alone = routeAllArrows(arrowsAlone, () => makeCtx(0, 100, 200, 200))
    expect(result[1]?.d).toBe(alone[0]?.d)
  })

  it('arrows sharing to-endpoint do NOT treat each other as obstacles', () => {
    const arrows = [
      { id: 'a1', from: 'A', to: 'C' },
      { id: 'a2', from: 'B', to: 'C' },
    ]
    const result = routeAllArrows(arrows, (a) =>
      a.id === 'a1' ? makeCtx(0, 100, 200, 100) : makeCtx(0, 200, 200, 100),
    )
    const arrowsAlone = [{ id: 'a2', from: 'B', to: 'C' }]
    const alone = routeAllArrows(arrowsAlone, () => makeCtx(0, 200, 200, 100))
    expect(result[1]?.d).toBe(alone[0]?.d)
  })

  it('thin edge segments do not corrupt blocked-direction detection', () => {
    // a1 (id 小: 先行ルート) は長い水平直線 y=100 を通る → 薄い水平セグメント Bbox を生成
    // a2 は y=300 で水平移動し、X=400 のノード障害 + 直下 (y=380) に塞ぐノードを置く
    // → a2 の迂回方向は本来 "上 (y を上方向にずらす)" になるべき
    // バグ時: a1 の薄い線分 (y=100, w 大) が xOverlap で誤マッチし、upBlocked=true となり
    //   迂回方向が下に反転してしまう可能性がある。修正後はそうならない。
    const blockerNode: Bbox = { x: 400, y: 300, w: 40, h: 40 } // 経路上の障害
    const belowBlocker: Bbox = { x: 400, y: 380, w: 40, h: 40 } // 下が塞がっている
    const resolveCtx = (id: string): ArrowResolveContext | null => {
      if (id === 'a1') return makeCtx(0, 100, 1000, 100)
      if (id === 'a2') return makeCtx(200, 300, 600, 300, [blockerNode, belowBlocker])
      return null
    }
    const withA1 = routeAllArrows(
      [
        { id: 'a1', from: 'X', to: 'Y' },
        { id: 'a2', from: 'P', to: 'Q' },
      ],
      (a) => resolveCtx(a.id),
    )
    const withoutA1 = routeAllArrows([{ id: 'a2', from: 'P', to: 'Q' }], (a) => resolveCtx(a.id))
    // a2 の迂回方向は a1 の有無で変わらない（薄い線分が判定を汚染しない）
    expect(withA1[1]?.d).toBe(withoutA1[0]?.d)
  })

  it('deterministic ordering by id.localeCompare', () => {
    const arrows1 = [
      { id: 'z1', from: 'A', to: 'B' },
      { id: 'a1', from: 'C', to: 'D' },
    ]
    const arrows2 = [...arrows1].reverse()
    const ctx = (a: { id: string }) =>
      a.id === 'z1' ? makeCtx(0, 100, 200, 100) : makeCtx(50, 100, 150, 100)
    const r1 = routeAllArrows(arrows1, ctx)
    const r2 = routeAllArrows(arrows2, ctx)
    const findById = (rs: typeof r1, arr: typeof arrows1, id: string) => {
      const idx = arr.findIndex((a) => a.id === id)
      return rs[idx]?.d
    }
    expect(findById(r1, arrows1, 'a1')).toBe(findById(r2, arrows2, 'a1'))
    expect(findById(r1, arrows1, 'z1')).toBe(findById(r2, arrows2, 'z1'))
  })

  it('snapshot: 3エッジ累積ルーティングの d 出力が安定する', () => {
    const arrows = [
      { id: 'a1', from: 'A', to: 'B' },
      { id: 'a2', from: 'C', to: 'D' },
      { id: 'a3', from: 'E', to: 'F' },
    ]
    const ctxMap: Record<string, ArrowResolveContext> = {
      a1: makeCtx(0, 100, 800, 100),
      a2: makeCtx(100, 200, 700, 300),
      a3: makeCtx(200, 100, 600, 100),
    }
    const result = routeAllArrows(arrows, (a) => ctxMap[a.id] ?? null)
    expect(result.map((r) => r?.d)).toMatchInlineSnapshot(`
      [
        "M50,100 L750,100",
        "M100,225 L100,250 L700,250 L700,275",
        "M250,100 L550,100",
      ]
    `)
  })
})

describe('routeAllArrowsWithJumpers', () => {
  it('交差なし: routeAllArrows と完全同一の出力', () => {
    const arrows = [
      { id: 'a1', from: 'A', to: 'B' },
      { id: 'a2', from: 'C', to: 'D' },
    ]
    const ctxMap: Record<string, ArrowResolveContext> = {
      a1: makeCtx(0, 100, 200, 100),
      a2: makeCtx(0, 300, 200, 300), // 平行で交差しない
    }
    const baseline = routeAllArrows(arrows, (a) => ctxMap[a.id] ?? null)
    const result = routeAllArrowsWithJumpers(arrows, (a) => ctxMap[a.id] ?? null)
    expect(result.map((r) => r?.d)).toEqual(baseline.map((r) => r?.d))
  })

  it('X字交差: 片方の H セグメントに弧が挿入される', () => {
    // 共有 from='A' を使い、routeAllArrows の障害物バイパスを発動させ
    // 純粋な H×V 交差を作る
    const arrows = [
      { id: 'a1', from: 'A', to: 'B' },
      { id: 'a2', from: 'A', to: 'C' },
    ]
    const ctxMap: Record<string, ArrowResolveContext> = {
      a1: makeCtx(0, 200, 600, 200), // 水平
      a2: makeCtx(300, 0, 300, 400), // 垂直
    }
    const result = routeAllArrowsWithJumpers(arrows, (a) => ctxMap[a.id] ?? null)
    // どちらか片方の d に "A5,5" が含まれる（弧マーカー）
    const hasArc = result.some((r) => r?.d.includes('A5,5'))
    expect(hasArc).toBe(true)
    // segments 自体は不変
    const baseline = routeAllArrows(arrows, (a) => ctxMap[a.id] ?? null)
    expect(result[0]?.segments).toEqual(baseline[0]?.segments)
    expect(result[1]?.segments).toEqual(baseline[1]?.segments)
  })

  it('null context は null のまま伝播する', () => {
    const arrows = [
      { id: 'a1', from: 'A', to: 'B' },
      { id: 'a2', from: 'C', to: 'D' },
    ]
    const result = routeAllArrowsWithJumpers(arrows, (a) =>
      a.id === 'a1' ? makeCtx(0, 100, 200, 100) : null,
    )
    expect(result[0]).not.toBeNull()
    expect(result[1]).toBeNull()
  })

  it('決定論性: 同じ入力を 10 回流して全結果の d が一致', () => {
    const arrows = [
      { id: 'a1', from: 'A', to: 'B' },
      { id: 'a2', from: 'A', to: 'C' },
    ]
    const ctxMap: Record<string, ArrowResolveContext> = {
      a1: makeCtx(0, 200, 600, 200),
      a2: makeCtx(300, 0, 300, 400),
    }
    const runs = Array.from({ length: 10 }, () =>
      routeAllArrowsWithJumpers(arrows, (a) => ctxMap[a.id] ?? null).map((r) => r?.d),
    )
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i]).toEqual(runs[0])
    }
  })
})
