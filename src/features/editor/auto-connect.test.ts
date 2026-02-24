import { describe, it, expect } from 'vitest'
import { findClosestUpstream } from './auto-connect'

describe('findClosestUpstream', () => {
  it('should return the node in the row directly above when single upstream exists', () => {
    const rows = [{ id: 'r0' }, { id: 'r1' }]
    const lanes = [{ id: 'l0' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
    }
    const result = findClosestUpstream(tasks, rows, lanes, 1, 0)
    expect(result).toBe('l0_r0')
  })

  it('should return the closest upstream node when multiple upstream exist', () => {
    const rows = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
    const lanes = [{ id: 'l0' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
      l0_r1: { lid: 'l0', rid: 'r1' },
    }
    const result = findClosestUpstream(tasks, rows, lanes, 2, 0)
    expect(result).toBe('l0_r1')
  })

  it('should return same-row left-lane node as upstream', () => {
    const rows = [{ id: 'r0' }]
    const lanes = [{ id: 'l0' }, { id: 'l1' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
    }
    const result = findClosestUpstream(tasks, rows, lanes, 0, 1)
    expect(result).toBe('l0_r0')
  })

  it('should return null when new node is at the top-left (no upstream)', () => {
    const rows = [{ id: 'r0' }, { id: 'r1' }]
    const lanes = [{ id: 'l0' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r1: { lid: 'l0', rid: 'r1' },
    }
    const result = findClosestUpstream(tasks, rows, lanes, 0, 0)
    expect(result).toBeNull()
  })

  it('should return null when tasks is empty', () => {
    const rows = [{ id: 'r0' }]
    const lanes = [{ id: 'l0' }]
    const tasks: Record<string, { lid: string; rid: string }> = {}
    const result = findClosestUpstream(tasks, rows, lanes, 0, 0)
    expect(result).toBeNull()
  })

  it('should not return same-row same-lane or right-lane node', () => {
    const rows = [{ id: 'r0' }]
    const lanes = [{ id: 'l0' }, { id: 'l1' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l1_r0: { lid: 'l1', rid: 'r0' },
    }
    const result = findClosestUpstream(tasks, rows, lanes, 0, 0)
    expect(result).toBeNull()
  })

  it('should prefer same-row left lane over higher row when same row is closer', () => {
    const rows = [{ id: 'r0' }, { id: 'r1' }]
    const lanes = [{ id: 'l0' }, { id: 'l1' }, { id: 'l2' }]
    const tasks: Record<string, { lid: string; rid: string }> = {
      l0_r0: { lid: 'l0', rid: 'r0' },
      l1_r1: { lid: 'l1', rid: 'r1' },
    }
    const result = findClosestUpstream(tasks, rows, lanes, 1, 2)
    expect(result).toBe('l1_r1')
  })
})
