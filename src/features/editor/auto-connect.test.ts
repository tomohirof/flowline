import { describe, it, expect } from 'vitest'
import { findClosestUpstream, findCrossingArrows, computeBridgeArrows } from './auto-connect'

describe('findClosestUpstream', () => {
  it('should return the node in the row directly above when single upstream exists', () => {
    const rows = [{ id: 'r0' }, { id: 'r1' }]
    const lanes = [{ id: 'l0' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
    }
    const result = findClosestUpstream(tasks, rows, lanes, 1, 0, [])
    expect(result).toBe('l0_r0')
  })

  it('should return the closest upstream node when multiple upstream exist', () => {
    const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
    const lanes = [{ id: 'l0' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
      l0_r1: { lid: 'l0', rid: 'r1' },
    }
    const result = findClosestUpstream(tasks, rows, lanes, 2, 0, [])
    expect(result).toBe('l0_r1')
  })

  it('should return same-row left-lane node as upstream', () => {
    const rows = [{ id: 'r0' }]
    const lanes = [{ id: 'l0' }, { id: 'l1' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
    }
    const result = findClosestUpstream(tasks, rows, lanes, 0, 1, [])
    expect(result).toBe('l0_r0')
  })

  it('should return null when new node is at the top-left (no upstream)', () => {
    const rows = [{ id: 'r0' }, { id: 'r1' }]
    const lanes = [{ id: 'l0' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r1: { lid: 'l0', rid: 'r1' },
    }
    const result = findClosestUpstream(tasks, rows, lanes, 0, 0, [])
    expect(result).toBeNull()
  })

  it('should return null when tasks is empty', () => {
    const rows = [{ id: 'r0' }]
    const lanes = [{ id: 'l0' }]
    const tasks: Record<string, { lid: string; rid: string }> = {}
    const result = findClosestUpstream(tasks, rows, lanes, 0, 0, [])
    expect(result).toBeNull()
  })

  it('should not return same-row same-lane node', () => {
    const rows = [{ id: 'r0' }]
    const lanes = [{ id: 'l0' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
    }
    const result = findClosestUpstream(tasks, rows, lanes, 0, 0, [])
    expect(result).toBeNull()
  })

  it('should prefer same-row left lane over higher row when same row is closer', () => {
    const rows = [{ id: 'r0' }, { id: 'r1' }]
    const lanes = [{ id: 'l0' }, { id: 'l1' }, { id: 'l2' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
      l1_r1: { lid: 'l1', rid: 'r1' },
    }
    const result = findClosestUpstream(tasks, rows, lanes, 1, 2, [])
    expect(result).toBe('l1_r1')
  })

  it('should prefer tail node (no outgoing arrow) over mid-chain node', () => {
    const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }, { id: 'r3' }]
    const lanes = [{ id: 'l0' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      A: { lid: 'l0', rid: 'r0' },
      B: { lid: 'l0', rid: 'r1' },
      C: { lid: 'l0', rid: 'r2' },
    }
    const arrows = [
      { id: 'a1', from: 'A', to: 'B', comment: '' },
      { id: 'a2', from: 'B', to: 'C', comment: '' },
    ]
    const result = findClosestUpstream(tasks, rows, lanes, 3, 0, arrows)
    expect(result).toBe('C')
  })

  it('should prefer flow-connected tail over isolated tail', () => {
    const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
    const lanes = [{ id: 'l0' }, { id: 'l1' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      A: { lid: 'l0', rid: 'r0' },
      B: { lid: 'l0', rid: 'r1' },
      X: { lid: 'l1', rid: 'r1' },
    }
    const arrows = [{ id: 'a1', from: 'A', to: 'B', comment: '' }]
    const result = findClosestUpstream(tasks, rows, lanes, 2, 0, arrows)
    expect(result).toBe('B')
  })

  it('should fall back to isolated tails when no flow-connected tails exist', () => {
    const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
    const lanes = [{ id: 'l0' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      X: { lid: 'l0', rid: 'r0' },
      Y: { lid: 'l0', rid: 'r1' },
    }
    const arrows: { id: string; from: string; to: string; comment: string }[] = []
    const result = findClosestUpstream(tasks, rows, lanes, 2, 0, arrows)
    expect(result).toBe('Y')
  })

  it('should return same-row non-tail when no tails exist on same row (#297)', () => {
    const rows = [{ id: 'r0' }, { id: 'r1' }]
    const lanes = [{ id: 'l0' }, { id: 'l1' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      A: { lid: 'l0', rid: 'r0' },
      B: { lid: 'l0', rid: 'r1' },
      C: { lid: 'l1', rid: 'r1' },
    }
    const arrows = [
      { id: 'a1', from: 'A', to: 'B', comment: '' },
      { id: 'a2', from: 'A', to: 'C', comment: '' },
    ]
    // A is same-row (r0), has outgoing but is closest same-row node
    const result = findClosestUpstream(tasks, rows, lanes, 0, 1, arrows)
    expect(result).toBe('A')
  })

  it('should prefer same-row node over upstream isolated tail (#241, #297)', () => {
    // N1→N2→N3 chain (l0, r0→r1→r2), N4 isolated (l1, r0)
    // New at (r1, l1) — N2 is same-row (closest), N4 is upstream isolated tail
    // Same-row takes priority (#297)
    const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
    const lanes = [{ id: 'l0' }, { id: 'l1' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      N1: { lid: 'l0', rid: 'r0' },
      N2: { lid: 'l0', rid: 'r1' },
      N3: { lid: 'l0', rid: 'r2' },
      N4: { lid: 'l1', rid: 'r0' },
    }
    const arrows = [
      { id: 'a1', from: 'N1', to: 'N2', comment: '' },
      { id: 'a2', from: 'N2', to: 'N3', comment: '' },
    ]
    const result = findClosestUpstream(tasks, rows, lanes, 1, 1, arrows)
    expect(result).toBe('N2')
  })

  it('should prefer same-row isolated tail over previous-row flowTail (#265)', () => {
    // Row 3: A → B (chain), Row 4: X (isolated), new node at Row 4 lane 1
    const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }, { id: 'r3' }, { id: 'r4' }]
    const lanes = [{ id: 'l0' }, { id: 'l1' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      A: { lid: 'l0', rid: 'r3' },
      B: { lid: 'l1', rid: 'r3' },
      X: { lid: 'l0', rid: 'r4' },
    }
    const arrows = [{ id: 'a1', from: 'A', to: 'B', comment: '' }]
    // New node at row4(r4), lane1(l1) — X is same-row isolated tail, B is flowTail at row3
    const result = findClosestUpstream(tasks, rows, lanes, 4, 1, arrows)
    expect(result).toBe('X')
  })

  it('should connect from same-row non-tail node when it is closest (#297)', () => {
    // Reproduces user's exact scenario:
    // Node1(l0,r0), Node2(l4,r0), Node3(l1,r1), Node4(l3,r2), Node5(l2,r3)
    // Arrows: 1→2, 4→5
    // Add Node6 at (r2, l1) — expect 4→6 (same row, closest)
    const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }, { id: 'r3' }]
    const lanes = [{ id: 'l0' }, { id: 'l1' }, { id: 'l2' }, { id: 'l3' }, { id: 'l4' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      N1: { lid: 'l0', rid: 'r0' },
      N2: { lid: 'l4', rid: 'r0' },
      N3: { lid: 'l1', rid: 'r1' },
      N4: { lid: 'l3', rid: 'r2' },
      N5: { lid: 'l2', rid: 'r3' },
    }
    const arrows = [
      { id: 'a1', from: 'N1', to: 'N2', comment: '' },
      { id: 'a2', from: 'N4', to: 'N5', comment: '' },
    ]
    const result = findClosestUpstream(tasks, rows, lanes, 2, 1, arrows)
    expect(result).toBe('N4')
  })

  it('should connect from same-row right-lane node (bidirectional) (#297)', () => {
    // Same row, right side node should still be selected
    const rows = [{ id: 'r0' }]
    const lanes = [{ id: 'l0' }, { id: 'l1' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l1_r0: { lid: 'l1', rid: 'r0' },
    }
    const result = findClosestUpstream(tasks, rows, lanes, 0, 0, [])
    expect(result).toBe('l1_r0')
  })

  it('should prefer same-row tail over same-row non-tail at equal distance (#297)', () => {
    // Two same-row nodes at equal distance: one tail, one non-tail
    const rows = [{ id: 'r0' }]
    const lanes = [{ id: 'l0' }, { id: 'l1' }, { id: 'l2' }, { id: 'l3' }, { id: 'l4' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      A: { lid: 'l0', rid: 'r0' }, // dist 2, non-tail
      B: { lid: 'l4', rid: 'r0' }, // dist 2, tail
    }
    const arrows = [{ id: 'a1', from: 'A', to: 'X', comment: '' }]
    const result = findClosestUpstream(tasks, rows, lanes, 0, 2, arrows)
    expect(result).toBe('B')
  })

  it('should prefer same-row closest tail when multiple same-row tails exist', () => {
    // Row 0: A → B (B is flowTail at l1), C is isolated at l2, new node at l3
    const rows = [{ id: 'r0' }]
    const lanes = [{ id: 'l0' }, { id: 'l1' }, { id: 'l2' }, { id: 'l3' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      A: { lid: 'l0', rid: 'r0' },
      B: { lid: 'l1', rid: 'r0' },
      C: { lid: 'l2', rid: 'r0' },
    }
    const arrows = [{ id: 'a1', from: 'A', to: 'B', comment: '' }]
    const result = findClosestUpstream(tasks, rows, lanes, 0, 3, arrows)
    // C is closer (l2 vs l1), both are same-row tails
    expect(result).toBe('C')
  })
})

describe('findCrossingArrows', () => {
  it('should detect arrow crossing the inserted row', () => {
    const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
      l0_r2: { lid: 'l0', rid: 'r2' },
    }
    const arrows = [{ id: 'a1', from: 'l0_r0', to: 'l0_r2', comment: '' }]
    const result = findCrossingArrows(arrows, tasks, rows, 1)
    expect(result).toEqual([{ id: 'a1', from: 'l0_r0', to: 'l0_r2', comment: '' }])
  })

  it('should return empty array when no arrows cross', () => {
    const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
      l0_r1: { lid: 'l0', rid: 'r1' },
    }
    const arrows = [{ id: 'a1', from: 'l0_r0', to: 'l0_r1', comment: '' }]
    const result = findCrossingArrows(arrows, tasks, rows, 2)
    expect(result).toEqual([])
  })

  it('should return empty array when arrows is empty', () => {
    const rows = [{ id: 'r0' }, { id: 'r1' }]
    const tasks: Record<string, { lid: string; rid: string }> = {}
    const result = findCrossingArrows([], tasks, rows, 1)
    expect(result).toEqual([])
  })

  it('should detect multiple crossing arrows', () => {
    const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
      l1_r0: { lid: 'l1', rid: 'r0' },
      l0_r2: { lid: 'l0', rid: 'r2' },
      l1_r2: { lid: 'l1', rid: 'r2' },
    }
    const arrows = [
      { id: 'a1', from: 'l0_r0', to: 'l0_r2', comment: '' },
      { id: 'a2', from: 'l1_r0', to: 'l1_r2', comment: '' },
    ]
    const result = findCrossingArrows(arrows, tasks, rows, 1)
    expect(result).toHaveLength(2)
  })

  it('should skip arrows with missing task references', () => {
    const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
    }
    const arrows = [{ id: 'a1', from: 'l0_r0', to: 'l0_r2', comment: '' }]
    const result = findCrossingArrows(arrows, tasks, rows, 1)
    expect(result).toEqual([])
  })
})

describe('computeBridgeArrows', () => {
  it('should bridge A→C when deleting B from A→B→C', () => {
    const arrows = [
      { id: 'a1', from: 'A', to: 'B', comment: '' },
      { id: 'a2', from: 'B', to: 'C', comment: '' },
    ]
    const result = computeBridgeArrows(new Set(['B']), arrows)
    expect(result).toHaveLength(1)
    expect(result[0].from).toBe('A')
    expect(result[0].to).toBe('C')
    expect(result[0].comment).toBe('')
  })

  it('should bridge multiple incoming × outgoing pairs', () => {
    const arrows = [
      { id: 'a1', from: 'A', to: 'B', comment: '' },
      { id: 'a2', from: 'X', to: 'B', comment: '' },
      { id: 'a3', from: 'B', to: 'C', comment: '' },
      { id: 'a4', from: 'B', to: 'D', comment: '' },
    ]
    const result = computeBridgeArrows(new Set(['B']), arrows)
    expect(result).toHaveLength(4)
    const pairs = result.map((a) => `${a.from}->${a.to}`)
    expect(pairs).toContain('A->C')
    expect(pairs).toContain('A->D')
    expect(pairs).toContain('X->C')
    expect(pairs).toContain('X->D')
  })

  it('should not create duplicate bridges when arrow already exists', () => {
    const arrows = [
      { id: 'a1', from: 'A', to: 'B', comment: '' },
      { id: 'a2', from: 'B', to: 'C', comment: '' },
      { id: 'a3', from: 'A', to: 'C', comment: '' },
    ]
    const result = computeBridgeArrows(new Set(['B']), arrows)
    expect(result).toHaveLength(0)
  })

  it('should not create self-loop bridges', () => {
    const arrows = [
      { id: 'a1', from: 'A', to: 'B', comment: '' },
      { id: 'a2', from: 'B', to: 'A', comment: '' },
    ]
    const result = computeBridgeArrows(new Set(['B']), arrows)
    expect(result).toHaveLength(0)
  })

  it('should return empty when deleted node has no arrows', () => {
    const arrows = [{ id: 'a1', from: 'X', to: 'Y', comment: '' }]
    const result = computeBridgeArrows(new Set(['Z']), arrows)
    expect(result).toHaveLength(0)
  })

  it('should handle multi-node deletion without bridging internal arrows', () => {
    const arrows = [
      { id: 'a1', from: 'A', to: 'B', comment: '' },
      { id: 'a2', from: 'B', to: 'C', comment: '' },
      { id: 'a3', from: 'C', to: 'D', comment: '' },
    ]
    const result = computeBridgeArrows(new Set(['B', 'C']), arrows)
    expect(result).toHaveLength(1)
    expect(result[0].from).toBe('A')
    expect(result[0].to).toBe('D')
  })

  it('should return empty when deleting all nodes in a chain', () => {
    const arrows = [{ id: 'a1', from: 'A', to: 'B', comment: '' }]
    const result = computeBridgeArrows(new Set(['A', 'B']), arrows)
    expect(result).toHaveLength(0)
  })
})
