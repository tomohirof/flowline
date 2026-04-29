import { describe, it, expect } from 'vitest'
import type { InternalArrow } from './types'
import {
  remapArrows,
  remapArrowsBatch,
  filterArrowsByDeletedKeys,
  calcArrowPath,
  findChain,
  detectReorder,
  reconnectChain,
  detectCrossLaneRewire,
  swapKeys,
  calcMultiDropTargets,
} from './flow-engine'
import { exitPt, entryPt } from './arrow-routing'
import { computeBridgeArrows } from '../features/editor/auto-connect'

/* --------------------------------------------------------- */
/* helpers                                                   */
/* --------------------------------------------------------- */

function mkArrow(overrides: Partial<InternalArrow> & { from: string; to: string }): InternalArrow {
  return {
    id: overrides.id ?? 'a1',
    from: overrides.from,
    to: overrides.to,
    comment: overrides.comment ?? '',
    ...(overrides.color !== undefined && { color: overrides.color }),
    ...(overrides.dash !== undefined && { dash: overrides.dash }),
  }
}

/* ========================================================= */
/* remapArrows                                               */
/* ========================================================= */

describe('remapArrows', () => {
  it('should remap from field when oldKey matches', () => {
    const arrows = [mkArrow({ from: 'L1_R1', to: 'L2_R1' })]
    const result = remapArrows(arrows, 'L1_R1', 'L1_R2')
    expect(result[0].from).toBe('L1_R2')
    expect(result[0].to).toBe('L2_R1')
  })

  it('should remap to field when oldKey matches', () => {
    const arrows = [mkArrow({ from: 'L1_R1', to: 'L2_R1' })]
    const result = remapArrows(arrows, 'L2_R1', 'L2_R2')
    expect(result[0].from).toBe('L1_R1')
    expect(result[0].to).toBe('L2_R2')
  })

  it('should remap both from and to in multiple arrows simultaneously', () => {
    const arrows = [
      mkArrow({ id: 'a1', from: 'X', to: 'Y' }),
      mkArrow({ id: 'a2', from: 'Y', to: 'X' }),
      mkArrow({ id: 'a3', from: 'X', to: 'X' }),
    ]
    const result = remapArrows(arrows, 'X', 'Z')
    expect(result).toEqual([
      expect.objectContaining({ id: 'a1', from: 'Z', to: 'Y' }),
      expect.objectContaining({ id: 'a2', from: 'Y', to: 'Z' }),
      expect.objectContaining({ id: 'a3', from: 'Z', to: 'Z' }),
    ])
  })

  it('should return unchanged arrows when oldKey not found', () => {
    const arrows = [mkArrow({ from: 'A', to: 'B' })]
    const result = remapArrows(arrows, 'NONEXISTENT', 'NEW')
    expect(result).toEqual(arrows)
  })

  it('should preserve optional color and dash fields', () => {
    const arrows = [mkArrow({ from: 'A', to: 'B', color: '#ff0000', dash: '5,3' })]
    const result = remapArrows(arrows, 'A', 'C')
    expect(result[0]).toEqual({
      id: 'a1',
      from: 'C',
      to: 'B',
      comment: '',
      color: '#ff0000',
      dash: '5,3',
    })
  })

  it('should return empty array for empty input', () => {
    const result = remapArrows([], 'A', 'B')
    expect(result).toEqual([])
  })
})

/* ========================================================= */
/* filterArrowsByDeletedKeys                                 */
/* ========================================================= */

describe('filterArrowsByDeletedKeys', () => {
  it('should remove arrows where from is in deletedKeys', () => {
    const arrows = [
      mkArrow({ id: 'a1', from: 'DEL', to: 'KEEP' }),
      mkArrow({ id: 'a2', from: 'KEEP', to: 'KEEP2' }),
    ]
    const result = filterArrowsByDeletedKeys(arrows, new Set(['DEL']))
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a2')
  })

  it('should remove arrows where to is in deletedKeys', () => {
    const arrows = [
      mkArrow({ id: 'a1', from: 'KEEP', to: 'DEL' }),
      mkArrow({ id: 'a2', from: 'KEEP', to: 'KEEP2' }),
    ]
    const result = filterArrowsByDeletedKeys(arrows, new Set(['DEL']))
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a2')
  })

  it('should return all arrows when deletedKeys is empty', () => {
    const arrows = [
      mkArrow({ id: 'a1', from: 'A', to: 'B' }),
      mkArrow({ id: 'a2', from: 'C', to: 'D' }),
    ]
    const result = filterArrowsByDeletedKeys(arrows, new Set())
    expect(result).toEqual(arrows)
  })

  it('should return empty array when all keys are deleted', () => {
    const arrows = [
      mkArrow({ id: 'a1', from: 'A', to: 'B' }),
      mkArrow({ id: 'a2', from: 'C', to: 'D' }),
    ]
    const result = filterArrowsByDeletedKeys(arrows, new Set(['A', 'B', 'C', 'D']))
    expect(result).toEqual([])
  })

  it('should return empty array for empty input', () => {
    const result = filterArrowsByDeletedKeys([], new Set(['X']))
    expect(result).toEqual([])
  })
})

/* ========================================================= */
/* calcArrowPath                                             */
/* ========================================================= */

