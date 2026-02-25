// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Dispatch, SetStateAction } from 'react'
import type { InternalArrow, TaskData, RowData } from '../types'
import { useMoveAutoRepair } from './useMoveAutoRepair'

/* --------------------------------------------------------- */
/* helpers                                                   */
/* --------------------------------------------------------- */

const mkArrow = (id: string, from: string, to: string, comment = ''): InternalArrow => ({
  id,
  from,
  to,
  comment,
})

vi.mock('../../../lib/uid', () => ({
  uid: (() => {
    let counter = 0
    return () => `uid-${++counter}`
  })(),
}))

/* --------------------------------------------------------- */
/* shared setup                                              */
/* --------------------------------------------------------- */

describe('useMoveAutoRepair', () => {
  let addConfirmToast: ReturnType<typeof vi.fn>
  let addSuccessToast: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    addConfirmToast = vi.fn()
    addSuccessToast = vi.fn()
  })

  /* ======================================================= */
  /* Skip conditions                                         */
  /* ======================================================= */

  describe('skip conditions', () => {
    it('should not show toast when lane has fewer than 3 nodes in chain', () => {
      // 2-node chain: A→B
      const arrows: InternalArrow[] = [mkArrow('a1', 'l0_r0', 'l0_r1')]
      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r1: { label: 'B', lid: 'l0', rid: 'r1', nodeId: 'n2' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }]
      const setArrows = vi.fn() as unknown as Dispatch<SetStateAction<InternalArrow[]>>

      const { result } = renderHook(() =>
        useMoveAutoRepair({
          arrows,
          setArrows,
          tasks,
          rows,
          addConfirmToast,
          addSuccessToast,
        }),
      )

      act(() => {
        result.current.triggerMoveRepairCheck('l0_r1', 'l0')
      })

      expect(addConfirmToast).not.toHaveBeenCalled()
    })

    it('should not show toast when movedKey is not in chain', () => {
      // 3-node chain: A→B→C, but movedKey is D (not in chain)
      const arrows: InternalArrow[] = [
        mkArrow('a1', 'l0_r0', 'l0_r1'),
        mkArrow('a2', 'l0_r1', 'l0_r2'),
      ]
      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r1: { label: 'B', lid: 'l0', rid: 'r1', nodeId: 'n2' },
        l0_r2: { label: 'C', lid: 'l0', rid: 'r2', nodeId: 'n3' },
        l0_r3: { label: 'D', lid: 'l0', rid: 'r3', nodeId: 'n4' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }, { id: 'r3' }]
      const setArrows = vi.fn() as unknown as Dispatch<SetStateAction<InternalArrow[]>>

      const { result } = renderHook(() =>
        useMoveAutoRepair({
          arrows,
          setArrows,
          tasks,
          rows,
          addConfirmToast,
          addSuccessToast,
        }),
      )

      act(() => {
        result.current.triggerMoveRepairCheck('l0_r3', 'l0')
      })

      expect(addConfirmToast).not.toHaveBeenCalled()
    })

    it('should not show toast when chain order matches position order', () => {
      // 3-node chain A→B→C, all in correct row order
      const arrows: InternalArrow[] = [
        mkArrow('a1', 'l0_r0', 'l0_r1'),
        mkArrow('a2', 'l0_r1', 'l0_r2'),
      ]
      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r1: { label: 'B', lid: 'l0', rid: 'r1', nodeId: 'n2' },
        l0_r2: { label: 'C', lid: 'l0', rid: 'r2', nodeId: 'n3' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
      const setArrows = vi.fn() as unknown as Dispatch<SetStateAction<InternalArrow[]>>

      const { result } = renderHook(() =>
        useMoveAutoRepair({
          arrows,
          setArrows,
          tasks,
          rows,
          addConfirmToast,
          addSuccessToast,
        }),
      )

      act(() => {
        result.current.triggerMoveRepairCheck('l0_r1', 'l0')
      })

      expect(addConfirmToast).not.toHaveBeenCalled()
    })

    it('should not show toast when lane has no chain arrows', () => {
      // Nodes exist in lane but no arrows connecting them
      const arrows: InternalArrow[] = []
      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r1: { label: 'B', lid: 'l0', rid: 'r1', nodeId: 'n2' },
        l0_r2: { label: 'C', lid: 'l0', rid: 'r2', nodeId: 'n3' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
      const setArrows = vi.fn() as unknown as Dispatch<SetStateAction<InternalArrow[]>>

      const { result } = renderHook(() =>
        useMoveAutoRepair({
          arrows,
          setArrows,
          tasks,
          rows,
          addConfirmToast,
          addSuccessToast,
        }),
      )

      act(() => {
        result.current.triggerMoveRepairCheck('l0_r0', 'l0')
      })

      expect(addConfirmToast).not.toHaveBeenCalled()
    })
  })

  /* ======================================================= */
  /* Happy path                                              */
  /* ======================================================= */

  describe('happy path', () => {
    it('should show confirm toast with correct message/detail/crossingCount for 5-node chain', () => {
      // Chain order: A→B→C→D→E but position order: A→C→D→E→B (B moved to last row)
      const arrows: InternalArrow[] = [
        mkArrow('a1', 'l0_r0', 'l0_r1'),
        mkArrow('a2', 'l0_r1', 'l0_r2'),
        mkArrow('a3', 'l0_r2', 'l0_r3'),
        mkArrow('a4', 'l0_r3', 'l0_r4'),
      ]
      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r1: { label: 'B', lid: 'l0', rid: 'r4', nodeId: 'n2' }, // moved to r4
        l0_r2: { label: 'C', lid: 'l0', rid: 'r1', nodeId: 'n3' },
        l0_r3: { label: 'D', lid: 'l0', rid: 'r2', nodeId: 'n4' },
        l0_r4: { label: 'E', lid: 'l0', rid: 'r3', nodeId: 'n5' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }, { id: 'r3' }, { id: 'r4' }]
      const setArrows = vi.fn() as unknown as Dispatch<SetStateAction<InternalArrow[]>>

      const { result } = renderHook(() =>
        useMoveAutoRepair({
          arrows,
          setArrows,
          tasks,
          rows,
          addConfirmToast,
          addSuccessToast,
        }),
      )

      act(() => {
        result.current.triggerMoveRepairCheck('l0_r1', 'l0')
      })

      expect(addConfirmToast).toHaveBeenCalledOnce()
      const toast = addConfirmToast.mock.calls[0][0]
      expect(toast.message).toBe('接続順を修復しますか？')
      // proposed order: A→C→D→E→B
      expect(toast.detail).toBe('接続順を修復: A → C → D → E → B')
      expect(toast.crossingCount).toBe(4) // 5 nodes => 4 arrows
      expect(typeof toast.onConfirm).toBe('function')
    })

    it('should show correct crossingCount (2) for 3-node chain with mismatch', () => {
      // Chain: A→B→C, but B is at row r2 and C is at row r1 (swapped)
      const arrows: InternalArrow[] = [
        mkArrow('a1', 'l0_r0', 'l0_r1'),
        mkArrow('a2', 'l0_r1', 'l0_r2'),
      ]
      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r1: { label: 'B', lid: 'l0', rid: 'r2', nodeId: 'n2' }, // moved to r2
        l0_r2: { label: 'C', lid: 'l0', rid: 'r1', nodeId: 'n3' }, // moved to r1
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
      const setArrows = vi.fn() as unknown as Dispatch<SetStateAction<InternalArrow[]>>

      const { result } = renderHook(() =>
        useMoveAutoRepair({
          arrows,
          setArrows,
          tasks,
          rows,
          addConfirmToast,
          addSuccessToast,
        }),
      )

      act(() => {
        result.current.triggerMoveRepairCheck('l0_r1', 'l0')
      })

      expect(addConfirmToast).toHaveBeenCalledOnce()
      const toast = addConfirmToast.mock.calls[0][0]
      expect(toast.crossingCount).toBe(2) // 3 nodes => 2 arrows
    })
  })

  /* ======================================================= */
  /* onConfirm execution                                     */
  /* ======================================================= */

  describe('onConfirm execution', () => {
    it('should replace old chain arrows with position-sorted arrows and preserve cross-lane arrows', () => {
      // Chain: A→B→C in lane l0, cross-lane arrow: A→X (l1)
      // B moved to r2, C at r1 => proposed: A→C→B
      const initialArrows: InternalArrow[] = [
        mkArrow('a1', 'l0_r0', 'l0_r1'), // chain: A→B
        mkArrow('a2', 'l0_r1', 'l0_r2'), // chain: B→C
        mkArrow('a3', 'l0_r0', 'l1_r0'), // cross-lane: A→X (should be preserved)
      ]
      let currentArrows = [...initialArrows]
      const setArrows = vi.fn((updater: (prev: InternalArrow[]) => InternalArrow[]) => {
        currentArrows = updater(currentArrows)
      }) as unknown as Dispatch<SetStateAction<InternalArrow[]>>

      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r1: { label: 'B', lid: 'l0', rid: 'r2', nodeId: 'n2' },
        l0_r2: { label: 'C', lid: 'l0', rid: 'r1', nodeId: 'n3' },
        l1_r0: { label: 'X', lid: 'l1', rid: 'r0', nodeId: 'n4' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]

      const { result } = renderHook(() =>
        useMoveAutoRepair({
          arrows: initialArrows,
          setArrows,
          tasks,
          rows,
          addConfirmToast,
          addSuccessToast,
        }),
      )

      act(() => {
        result.current.triggerMoveRepairCheck('l0_r1', 'l0')
      })

      // Execute onConfirm
      const toast = addConfirmToast.mock.calls[0][0]
      toast.onConfirm()

      expect(setArrows).toHaveBeenCalled()

      // Cross-lane arrow should be preserved
      const crossLane = currentArrows.find((a) => a.id === 'a3')
      expect(crossLane).toBeDefined()
      expect(crossLane!.from).toBe('l0_r0')
      expect(crossLane!.to).toBe('l1_r0')

      // Old chain arrows (a1, a2) should be removed
      expect(currentArrows.find((a) => a.id === 'a1')).toBeUndefined()
      expect(currentArrows.find((a) => a.id === 'a2')).toBeUndefined()

      // New chain arrows should be: A→C, C→B (position order)
      const newChainArrows = currentArrows.filter((a) => a.id !== 'a3')
      expect(newChainArrows).toHaveLength(2)

      const fromTos = newChainArrows.map((a) => `${a.from}->${a.to}`)
      expect(fromTos).toContain('l0_r0->l0_r2') // A→C
      expect(fromTos).toContain('l0_r2->l0_r1') // C→B
    })

    it('should not preserve comments when pairs change', () => {
      // Chain: A→B→C with comment on A→B
      // After repair: A→C→B — the A→B pair no longer exists
      const initialArrows: InternalArrow[] = [
        mkArrow('a1', 'l0_r0', 'l0_r1', '重要コメント'),
        mkArrow('a2', 'l0_r1', 'l0_r2'),
      ]
      let currentArrows = [...initialArrows]
      const setArrows = vi.fn((updater: (prev: InternalArrow[]) => InternalArrow[]) => {
        currentArrows = updater(currentArrows)
      }) as unknown as Dispatch<SetStateAction<InternalArrow[]>>

      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r1: { label: 'B', lid: 'l0', rid: 'r2', nodeId: 'n2' },
        l0_r2: { label: 'C', lid: 'l0', rid: 'r1', nodeId: 'n3' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]

      const { result } = renderHook(() =>
        useMoveAutoRepair({
          arrows: initialArrows,
          setArrows,
          tasks,
          rows,
          addConfirmToast,
          addSuccessToast,
        }),
      )

      act(() => {
        result.current.triggerMoveRepairCheck('l0_r1', 'l0')
      })

      const toast = addConfirmToast.mock.calls[0][0]
      toast.onConfirm()

      // A→C is a new pair (not A→B), so comment should NOT be preserved
      const arrowAC = currentArrows.find((a) => a.from === 'l0_r0' && a.to === 'l0_r2')
      expect(arrowAC).toBeDefined()
      expect(arrowAC!.comment).toBe('')

      // C→B is also a new pair, no comment
      const arrowCB = currentArrows.find((a) => a.from === 'l0_r2' && a.to === 'l0_r1')
      expect(arrowCB).toBeDefined()
      expect(arrowCB!.comment).toBe('')
    })

    it('should preserve comments when same pair exists in new chain', () => {
      // Chain: A→B→C→D. After move: A→B→D→C (C and D swap).
      // A→B pair survives, so its comment should be preserved.
      const initialArrows: InternalArrow[] = [
        mkArrow('a1', 'l0_r0', 'l0_r1', '保持コメント'), // A→B
        mkArrow('a2', 'l0_r1', 'l0_r2'), // B→C
        mkArrow('a3', 'l0_r2', 'l0_r3'), // C→D
      ]
      let currentArrows = [...initialArrows]
      const setArrows = vi.fn((updater: (prev: InternalArrow[]) => InternalArrow[]) => {
        currentArrows = updater(currentArrows)
      }) as unknown as Dispatch<SetStateAction<InternalArrow[]>>

      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r1: { label: 'B', lid: 'l0', rid: 'r1', nodeId: 'n2' },
        l0_r2: { label: 'C', lid: 'l0', rid: 'r3', nodeId: 'n3' }, // C moved to r3
        l0_r3: { label: 'D', lid: 'l0', rid: 'r2', nodeId: 'n4' }, // D at r2
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }, { id: 'r3' }]

      const { result } = renderHook(() =>
        useMoveAutoRepair({
          arrows: initialArrows,
          setArrows,
          tasks,
          rows,
          addConfirmToast,
          addSuccessToast,
        }),
      )

      act(() => {
        result.current.triggerMoveRepairCheck('l0_r2', 'l0')
      })

      const toast = addConfirmToast.mock.calls[0][0]
      toast.onConfirm()

      // Proposed: A→B→D→C
      // A→B pair still exists, comment should be preserved
      const arrowAB = currentArrows.find((a) => a.from === 'l0_r0' && a.to === 'l0_r1')
      expect(arrowAB).toBeDefined()
      expect(arrowAB!.comment).toBe('保持コメント')
    })

    it('should show success toast after repair with correct arrow count', () => {
      // 3-node chain with mismatch → repair → success toast with "2本"
      const initialArrows: InternalArrow[] = [
        mkArrow('a1', 'l0_r0', 'l0_r1'),
        mkArrow('a2', 'l0_r1', 'l0_r2'),
      ]
      let currentArrows = [...initialArrows]
      const setArrows = vi.fn((updater: (prev: InternalArrow[]) => InternalArrow[]) => {
        currentArrows = updater(currentArrows)
      }) as unknown as Dispatch<SetStateAction<InternalArrow[]>>

      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r1: { label: 'B', lid: 'l0', rid: 'r2', nodeId: 'n2' },
        l0_r2: { label: 'C', lid: 'l0', rid: 'r1', nodeId: 'n3' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]

      const { result } = renderHook(() =>
        useMoveAutoRepair({
          arrows: initialArrows,
          setArrows,
          tasks,
          rows,
          addConfirmToast,
          addSuccessToast,
        }),
      )

      act(() => {
        result.current.triggerMoveRepairCheck('l0_r1', 'l0')
      })

      const toast = addConfirmToast.mock.calls[0][0]
      toast.onConfirm()

      expect(addSuccessToast).toHaveBeenCalledOnce()
      expect(addSuccessToast.mock.calls[0][0].message).toBe(
        '↻ オートリペア: 2本の矢印を修復しました',
      )
    })
  })

  /* ======================================================= */
  /* Edge cases                                              */
  /* ======================================================= */

  describe('edge cases', () => {
    it('should not crash on circular reference (A→B→C→A)', () => {
      const arrows: InternalArrow[] = [
        mkArrow('a1', 'l0_r0', 'l0_r1'),
        mkArrow('a2', 'l0_r1', 'l0_r2'),
        mkArrow('a3', 'l0_r2', 'l0_r0'),
      ]
      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r1: { label: 'B', lid: 'l0', rid: 'r1', nodeId: 'n2' },
        l0_r2: { label: 'C', lid: 'l0', rid: 'r2', nodeId: 'n3' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
      const setArrows = vi.fn() as unknown as Dispatch<SetStateAction<InternalArrow[]>>

      // Should not throw
      expect(() => {
        const { result } = renderHook(() =>
          useMoveAutoRepair({
            arrows,
            setArrows,
            tasks,
            rows,
            addConfirmToast,
            addSuccessToast,
          }),
        )

        act(() => {
          result.current.triggerMoveRepairCheck('l0_r0', 'l0')
        })
      }).not.toThrow()
    })

    it('should detect on target lane when move is to a different lane', () => {
      // Node moved within l1 lane — detection should work on l1
      const arrows: InternalArrow[] = [
        mkArrow('a1', 'l1_r0', 'l1_r1'),
        mkArrow('a2', 'l1_r1', 'l1_r2'),
      ]
      const tasks: Record<string, TaskData> = {
        l1_r0: { label: 'X', lid: 'l1', rid: 'r0', nodeId: 'n1' },
        l1_r1: { label: 'Y', lid: 'l1', rid: 'r2', nodeId: 'n2' }, // Y moved to r2
        l1_r2: { label: 'Z', lid: 'l1', rid: 'r1', nodeId: 'n3' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
      const setArrows = vi.fn() as unknown as Dispatch<SetStateAction<InternalArrow[]>>

      const { result } = renderHook(() =>
        useMoveAutoRepair({
          arrows,
          setArrows,
          tasks,
          rows,
          addConfirmToast,
          addSuccessToast,
        }),
      )

      act(() => {
        result.current.triggerMoveRepairCheck('l1_r1', 'l1')
      })

      expect(addConfirmToast).toHaveBeenCalledOnce()
      const toast = addConfirmToast.mock.calls[0][0]
      expect(toast.detail).toContain('X')
      expect(toast.detail).toContain('Z')
      expect(toast.detail).toContain('Y')
    })

    it('should not carry over color/dash style attributes to new arrows', () => {
      // Chain: A→B→C with styled arrows
      const initialArrows: InternalArrow[] = [
        { id: 'a1', from: 'l0_r0', to: 'l0_r1', comment: '', color: '#ff0000', dash: '5,3' },
        { id: 'a2', from: 'l0_r1', to: 'l0_r2', comment: '', color: '#00ff00', dash: '2,2' },
      ]
      let currentArrows = [...initialArrows]
      const setArrows = vi.fn((updater: (prev: InternalArrow[]) => InternalArrow[]) => {
        currentArrows = updater(currentArrows)
      }) as unknown as Dispatch<SetStateAction<InternalArrow[]>>

      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r1: { label: 'B', lid: 'l0', rid: 'r2', nodeId: 'n2' },
        l0_r2: { label: 'C', lid: 'l0', rid: 'r1', nodeId: 'n3' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]

      const { result } = renderHook(() =>
        useMoveAutoRepair({
          arrows: initialArrows,
          setArrows,
          tasks,
          rows,
          addConfirmToast,
          addSuccessToast,
        }),
      )

      act(() => {
        result.current.triggerMoveRepairCheck('l0_r1', 'l0')
      })

      const toast = addConfirmToast.mock.calls[0][0]
      toast.onConfirm()

      // New arrows should NOT have color or dash
      for (const a of currentArrows) {
        expect(a.color).toBeUndefined()
        expect(a.dash).toBeUndefined()
      }
    })
  })
})
