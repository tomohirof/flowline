import { describe, it, expect } from 'vitest'
import type { InternalArrow } from '../features/editor/types'
import {
  remapArrows,
  filterArrowsByDeletedKeys,
  calcArrowPath,
  findChain,
  detectReorder,
  reconnectChain,
} from './flow-engine'
import { exitPt, entryPt } from './arrow-routing'
import { computeBridgeArrows } from '../features/editor/auto-connect'

/* --------------------------------------------------------- */
/* helpers                                                   */
/* --------------------------------------------------------- */

function mkArrow(
  overrides: Partial<InternalArrow> & { from: string; to: string },
): InternalArrow {
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
    const arrows = [
      mkArrow({ from: 'A', to: 'B', color: '#ff0000', dash: '5,3' }),
    ]
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
    const result = filterArrowsByDeletedKeys(
      arrows,
      new Set(['A', 'B', 'C', 'D']),
    )
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
    const rows = [
      { id: 'r0' },
      { id: 'r1' },
      { id: 'r2' },
      { id: 'r3' },
      { id: 'r4' },
    ]

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
})