describe('calcArrowPath', () => {
  const config = { hw: 76, hh: 28, rh: 84 }

  it('should route same-lane downward: exit bottom, enter top', () => {
    // from={200,100} to={200,300}: dy=200 > 84*0.3=25.2 → exit bottom {200,128}
    // entryPt({200,300}, {200,100}): dy=-200 < -25.2 → enter top {200,272}
    // buildArrowPath({200,128}, {200,272}, {200,100}, {200,300}): dx=0 < 2 → straight line
    const result = calcArrowPath({ x: 200, y: 100 }, { x: 200, y: 300 }, config)
    expect(result).not.toBeNull()
    expect(result.d).toBe('M200,128 L200,272')
    expect(result.mx).toBe(200)
    expect(result.my).toBe(200)
  })

  it('should route cross-lane horizontal: exit right, enter left', () => {
    // from={100,200} to={400,200}: dy=0, dx=300 → exit right {176,200}
    // entryPt({400,200}, {100,200}): dx=-300, dy=0 → enter left {324,200}
    // buildArrowPath: dy=0 < 2 → straight line
    const result = calcArrowPath({ x: 100, y: 200 }, { x: 400, y: 200 }, config)
    expect(result).not.toBeNull()
    expect(result.d).toBe('M176,200 L324,200')
  })

  it('should change exit direction when moving from same-lane to cross-lane', () => {
    // Same lane down: exit bottom
    const r1 = calcArrowPath({ x: 100, y: 100 }, { x: 100, y: 200 }, config)
    expect(r1).not.toBeNull()
    expect(r1.d).toContain('M100,128')

    // Cross lane diagonal: from={100,100} to={400,200}
    // exitPt: dy=100 > 25.2 → bottom {100,128}
    // entryPt({400,200}, {100,100}): dy=-100 < -25.2 → top {400,172}
    // sV: |128-100|=28 vs |100-100|=0 → true (vertical)
    // eV: |172-200|=28 vs |400-400|=0 → true (vertical)
    // Both vertical → Z path: my=(128+172)/2=150
    const r2 = calcArrowPath({ x: 100, y: 100 }, { x: 400, y: 200 }, config)
    expect(r2).not.toBeNull()
    expect(r2.d).toBe('M100,128 L100,150 L400,150 L400,172')
  })

  it('③ diamond — left-down exit from left vertex', () => {
    // from diamond at {300,200} to target at {100,400}: dx=-200 < 0 → left vertex
    const result = calcArrowPath(
      { x: 300, y: 200 },
      { x: 100, y: 400 },
      { hw: 76, hh: 28, rh: 84, fromShape: 'diamond' },
    )
    expect(result).not.toBeNull()
    // exitPt diamond: dx=-200 < 0 → {x: 300-34, y: 200} = {x: 266, y: 200}
    expect(result!.d).toContain('M266,200')
  })

  it('③ diamond — right-down exit from right vertex', () => {
    // from diamond at {300,200} to target at {500,400}: dx=200 >= 0 → right vertex
    const result = calcArrowPath(
      { x: 300, y: 200 },
      { x: 500, y: 400 },
      { hw: 76, hh: 28, rh: 84, fromShape: 'diamond' },
    )
    expect(result).not.toBeNull()
    // exitPt diamond: dx=200 >= 0 → {x: 300+34, y: 200} = {x: 334, y: 200}
    expect(result!.d).toContain('M334,200')
  })

  it('③ diamond — straight-down exit from bottom vertex', () => {
    // from diamond at {300,200} to target at {300,400}: dx=0, dy>0 → bottom vertex
    const result = calcArrowPath(
      { x: 300, y: 200 },
      { x: 300, y: 400 },
      { hw: 76, hh: 28, rh: 84, fromShape: 'diamond' },
    )
    expect(result).not.toBeNull()
    // exitPt diamond: |dx|<1, dy>0 → {x: 300, y: 200+34} = {x: 300, y: 234}
    expect(result!.d).toContain('M300,234')
  })

  it('should pass obstacles through to buildArrowPath and produce detour path', () => {
    // A=(200,200) → C=(600,200) 同一行、間に B (400,200) 障害
    const obstacles = [{ x: 400, y: 200, w: 152, h: 56 }]
    const r = calcArrowPath(
      { x: 200, y: 200 },
      { x: 600, y: 200 },
      { hw: 76, hh: 28, rh: 84 },
      obstacles,
    )
    expect(r).not.toBeNull()
    // exitPt: dx=400 横出口 {276,200}, entryPt: 横入口 {524,200}
    // 迂回: detourY = 228 + 14 = 242, approachX = 524 - 14 = 510
    expect(r.d).toBe('M276,200 L276,242 L510,242 L510,200 L524,200')
    expect(r.mx).toBe(400)
    expect(r.my).toBe(242)
  })

  it('should ignore obstacles when arrow is not horizontal', () => {
    const obstacles = [{ x: 200, y: 200, w: 152, h: 56 }]
    const r = calcArrowPath(
      { x: 100, y: 100 },
      { x: 100, y: 300 },
      { hw: 76, hh: 28, rh: 84 },
      obstacles,
    )
    // 縦パスなので obstacles 無視 → 既存の直線
    expect(r.d).toBe('M100,128 L100,272')
  })
})

/* ========================================================= */
/* findChain                                                  */
/* ========================================================= */

