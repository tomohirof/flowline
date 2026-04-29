import { describe, it, expect } from 'vitest'
import { buildArrowPath, collectObstacles, type Bbox, type ObstacleNode } from './arrow-routing'

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
    const r = buildArrowPath(sExt, eExt, { x: 200, y: 200 }, { x: 700, y: 200 }, [B, C2, Bdown])
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
      { x: 200, y: 200 },
      { x: 200, y: 200 },
      { x: 200, y: 200 },
      { x: 200, y: 200 },
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

  it('同一行・右→左方向でも下迂回する（s.x > e.x）', () => {
    // s と e を逆転（s.x=524 → e.x=276）。同一行 (y=200)、間に B (400,200)
    const sR = { x: 524, y: 200 }
    const eR = { x: 276, y: 200 }
    const fcR = { x: 600, y: 200 }
    const tcR = { x: 200, y: 200 }
    const B: Bbox = { x: 400, y: 200, w: 152, h: 56 }
    const r = buildArrowPath(sR, eR, fcR, tcR, [B])
    // detourY = 200 + 28 + 14 = 242。左右が反転したミラーパス
    expect(r.d).toBe('M524,200 L524,242 L276,242 L276,200')
    expect(r.mx).toBe(400)
    expect(r.my).toBe(242)
  })
})

describe('collectObstacles', () => {
  // A=(200,200), B=(400,200), C=(600,200) 同一行 (rowY=200)
  // D=(400,284) B 直下行, E=(400,116) B 直上行
  // F=(400,368) 2行下（除外対象）
  const TW = 152,
    TH = 56,
    RH = 84

  const baseNodes: ObstacleNode[] = [
    { key: 'A', cx: 200, cy: 200 },
    { key: 'B', cx: 400, cy: 200 },
    { key: 'C', cx: 600, cy: 200 },
    { key: 'D', cx: 400, cy: 284 },
    { key: 'E', cx: 400, cy: 116 },
    { key: 'F', cx: 400, cy: 368 },
  ]

  it('A→C: 同一行の B（from-to 間）と直上 E・直下 D を集める。F（2行下）は除外', () => {
    const result = collectObstacles({
      nodes: baseNodes,
      fromKey: 'A',
      toKey: 'C',
      fromCx: 200,
      toCx: 600,
      rowY: 200,
      rowH: RH,
      bboxW: TW,
      bboxH: TH,
    })
    // B (同一行・間), D (直下), E (直上) が含まれる
    const cxs = result.map((b) => b.x).sort((a, b) => a - b)
    expect(result).toHaveLength(3)
    expect(cxs).toEqual([400, 400, 400])
    // F (cy=368) は除外
    expect(result.every((b) => b.y !== 368)).toBe(true)
  })

  it('from/to 自身は除外される', () => {
    const result = collectObstacles({
      nodes: baseNodes,
      fromKey: 'A',
      toKey: 'C',
      fromCx: 200,
      toCx: 600,
      rowY: 200,
      rowH: RH,
      bboxW: TW,
      bboxH: TH,
    })
    // A, C は含まれない
    const ys = result.map((b) => `${b.x},${b.y}`)
    expect(ys).not.toContain('200,200')
    expect(ys).not.toContain('600,200')
  })

  it('A→B（隣接、間にノードなし）: 同一行は from-to 間限定なので空、直上下は X 制限なしで含む', () => {
    const result = collectObstacles({
      nodes: baseNodes,
      fromKey: 'A',
      toKey: 'B',
      fromCx: 200,
      toCx: 400,
      rowY: 200,
      rowH: RH,
      bboxW: TW,
      bboxH: TH,
    })
    // 同一行: A=200, B=400 が from/to で除外。C=600 は X 範囲外で除外。→ 0件
    // 直上下: D, E, F は X 制限なしだが F は 2行下で除外。D, E のみ含まれる。
    expect(result).toHaveLength(2)
    const cys = result.map((b) => b.y).sort((a, b) => a - b)
    expect(cys).toEqual([116, 284])
  })

  it('Bbox の w, h は引数の bboxW, bboxH と一致する', () => {
    const result = collectObstacles({
      nodes: baseNodes,
      fromKey: 'A',
      toKey: 'C',
      fromCx: 200,
      toCx: 600,
      rowY: 200,
      rowH: RH,
      bboxW: TW,
      bboxH: TH,
    })
    expect(result.every((b) => b.w === TW && b.h === TH)).toBe(true)
  })

  it('nodes が空配列 → 空配列を返す', () => {
    const result = collectObstacles({
      nodes: [],
      fromKey: 'A',
      toKey: 'C',
      fromCx: 200,
      toCx: 600,
      rowY: 200,
      rowH: RH,
      bboxW: TW,
      bboxH: TH,
    })
    expect(result).toEqual([])
  })

  it('右→左方向（fromCx > toCx）でも同一行・隣接行を正しく抽出', () => {
    // fromCx=600 (C), toCx=200 (A) と入れ替え。間に B (cx=400) があるはず
    const result = collectObstacles({
      nodes: baseNodes,
      fromKey: 'C',
      toKey: 'A',
      fromCx: 600,
      toCx: 200,
      rowY: 200,
      rowH: RH,
      bboxW: TW,
      bboxH: TH,
    })
    // 同一行: B (400, 200) が含まれる、C/A は from/to で除外
    // 直上下: D (400, 284) と E (400, 116)
    // F (400, 368) は 2 行下で除外
    expect(result).toHaveLength(3)
    const cys = result.map((b) => b.y).sort((a, b) => a - b)
    expect(cys).toEqual([116, 200, 284])
  })
})
