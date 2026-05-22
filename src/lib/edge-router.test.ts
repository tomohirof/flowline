import { describe, it, expect } from 'vitest'
import { routeAllArrows } from './edge-router'
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

  it('second arrow with no shared endpoint sees first arrow segments as obstacles', () => {
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

    // With a1 present, a2's route must differ from routing alone
    expect(result[1]?.d).not.toBe(alone[0]?.d)
    // And still produce a valid result
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
})