describe('findChain', () => {
  it('should return linear chain A→B→C in order', () => {
    const arrows = [
      { from: 'l0_r0', to: 'l0_r1' },
      { from: 'l0_r1', to: 'l0_r2' },
    ]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
      l0_r1: { lid: 'l0', rid: 'r1' },
      l0_r2: { lid: 'l0', rid: 'r2' },
    }
    const result = findChain(arrows, tasks, 'l0')
    expect(result).toEqual(['l0_r0', 'l0_r1', 'l0_r2'])
  })

  it('should return only nodes in specified lane when branches exist', () => {
    const arrows = [
      { from: 'l0_r0', to: 'l0_r1' },
      { from: 'l0_r0', to: 'l1_r1' },
    ]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
      l0_r1: { lid: 'l0', rid: 'r1' },
      l1_r1: { lid: 'l1', rid: 'r1' },
    }
    const result = findChain(arrows, tasks, 'l0')
    expect(result).toEqual(['l0_r0', 'l0_r1'])
  })

  it('should return empty array when no arrows exist', () => {
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
    }
    const result = findChain([], tasks, 'l0')
    expect(result).toEqual([])
  })

  it('should not infinite loop on circular reference A→B→C→A', () => {
    const arrows = [
      { from: 'l0_r0', to: 'l0_r1' },
      { from: 'l0_r1', to: 'l0_r2' },
      { from: 'l0_r2', to: 'l0_r0' },
    ]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
      l0_r1: { lid: 'l0', rid: 'r1' },
      l0_r2: { lid: 'l0', rid: 'r2' },
    }
    const result = findChain(arrows, tasks, 'l0')
    expect(result).toHaveLength(3)
    expect(new Set(result).size).toBe(3)
  })

  it('should return empty array when no nodes belong to specified lane', () => {
    const arrows = [{ from: 'l1_r0', to: 'l1_r1' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l1_r0: { lid: 'l1', rid: 'r0' },
      l1_r1: { lid: 'l1', rid: 'r1' },
    }
    const result = findChain(arrows, tasks, 'l0')
    expect(result).toEqual([])
  })
})

/* ========================================================= */
/* detectReorder                                              */
/* ========================================================= */

describe('detectReorder', () => {
  it('should detect reorder when node moved to different row', () => {
    const chain = ['k1', 'k2', 'k3', 'k4', 'k5']
    const tasks: Record<string, { rid: string }> = {
      k1: { rid: 'r1' },
      k2: { rid: 'r5' },
      k3: { rid: 'r2' },
      k4: { rid: 'r3' },
      k5: { rid: 'r4' },
    }
    const rows = [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }, { id: 'r4' }, { id: 'r5' }]
    const result = detectReorder(chain, tasks, rows)
    expect(result.changed).toBe(true)
    expect(result.current).toEqual(['k1', 'k2', 'k3', 'k4', 'k5'])
    expect(result.proposed).toEqual(['k1', 'k3', 'k4', 'k5', 'k2'])
  })

  it('should return changed=false when chain is already in row order', () => {
    const chain = ['k1', 'k2', 'k3']
    const tasks: Record<string, { rid: string }> = {
      k1: { rid: 'r0' },
      k2: { rid: 'r1' },
      k3: { rid: 'r2' },
    }
    const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
    const result = detectReorder(chain, tasks, rows)
    expect(result.changed).toBe(false)
    expect(result.current).toEqual(['k1', 'k2', 'k3'])
    expect(result.proposed).toEqual(['k1', 'k2', 'k3'])
  })

  it('should return changed=false for empty chain', () => {
    const result = detectReorder([], {}, [])
    expect(result.changed).toBe(false)
    expect(result.current).toEqual([])
    expect(result.proposed).toEqual([])
  })

  it('should return changed=false for single-node chain', () => {
    const chain = ['k1']
    const tasks: Record<string, { rid: string }> = { k1: { rid: 'r0' } }
    const rows = [{ id: 'r0' }]
    const result = detectReorder(chain, tasks, rows)
    expect(result.changed).toBe(false)
  })
})

/* ========================================================= */
/* reconnectChain                                             */
/* ========================================================= */

describe('reconnectChain', () => {
  it('should create arrows for adjacent pairs in sorted order', () => {
    const result = reconnectChain(['k1', 'k3', 'k4', 'k5', 'k2'])
    expect(result).toEqual([
      { from: 'k1', to: 'k3' },
      { from: 'k3', to: 'k4' },
      { from: 'k4', to: 'k5' },
      { from: 'k5', to: 'k2' },
    ])
  })

  it('should return empty array for single node', () => {
    expect(reconnectChain(['k1'])).toEqual([])
  })

  it('should return single arrow for two nodes', () => {
    expect(reconnectChain(['k1', 'k2'])).toEqual([{ from: 'k1', to: 'k2' }])
  })

  it('should return empty array for empty input', () => {
    expect(reconnectChain([])).toEqual([])
  })
})

/* ========================================================= */
/* 統合テスト                                                  */
/* ========================================================= */

