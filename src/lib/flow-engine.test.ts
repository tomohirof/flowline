import { describe, it, expect } from 'vitest'
import type { InternalArrow } from '../features/editor/types'
import { remapArrows, filterArrowsByDeletedKeys } from './flow-engine'

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
