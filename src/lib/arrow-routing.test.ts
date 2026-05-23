import { describe, it, expect } from 'vitest'
import {
  buildArrowPath,
  collectObstacles,
  collectVerticalObstacles,
  collectDiagonalObstacles,
  detectDiagonalDetour,
  deriveFromSide,
  deriveToSide,
  exitPt,
  entryPt,
  segmentsToBboxes,
  segmentsToD,
  detectCrossings,
  DS,
  type Bbox,
  type EdgeSegment,
  type ObstacleNode,
  type EdgeWithSegments,
  type Crossing,
} from './arrow-routing'
import type { ArrowSide } from './types'

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

  it('斜め方向（dx >= 2）→ detectVerticalDetour は発火せず detectDiagonalDetour 経路へ', () => {
    const sDiag = { x: 200, y: 228 }
    const eDiag = { x: 300, y: 572 }
    const B: Bbox = { x: 200, y: 400, w: 152, h: 56 }
    const r = buildArrowPath(sDiag, eDiag, { x: 200, y: 200 }, { x: 300, y: 600 }, [B])
    // detectVerticalDetour は |dx| >= 2 で null を返す → 縦迂回固有の my=(s.y+e.y)/2 と
    // detourX 同値の 6 セグ縦迂回パターンにはならない。
    // detectDiagonalDetour による source-detour に流れる（B は source 列 (200) 上、target 列 (300)
    // は障害なし）。
    expect(r.d).toBe('M200,228 L200,242 L290,242 L290,400 L300,400 L300,572')
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

describe('buildArrowPath - 斜め迂回（異行×異レーン）', () => {
  const s = { x: 200, y: 128 }
  const e = { x: 600, y: 372 }
  const fc = { x: 200, y: 100 }
  const tc = { x: 600, y: 400 }

  it('should produce 6-segment target-detour path when obstacle in target column (core bug case)', () => {
    const B: Bbox = { x: 600, y: 250, w: 152, h: 56 }
    const r = buildArrowPath(s, e, fc, tc, [B])
    expect(r.d).toBe('M200,128 L200,250 L690,250 L690,358 L600,358 L600,372')
    expect(r.mx).toBe((200 + 690) / 2)
    expect(r.my).toBe(250)
  })

  it('should produce default Z-path when no obstacles intersect (diagonal)', () => {
    const r = buildArrowPath(s, e, fc, tc, [])
    expect(r.d).toBe('M200,128 L200,250 L600,250 L600,372')
  })

  it('should produce 6-segment source-detour path (mirror)', () => {
    const B: Bbox = { x: 200, y: 250, w: 152, h: 56 }
    const r = buildArrowPath(s, e, fc, tc, [B])
    expect(r.d).toBe('M200,128 L200,142 L290,142 L290,250 L600,250 L600,372')
    expect(r.mx).toBe((290 + 600) / 2)
    expect(r.my).toBe(250)
  })

  it('should produce 8-segment both-detour path when both columns blocked', () => {
    const Bs: Bbox = { x: 200, y: 250, w: 152, h: 56 }
    const Bt: Bbox = { x: 600, y: 250, w: 152, h: 56 }
    const r = buildArrowPath(s, e, fc, tc, [Bs, Bt])
    expect(r.d).toBe('M200,128 L200,142 L290,142 L290,250 L690,250 L690,358 L600,358 L600,372')
    expect(r.mx).toBe((290 + 690) / 2)
    expect(r.my).toBe(250)
  })

  it('should produce 4-segment shift-my path when only middle horizontal segment is blocked', () => {
    const B: Bbox = { x: 400, y: 250, w: 152, h: 56 }
    const r = buildArrowPath(s, e, fc, tc, [B])
    expect(r.d).toBe('M200,128 L200,292 L600,292 L600,372')
    expect(r.mx).toBe(400)
    expect(r.my).toBe(292)
  })

  it('should not affect horizontal arrow detour (regression guard for #314)', () => {
    const sH = { x: 276, y: 200 }
    const eH = { x: 524, y: 200 }
    const B: Bbox = { x: 400, y: 200, w: 152, h: 56 }
    const r = buildArrowPath(sH, eH, { x: 200, y: 200 }, { x: 600, y: 200 }, [B])
    expect(r.d).toBe('M276,200 L290,200 L290,242 L510,242 L510,200 L524,200')
  })

  it('should not affect vertical arrow detour (regression guard for #333)', () => {
    const sV = { x: 200, y: 128 }
    const eV = { x: 200, y: 372 }
    const B: Bbox = { x: 200, y: 250, w: 152, h: 56 }
    const r = buildArrowPath(sV, eV, { x: 200, y: 100 }, { x: 200, y: 400 }, [B])
    // 既存 detectVerticalDetour による 6 セグ右迂回
    expect(r.d).toContain('M200,128')
    expect(r.d).toContain('L200,372')
    expect(r.d).toMatch(/L290,\d+/) // 右迂回 detourX = 200+76+14 = 290
  })

  it('should produce default Z-path when obstacles array is undefined (diagonal)', () => {
    const r = buildArrowPath(s, e, fc, tc)
    expect(r.d).toBe('M200,128 L200,250 L600,250 L600,372')
  })

  it('should handle diagonal detour when source/target points come from diamond shape', () => {
    const sDia = { x: 200, y: 134 } // approx 中心 (200,100) + DS(34) 下
    const eDia = { x: 600, y: 366 } // approx 中心 (600,400) - DS(34) 上
    const B: Bbox = { x: 600, y: 250, w: 152, h: 56 } // target 列障害
    const r = buildArrowPath(sDia, eDia, { x: 200, y: 100 }, { x: 600, y: 400 }, [B])
    expect(r.d).toBe('M200,134 L200,250 L690,250 L690,352 L600,352 L600,366')
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

  it('should collect middle-row obstacle between source and target X', () => {
    const nodes: ObstacleNode[] = [
      { key: 'A', cx: 200, cy: 100 },
      { key: 'B', cx: 400, cy: 250 },
      { key: 'C', cx: 600, cy: 400 },
    ]
    const r = collectDiagonalObstacles({ nodes, ...baseArgs })
    expect(r).toEqual([{ x: 400, y: 250, w: 152, h: 56 }])
  })

  it('should not collect nodes outside Z-path X range at middle row', () => {
    // 中央行 Y (=250) だが、source 列・target 列・隣接列のいずれにも該当しない X 位置
    // (fromCx=200, toCx=600, colW=200, bboxW=152)
    //   source col:        cx in (122, 278)
    //   target col:        cx in (522, 678)
    //   source adjacent:   |cx-200| in (124, 276) → cx in (-76, 76) ∪ (324, 476)
    //   target adjacent:   |cx-600| in (124, 276) → cx in (324, 476) ∪ (724, 876)
    //   middle-row Z(X):   cx in (201, 599)
    // cx=100: 隣接列バンド外 (76 < 100 < 122)、source 列外、middle-row Z 範囲外
    // cx=700: 隣接列バンド外 (678 < 700 < 724)、target 列外、middle-row Z 範囲外
    const nodes: ObstacleNode[] = [
      { key: 'A', cx: 200, cy: 100 },
      { key: 'B', cx: 100, cy: 250 },
      { key: 'D', cx: 700, cy: 250 },
      { key: 'C', cx: 600, cy: 400 },
    ]
    const r = collectDiagonalObstacles({ nodes, ...baseArgs })
    expect(r).toEqual([])
  })

  it('should collect source-adjacent-column obstacle within extended Y range', () => {
    const nodes: ObstacleNode[] = [
      { key: 'A', cx: 200, cy: 100 },
      { key: 'B', cx: 400, cy: 100 },
      { key: 'C', cx: 600, cy: 400 },
    ]
    const r = collectDiagonalObstacles({ nodes, ...baseArgs })
    expect(r).toContainEqual({ x: 400, y: 100, w: 152, h: 56 })
  })

  it('should collect target-adjacent-column obstacle for direction decision', () => {
    const nodes: ObstacleNode[] = [
      { key: 'A', cx: 200, cy: 100 },
      { key: 'B', cx: 800, cy: 400 },
      { key: 'C', cx: 600, cy: 400 },
    ]
    const r = collectDiagonalObstacles({ nodes, ...baseArgs })
    expect(r).toContainEqual({ x: 800, y: 400, w: 152, h: 56 })
  })

  it('should not collect adjacent-column nodes outside extended Y range', () => {
    const nodes: ObstacleNode[] = [
      { key: 'A', cx: 200, cy: 100 },
      { key: 'B', cx: 400, cy: 800 },
      { key: 'C', cx: 600, cy: 400 },
    ]
    const r = collectDiagonalObstacles({ nodes, ...baseArgs })
    expect(r).toEqual([])
  })

  it('should return empty array when nodes is empty', () => {
    const r = collectDiagonalObstacles({ nodes: [], ...baseArgs })
    expect(r).toEqual([])
  })

  it('should collect multiple obstacles matching different rules simultaneously', () => {
    const nodes: ObstacleNode[] = [
      { key: 'A', cx: 200, cy: 100 },
      { key: 'C', cx: 600, cy: 400 },
      { key: 'Bs', cx: 200, cy: 250 }, // source 列 ストリップ
      { key: 'Bm', cx: 400, cy: 250 }, // 中央行 ストリップ
      { key: 'Bt', cx: 600, cy: 250 }, // target 列 ストリップ
    ]
    const r = collectDiagonalObstacles({ nodes, ...baseArgs })
    expect(r).toHaveLength(3)
    expect(r).toContainEqual({ x: 200, y: 250, w: 152, h: 56 })
    expect(r).toContainEqual({ x: 400, y: 250, w: 152, h: 56 })
    expect(r).toContainEqual({ x: 600, y: 250, w: 152, h: 56 })
  })
})

describe('detectDiagonalDetour', () => {
  const s = { x: 200, y: 128 }
  const e = { x: 600, y: 372 }

  it('should return null when arrow is horizontal (|dy| < 2)', () => {
    const r = detectDiagonalDetour({ x: 200, y: 200 }, { x: 600, y: 201 }, [
      { x: 400, y: 200, w: 152, h: 56 },
    ])
    expect(r).toBeNull()
  })

  it('should return null when arrow is vertical (|dx| < 2)', () => {
    const r = detectDiagonalDetour({ x: 200, y: 100 }, { x: 201, y: 400 }, [
      { x: 200, y: 250, w: 152, h: 56 },
    ])
    expect(r).toBeNull()
  })

  it('should return null with empty obstacles array', () => {
    expect(detectDiagonalDetour(s, e, [])).toBeNull()
  })

  it('should return null when no obstacles intersect Z-path', () => {
    const farAway: Bbox = { x: 50, y: 50, w: 152, h: 56 }
    expect(detectDiagonalDetour(s, e, [farAway])).toBeNull()
  })

  it('should return target-detour when obstacle is in target column between my and e.y', () => {
    const B: Bbox = { x: 600, y: 250, w: 152, h: 56 }
    const r = detectDiagonalDetour(s, e, [B])
    expect(r).toEqual({
      kind: 'target-detour',
      my: 250,
      detourX: 600 + 76 + 14, // 690 (右迂回: 障害右端 + DETOUR_MARGIN)
      approachY: 372 - 14, // 358
    })
  })

  it('should return target-detour with left-side detourX when target column is right-blocked', () => {
    const B: Bbox = { x: 600, y: 250, w: 152, h: 56 }
    const R: Bbox = { x: 800, y: 250, w: 152, h: 56 }
    const r = detectDiagonalDetour(s, e, [B, R])
    expect(r).toEqual({
      kind: 'target-detour',
      my: 250,
      detourX: 600 - 76 - 14, // 510 (左迂回)
      approachY: 358,
    })
  })

  it('should prefer right detour when both sides of target column are blocked', () => {
    const B: Bbox = { x: 600, y: 250, w: 152, h: 56 }
    const R: Bbox = { x: 800, y: 250, w: 152, h: 56 }
    const L: Bbox = { x: 400, y: 250, w: 152, h: 56 }
    const r = detectDiagonalDetour(s, e, [B, R, L])
    // L は中央行 (y=my=250) 上にあり target-detour の中央水平セグメント [s.x=200, detourX=690]
    // を貫通するため、my を shiftedMy=292 (#366 修正) にシフトする。direction (right) は detourX で検証。
    expect(r).toEqual({
      kind: 'target-detour',
      my: 292, // 250 + 28 + 14 (障害下端 + DETOUR_MARGIN)
      detourX: 690, // 右優先
      approachY: 358, // clampOffset(372, 292, 14) = 372 - 14 = 358 (偶然 unshift と同値)
    })
  })

  it('should return source-detour when obstacle is in source column between s.y and my', () => {
    const B: Bbox = { x: 200, y: 250, w: 152, h: 56 }
    const r = detectDiagonalDetour(s, e, [B])
    expect(r).toEqual({
      kind: 'source-detour',
      departY: 128 + 14, // 142
      detourX: 200 + 76 + 14, // 290 (右優先)
      my: 250,
    })
  })

  it('should return shift-my when only middle horizontal segment is blocked', () => {
    const B: Bbox = { x: 400, y: 250, w: 152, h: 56 }
    const r = detectDiagonalDetour(s, e, [B])
    expect(r).toEqual({
      kind: 'shift-my',
      my: 250 + 28 + 14, // 292 (下優先: 障害下端 + DETOUR_MARGIN)
    })
  })

  it('should escalate to source-detour when shift-my exceeds row bounds and right detour is chosen', () => {
    // 中間行に障害 + 行間隔が狭く shift-my の range check が失敗するケース。
    // 右迂回時は target-detour の中央水平セグメント [s.x, detourX] が障害を横断するため、
    // 短い中央水平 [detourX, e.x] を持つ source-detour に escalate する必要がある (#359)。
    const sNarrow = { x: 200, y: 128 }
    const eNarrow = { x: 600, y: 172 }
    const B: Bbox = { x: 400, y: 150, w: 152, h: 56 }
    const r = detectDiagonalDetour(sNarrow, eNarrow, [B])
    expect(r).toEqual({
      kind: 'source-detour',
      departY: 139, // clampOffset(128, 150, 14) = 128 + min(14, 11) = 139
      detourX: 490, // 400 + 76 + 14
      my: 150,
    })
  })

  it('should escalate to target-detour when shift-my exceeds row bounds and left detour is chosen', () => {
    // 中間行障害の右側に blocker があり pickDetourX が左迂回を選ぶケース。
    // 左迂回時は target-detour の中央水平 [s.x, detourX] が障害の左側のみを通るため衝突なし (#359)。
    const sNarrow = { x: 200, y: 128 }
    const eNarrow = { x: 600, y: 172 }
    const B: Bbox = { x: 400, y: 150, w: 152, h: 56 }
    // 障害の右側に位置するが source 列・target 列・中間行いずれでもない blocker。
    // pickDetourX の rightBlocked 判定にだけ寄与する。
    const rightBlocker: Bbox = { x: 450, y: 100, w: 152, h: 56 }
    const r = detectDiagonalDetour(sNarrow, eNarrow, [B, rightBlocker])
    expect(r).toEqual({
      kind: 'target-detour',
      my: 150,
      detourX: 310, // 400 - 76 - 14
      approachY: 161, // clampOffset(172, 150, 14) = 172 - min(14, 11) = 161
    })
  })

  it('should escalate to target-detour for right-to-left diagonal with right detour', () => {
    // 右→左対角線 (s.x > e.x) でも幾何ベースで正しく kind を選べることを検証 (#359)。
    // 右迂回 (detourX > 障害) のとき source-detour 中央水平 [detourX, e.x] は障害を横断するため
    // target-detour を選ぶ。
    const sRTL = { x: 600, y: 128 }
    const eRTL = { x: 200, y: 172 }
    const B: Bbox = { x: 400, y: 150, w: 152, h: 56 }
    const r = detectDiagonalDetour(sRTL, eRTL, [B])
    expect(r).toEqual({
      kind: 'target-detour',
      my: 150,
      detourX: 490, // 400 + 76 + 14 (右迂回 default)
      approachY: 161, // clampOffset(172, 150, 14)
    })
  })

  it('should escalate to source-detour for right-to-left diagonal with left detour', () => {
    // 右→左対角線で左迂回。左迂回時は target-detour 中央水平 [s.x, detourX]=[600, 310] が障害を
    // 横断するため source-detour を選ぶ (#359)。
    const sRTL = { x: 600, y: 128 }
    const eRTL = { x: 200, y: 172 }
    const B: Bbox = { x: 400, y: 150, w: 152, h: 56 }
    // 障害の右に blocker → pickDetourX 左迂回
    const rightBlocker: Bbox = { x: 450, y: 100, w: 152, h: 56 }
    const r = detectDiagonalDetour(sRTL, eRTL, [B, rightBlocker])
    expect(r).toEqual({
      kind: 'source-detour',
      departY: 139, // clampOffset(128, 150, 14)
      detourX: 310, // 400 - 76 - 14
      my: 150,
    })
  })

  it('should return both-detour when source and target columns both have obstacles', () => {
    const Bs: Bbox = { x: 200, y: 250, w: 152, h: 56 }
    const Bt: Bbox = { x: 600, y: 250, w: 152, h: 56 }
    const r = detectDiagonalDetour(s, e, [Bs, Bt])
    expect(r).toEqual({
      kind: 'both-detour',
      departY: 142,
      sourceDetourX: 290,
      my: 250,
      targetDetourX: 690,
      approachY: 358,
    })
  })

  it('should shift my when source-detour selected AND middle-row obstacle exists', () => {
    // s=(100, 100), e=(300, 300), my=200
    // source col hit at (100, 200) → source-detour 確定
    // middle row hit at (200, 200) → my を shiftedMy にシフトすべき
    const obstacles: Bbox[] = [
      { x: 100, y: 200, w: 80, h: 50 }, // source col & middle row
      { x: 200, y: 200, w: 80, h: 50 }, // middle row のみ (target col=300 ではない)
    ]
    const r = detectDiagonalDetour({ x: 100, y: 100 }, { x: 300, y: 300 }, obstacles)
    expect(r?.kind).toBe('source-detour')
    // 障害下端 (200 + 25) + DETOUR_MARGIN (14) = 239
    if (r?.kind === 'source-detour') {
      expect(r.my).toBe(239) // shifted: 200 (障害中心) + 25 (h/2) + 14 (DETOUR_MARGIN)
      expect(r.departY).toBe(114) // clampOffset(100, 239, 14) = 100 + 14 (shiftedMy ベース)
    }
  })

  it('should shift my when target-detour selected AND middle-row obstacle exists', () => {
    // s=(100, 100), e=(300, 300), my=200
    // target col hit at (300, 200) → target-detour 確定
    // middle row hit at (200, 200)
    const obstacles: Bbox[] = [
      { x: 300, y: 200, w: 80, h: 50 }, // target col & middle row
      { x: 200, y: 200, w: 80, h: 50 }, // middle row のみ
    ]
    const r = detectDiagonalDetour({ x: 100, y: 100 }, { x: 300, y: 300 }, obstacles)
    expect(r?.kind).toBe('target-detour')
    if (r?.kind === 'target-detour') {
      expect(r.my).toBe(239) // shifted: 200 (障害中心) + 25 (h/2) + 14 (DETOUR_MARGIN)
      expect(r.approachY).toBe(286) // clampOffset(300, 239, 14) = 300 - 14 (shiftedMy ベース)
    }
  })

  it('should shift my when both-detour selected AND middle-row obstacle exists', () => {
    // s=(100, 100), e=(300, 300), my=200
    // 両列 hit + 中央行 hit
    const obstacles: Bbox[] = [
      { x: 100, y: 200, w: 80, h: 50 }, // source col & middle row
      { x: 300, y: 200, w: 80, h: 50 }, // target col & middle row
      { x: 200, y: 200, w: 80, h: 50 }, // 中央のみ
    ]
    const r = detectDiagonalDetour({ x: 100, y: 100 }, { x: 300, y: 300 }, obstacles)
    expect(r?.kind).toBe('both-detour')
    if (r?.kind === 'both-detour') {
      expect(r.my).toBe(239) // shifted: 200 (障害中心) + 25 (h/2) + 14 (DETOUR_MARGIN)
      expect(r.departY).toBe(114) // clampOffset(100, 239, 14)
      expect(r.approachY).toBe(286) // clampOffset(300, 239, 14)
    }
  })

  it('should avoid middle-row obstacle in issue #366 reproduction case', () => {
    // issue #366: 菱形 (fromSide:"bottom") + 3点同時障害
    // source 店舗/ステータス変更 (col0=100, row0=100)
    // target グルプラ(2)/請求 (col2=300, row2=300)
    // 障害①: 店舗/確認連絡(9) (col0=100, row1=200) — source 列・中央行
    // 障害②: グルプラ/確認連絡(8) (col1=200, row1=200) — 中央行
    // 障害③: グルプラ/請求 (col1=200, row2=300) — target 隣接列・target 行
    const obstacles: Bbox[] = [
      { x: 100, y: 200, w: 80, h: 50 },
      { x: 200, y: 200, w: 80, h: 50 },
      { x: 200, y: 300, w: 80, h: 50 },
    ]
    const r = detectDiagonalDetour({ x: 100, y: 100 }, { x: 300, y: 300 }, obstacles)
    // source col に障害①、target col に障害無し、中央行に障害② → source-detour + shifted my
    expect(r?.kind).toBe('source-detour')
    if (r?.kind === 'source-detour') {
      // middle horizontal が y=200 (row1) を回避: 200 + 25 (h/2) + 14 (DETOUR_MARGIN) = 239
      expect(r.my).toBe(239)
    }
  })

  it('should fall back to original my when shiftedMy exceeds row bounds', () => {
    // 行間隔が狭く shiftedMy が source 行 / target 行を侵食するケース
    // s=(100, 100), e=(300, 160), my=130 — 行差 60 で狭い
    // 中央行に大きな障害があると shiftedMy が範囲外になる
    const obstacles: Bbox[] = [
      { x: 100, y: 130, w: 80, h: 50 }, // source col & middle row
      { x: 200, y: 130, w: 80, h: 50 }, // 中央のみ — 下端 155, +14 = 169 > yHigh-25-1 = 134
    ]
    const r = detectDiagonalDetour({ x: 100, y: 100 }, { x: 300, y: 160 }, obstacles)
    // range-check 失敗 → 従来の my (=130) で source-detour
    expect(r?.kind).toBe('source-detour')
    if (r?.kind === 'source-detour') {
      expect(r.my).toBe(130) // unshifted
    }
  })
})

describe('deriveFromSide', () => {
  const c = { x: 100, y: 100 }

  it('右側にドラッグ起点 → right', () => {
    expect(deriveFromSide({ x: 134, y: 100 }, c)).toBe('right')
  })

  it('左側にドラッグ起点 → left', () => {
    expect(deriveFromSide({ x: 66, y: 100 }, c)).toBe('left')
  })

  it('下側にドラッグ起点 → bottom', () => {
    expect(deriveFromSide({ x: 100, y: 134 }, c)).toBe('bottom')
  })

  it('上側にドラッグ起点 → top', () => {
    expect(deriveFromSide({ x: 100, y: 66 }, c)).toBe('top')
  })

  it('右下斜め（横優位）→ right', () => {
    expect(deriveFromSide({ x: 130, y: 110 }, c)).toBe('right')
  })

  it('右下斜め（縦優位）→ bottom', () => {
    expect(deriveFromSide({ x: 110, y: 130 }, c)).toBe('bottom')
  })

  it('中心と一致（dx=dy=0）→ bottom フォールバック', () => {
    expect(deriveFromSide(c, c)).toBe('bottom')
  })
})

describe('exitPt with explicit fromSide (diamond)', () => {
  const c = { x: 200, y: 200 }
  const o = { x: 500, y: 500 } // ターゲット（自動ロジックなら dx>0 で 'right' になる位置）
  const hw = 76
  const hh = 28
  const rh = 84

  it('fromSide=top → 上頂点', () => {
    expect(exitPt(c, o, hw, hh, rh, 'diamond', 'top')).toEqual({ x: 200, y: 200 - DS })
  })

  it('fromSide=right → 右頂点', () => {
    expect(exitPt(c, o, hw, hh, rh, 'diamond', 'right')).toEqual({ x: 200 + DS, y: 200 })
  })

  it('fromSide=bottom → 下頂点（dxに関係なく）', () => {
    expect(exitPt(c, o, hw, hh, rh, 'diamond', 'bottom')).toEqual({ x: 200, y: 200 + DS })
  })

  it('fromSide=left → 左頂点', () => {
    expect(exitPt(c, o, hw, hh, rh, 'diamond', 'left')).toEqual({ x: 200 - DS, y: 200 })
  })

  it('fromSide 未指定 → 既存の自動ロジック（後方互換）', () => {
    // dx>0, dy>0 → right
    expect(exitPt(c, o, hw, hh, rh, 'diamond')).toEqual({ x: 200 + DS, y: 200 })
  })

  it('shape が diamond でない四角形ノードでも fromSide=top を honor する', () => {
    // #355: 四角形ノードでも fromSide があれば優先（上辺中央）
    const result = exitPt(c, o, hw, hh, rh, undefined, 'top' as ArrowSide)
    expect(result).toEqual({ x: 200, y: 200 - hh })
  })
})

describe('exitPt 四角形ノードの fromSide honor (#355)', () => {
  const c = { x: 100, y: 100 }
  const o = { x: 200, y: 100 } // dx>0 で自動ロジックなら 'right'
  const hw = 50
  const hh = 25
  const rh = 84

  it('四角形 + fromSide=top → 上辺中央', () => {
    expect(exitPt(c, o, hw, hh, rh, undefined, 'top')).toEqual({ x: 100, y: 75 })
  })

  it('四角形 + fromSide=right → 右辺中央', () => {
    expect(exitPt(c, o, hw, hh, rh, undefined, 'right')).toEqual({ x: 150, y: 100 })
  })

  it('四角形 + fromSide=bottom → 下辺中央', () => {
    expect(exitPt(c, o, hw, hh, rh, undefined, 'bottom')).toEqual({ x: 100, y: 125 })
  })

  it('四角形 + fromSide=left → 左辺中央', () => {
    expect(exitPt(c, o, hw, hh, rh, undefined, 'left')).toEqual({ x: 50, y: 100 })
  })

  it('四角形 + fromSide=undefined → 既存の auto ロジック（後方互換）', () => {
    // dx>0, dy=0 → 水平方向 → 右辺
    expect(exitPt(c, o, hw, hh, rh, undefined, undefined)).toEqual({ x: 150, y: 100 })
  })
})

describe('entryPt with explicit toSide (#355)', () => {
  const c = { x: 100, y: 100 }
  const o = { x: 200, y: 100 }
  const hw = 50
  const hh = 25
  const rh = 84

  it('四角形 + toSide=top → 上辺中央', () => {
    expect(entryPt(c, o, hw, hh, rh, undefined, 'top')).toEqual({ x: 100, y: 75 })
  })

  it('四角形 + toSide=right → 右辺中央', () => {
    expect(entryPt(c, o, hw, hh, rh, undefined, 'right')).toEqual({ x: 150, y: 100 })
  })

  it('四角形 + toSide=bottom → 下辺中央', () => {
    expect(entryPt(c, o, hw, hh, rh, undefined, 'bottom')).toEqual({ x: 100, y: 125 })
  })

  it('四角形 + toSide=left → 左辺中央', () => {
    expect(entryPt(c, o, hw, hh, rh, undefined, 'left')).toEqual({ x: 50, y: 100 })
  })

  it('diamond + toSide=top → 上頂点 (DS)', () => {
    expect(entryPt(c, o, hw, hh, rh, 'diamond', 'top')).toEqual({ x: 100, y: 100 - DS })
  })

  it('diamond + toSide=right → 右頂点 (DS)', () => {
    expect(entryPt(c, o, hw, hh, rh, 'diamond', 'right')).toEqual({ x: 100 + DS, y: 100 })
  })

  it('diamond + toSide=bottom → 下頂点 (DS)', () => {
    expect(entryPt(c, o, hw, hh, rh, 'diamond', 'bottom')).toEqual({ x: 100, y: 100 + DS })
  })

  it('diamond + toSide=left → 左頂点 (DS)', () => {
    expect(entryPt(c, o, hw, hh, rh, 'diamond', 'left')).toEqual({ x: 100 - DS, y: 100 })
  })

  it('toSide=undefined → 既存 auto ロジック（後方互換）', () => {
    // o.x > c.x, dy=0 → 水平方向 → 右辺
    expect(entryPt(c, o, hw, hh, rh, undefined, undefined)).toEqual({ x: 150, y: 100 })
  })
})

describe('deriveToSide (#355)', () => {
  const c = { x: 100, y: 100 }

  it('deriveFromSide と同一ロジック', () => {
    const point = { x: 110, y: 90 }
    expect(deriveToSide(point, c)).toBe(deriveFromSide(point, c))
  })

  it('右にドロップ → "right"', () => {
    expect(deriveToSide({ x: 140, y: 100 }, c)).toBe('right')
  })

  it('上にドロップ → "top"', () => {
    expect(deriveToSide({ x: 100, y: 60 }, c)).toBe('top')
  })

  it('下にドロップ → "bottom"', () => {
    expect(deriveToSide({ x: 100, y: 140 }, c)).toBe('bottom')
  })

  it('左にドロップ → "left"', () => {
    expect(deriveToSide({ x: 60, y: 100 }, c)).toBe('left')
  })
})

describe('buildArrowPath - L字パスのラベル座標 (#358)', () => {
  describe('L字 縦→横 (sV && !eV)', () => {
    it('縦辺が長い場合、縦辺の中点を返す', () => {
      const s = { x: 100, y: 100 }
      const e = { x: 200, y: 400 }
      const fc = { x: 100, y: 80 } // sV: |20| > |0|
      const tc = { x: 180, y: 400 } // eV: |0| < |20|
      const r = buildArrowPath(s, e, fc, tc)
      expect(r.d).toBe('M100,100 L100,400 L200,400')
      expect(r.mx).toBe(100) // s.x
      expect(r.my).toBe(250) // (s.y+e.y)/2
    })

    it('横辺が長い場合、横辺の中点を返す', () => {
      const s = { x: 100, y: 100 }
      const e = { x: 500, y: 200 }
      const fc = { x: 100, y: 80 }
      const tc = { x: 480, y: 200 }
      const r = buildArrowPath(s, e, fc, tc)
      expect(r.d).toBe('M100,100 L100,200 L500,200')
      expect(r.mx).toBe(300) // (s.x+e.x)/2
      expect(r.my).toBe(200) // e.y
    })

    it('等長の場合、縦辺優先（>=）', () => {
      const s = { x: 100, y: 100 }
      const e = { x: 300, y: 300 }
      const fc = { x: 100, y: 80 }
      const tc = { x: 280, y: 300 }
      const r = buildArrowPath(s, e, fc, tc)
      expect(r.d).toBe('M100,100 L100,300 L300,300')
      expect(r.mx).toBe(100)
      expect(r.my).toBe(200)
    })
  })

  describe('L字 横→縦 (!sV && eV)', () => {
    it('横辺が長い場合、横辺の中点を返す', () => {
      const s = { x: 100, y: 100 }
      const e = { x: 500, y: 300 }
      const fc = { x: 80, y: 100 } // sV: |0| < |20|
      const tc = { x: 500, y: 280 } // eV: |20| > |0|
      const r = buildArrowPath(s, e, fc, tc)
      expect(r.d).toBe('M100,100 L500,100 L500,300')
      expect(r.mx).toBe(300) // (s.x+e.x)/2
      expect(r.my).toBe(100) // s.y
    })

    it('縦辺が長い場合、縦辺の中点を返す', () => {
      const s = { x: 100, y: 100 }
      const e = { x: 200, y: 500 }
      const fc = { x: 80, y: 100 }
      const tc = { x: 200, y: 480 }
      const r = buildArrowPath(s, e, fc, tc)
      expect(r.d).toBe('M100,100 L200,100 L200,500')
      expect(r.mx).toBe(200) // e.x
      expect(r.my).toBe(300) // (s.y+e.y)/2
    })

    it('等長の場合、横辺優先（>=）', () => {
      const s = { x: 100, y: 100 }
      const e = { x: 300, y: 300 }
      const fc = { x: 80, y: 100 }
      const tc = { x: 300, y: 280 }
      const r = buildArrowPath(s, e, fc, tc)
      expect(r.d).toBe('M100,100 L300,100 L300,300')
      expect(r.mx).toBe(200)
      expect(r.my).toBe(100)
    })
  })

  describe('リグレッションガード', () => {
    it('Z字 縦→縦: mx, my は既存の対角線中点を維持', () => {
      const s = { x: 100, y: 100 }
      const e = { x: 300, y: 400 }
      const fc = { x: 100, y: 80 }
      const tc = { x: 300, y: 380 }
      const r = buildArrowPath(s, e, fc, tc)
      expect(r.mx).toBe(200) // (s.x+e.x)/2
      expect(r.my).toBe(250) // (s.y+e.y)/2
    })

    it('Z字 横→横: mx, my は既存の対角線中点を維持', () => {
      const s = { x: 100, y: 100 }
      const e = { x: 400, y: 300 }
      const fc = { x: 80, y: 100 }
      const tc = { x: 420, y: 300 }
      const r = buildArrowPath(s, e, fc, tc)
      expect(r.mx).toBe(250)
      expect(r.my).toBe(200)
    })

    it('直線パス: mx, my は線分中点', () => {
      const s = { x: 100, y: 200 }
      const e = { x: 400, y: 200 }
      const fc = { x: 80, y: 200 }
      const tc = { x: 420, y: 200 }
      const r = buildArrowPath(s, e, fc, tc)
      expect(r.d).toBe('M100,200 L400,200')
      expect(r.mx).toBe(250)
      expect(r.my).toBe(200)
    })
  })
})

describe('segmentsToBboxes', () => {
  it('converts horizontal segment to thin Bbox with h=1', () => {
    const segs: EdgeSegment[] = [{ orientation: 'h', fixed: 100, range: [50, 200] }]
    expect(segmentsToBboxes(segs)).toEqual([{ x: 125, y: 100, w: 150, h: 1 }])
  })

  it('converts vertical segment to thin Bbox with w=1', () => {
    const segs: EdgeSegment[] = [{ orientation: 'v', fixed: 100, range: [50, 200] }]
    expect(segmentsToBboxes(segs)).toEqual([{ x: 100, y: 125, w: 1, h: 150 }])
  })

  it('handles negative range (max < min) by taking absolute width', () => {
    const segs: EdgeSegment[] = [{ orientation: 'h', fixed: 100, range: [200, 50] }]
    expect(segmentsToBboxes(segs)).toEqual([{ x: 125, y: 100, w: 150, h: 1 }])
  })

  it('converts empty array to empty array', () => {
    expect(segmentsToBboxes([])).toEqual([])
  })

  it('converts multiple mixed orientations', () => {
    const segs: EdgeSegment[] = [
      { orientation: 'h', fixed: 0, range: [0, 100] },
      { orientation: 'v', fixed: 100, range: [0, 50] },
    ]
    expect(segmentsToBboxes(segs)).toEqual([
      { x: 50, y: 0, w: 100, h: 1 },
      { x: 100, y: 25, w: 1, h: 50 },
    ])
  })

  it('handles zero-length horizontal segment (range[0] === range[1]) as degenerate {w:0, h:1}', () => {
    const segs: EdgeSegment[] = [{ orientation: 'h', fixed: 100, range: [50, 50] }]
    expect(segmentsToBboxes(segs)).toEqual([{ x: 50, y: 100, w: 0, h: 1 }])
  })

  it('handles zero-length vertical segment (range[0] === range[1]) as degenerate {w:1, h:0}', () => {
    const segs: EdgeSegment[] = [{ orientation: 'v', fixed: 100, range: [50, 50] }]
    expect(segmentsToBboxes(segs)).toEqual([{ x: 100, y: 50, w: 1, h: 0 }])
  })
})

describe('buildArrowPath segments — straight & L-shape', () => {
  it('straight horizontal: 1 horizontal segment', () => {
    const result = buildArrowPath(
      { x: 0, y: 100 },
      { x: 200, y: 100 },
      { x: 0, y: 100 },
      { x: 200, y: 100 },
    )
    expect(result.segments).toEqual([{ orientation: 'h', fixed: 100, range: [0, 200] }])
  })

  it('straight vertical: 1 vertical segment', () => {
    const result = buildArrowPath(
      { x: 100, y: 0 },
      { x: 100, y: 200 },
      { x: 100, y: 0 },
      { x: 100, y: 200 },
    )
    expect(result.segments).toEqual([{ orientation: 'v', fixed: 100, range: [0, 200] }])
  })

  it('L-shape (vertical exit → horizontal entry): vertical then horizontal', () => {
    const result = buildArrowPath(
      { x: 100, y: 50 },
      { x: 250, y: 200 },
      { x: 100, y: 0 },
      { x: 300, y: 200 },
    )
    expect(result.segments).toEqual([
      { orientation: 'v', fixed: 100, range: [50, 200] },
      { orientation: 'h', fixed: 200, range: [100, 250] },
    ])
  })

  it('L-shape (horizontal exit → vertical entry): horizontal then vertical', () => {
    const result = buildArrowPath(
      { x: 50, y: 100 },
      { x: 200, y: 250 },
      { x: 0, y: 100 },
      { x: 200, y: 300 },
    )
    expect(result.segments).toEqual([
      { orientation: 'h', fixed: 100, range: [50, 200] },
      { orientation: 'v', fixed: 200, range: [100, 250] },
    ])
  })
})

describe('buildArrowPath segments — Z-shape', () => {
  it('Z-shape (both vertical exits): vert, horiz, vert', () => {
    const result = buildArrowPath(
      { x: 100, y: 50 },
      { x: 300, y: 250 },
      { x: 100, y: 0 },
      { x: 300, y: 300 },
    )
    expect(result.segments).toEqual([
      { orientation: 'v', fixed: 100, range: [50, 150] },
      { orientation: 'h', fixed: 150, range: [100, 300] },
      { orientation: 'v', fixed: 300, range: [150, 250] },
    ])
  })

  it('Z-shape (both horizontal exits): horiz, vert, horiz', () => {
    const result = buildArrowPath(
      { x: 50, y: 100 },
      { x: 250, y: 300 },
      { x: 0, y: 100 },
      { x: 300, y: 300 },
    )
    expect(result.segments).toEqual([
      { orientation: 'h', fixed: 100, range: [50, 150] },
      { orientation: 'v', fixed: 150, range: [100, 300] },
      { orientation: 'h', fixed: 300, range: [150, 250] },
    ])
  })
})

describe('buildArrowPath segments — horizontal/vertical detour', () => {
  it('horizontal detour: 5 segments alternating h/v/h/v/h', () => {
    const obstacles: Bbox[] = [{ x: 150, y: 100, w: 40, h: 40 }]
    const result = buildArrowPath(
      { x: 50, y: 100 },
      { x: 250, y: 100 },
      { x: 50, y: 100 },
      { x: 250, y: 100 },
      obstacles,
    )
    expect(result.segments).toHaveLength(5)
    expect(result.segments[0].orientation).toBe('h')
    expect(result.segments[1].orientation).toBe('v')
    expect(result.segments[2].orientation).toBe('h')
    expect(result.segments[3].orientation).toBe('v')
    expect(result.segments[4].orientation).toBe('h')
    expect(result.segments[2].fixed).toBe(134) // detourY = 100 + 20 + 14
  })

  it('vertical detour: 5 segments alternating v/h/v/h/v', () => {
    const obstacles: Bbox[] = [{ x: 100, y: 150, w: 40, h: 40 }]
    const result = buildArrowPath(
      { x: 100, y: 50 },
      { x: 100, y: 250 },
      { x: 100, y: 50 },
      { x: 100, y: 250 },
      obstacles,
    )
    expect(result.segments).toHaveLength(5)
    expect(result.segments[0].orientation).toBe('v')
    expect(result.segments[1].orientation).toBe('h')
    expect(result.segments[2].orientation).toBe('v')
    expect(result.segments[3].orientation).toBe('h')
    expect(result.segments[4].orientation).toBe('v')
  })
})

describe('buildArrowPath segments — diagonal detour (4 kinds)', () => {
  // 共通の s/e は detectDiagonalDetour テストブロックと合わせる
  const s = { x: 200, y: 128 }
  const e = { x: 600, y: 372 }
  const fc = { x: 200, y: 128 }
  const tc = { x: 600, y: 372 }

  it('shift-my: v, h, v (3 segments)', () => {
    const obstacles: Bbox[] = [{ x: 400, y: 250, w: 152, h: 56 }]
    const result = buildArrowPath(s, e, fc, tc, obstacles)
    expect(result.segments).toHaveLength(3)
    expect(result.segments.map((sg) => sg.orientation)).toEqual(['v', 'h', 'v'])
  })

  it('target-detour: v, h, v, h, v (5 segments)', () => {
    const obstacles: Bbox[] = [{ x: 600, y: 250, w: 152, h: 56 }]
    const result = buildArrowPath(s, e, fc, tc, obstacles)
    expect(result.segments).toHaveLength(5)
    expect(result.segments.map((sg) => sg.orientation)).toEqual(['v', 'h', 'v', 'h', 'v'])
  })

  it('source-detour: v, h, v, h, v (5 segments)', () => {
    const obstacles: Bbox[] = [{ x: 200, y: 250, w: 152, h: 56 }]
    const result = buildArrowPath(s, e, fc, tc, obstacles)
    expect(result.segments).toHaveLength(5)
    expect(result.segments.map((sg) => sg.orientation)).toEqual(['v', 'h', 'v', 'h', 'v'])
  })

  it('both-detour: v, h, v, h, v, h, v (7 segments)', () => {
    const obstacles: Bbox[] = [
      { x: 200, y: 250, w: 152, h: 56 },
      { x: 600, y: 250, w: 152, h: 56 },
    ]
    const result = buildArrowPath(s, e, fc, tc, obstacles)
    expect(result.segments).toHaveLength(7)
    expect(result.segments.map((sg) => sg.orientation)).toEqual(['v', 'h', 'v', 'h', 'v', 'h', 'v'])
  })
})

describe('buildArrowPath segments 構造（リファクタ安全網）', () => {
  it('水平直線: segments は単一 H', () => {
    const s = { x: 100, y: 200 }, e = { x: 300, y: 200 }
    const fc = { x: 50, y: 200 }, tc = { x: 350, y: 200 }
    const r = buildArrowPath(s, e, fc, tc)
    expect(r.segments).toEqual([
      { orientation: 'h', fixed: 200, range: [100, 300] },
    ])
  })

  it('垂直直線: segments は単一 V', () => {
    const s = { x: 200, y: 100 }, e = { x: 200, y: 300 }
    const fc = { x: 200, y: 50 }, tc = { x: 200, y: 350 }
    const r = buildArrowPath(s, e, fc, tc)
    expect(r.segments).toEqual([
      { orientation: 'v', fixed: 200, range: [100, 300] },
    ])
  })

  it('H 迂回（下迂回）: segments は H-V-H-V-H の 5 セグ', () => {
    // 障害 B: x=400, w=152 → 中央x=476, 右端=476。detourY 計算:
    //   障害 y=200, h=56 → 中央y=228。障害が下塞がり → detourY = 228+DETOUR_MARGIN(14) = 242
    //   s.x=276, departX = 276+DEPART_GAP(14) = 290
    //   e.x=524, approachX = 524-APPROACH_GAP(14) = 510
    const s = { x: 276, y: 200 }, e = { x: 524, y: 200 }
    const fc = { x: 200, y: 200 }, tc = { x: 600, y: 200 }
    const B: Bbox = { x: 400, y: 200, w: 152, h: 56 }
    const r = buildArrowPath(s, e, fc, tc, [B])
    expect(r.segments).toEqual([
      { orientation: 'h', fixed: 200, range: [276, 290] },    // s.x → departX
      { orientation: 'v', fixed: 290, range: [200, 242] },    // s.y → detourY
      { orientation: 'h', fixed: 242, range: [290, 510] },    // departX → approachX
      { orientation: 'v', fixed: 510, range: [242, 200] },    // detourY → e.y (下→上)
      { orientation: 'h', fixed: 200, range: [510, 524] },    // approachX → e.x
    ])
  })

  it('V 迂回（右迂回）: segments は V-H-V-H-V の 5 セグ', () => {
    // 障害 B: x=200, w=152 → 中央x=276。障害が右塞がり → detourX = 276+DETOUR_MARGIN(14) = 290
    //   s.y=276, departY = 276+DEPART_GAP(14) = 290
    //   e.y=524, approachY = 524-APPROACH_GAP(14) = 510
    const s = { x: 200, y: 276 }, e = { x: 200, y: 524 }
    const fc = { x: 200, y: 200 }, tc = { x: 200, y: 600 }
    const B: Bbox = { x: 200, y: 400, w: 152, h: 56 }
    const r = buildArrowPath(s, e, fc, tc, [B])
    expect(r.segments).toEqual([
      { orientation: 'v', fixed: 200, range: [276, 290] },    // s.y → departY
      { orientation: 'h', fixed: 290, range: [200, 290] },    // s.x → detourX
      { orientation: 'v', fixed: 290, range: [290, 510] },    // departY → approachY
      { orientation: 'h', fixed: 510, range: [290, 200] },    // detourX → e.x (右→左)
      { orientation: 'v', fixed: 200, range: [510, 524] },    // approachY → e.y
    ])
  })

  it('斜め配置（障害なし）: segments は H-V-H の 3 セグ', () => {
    const s = { x: 200, y: 100 }, e = { x: 400, y: 300 }
    const fc = { x: 200, y: 100 }, tc = { x: 400, y: 300 }
    const r = buildArrowPath(s, e, fc, tc)
    expect(r.segments).toEqual([
      { orientation: 'h', fixed: 100, range: [200, 300] },
      { orientation: 'v', fixed: 300, range: [100, 300] },
      { orientation: 'h', fixed: 300, range: [300, 400] },
    ])
  })

})

describe('segmentsToD', () => {
  it('空配列 → 空文字列', () => {
    expect(segmentsToD([])).toBe('')
  })

  it('水平直線 1 セグ（range[0] < range[1]）', () => {
    const segs: EdgeSegment[] = [
      { orientation: 'h', fixed: 200, range: [100, 300] },
    ]
    expect(segmentsToD(segs)).toBe('M100,200 L300,200')
  })

  it('水平直線 1 セグ（range[0] > range[1]、逆方向）', () => {
    const segs: EdgeSegment[] = [
      { orientation: 'h', fixed: 200, range: [300, 100] },
    ]
    expect(segmentsToD(segs)).toBe('M300,200 L100,200')
  })

  it('垂直直線 1 セグ', () => {
    const segs: EdgeSegment[] = [
      { orientation: 'v', fixed: 200, range: [100, 300] },
    ]
    expect(segmentsToD(segs)).toBe('M200,100 L200,300')
  })

  it('Z字 3セグ', () => {
    const segs: EdgeSegment[] = [
      { orientation: 'v', fixed: 200, range: [100, 200] },
      { orientation: 'h', fixed: 200, range: [200, 400] },
      { orientation: 'v', fixed: 400, range: [200, 300] },
    ]
    expect(segmentsToD(segs)).toBe('M200,100 L200,200 L400,200 L400,300')
  })

  it('jumps あり: 単一ジャンプ点（goingRight）', () => {
    const segs: EdgeSegment[] = [
      { orientation: 'h', fixed: 200, range: [100, 300] },
    ]
    const jumps = new Map([[0, [200]]])
    const d = segmentsToD(segs, jumps)
    expect(d).toBe('M100,200 L195,200 A5,5 0 0 1 205,200 L300,200')
  })

  it('jumps あり: 単一ジャンプ点（逆方向 goingRight=false）', () => {
    const segs: EdgeSegment[] = [
      { orientation: 'h', fixed: 200, range: [300, 100] },
    ]
    const jumps = new Map([[0, [200]]])
    const d = segmentsToD(segs, jumps)
    // sweep=0（逆方向でも上膨らみ）
    expect(d).toBe('M300,200 L205,200 A5,5 0 0 0 195,200 L100,200')
  })

  it('jumps あり: 複数ジャンプ点が進行方向順にソートされる', () => {
    const segs: EdgeSegment[] = [
      { orientation: 'h', fixed: 200, range: [100, 400] },
    ]
    // 順序を逆に渡しても、進行方向（左→右）で 150 → 300 の順に処理される
    const jumps = new Map([[0, [300, 150]]])
    const d = segmentsToD(segs, jumps)
    expect(d).toBe('M100,200 L145,200 A5,5 0 0 1 155,200 L295,200 A5,5 0 0 1 305,200 L400,200')
  })

  it('V セグの jumps エントリは無視される', () => {
    const segs: EdgeSegment[] = [
      { orientation: 'h', fixed: 200, range: [0, 200] },
      { orientation: 'v', fixed: 200, range: [200, 400] },
    ]
    // V セグの index=1 に jumps を渡しても V には弧が乗らない（規約）
    const jumps = new Map([[1, [300]]])
    const d = segmentsToD(segs, jumps)
    expect(d).toBe('M0,200 L200,200 L200,400')
  })
})

describe('detectCrossings', () => {
  it('交差なし: 空配列を返す', () => {
    const edges: EdgeWithSegments[] = [
      { id: 'a', segments: [{ orientation: 'h' as const, fixed: 100, range: [0, 200] as [number, number] }] },
      { id: 'b', segments: [{ orientation: 'h' as const, fixed: 200, range: [0, 200] as [number, number] }] },
    ]
    expect(detectCrossings(edges)).toEqual([])
  })

  it('H × V 交差: 1 件検出', () => {
    const edges: EdgeWithSegments[] = [
      { id: 'a', segments: [{ orientation: 'h' as const, fixed: 100, range: [0, 200] as [number, number] }] },
      { id: 'b', segments: [{ orientation: 'v' as const, fixed: 100, range: [0, 200] as [number, number] }] },
    ]
    const result = detectCrossings(edges)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ x: 100, y: 100, jumperEdgeId: 'a', jumperSegmentIndex: 0 })
  })

  it('端点マージン: CROSSING_MARGIN=7 以内の交差は除外', () => {
    // V の fixed=95 は H の終点 100 から 5px (< CROSSING_MARGIN=7) なので除外
    const edges: EdgeWithSegments[] = [
      { id: 'a', segments: [{ orientation: 'h' as const, fixed: 100, range: [0, 100] as [number, number] }] },
      { id: 'b', segments: [{ orientation: 'v' as const, fixed: 95, range: [0, 200] as [number, number] }] },
    ]
    expect(detectCrossings(edges)).toEqual([])
  })

  it('同一エッジ内の自己交差は無視', () => {
    const edges: EdgeWithSegments[] = [
      { id: 'a', segments: [
        { orientation: 'h' as const, fixed: 100, range: [0, 200] as [number, number] },
        { orientation: 'v' as const, fixed: 100, range: [50, 150] as [number, number] },
      ]},
    ]
    expect(detectCrossings(edges)).toEqual([])
  })

  it('相互ジャンプ: A(H+V) と B(H+V) が絡み合う配置で 2 件検出', () => {
    // A: H(y=100, x=[0,200]) + V(x=150, y=[100,300])
    // B: H(y=200, x=[100,300]) + V(x=50, y=[0,200])
    // 交差点:
    //   A の H(y=100) × B の V(x=50): (50, 100) — jumperEdgeId=A
    //   B の H(y=200) × A の V(x=150): (150, 200) — jumperEdgeId=B
    const edges: EdgeWithSegments[] = [
      { id: 'A', segments: [
        { orientation: 'h' as const, fixed: 100, range: [0, 200] as [number, number] },
        { orientation: 'v' as const, fixed: 150, range: [100, 300] as [number, number] },
      ]},
      { id: 'B', segments: [
        { orientation: 'h' as const, fixed: 200, range: [100, 300] as [number, number] },
        { orientation: 'v' as const, fixed: 50, range: [0, 200] as [number, number] },
      ]},
    ]
    const result = detectCrossings(edges)
    expect(result).toHaveLength(2)
    expect(result).toContainEqual({ x: 50, y: 100, jumperEdgeId: 'A', jumperSegmentIndex: 0 })
    expect(result).toContainEqual({ x: 150, y: 200, jumperEdgeId: 'B', jumperSegmentIndex: 0 })
  })

  it('V セグメントが基準でも H が jumper になる: 規約確認', () => {
    const edges: EdgeWithSegments[] = [
      { id: 'a', segments: [{ orientation: 'v' as const, fixed: 100, range: [0, 200] as [number, number] }] },
      { id: 'b', segments: [{ orientation: 'h' as const, fixed: 100, range: [0, 200] as [number, number] }] },
    ]
    const result = detectCrossings(edges)
    expect(result).toHaveLength(1)
    expect(result[0].jumperEdgeId).toBe('b')
  })
})