describe('統合テスト', () => {
  it('⑤ should bridge A→C when B is deleted from A→B→C', () => {
    const arrows: InternalArrow[] = [
      { id: 'a1', from: 'A', to: 'B', comment: '' },
      { id: 'a2', from: 'B', to: 'C', comment: '' },
    ]
    const bridges = computeBridgeArrows(new Set(['B']), arrows)
    expect(bridges).toHaveLength(1)
    expect(bridges[0].from).toBe('A')
    expect(bridges[0].to).toBe('C')

    // After filtering deleted keys and adding bridges
    const remaining = filterArrowsByDeletedKeys(arrows, new Set(['B']))
    expect(remaining).toHaveLength(0)
    const newArrows = [
      ...remaining,
      ...bridges.map((b, i) => ({
        id: `bridge${i}`,
        from: b.from,
        to: b.to,
        comment: b.comment,
      })),
    ]
    expect(newArrows).toHaveLength(1)
    expect(newArrows[0].from).toBe('A')
    expect(newArrows[0].to).toBe('C')
  })

  it('⑥ should verify all arrow directions after chain reconnection', () => {
    // 5 nodes in same lane, chain needs reordering
    const chain = ['k1', 'k2', 'k3', 'k4', 'k5']
    const tasks: Record<string, { rid: string }> = {
      k1: { rid: 'r0' },
      k2: { rid: 'r4' },
      k3: { rid: 'r1' },
      k4: { rid: 'r2' },
      k5: { rid: 'r3' },
    }
    const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }, { id: 'r3' }, { id: 'r4' }]

    // Detect and reorder
    const reorder = detectReorder(chain, tasks, rows)
    expect(reorder.changed).toBe(true)
    expect(reorder.proposed).toEqual(['k1', 'k3', 'k4', 'k5', 'k2'])

    // Reconnect
    const newArrows = reconnectChain(reorder.proposed)

    // Verify all arrow routing directions
    const RH = 84,
      TM = 24,
      HH = 46
    const positions: Record<string, { x: number; y: number }> = {}
    for (const key of reorder.proposed) {
      const ri = rows.findIndex((r) => r.id === tasks[key].rid)
      positions[key] = { x: 200, y: TM + HH + ri * RH + RH / 2 }
    }

    for (const arrow of newArrows) {
      const fp = positions[arrow.from]
      const tp = positions[arrow.to]
      const exit = exitPt(fp, tp, 76, 28, RH)
      const entry = entryPt(tp, fp, 76, 28, RH)

      // Exit should be from bottom (y > center.y)
      expect(exit.y).toBeGreaterThan(fp.y)
      // Entry should be at top (y < center.y)
      expect(entry.y).toBeLessThan(tp.y)
      // Same lane → X should match
      expect(exit.x).toBe(entry.x)
    }
  })

  it('⑦ should rewire cross-lane arrow to new tail when tail node changes after reorder', () => {
    // 右レーン: k7→k9→k10→k11 のチェーン
    // k11→k15 は左レーンへの横矢印（クロスレーン）
    // k9 を k11 の下（r5）に移動した後のシナリオ
    const arrows: InternalArrow[] = [
      { id: 'a1', from: 'k7', to: 'k9', comment: '' },
      { id: 'a2', from: 'k9', to: 'k10', comment: '' },
      { id: 'a3', from: 'k10', to: 'k11', comment: '' },
      { id: 'a4', from: 'k11', to: 'k15', comment: '' },
    ]
    const tasks: Record<string, { lid: string; rid: string }> = {
      k7: { lid: 'lane-right', rid: 'r1' },
      k9: { lid: 'lane-right', rid: 'r5' }, // 移動後: r2→r5
      k10: { lid: 'lane-right', rid: 'r2' },
      k11: { lid: 'lane-right', rid: 'r3' },
      k15: { lid: 'lane-left', rid: 'r4' }, // 旧末尾(r3)より下の行
    }
    const rows = [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }, { id: 'r4' }, { id: 'r5' }]

    // Step 1: findChain — 矢印をたどってチェーン検出
    const chain = findChain(arrows, tasks, 'lane-right')
    expect(chain).toEqual(['k7', 'k9', 'k10', 'k11'])

    // Step 2: detectReorder — 行位置順に並び替え提案
    const reorder = detectReorder(chain, tasks, rows)
    expect(reorder.changed).toBe(true)
    expect(reorder.proposed).toEqual(['k7', 'k10', 'k11', 'k9'])

    // Step 3: detectCrossLaneRewire — 横矢印張り替え提案
    const rewires = detectCrossLaneRewire(reorder.current, reorder.proposed, arrows, tasks, rows)
    expect(rewires).toEqual([
      {
        arrowId: 'a4',
        oldFrom: 'k11',
        newFrom: 'k9',
        to: 'k15',
        comment: '',
      },
    ])
  })

  it('⑧ should not rewire same-row horizontal cross-lane arrow when tail changes', () => {
    // 右レーン: k7→k9→k10→k11 のチェーン
    // k11→k15 は左レーンへの下方向横矢印（登録メール相当）→ 張り替えるべき
    // k11→k16 は左レーンへの同行水平矢印（価格の登録L相当）→ 張り替えないべき
    // k9 を k11 の下（r5）に移動
    const arrows: InternalArrow[] = [
      { id: 'a1', from: 'k7', to: 'k9', comment: '' },
      { id: 'a2', from: 'k9', to: 'k10', comment: '' },
      { id: 'a3', from: 'k10', to: 'k11', comment: '' },
      { id: 'a4', from: 'k11', to: 'k15', comment: '' }, // 下方向クロスレーン
      { id: 'a5', from: 'k11', to: 'k16', comment: '' }, // 同行水平クロスレーン
    ]
    const tasks: Record<string, { lid: string; rid: string }> = {
      k7: { lid: 'lane-right', rid: 'r1' },
      k9: { lid: 'lane-right', rid: 'r5' },
      k10: { lid: 'lane-right', rid: 'r2' },
      k11: { lid: 'lane-right', rid: 'r3' },
      k15: { lid: 'lane-left', rid: 'r6' }, // 旧末尾より下の行
      k16: { lid: 'lane-left', rid: 'r3' }, // 旧末尾と同じ行
    }
    const rows = [
      { id: 'r1' },
      { id: 'r2' },
      { id: 'r3' },
      { id: 'r4' },
      { id: 'r5' },
      { id: 'r6' },
    ]

    const chain = findChain(arrows, tasks, 'lane-right')
    expect(chain).toEqual(['k7', 'k9', 'k10', 'k11'])

    const reorder = detectReorder(chain, tasks, rows)
    expect(reorder.changed).toBe(true)
    expect(reorder.proposed).toEqual(['k7', 'k10', 'k11', 'k9'])

    const rewires = detectCrossLaneRewire(reorder.current, reorder.proposed, arrows, tasks, rows)

    // 下方向の a4 のみ張り替え。同行水平の a5 は対象外
    expect(rewires).toEqual([
      {
        arrowId: 'a4',
        oldFrom: 'k11',
        newFrom: 'k9',
        to: 'k15',
        comment: '',
      },
    ])
  })

  it('⑨ should not rewire upward cross-lane arrow when tail changes', () => {
    // k11→k17 は左レーンの上方向矢印 → 張り替えないべき
    const arrows: InternalArrow[] = [
      { id: 'a1', from: 'k7', to: 'k9', comment: '' },
      { id: 'a2', from: 'k9', to: 'k10', comment: '' },
      { id: 'a3', from: 'k10', to: 'k11', comment: '' },
      { id: 'a4', from: 'k11', to: 'k15', comment: '' }, // 下方向
      { id: 'a5', from: 'k11', to: 'k17', comment: '' }, // 上方向
    ]
    const tasks: Record<string, { lid: string; rid: string }> = {
      k7: { lid: 'lane-right', rid: 'r1' },
      k9: { lid: 'lane-right', rid: 'r5' },
      k10: { lid: 'lane-right', rid: 'r2' },
      k11: { lid: 'lane-right', rid: 'r3' },
      k15: { lid: 'lane-left', rid: 'r6' },
      k17: { lid: 'lane-left', rid: 'r1' }, // 旧末尾より上の行
    }
    const rows = [
      { id: 'r1' },
      { id: 'r2' },
      { id: 'r3' },
      { id: 'r4' },
      { id: 'r5' },
      { id: 'r6' },
    ]

    const chain = findChain(arrows, tasks, 'lane-right')
    const reorder = detectReorder(chain, tasks, rows)
    const rewires = detectCrossLaneRewire(reorder.current, reorder.proposed, arrows, tasks, rows)

    // 下方向の a4 のみ張り替え。上方向の a5 は対象外
    expect(rewires).toEqual([
      {
        arrowId: 'a4',
        oldFrom: 'k11',
        newFrom: 'k9',
        to: 'k15',
        comment: '',
      },
    ])
  })

  it('⑩ should preserve comment when rewiring downward cross-lane arrow', () => {
    const arrows: InternalArrow[] = [
      { id: 'a1', from: 'k7', to: 'k9', comment: '' },
      { id: 'a2', from: 'k9', to: 'k10', comment: '' },
      { id: 'a3', from: 'k10', to: 'k11', comment: '' },
      { id: 'a4', from: 'k11', to: 'k15', comment: '確認依頼' },
    ]
    const tasks: Record<string, { lid: string; rid: string }> = {
      k7: { lid: 'lane-right', rid: 'r1' },
      k9: { lid: 'lane-right', rid: 'r5' },
      k10: { lid: 'lane-right', rid: 'r2' },
      k11: { lid: 'lane-right', rid: 'r3' },
      k15: { lid: 'lane-left', rid: 'r6' },
    }
    const rows = [
      { id: 'r1' },
      { id: 'r2' },
      { id: 'r3' },
      { id: 'r4' },
      { id: 'r5' },
      { id: 'r6' },
    ]

    const chain = findChain(arrows, tasks, 'lane-right')
    const reorder = detectReorder(chain, tasks, rows)
    const rewires = detectCrossLaneRewire(reorder.current, reorder.proposed, arrows, tasks, rows)

    expect(rewires).toHaveLength(1)
    expect(rewires[0].comment).toBe('確認依頼')
    expect(rewires[0].newFrom).toBe('k9')
    expect(rewires[0].to).toBe('k15')
  })
})

