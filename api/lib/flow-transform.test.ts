// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { toNode, toFlowSummary, toProject, toLane } from './flow-transform'
import type { NodeRow, FlowRow, ProjectRow, LaneRow } from './flow-transform'

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

describe('toFlowSummary', () => {
  it('should include projectId from FlowRow', () => {
    const row: FlowRow = {
      id: 'f1',
      user_id: 'u1',
      title: 'Test Flow',
      theme_id: 'cloud',
      share_token: null,
      deleted_at: null,
      project_id: 'proj1',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }
    const result = toFlowSummary(row)
    expect(result.projectId).toBe('proj1')
    expect(result.id).toBe('f1')
    expect(result.title).toBe('Test Flow')
  })

  it('should handle null project_id', () => {
    const row: FlowRow = {
      id: 'f2',
      user_id: 'u1',
      title: 'Uncategorized',
      theme_id: 'midnight',
      share_token: 'tok1',
      deleted_at: null,
      project_id: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }
    const result = toFlowSummary(row)
    expect(result.projectId).toBeNull()
  })
})

describe('toProject', () => {
  it('should map ProjectRow to camelCase', () => {
    const row: ProjectRow = {
      id: 'p1',
      user_id: 'u1',
      name: 'My Project',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    }
    const result = toProject(row)
    expect(result).toEqual({
      id: 'p1',
      name: 'My Project',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    })
  })

  it('should not expose user_id in output', () => {
    const row: ProjectRow = {
      id: 'p2',
      user_id: 'u-secret',
      name: 'Secret',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }
    const result = toProject(row)
    expect(result).not.toHaveProperty('user_id')
    expect(result).not.toHaveProperty('userId')
  })
})

describe('toLane', () => {
  const baseRow: LaneRow = {
    id: 'l1',
    flow_id: 'f1',
    name: 'Lane',
    color_index: 0,
    position: 0,
    group_id: null,
    group_role: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }

  it('should map group_id and group_role to camelCase for parent role', () => {
    const row: LaneRow = { ...baseRow, group_id: 'g1', group_role: 'parent' }
    const result = toLane(row)
    expect(result.groupId).toBe('g1')
    expect(result.groupRole).toBe('parent')
  })

  it('should preserve sub role', () => {
    const row: LaneRow = { ...baseRow, group_id: 'g1', group_role: 'sub' }
    expect(toLane(row).groupRole).toBe('sub')
  })

  it('should normalize null group fields to undefined', () => {
    const result = toLane(baseRow)
    expect(result.groupId).toBeUndefined()
    expect(result.groupRole).toBeUndefined()
  })

  it('should not include snake_case keys in output', () => {
    const result = toLane({ ...baseRow, group_id: 'g1', group_role: 'parent' })
    expect(result).not.toHaveProperty('group_id')
    expect(result).not.toHaveProperty('group_role')
  })
})
