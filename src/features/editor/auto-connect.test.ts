import { describe, it, expect } from 'vitest'
import { findClosestUpstream, findCrossingArrows } from './auto-connect'

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

  it('should not return same-row same-lane or right-lane node', () => {
    const rows = [{ id: 'r0' }]
    const lanes = [{ id: 'l0' }, { id: 'l1' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l1_r0: { lid: 'l1', rid: 'r0' },
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

  it('should return null when all upstream nodes have outgoing arrows', () => {
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
    const result = findClosestUpstream(tasks, rows, lanes, 0, 1, arrows)
    expect(result).toBeNull()
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