/* ======================================================= */
/* detectCrossLaneRewire                                   */
/* ======================================================= */

describe('detectCrossLaneRewire', () => {
  const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }, { id: 'r3' }]

  it('should return empty array when tail does not change', () => {
    const current = ['l0_r0', 'l0_r1', 'l0_r2']
    const proposed = ['l0_r0', 'l0_r1', 'l0_r2']
    const arrows = [{ id: 'x1', from: 'l0_r2', to: 'l1_r0', comment: '' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
      l0_r1: { lid: 'l0', rid: 'r1' },
      l0_r2: { lid: 'l0', rid: 'r2' },
      l1_r0: { lid: 'l1', rid: 'r0' },
    }
    expect(detectCrossLaneRewire(current, proposed, arrows, tasks, rows)).toEqual([])
  })

  it('should return empty array when new tail is on same row as old tail', () => {
    const current = ['l0_r0', 'l0_r1', 'l0_r2']
    const proposed = ['l0_r0', 'l0_r2', 'l0_r1']
    const arrows = [{ id: 'x1', from: 'l0_r2', to: 'l1_r0', comment: '' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
      l0_r1: { lid: 'l0', rid: 'r2' },
      l0_r2: { lid: 'l0', rid: 'r2' },
      l1_r0: { lid: 'l1', rid: 'r0' },
    }
    expect(detectCrossLaneRewire(current, proposed, arrows, tasks, rows)).toEqual([])
  })

  it('should return empty array when new tail is above old tail', () => {
    const current = ['l0_r0', 'l0_r1', 'l0_r2']
    const proposed = ['l0_r0', 'l0_r2', 'l0_r1']
    const arrows = [{ id: 'x1', from: 'l0_r2', to: 'l1_r0', comment: '' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
      l0_r1: { lid: 'l0', rid: 'r1' },
      l0_r2: { lid: 'l0', rid: 'r2' },
      l1_r0: { lid: 'l1', rid: 'r0' },
    }
    expect(detectCrossLaneRewire(current, proposed, arrows, tasks, rows)).toEqual([])
  })

  it('should return empty array when old tail has no cross-lane arrows', () => {
    const current = ['l0_r0', 'l0_r1', 'l0_r2']
    const proposed = ['l0_r0', 'l0_r2', 'l0_r1']
    const arrows: { id: string; from: string; to: string; comment: string }[] = []
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
      l0_r1: { lid: 'l0', rid: 'r3' },
      l0_r2: { lid: 'l0', rid: 'r1' },
    }
    expect(detectCrossLaneRewire(current, proposed, arrows, tasks, rows)).toEqual([])
  })

  it('should return rewire proposals when new tail is below old tail and old tail has cross-lane arrow', () => {
    const current = ['l0_r0', 'l0_r1', 'l0_r2', 'l0_r3']
    const proposed = ['l0_r0', 'l0_r2', 'l0_r3', 'l0_r1']
    const arrows = [{ id: 'x1', from: 'l0_r3', to: 'l1_r0', comment: 'memo' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
      l0_r1: { lid: 'l0', rid: 'r3' },
      l0_r2: { lid: 'l0', rid: 'r1' },
      l0_r3: { lid: 'l0', rid: 'r2' },
      l1_r0: { lid: 'l1', rid: 'r3' }, // 旧末尾(r2)より下の行
    }
    const result = detectCrossLaneRewire(current, proposed, arrows, tasks, rows)
    expect(result).toEqual([
      { arrowId: 'x1', oldFrom: 'l0_r3', newFrom: 'l0_r1', to: 'l1_r0', comment: 'memo' },
    ])
  })

  it('should return multiple rewire proposals for multiple cross-lane arrows', () => {
    const current = ['l0_r0', 'l0_r1', 'l0_r2']
    const proposed = ['l0_r0', 'l0_r2', 'l0_r1']
    const arrows = [
      { id: 'x1', from: 'l0_r2', to: 'l1_r0', comment: '' },
      { id: 'x2', from: 'l0_r2', to: 'l2_r1', comment: 'note' },
    ]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
      l0_r1: { lid: 'l0', rid: 'r3' },
      l0_r2: { lid: 'l0', rid: 'r1' },
      l1_r0: { lid: 'l1', rid: 'r2' }, // 旧末尾(r1)より下の行
      l2_r1: { lid: 'l2', rid: 'r2' }, // 旧末尾(r1)より下の行
    }
    const result = detectCrossLaneRewire(current, proposed, arrows, tasks, rows)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      arrowId: 'x1',
      oldFrom: 'l0_r2',
      newFrom: 'l0_r1',
      to: 'l1_r0',
      comment: '',
    })
    expect(result[1]).toEqual({
      arrowId: 'x2',
      oldFrom: 'l0_r2',
      newFrom: 'l0_r1',
      to: 'l2_r1',
      comment: 'note',
    })
  })

  it('should ignore same-lane arrows from old tail', () => {
    const current = ['l0_r0', 'l0_r1', 'l0_r2']
    const proposed = ['l0_r0', 'l0_r2', 'l0_r1']
    const arrows = [{ id: 'x1', from: 'l0_r2', to: 'l0_r0', comment: '' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
      l0_r1: { lid: 'l0', rid: 'r3' },
      l0_r2: { lid: 'l0', rid: 'r1' },
    }
    expect(detectCrossLaneRewire(current, proposed, arrows, tasks, rows)).toEqual([])
  })

  it('should return empty array when chains are empty', () => {
    expect(detectCrossLaneRewire([], [], [], {}, rows)).toEqual([])
  })

  it('should return empty array when only currentChain is empty', () => {
    const proposed = ['l0_r0', 'l0_r1']
    expect(detectCrossLaneRewire([], proposed, [], {}, rows)).toEqual([])
  })

  it('should return empty array when only proposedChain is empty', () => {
    const current = ['l0_r0', 'l0_r1']
    expect(detectCrossLaneRewire(current, [], [], {}, rows)).toEqual([])
  })

  it('should return empty array when arrows exist but none originate from old tail', () => {
    const current = ['l0_r0', 'l0_r1', 'l0_r2']
    const proposed = ['l0_r0', 'l0_r2', 'l0_r1']
    const arrows = [{ id: 'x1', from: 'l0_r0', to: 'l1_r0', comment: '' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
      l0_r1: { lid: 'l0', rid: 'r3' },
      l0_r2: { lid: 'l0', rid: 'r1' },
      l1_r0: { lid: 'l1', rid: 'r0' },
    }
    expect(detectCrossLaneRewire(current, proposed, arrows, tasks, rows)).toEqual([])
  })

  it('should skip arrows whose to-node is missing from tasks', () => {
    const current = ['l0_r0', 'l0_r1', 'l0_r2']
    const proposed = ['l0_r0', 'l0_r2', 'l0_r1']
    const arrows = [{ id: 'x1', from: 'l0_r2', to: 'l9_r9', comment: '' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
      l0_r1: { lid: 'l0', rid: 'r3' },
      l0_r2: { lid: 'l0', rid: 'r1' },
      // l9_r9 intentionally missing
    }
    expect(detectCrossLaneRewire(current, proposed, arrows, tasks, rows)).toEqual([])
  })
})

/* ========================================================= */
/* swapKeys                                                  */
/* ========================================================= */

describe('swapKeys', () => {
  it('should swap content (label, nodeId) while keeping keys and arrows unchanged', () => {
    const tasks = {
      L1_R1: { label: 'A', lid: 'L1', rid: 'R1', nodeId: 'n1' },
      L1_R2: { label: 'B', lid: 'L1', rid: 'R2', nodeId: 'n2' },
    }
    const arrows = [mkArrow({ from: 'L1_R1', to: 'L1_R2' })]
    const order = ['L1_R1', 'L1_R2']
    const memos = { L1_R1: { text: 'note-A', dx: 50, dy: 46 } }

    const result = swapKeys(tasks, arrows, order, memos, 'L1_R1', 'L1_R2')

    // tasks: キーは維持、コンテンツが入れ替わる
    expect(result!.tasks['L1_R1'].label).toBe('B')
    expect(result!.tasks['L1_R1'].nodeId).toBe('n2')
    expect(result!.tasks['L1_R1'].lid).toBe('L1')
    expect(result!.tasks['L1_R1'].rid).toBe('R1')
    expect(result!.tasks['L1_R2'].label).toBe('A')
    expect(result!.tasks['L1_R2'].nodeId).toBe('n1')
    expect(result!.tasks['L1_R2'].lid).toBe('L1')
    expect(result!.tasks['L1_R2'].rid).toBe('R2')

    // arrows: キー変更なしのためそのまま（矢印反転しない）
    expect(result!.arrows[0].from).toBe('L1_R1')
    expect(result!.arrows[0].to).toBe('L1_R2')

    // order: キー変更なしのためそのまま
    expect(result!.order).toEqual(['L1_R1', 'L1_R2'])

    // memos: コンテンツに追従して入れ替わる
    expect(result!.memos['L1_R2']).toEqual({ text: 'note-A', dx: 50, dy: 46 })
    expect(result!.memos['L1_R1']).toBeUndefined()

    // newKeyA = targetKey, newKeyB = draggedKey
    expect(result!.newKeyA).toBe('L1_R2')
    expect(result!.newKeyB).toBe('L1_R1')
  })

  it('should return null when keys are in different lanes', () => {
    const tasks = {
      L1_R1: { label: 'A', lid: 'L1', rid: 'R1', nodeId: 'n1' },
      L2_R2: { label: 'B', lid: 'L2', rid: 'R2', nodeId: 'n2' },
    }
    const result = swapKeys(tasks, [], ['L1_R1', 'L2_R2'], {}, 'L1_R1', 'L2_R2')
    expect(result).toBeNull()
  })

  it('should return null when same row', () => {
    const tasks = {
      L1_R1: { label: 'A', lid: 'L1', rid: 'R1', nodeId: 'n1' },
    }
    const result = swapKeys(tasks, [], ['L1_R1'], {}, 'L1_R1', 'L1_R1')
    expect(result).toBeNull()
  })

  it('should handle non-adjacent nodes without affecting others', () => {
    const tasks = {
      L1_R1: { label: 'A', lid: 'L1', rid: 'R1', nodeId: 'n1' },
      L1_R2: { label: 'B', lid: 'L1', rid: 'R2', nodeId: 'n2' },
      L1_R3: { label: 'C', lid: 'L1', rid: 'R3', nodeId: 'n3' },
    }
    const arrows = [
      mkArrow({ id: 'a1', from: 'L1_R1', to: 'L1_R2' }),
      mkArrow({ id: 'a2', from: 'L1_R2', to: 'L1_R3' }),
    ]
    const order = ['L1_R1', 'L1_R2', 'L1_R3']

    const result = swapKeys(tasks, arrows, order, {}, 'L1_R1', 'L1_R3')

    // コンテンツが入れ替わる（キーは維持）
    expect(result!.tasks['L1_R1'].label).toBe('C')
    expect(result!.tasks['L1_R1'].nodeId).toBe('n3')
    expect(result!.tasks['L1_R2'].label).toBe('B')
    expect(result!.tasks['L1_R3'].label).toBe('A')
    expect(result!.tasks['L1_R3'].nodeId).toBe('n1')

    // arrows: キー変更なしのためそのまま（矢印反転しない）
    const a1 = result!.arrows.find((a) => a.id === 'a1')!
    expect(a1.from).toBe('L1_R1')
    expect(a1.to).toBe('L1_R2')

    const a2 = result!.arrows.find((a) => a.id === 'a2')!
    expect(a2.from).toBe('L1_R2')
    expect(a2.to).toBe('L1_R3')

    // order: キー変更なしのためそのまま
    expect(result!.order).toEqual(['L1_R1', 'L1_R2', 'L1_R3'])
  })

  it('should swap memos following content swap', () => {
    const tasks = {
      L1_R1: { label: 'A', lid: 'L1', rid: 'R1', nodeId: 'n1' },
      L1_R2: { label: 'B', lid: 'L1', rid: 'R2', nodeId: 'n2' },
    }
    const memos = {
      L1_R1: { text: 'note-A', dx: 50, dy: 46 },
      L1_R2: { text: 'note-B', dx: -50, dy: 46 },
    }

    const result = swapKeys(tasks, [], ['L1_R1', 'L1_R2'], memos, 'L1_R1', 'L1_R2')

    // memos はコンテンツに追従して入れ替わる
    expect(result!.memos['L1_R2']).toEqual({ text: 'note-A', dx: 50, dy: 46 })
    expect(result!.memos['L1_R1']).toEqual({ text: 'note-B', dx: -50, dy: 46 })
  })

  it('should swap style properties (bg, strokeColor, dash, shape) with content', () => {
    const tasks = {
      L1_R1: {
        label: 'A',
        lid: 'L1',
        rid: 'R1',
        nodeId: 'n1',
        bg: '#ff0000',
        shape: 'diamond' as const,
      },
      L1_R2: {
        label: 'B',
        lid: 'L1',
        rid: 'R2',
        nodeId: 'n2',
        strokeColor: '#00ff00',
        dash: '5,5',
      },
    }

    const result = swapKeys(tasks, [], ['L1_R1', 'L1_R2'], {}, 'L1_R1', 'L1_R2')

    // スタイルもコンテンツに追従する
    expect(result!.tasks['L1_R1'].bg).toBeUndefined()
    expect(result!.tasks['L1_R1'].strokeColor).toBe('#00ff00')
    expect(result!.tasks['L1_R1'].dash).toBe('5,5')
    expect(result!.tasks['L1_R1'].shape).toBeUndefined()
    expect(result!.tasks['L1_R2'].bg).toBe('#ff0000')
    expect(result!.tasks['L1_R2'].shape).toBe('diamond')
    expect(result!.tasks['L1_R2'].strokeColor).toBeUndefined()
    expect(result!.tasks['L1_R2'].dash).toBeUndefined()
  })

  it('should return null when dragged key does not exist', () => {
    const tasks = {
      L1_R2: { label: 'B', lid: 'L1', rid: 'R2', nodeId: 'n2' },
    }
    const result = swapKeys(tasks, [], [], {}, 'L1_R1', 'L1_R2')
    expect(result).toBeNull()
  })
})

/* ========================================================= */
/* remapArrowsBatch                                          */
/* ========================================================= */

describe('remapArrowsBatch', () => {
  it('should remap multiple keys in a single pass', () => {
    const arrows = [
      mkArrow({ id: 'a1', from: 'L1_R1', to: 'L1_R2' }),
      mkArrow({ id: 'a2', from: 'L1_R2', to: 'L2_R1' }),
    ]
    const keyMap = new Map([
      ['L1_R1', 'L1_R3'],
      ['L1_R2', 'L1_R4'],
    ])
    const result = remapArrowsBatch(arrows, keyMap)
    expect(result[0].from).toBe('L1_R3')
    expect(result[0].to).toBe('L1_R4')
    expect(result[1].from).toBe('L1_R4')
    expect(result[1].to).toBe('L2_R1')
  })

  it('should not mutate original array', () => {
    const arrows = [mkArrow({ from: 'L1_R1', to: 'L1_R2' })]
    const keyMap = new Map([['L1_R1', 'L1_R3']])
    const result = remapArrowsBatch(arrows, keyMap)
    expect(result).not.toBe(arrows)
    expect(arrows[0].from).toBe('L1_R1')
  })

  it('should handle empty keyMap (no changes)', () => {
    const arrows = [mkArrow({ from: 'L1_R1', to: 'L1_R2' })]
    const result = remapArrowsBatch(arrows, new Map())
    expect(result[0].from).toBe('L1_R1')
    expect(result[0].to).toBe('L1_R2')
  })

  it('should handle empty arrows array', () => {
    const keyMap = new Map([['L1_R1', 'L1_R3']])
    const result = remapArrowsBatch([], keyMap)
    expect(result).toEqual([])
  })

  it('should preserve optional color and dash fields', () => {
    const arrows = [mkArrow({ from: 'A', to: 'B', color: '#ff0000', dash: '5,3' })]
    const keyMap = new Map([['A', 'C']])
    const result = remapArrowsBatch(arrows, keyMap)
    expect(result[0]).toEqual({
      id: 'a1',
      from: 'C',
      to: 'B',
      comment: '',
      color: '#ff0000',
      dash: '5,3',
    })
  })
})

/* ========================================================= */
/* calcMultiDropTargets                                      */
/* ========================================================= */

describe('calcMultiDropTargets', () => {
  const lanes = [{ id: 'L1' }, { id: 'L2' }, { id: 'L3' }]
  const rows = [{ id: 'R1' }, { id: 'R2' }, { id: 'R3' }, { id: 'R4' }]
  const liMap: Record<string, number> = { L1: 0, L2: 1, L3: 2 }
  const riMap: Record<string, number> = { R1: 0, R2: 1, R3: 2, R4: 3 }

  it('should return target keys for valid multi-drop', () => {
    const tasks: Record<string, { lid: string; rid: string }> = {
      L1_R1: { lid: 'L1', rid: 'R1' },
      L1_R2: { lid: 'L1', rid: 'R2' },
    }
    const selected = new Set(['L1_R1', 'L1_R2'])
    const result = calcMultiDropTargets(
      { li: 1, ri: 0, key: 'L2_R1' },
      'L1_R1',
      selected,
      tasks,
      liMap,
      riMap,
      lanes,
      rows,
    )
    expect(result).toEqual(new Set(['L2_R1', 'L2_R2']))
  })

  it('should return null when target is out of bounds', () => {
    const tasks: Record<string, { lid: string; rid: string }> = {
      L3_R3: { lid: 'L3', rid: 'R3' },
      L3_R4: { lid: 'L3', rid: 'R4' },
    }
    const selected = new Set(['L3_R3', 'L3_R4'])
    const result = calcMultiDropTargets(
      { li: 2, ri: 3, key: 'L3_R4' },
      'L3_R3',
      selected,
      tasks,
      liMap,
      riMap,
      lanes,
      rows,
    )
    expect(result).toBeNull()
  })

  it('should return null when target cell has a non-selected node', () => {
    const tasks: Record<string, { lid: string; rid: string }> = {
      L1_R1: { lid: 'L1', rid: 'R1' },
      L1_R2: { lid: 'L1', rid: 'R2' },
      L2_R2: { lid: 'L2', rid: 'R2' },
    }
    const selected = new Set(['L1_R1', 'L1_R2'])
    const result = calcMultiDropTargets(
      { li: 1, ri: 0, key: 'L2_R1' },
      'L1_R1',
      selected,
      tasks,
      liMap,
      riMap,
      lanes,
      rows,
    )
    expect(result).toBeNull()
  })

  it('should allow drop when target overlaps with selected nodes own positions', () => {
    const tasks: Record<string, { lid: string; rid: string }> = {
      L1_R1: { lid: 'L1', rid: 'R1' },
      L1_R2: { lid: 'L1', rid: 'R2' },
    }
    const selected = new Set(['L1_R1', 'L1_R2'])
    const result = calcMultiDropTargets(
      { li: 0, ri: 1, key: 'L1_R2' },
      'L1_R1',
      selected,
      tasks,
      liMap,
      riMap,
      lanes,
      rows,
    )
    expect(result).toEqual(new Set(['L1_R2', 'L1_R3']))
  })

  it('should return null when lane index goes negative', () => {
    const tasks: Record<string, { lid: string; rid: string }> = {
      L1_R1: { lid: 'L1', rid: 'R1' },
      L1_R2: { lid: 'L1', rid: 'R2' },
    }
    const selected = new Set(['L1_R1', 'L1_R2'])
    const result = calcMultiDropTargets(
      { li: 0, ri: -1, key: 'bogus' },
      'L1_R1',
      selected,
      tasks,
      liMap,
      riMap,
      lanes,
      rows,
    )
    expect(result).toBeNull()
  })
})
