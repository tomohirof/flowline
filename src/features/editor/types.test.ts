// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { Node, TaskData } from './types'

describe('types', () => {
  it('Node should accept shape property', () => {
    const node: Node = {
      id: 'n1', laneId: 'l1', rowIndex: 0, label: 'test', note: null, orderIndex: 0, shape: 'diamond',
    }
    expect(node.shape).toBe('diamond')
  })

  it('Node should allow shape to be undefined (backward compat)', () => {
    const node: Node = {
      id: 'n1', laneId: 'l1', rowIndex: 0, label: 'test', note: null, orderIndex: 0,
    }
    expect(node.shape).toBeUndefined()
  })

  it('TaskData should accept shape property', () => {
    const task: TaskData = {
      label: 'test', lid: 'l1', rid: 'r1', nodeId: 'n1', shape: 'diamond',
    }
    expect(task.shape).toBe('diamond')
  })
})
