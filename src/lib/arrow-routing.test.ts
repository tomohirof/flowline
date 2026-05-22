import { describe, it, expect } from 'vitest'
import {
  buildArrowPath,
  collectObstacles,
  collectVerticalObstacles,
  collectDiagonalObstacles,
  type Bbox,
  type ObstacleNode,
} from './arrow-routing'

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
    // departX = 276 + 14 = 290, approachX = 524 - 14 = 510
    expect(r.d).toBe('M276,200 L290,200 L290,242 L510,242 L510,200 L524,200')
    expect(r.mx).toBe(400)
    expect(r.my).toBe(242)
  })

  it('同一行・障害1個・直下塞がり → 上迂回（detourY = 障害上端 - 14）', () => {
    const B: Bbox = { x: 400, y: 200, w: 152, h: 56 }
    const D: Bbox = { x: 400, y: 284, w: 152, h: 56 }
    const r = buildArrowPath(s, e, fc, tc, [B, D])
    expect(r.d).toBe('M276,200 L290,200 L290,158 L510,158 L510,200 L524,200')
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
    // departX = 276 + 14 = 290, approachX = 624 - 14 = 610
    expect(r.d).toBe('M276,200 L290,200 L290,254 L610,254 L610,200 L624,200')
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
    // departX = 524 - 14 = 510, approachX = 276 + 14 = 290
    expect(r.d).toBe('M524,200 L510,200 L510,242 L290,242 L290,200 L276,200')
    expect(r.mx).toBe(400)
    expect(r.my).toBe(242)
  })

  describe('水平進入＋水平 depart（始終点とも水平）', () => {
    it('下迂回パスは 6 セグメントで最初と最終セグメントが水平', () => {
      const B: Bbox = { x: 400, y: 200, w: 152, h: 56 }
      const r = buildArrowPath(s, e, fc, tc, [B])
      const segments = r.d.match(/[ML][^ML]+/g) ?? []
      expect(segments).toHaveLength(6)
      // 最初のセグメント（M→L）は水平: M の Y と次の L の Y が同じ
      const first = segments[0]
      const second = segments[1]
      const firstY = Number(first.split(',')[1])
      const secondY = Number(second.split(',')[1])
      expect(firstY).toBe(secondY)
      expect(firstY).toBe(s.y)
      // 最終セグメントは水平
      const last = segments[segments.length - 1]
      const prev = segments[segments.length - 2]
      const lastY = Number(last.split(',')[1])
      const prevY = Number(prev.split(',')[1])
      expect(lastY).toBe(prevY)
      expect(lastY).toBe(e.y)
    })

    it('水平距離が DEPART_GAP*2 未満の場合 departX/approachX は中央で接合し自己交差しない', () => {
      // 水平距離=20, DEPART_GAP=APPROACH_GAP=14。Math.min(14, 10) で 10 に clamp される
      // s=(100,200), e=(120,200) で間に B (110,200) を置いて迂回を強制
      const sN = { x: 100, y: 200 }
      const eN = { x: 120, y: 200 }
      const fcN = { x: 80, y: 200 }
      const tcN = { x: 140, y: 200 }
      const B: Bbox = { x: 110, y: 200, w: 16, h: 56 }
      const r = buildArrowPath(sN, eN, fcN, tcN, [B])
      // departX = 100 + 1 * Math.min(14, 10) = 110
      // approachX = 120 - 1 * Math.min(14, 10) = 110
      // → 中央 (110) で接合。departX も approachX も s.x/e.x を越えない
      expect(r.d).toBe('M100,200 L110,200 L110,242 L110,242 L110,200 L120,200')
    })
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

describe('buildArrowPath - 縦方向迂回（同一レーン）', () => {
  // 共通の始終点（A→C 同一レーン、A=(200,200), C=(200,600) のときの exitPt/entryPt 後の値）
  // ノード TW=152, TH=56 → hh=28, exit Y=200+28=228, entry Y=600-28=572
  const s = { x: 200, y: 228 }
  const e = { x: 200, y: 572 }
  const fc = { x: 200, y: 200 }
  const tc = { x: 200, y: 600 }

  it('obstacles 省略 → 既存の直線パスを返す（垂直直線）', () => {
    const r = buildArrowPath(s, e, fc, tc)
    expect(r.d).toBe('M200,228 L200,572')
  })

  it('obstacles が空配列 → 既存の直線パスを返す', () => {
    const r = buildArrowPath(s, e, fc, tc, [])
    expect(r.d).toBe('M200,228 L200,572')
  })

  it('同一列・障害1個・左右空き → 右迂回パス（detourX = 障害右端 + 14）', () => {
    const B: Bbox = { x: 200, y: 400, w: 152, h: 56 }
    const r = buildArrowPath(s, e, fc, tc, [B])
    // detourX = 200 + 76 + 14 = 290
    // sign=+1, halfDy=172, departY=228+14=242, approachY=572-14=558
    expect(r.d).toBe('M200,228 L200,242 L290,242 L290,558 L200,558 L200,572')
    expect(r.mx).toBe(290)
    expect(r.my).toBe(400)
  })

  it('同一列・障害1個・直右塞がり → 左迂回（detourX = 障害左端 - 14）', () => {
    const B: Bbox = { x: 200, y: 400, w: 152, h: 56 }
    const Bright: Bbox = { x: 284, y: 400, w: 152, h: 56 }
    const r = buildArrowPath(s, e, fc, tc, [B, Bright])
    // detourX = 200 - 76 - 14 = 110
    expect(r.d).toBe('M200,228 L200,242 L110,242 L110,558 L200,558 L200,572')
    expect(r.mx).toBe(110)
  })

  it('同一列・障害1個・両塞がり → 右優先で右迂回', () => {
    const B: Bbox = { x: 200, y: 400, w: 152, h: 56 }
    const Bright: Bbox = { x: 284, y: 400, w: 152, h: 56 }
    const Bleft: Bbox = { x: 116, y: 400, w: 152, h: 56 }
    const r = buildArrowPath(s, e, fc, tc, [B, Bright, Bleft])
    expect(r.mx).toBe(290)
  })

  it('同一列・障害2個・右空き → まとめて右迂回（detourX は最右端の最大）', () => {
    const B: Bbox = { x: 200, y: 380, w: 152, h: 56 }
    const C2: Bbox = { x: 200, y: 480, w: 200, h: 56 }
    const sExt = { x: 200, y: 228 }
    const eExt = { x: 200, y: 624 }
    const r = buildArrowPath(sExt, eExt, { x: 200, y: 200 }, { x: 200, y: 700 }, [B, C2])
    // 最右端: max(200+76, 200+100) = 300, +14 = 314
    expect(r.mx).toBe(314)
    expect(r.d).toBe('M200,228 L200,242 L314,242 L314,610 L200,610 L200,624')
  })

  it('同一列・障害2個・1つだけ直右塞がり → 左迂回', () => {
    const B: Bbox = { x: 200, y: 380, w: 152, h: 56 }
    const C2: Bbox = { x: 200, y: 480, w: 152, h: 56 }
    const Bright: Bbox = { x: 284, y: 380, w: 152, h: 56 }
    const sExt = { x: 200, y: 228 }
    const eExt = { x: 200, y: 624 }
    const r = buildArrowPath(sExt, eExt, { x: 200, y: 200 }, { x: 200, y: 700 }, [B, C2, Bright])
    // 最左端: min(200-76, 200-76) = 124, -14 = 110
    expect(r.mx).toBe(110)
  })

  it('同一列・障害なし（経路上に bbox がない）→ 直線', () => {
    const farUp: Bbox = { x: 200, y: 100, w: 152, h: 56 }
    const farDown: Bbox = { x: 200, y: 700, w: 152, h: 56 }
    const r = buildArrowPath(s, e, fc, tc, [farUp, farDown])
    expect(r.d).toBe('M200,228 L200,572')
  })

  it('斜め方向（dx >= 2）→ 既存の Z/L 字ロジック（縦迂回しない）', () => {
    const sDiag = { x: 200, y: 228 }
    const eDiag = { x: 300, y: 572 }
    const B: Bbox = { x: 200, y: 400, w: 152, h: 56 }
    const r = buildArrowPath(sDiag, eDiag, { x: 200, y: 200 }, { x: 300, y: 600 }, [B])
    expect(r.d).not.toContain('L290,242')
  })

  it('始終点が同じ Y（自己参照） → inCol 空 → 直線', () => {
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

  it('from/to 自身の bbox が混入しても Y±1 マージンで除外される', () => {
    const fromSelfBbox: Bbox = { x: 200, y: 200, w: 152, h: 56 }
    const toSelfBbox: Bbox = { x: 200, y: 600, w: 152, h: 56 }
    const r = buildArrowPath(s, e, fc, tc, [fromSelfBbox, toSelfBbox])
    expect(r.d).toBe('M200,228 L200,572')
  })

  it('同一列・下→上方向でも右迂回する（s.y > e.y）', () => {
    const sR = { x: 200, y: 572 }
    const eR = { x: 200, y: 228 }
    const fcR = { x: 200, y: 600 }
    const tcR = { x: 200, y: 200 }
    const B: Bbox = { x: 200, y: 400, w: 152, h: 56 }
    const r = buildArrowPath(sR, eR, fcR, tcR, [B])
    expect(r.d).toBe('M200,572 L200,558 L290,558 L290,242 L200,242 L200,228')
    expect(r.mx).toBe(290)
  })

  it('上向き矢印（同一レーン・サイド出口で s.x = lane center + hw）でも障害を検出して迂回', () => {
    // 上向き矢印では exitPt/entryPt がサイド出口を返すため s.x/e.x がレーン中心からズレる。
    // colX オフセットが bboxW/2 までであり「< bboxW/2 + 2」マージンに収まることを保証する回帰テスト。
    // A=(200,600) → C=(200,200) を上向きに引いた想定: s=(276,600), e=(276,200)
    const sUp = { x: 276, y: 600 }
    const eUp = { x: 276, y: 200 }
    const fcUp = { x: 200, y: 600 }
    const tcUp = { x: 200, y: 200 }
    // 障害 B はレーン中心 (200) にあり、s.x (276) との差は hw=76 < bboxW/2 + 2 = 78 で検出される
    const B: Bbox = { x: 200, y: 400, w: 152, h: 56 }
    const r = buildArrowPath(sUp, eUp, fcUp, tcUp, [B])
    // detourX = 200 + 76 + 14 = 290 (障害の右端基準、s.x ではなく b.x 基準)
    // sign=-1, halfDy=200, departY=600-14=586, approachY=200+14=214
    expect(r.d).toBe('M276,600 L276,586 L290,586 L290,214 L276,214 L276,200')
    expect(r.mx).toBe(290)
  })

  describe('垂直進入＋垂直 depart（始終点とも垂直）', () => {
    it('右迂回パスは 6 セグメントで最初と最終セグメントが垂直', () => {
      const B: Bbox = { x: 200, y: 400, w: 152, h: 56 }
      const r = buildArrowPath(s, e, fc, tc, [B])
      const segments = r.d.match(/[ML][^ML]+/g) ?? []
      expect(segments).toHaveLength(6)
      const first = segments[0]
      const second = segments[1]
      const firstX = Number(first.slice(1).split(',')[0])
      const secondX = Number(second.slice(1).split(',')[0])
      expect(firstX).toBe(secondX)
      expect(firstX).toBe(s.x)
      const last = segments[segments.length - 1]
      const prev = segments[segments.length - 2]
      const lastX = Number(last.slice(1).split(',')[0])
      const prevX = Number(prev.slice(1).split(',')[0])
      expect(lastX).toBe(prevX)
      expect(lastX).toBe(e.x)
    })

    it('垂直距離が DEPART_GAP*2 未満の場合 departY/approachY は中央で接合し自己交差しない', () => {
      const sN = { x: 200, y: 100 }
      const eN = { x: 200, y: 120 }
      const fcN = { x: 200, y: 80 }
      const tcN = { x: 200, y: 140 }
      const B: Bbox = { x: 200, y: 110, w: 152, h: 16 }
      const r = buildArrowPath(sN, eN, fcN, tcN, [B])
      // departY = 100 + 1 * Math.min(14, 10) = 110
      // approachY = 120 - 1 * Math.min(14, 10) = 110
      // detourX = 200 + 76 + 14 = 290
      expect(r.d).toBe('M200,100 L200,110 L290,110 L290,110 L200,110 L200,120')
    })
  })
})

describe('collectVerticalObstacles', () => {
  // A=(200,200), B=(200,400), C=(200,600) 同一レーン (colX=200)
  // D=(284,400) B 直右列, E=(116,400) B 直左列 (colW=84 → adjacent threshold)
  // F=(368,400) 2列右（除外対象）
  // 注: ここではテストしやすい colW=84 を使用。実際の運用では LW + G を渡す。
  const TW = 152,
    TH = 56,
    LANE_W = 84

  const baseNodes: ObstacleNode[] = [
    { key: 'A', cx: 200, cy: 200 },
    { key: 'B', cx: 200, cy: 400 },
    { key: 'C', cx: 200, cy: 600 },
    { key: 'D', cx: 284, cy: 400 },
    { key: 'E', cx: 116, cy: 400 },
    { key: 'F', cx: 368, cy: 400 },
  ]

  it('A→C: 同一列の B（from-to 間）と直左 E・直右 D を集める。F（2列右）は除外', () => {
    const result = collectVerticalObstacles({
      nodes: baseNodes,
      fromKey: 'A',
      toKey: 'C',
      fromCy: 200,
      toCy: 600,
      colX: 200,
      colW: LANE_W,
      bboxW: TW,
      bboxH: TH,
    })
    expect(result).toHaveLength(3)
    const cxs = result.map((b) => b.x).sort((a, b) => a - b)
    expect(cxs).toEqual([116, 200, 284])
    expect(result.every((b) => b.x !== 368)).toBe(true)
  })

  it('from/to 自身は除外される', () => {
    const result = collectVerticalObstacles({
      nodes: baseNodes,
      fromKey: 'A',
      toKey: 'C',
      fromCy: 200,
      toCy: 600,
      colX: 200,
      colW: LANE_W,
      bboxW: TW,
      bboxH: TH,
    })
    const xys = result.map((b) => `${b.x},${b.y}`)
    expect(xys).not.toContain('200,200')
    expect(xys).not.toContain('200,600')
  })

  it('A→B（隣接、間にノードなし）: 同一列は from-to 間限定なので空、直左/直右列は Y 制限なしで含む', () => {
    const result = collectVerticalObstacles({
      nodes: baseNodes,
      fromKey: 'A',
      toKey: 'B',
      fromCy: 200,
      toCy: 400,
      colX: 200,
      colW: LANE_W,
      bboxW: TW,
      bboxH: TH,
    })
    expect(result).toHaveLength(2)
    const cxs = result.map((b) => b.x).sort((a, b) => a - b)
    expect(cxs).toEqual([116, 284])
  })

  it('下→上方向（fromCy > toCy）でも同一列・隣接列を正しく抽出', () => {
    const result = collectVerticalObstacles({
      nodes: baseNodes,
      fromKey: 'C',
      toKey: 'A',
      fromCy: 600,
      toCy: 200,
      colX: 200,
      colW: LANE_W,
      bboxW: TW,
      bboxH: TH,
    })
    expect(result).toHaveLength(3)
    const cxs = result.map((b) => b.x).sort((a, b) => a - b)
    expect(cxs).toEqual([116, 200, 284])
  })

  it('Bbox の w, h は引数の bboxW, bboxH と一致する', () => {
    const result = collectVerticalObstacles({
      nodes: baseNodes,
      fromKey: 'A',
      toKey: 'C',
      fromCy: 200,
      toCy: 600,
      colX: 200,
      colW: LANE_W,
      bboxW: TW,
      bboxH: TH,
    })
    expect(result.every((b) => b.w === TW && b.h === TH)).toBe(true)
  })

  it('nodes が空配列 → 空配列を返す', () => {
    const result = collectVerticalObstacles({
      nodes: [],
      fromKey: 'A',
      toKey: 'C',
      fromCy: 200,
      toCy: 600,
      colX: 200,
      colW: LANE_W,
      bboxW: TW,
      bboxH: TH,
    })
    expect(result).toEqual([])
  })
})

describe('collectDiagonalObstacles', () => {
  const baseArgs = {
    fromKey: 'A',
    toKey: 'C',
    fromCx: 200,
    fromCy: 100,
    toCx: 600,
    toCy: 400,
    rowH: 84,
    colW: 200,
    bboxW: 152,
    bboxH: 56,
  }

  it('should exclude from/to nodes themselves when only from/to exist', () => {
    const nodes: ObstacleNode[] = [
      { key: 'A', cx: 200, cy: 100 },
      { key: 'C', cx: 600, cy: 400 },
    ]
    const r = collectDiagonalObstacles({ nodes, ...baseArgs })
    expect(r).toEqual([])
  })

  it('should collect source-column obstacle between source and target rows', () => {
    const nodes: ObstacleNode[] = [
      { key: 'A', cx: 200, cy: 100 },
      { key: 'B', cx: 200, cy: 250 },
      { key: 'C', cx: 600, cy: 400 },
    ]
    const r = collectDiagonalObstacles({ nodes, ...baseArgs })
    expect(r).toEqual([{ x: 200, y: 250, w: 152, h: 56 }])
  })

  it('should not collect source-column nodes outside Z-path Y range', () => {
    const nodes: ObstacleNode[] = [
      { key: 'A', cx: 200, cy: 100 },
      { key: 'B', cx: 200, cy: 50 },
      { key: 'D', cx: 200, cy: 450 },
      { key: 'C', cx: 600, cy: 400 },
    ]
    const r = collectDiagonalObstacles({ nodes, ...baseArgs })
    expect(r).toEqual([])
  })

  it('should collect target-column obstacle between source and target rows', () => {
    const nodes: ObstacleNode[] = [
      { key: 'A', cx: 200, cy: 100 },
      { key: 'B', cx: 600, cy: 250 },
      { key: 'C', cx: 600, cy: 400 },
    ]
    const r = collectDiagonalObstacles({ nodes, ...baseArgs })
    expect(r).toEqual([{ x: 600, y: 250, w: 152, h: 56 }])
  })
})
