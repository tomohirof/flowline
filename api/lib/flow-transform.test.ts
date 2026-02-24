// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { toNode } from './flow-transform'
import type { NodeRow } from './flow-transform'

describe('toNode', () => {
  it('should map shape field from NodeRow', () => {
    const row: NodeRow = {
      id: 'n1',
      flow_id: 'f1',
      lane_id: 'l1',
      row_index: 0,
      label: 'test',
      note: null,
      order_index: 0,
      bg: null,
      stroke_color: null,
      dash: null,
      shape: 'diamond',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }
    expect(toNode(row).shape).toBe('diamond')
  })

  it('should handle null shape', () => {
    const row: NodeRow = {
      id: 'n1',
      flow_id: 'f1',
      lane_id: 'l1',
      row_index: 0,
      label: 'test',
      note: null,
      order_index: 0,
      bg: null,
      stroke_color: null,
      dash: null,
      shape: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }
    expect(toNode(row).shape).toBeNull()
  })
})
