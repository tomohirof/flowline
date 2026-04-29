import { describe, it, expect } from 'vitest'
import { buildArrowPath, type Bbox } from './arrow-routing'

describe('buildArrowPath - obstacles 引数（迂回モード）', () => {
  // 共通の始終点（A→C 同一行、A=(200,200), C=(600,200) のときの exitPt/entryPt 後の値）
  const s = { x: 276, y: 200 }
  const e = { x: 524, y: 200 }
  const fc = { x: 200, y: 200 }
  const tc = { x: 600, y: 200 }

  it('obstacles 省略 → 既存の直線パスを返す（後方互換）', () => {
    const r = buildArrowPath(s, e, fc, tc)
    expect(r.d).toBe('M276,200 L524,200')
    expect(r.mx).toBe(400)
    expect(r.my).toBe(200)
  })

  it('obstacles が空配列 → 既存の直線パスを返す', () => {
    const r = buildArrowPath(s, e, fc, tc, [])
    expect(r.d).toBe('M276,200 L524,200')
  })

  it('同一行・障害1個・上下空き → 下迂回パス（detourY = 障害下端 + 14）', () => {
    const B: Bbox = { x: 400, y: 200, w: 152, h: 56 }
    const r = buildArrowPath(s, e, fc, tc, [B])
    expect(r.d).toBe('M276,200 L276,242 L524,242 L524,200')
    expect(r.mx).toBe(400)
    expect(r.my).toBe(242)
  })

  it('同一行・障害1個・直下塞がり → 上迂回（detourY = 障害上端 - 14）', () => {
    const B: Bbox = { x: 400, y: 200, w: 152, h: 56 }
    const D: Bbox = { x: 400, y: 284, w: 152, h: 56 }
    const r = buildArrowPath(s, e, fc, tc, [B, D])
    expect(r.d).toBe('M276,200 L276,158 L524,158 L524,200')
    expect(r.my).toBe(158)
  })

  it('同一行・障害1個・両塞がり → 下優先で下迂回', () => {
    const B: Bbox = { x: 400, y: 200, w: 152, h: 56 }
    const D: Bbox = { x: 400, y: 284, w: 152, h: 56 }
    const E: Bbox = { x: 400, y: 116, w: 152, h: 56 }
    const r = buildArrowPath(s, e, fc, tc, [B, D, E])
    expect(r.my).toBe(242)
  })

  it('同一行・障害2個・下空き → まとめて下迂回（detourY は最下端の最大）', () => {
    const B: Bbox = { x: 380, y: 200, w: 152, h: 56 }
    const C2: Bbox = { x: 480, y: 200, w: 152, h: 80 }
    const sExt = { x: 276, y: 200 }
    const eExt = { x: 624, y: 200 }
    const r = buildArrowPath(sExt, eExt, { x: 200, y: 200 }, { x: 700, y: 200 }, [B, C2])
    expect(r.my).toBe(254)
    expect(r.d).toBe('M276,200 L276,254 L624,254 L624,200')
  })

  it('同一行・障害2個・1つだけ直下塞がり → 上迂回', () => {
    const B: Bbox = { x: 380, y: 200, w: 152, h: 56 }
    const C2: Bbox = { x: 480, y: 200, w: 152, h: 56 }
    const Bdown: Bbox = { x: 380, y: 284, w: 152, h: 56 }
    const sExt = { x: 276, y: 200 }
    const eExt = { x: 624, y: 200 }
    const r = buildArrowPath(
      sExt, eExt,
      { x: 200, y: 200 }, { x: 700, y: 200 },
      [B, C2, Bdown],
    )
    expect(r.my).toBe(158)
  })

  it('同一行・障害なし（経路上に bbox がない）→ 直線', () => {
    const farLeft: Bbox = { x: 100, y: 200, w: 152, h: 56 }
    const farRight: Bbox = { x: 800, y: 200, w: 152, h: 56 }
    const r = buildArrowPath(s, e, fc, tc, [farLeft, farRight])
    expect(r.d).toBe('M276,200 L524,200')
  })

  it('斜め方向（dy >= 2）→ 既存の Z/L 字ロジック（迂回しない）', () => {
    const sDiag = { x: 276, y: 200 }
    const eDiag = { x: 524, y: 300 }
    const B: Bbox = { x: 400, y: 200, w: 152, h: 56 }
    const r = buildArrowPath(sDiag, eDiag, { x: 200, y: 200 }, { x: 600, y: 300 }, [B])
    expect(r.d).not.toContain('L276,242')
  })

  it('始終点が同じ X（自己参照） → inRow 空 → 直線', () => {
    const B: Bbox = { x: 200, y: 200, w: 152, h: 56 }
    const r = buildArrowPath(
      { x: 200, y: 200 }, { x: 200, y: 200 },
      { x: 200, y: 200 }, { x: 200, y: 200 },
      [B],
    )
    expect(r.d).toBe('M200,200 L200,200')
  })

  it('from/to 自身の bbox が混入しても X±1 マージンで除外される', () => {
    const fromSelfBbox: Bbox = { x: 200, y: 200, w: 152, h: 56 }
    const toSelfBbox: Bbox = { x: 600, y: 200, w: 152, h: 56 }
    const r = buildArrowPath(s, e, fc, tc, [fromSelfBbox, toSelfBbox])
    expect(r.d).toBe('M276,200 L524,200')
  })
})
