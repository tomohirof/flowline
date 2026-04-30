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
    expect(result?.key).toBe('l0_r0')
  })

  it('should return the closest upstream node when multiple upstream exist', () => {
    const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
    const lanes = [{ id: 'l0' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
      l0_r1: { lid: 'l0', rid: 'r1' },
    }
    const result = findClosestUpstream(tasks, rows, lanes, 2, 0, [])
    expect(result?.key).toBe('l0_r1')
  })

  it('should return same-row left-lane node as upstream', () => {
    const rows = [{ id: 'r0' }]
    const lanes = [{ id: 'l0' }, { id: 'l1' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
    }
    const result = findClosestUpstream(tasks, rows, lanes, 0, 1, [])
    expect(result?.key).toBe('l0_r0')
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
    expect(result?.key).toBe('l1_r1')
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
    expect(result?.key).toBe('C')
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
    expect(result?.key).toBe('B')
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
    expect(result?.key).toBe('Y')
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
    expect(result?.key).toBe('A')
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
    expect(result?.key).toBe('N2')
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
    expect(result?.key).toBe('X')
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
    expect(result?.key).toBe('N4')
  })

  it('should connect from same-row right-lane node (bidirectional) (#297)', () => {
    // Same row, right side node should still be selected
    const rows = [{ id: 'r0' }]
    const lanes = [{ id: 'l0' }, { id: 'l1' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l1_r0: { lid: 'l1', rid: 'r0' },
    }
    const result = findClosestUpstream(tasks, rows, lanes, 0, 0, [])
    expect(result?.key).toBe('l1_r0')
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
    expect(result?.key).toBe('B')
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
    expect(result?.key).toBe('C')
  })

  it('should prefer same-lane upstream non-tail over other-lane tail when inserted between linked nodes', () => {
    // User reported scenario:
    // Row 2: worker_r2 (outgoing → worker_r3), teams_r2 (no outgoing = tail)
    // Row 3: worker_r3 (outgoing → worker_r5, non-tail)
    // Row 4: (empty) ← new node inserted here in worker lane
    // Row 5: worker_r5
    // Expected: worker_r3 (same-lane direct upstream), NOT teams_r2 (closer tail)
    const rows = [
      { id: 'r0' },
      { id: 'r1' },
      { id: 'r2' },
      { id: 'r3' },
      { id: 'r4' },
      { id: 'r5' },
    ]
    const lanes = [
      { id: 'L_customer' },
      { id: 'L_sales' },
      { id: 'L_worker' },
      { id: 'L_worker2' },
      { id: 'L_teams' },
    ]
    const tasks: Record<string, { lid: string; rid: string }> = {
      worker_r2: { lid: 'L_worker', rid: 'r2' },
      teams_r2: { lid: 'L_teams', rid: 'r2' },
      worker_r3: { lid: 'L_worker', rid: 'r3' },
      worker_r5: { lid: 'L_worker', rid: 'r5' },
    }
    const arrows = [
      { id: 'a1', from: 'worker_r2', to: 'teams_r2', comment: '' },
      { id: 'a2', from: 'worker_r2', to: 'worker_r3', comment: '' },
      { id: 'a3', from: 'worker_r3', to: 'worker_r5', comment: '' },
    ]
    const result = findClosestUpstream(tasks, rows, lanes, 4, 2, arrows)
    expect(result?.key).toBe('worker_r3')
  })

  it('should still return same-row node when same-lane upstream and same-row both exist', () => {
    // Verify same-row priority is preserved (Step 1 takes precedence over Step 2)
    const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
    const lanes = [{ id: 'l0' }, { id: 'l1' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      sameLaneUpstream: { lid: 'l0', rid: 'r1' },
      sameRow: { lid: 'l1', rid: 'r2' },
    }
    const arrows = [{ id: 'a1', from: 'sameLaneUpstream', to: 'other', comment: '' }]
    const result = findClosestUpstream(tasks, rows, lanes, 2, 0, arrows)
    expect(result?.key).toBe('sameRow')
  })

  it('should fall through to tail-based search when no same-lane upstream exists', () => {
    // Only upstream is in a different lane as a tail — should still be found
    const rows = [{ id: 'r0' }, { id: 'r1' }]
    const lanes = [{ id: 'l0' }, { id: 'l1' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      otherLaneTail: { lid: 'l0', rid: 'r0' },
    }
    const result = findClosestUpstream(tasks, rows, lanes, 1, 1, [])
    expect(result?.key).toBe('otherLaneTail')
  })

  it('should return crossing arrow upstream when new node is on its path (Step 2.5)', () => {
    // A(l0,r0) → C(l1,r2). New node at (r1, l1).
    // Step 1: same-row r1 — none.
    // Step 2: same-lane l1 upstream — none (C is downstream).
    // Step 2.5: arrow A→C, fromRi=0 < newRi=1 < toRi=2, toLi=l1 === newLi=l1 (タイプ①).
    //          → returns A + splitArrowId.
    const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
    const lanes = [{ id: 'l0' }, { id: 'l1' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      A: { lid: 'l0', rid: 'r0' },
      C: { lid: 'l1', rid: 'r2' },
    }
    const arrows = [{ id: 'a1', from: 'A', to: 'C', comment: '' }]
    const result = findClosestUpstream(tasks, rows, lanes, 1, 1, arrows)
    expect(result?.key).toBe('A')
    expect(result?.splitArrowId).toBe('a1')
  })

  it('should prefer toLi===newLi (タイプ①) over lane-range match (タイプ②) in Step 2.5', () => {
    // Two crossing arrows:
    //   - A(l0,r0) → B(l4,r2): タイプ② (newLi=l2 in [l0..l4])
    //   - X(l1,r0) → Y(l2,r2): タイプ① (toLi=l2=newLi)
    // New at (r1, l2). Both pass row crossing. タイプ① must win.
    const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
    const lanes = [{ id: 'l0' }, { id: 'l1' }, { id: 'l2' }, { id: 'l3' }, { id: 'l4' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      A: { lid: 'l0', rid: 'r0' },
      B: { lid: 'l4', rid: 'r2' },
      X: { lid: 'l1', rid: 'r0' },
      Y: { lid: 'l2', rid: 'r2' },
    }
    const arrows = [
      { id: 'aAB', from: 'A', to: 'B', comment: '' },
      { id: 'aXY', from: 'X', to: 'Y', comment: '' },
    ]
    const result = findClosestUpstream(tasks, rows, lanes, 1, 2, arrows)
    expect(result?.key).toBe('X')
    expect(result?.splitArrowId).toBe('aXY')
  })

  it('should prefer closer fromRi when both candidates are タイプ① in Step 2.5', () => {
    // Two タイプ① arrows landing in newLi=l1:
    //   - A(l0,r0) → C(l1,r5)  fromRi=0, dist=2
    //   - D(l0,r1) → E(l1,r5)  fromRi=1, dist=1 ← closer
    // New at (r2, l1).
    const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }, { id: 'r3' }, { id: 'r4' }, { id: 'r5' }]
    const lanes = [{ id: 'l0' }, { id: 'l1' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      A: { lid: 'l0', rid: 'r0' },
      C: { lid: 'l1', rid: 'r5' },
      D: { lid: 'l0', rid: 'r1' },
      E: { lid: 'l1', rid: 'r5' },
    }
    const arrows = [
      { id: 'aAC', from: 'A', to: 'C', comment: '' },
      { id: 'aDE', from: 'D', to: 'E', comment: '' },
    ]
    const result = findClosestUpstream(tasks, rows, lanes, 2, 1, arrows)
    expect(result?.key).toBe('D')
    expect(result?.splitArrowId).toBe('aDE')
  })

  it('should prefer same-lane upstream (Step 2) over crossing arrow (Step 2.5)', () => {
    // Same-lane upstream P(l1,r1) and crossing arrow A→C exist.
    // Step 2 must return P, splitArrowId must be undefined.
    const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }, { id: 'r3' }]
    const lanes = [{ id: 'l0' }, { id: 'l1' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      P: { lid: 'l1', rid: 'r1' },
      A: { lid: 'l0', rid: 'r0' },
      C: { lid: 'l1', rid: 'r3' },
    }
    const arrows = [{ id: 'aAC', from: 'A', to: 'C', comment: '' }]
    const result = findClosestUpstream(tasks, rows, lanes, 2, 1, arrows)
    expect(result?.key).toBe('P')
    expect(result?.splitArrowId).toBeUndefined()
  })

  it('should prefer same-row node (Step 1) over crossing arrow (Step 2.5)', () => {
    // Same-row node SR(l0,r1) and crossing arrow A→C through (r1,l1).
    const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
    const lanes = [{ id: 'l0' }, { id: 'l1' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      SR: { lid: 'l0', rid: 'r1' },
      A: { lid: 'l0', rid: 'r0' },
      C: { lid: 'l1', rid: 'r2' },
    }
    const arrows = [{ id: 'aAC', from: 'A', to: 'C', comment: '' }]
    const result = findClosestUpstream(tasks, rows, lanes, 1, 1, arrows)
    expect(result?.key).toBe('SR')
    expect(result?.splitArrowId).toBeUndefined()
  })

  it('should fall through to Step 3 when crossing arrow does not match lane criteria', () => {
    // Arrow A(l0,r0) → C(l1,r2). New at (r1, l3).
    // Row crossing OK, but neither toLi(l1)===newLi(l3) nor newLi in [l0..l1] range.
    // → Step 2.5 misses, Step 3 picks tail T.
    const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
    const lanes = [{ id: 'l0' }, { id: 'l1' }, { id: 'l2' }, { id: 'l3' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      A: { lid: 'l0', rid: 'r0' },
      C: { lid: 'l1', rid: 'r2' },
      T: { lid: 'l3', rid: 'r0' }, // isolated tail in upstream row
    }
    const arrows = [{ id: 'aAC', from: 'A', to: 'C', comment: '' }]
    const result = findClosestUpstream(tasks, rows, lanes, 1, 3, arrows)
    expect(result?.key).toBe('T')
    expect(result?.splitArrowId).toBeUndefined()
  })

  it('should reproduce issue #336 scenario (案件情報登録 → 正式登録 with new node on path)', () => {
    // 案件情報登録 (l_sharepoint, r12) → 正式登録 (l_input, r14)
    // 情報提供依頼 (l_sales, r10) is an isolated tail — must NOT be picked.
    // New node at (r13, l_input). Step 2.5 must intercept.
    const rows = Array.from({ length: 16 }, (_, i) => ({ id: `r${i}` }))
    const lanes = [
      { id: 'l_sales' },
      { id: 'l_sharepoint' },
      { id: 'l_input' },
    ]
    const tasks: Record<string, { lid: string; rid: string }> = {
      info_request: { lid: 'l_sales', rid: 'r10' }, // 情報提供依頼 (tail)
      sp_register: { lid: 'l_sharepoint', rid: 'r12' }, // 案件情報登録
      formal_register: { lid: 'l_input', rid: 'r14' }, // 正式登録
    }
    const arrows = [
      { id: 'a_sp_to_formal', from: 'sp_register', to: 'formal_register', comment: '' },
    ]
    const result = findClosestUpstream(tasks, rows, lanes, 13, 2, arrows)
    expect(result?.key).toBe('sp_register')
    expect(result?.splitArrowId).toBe('a_sp_to_formal')
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
