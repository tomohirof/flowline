// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
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

/**
 * Render the hook and trigger a move repair check.
 * After setting the ref via triggerMoveRepairCheck, a rerender with
 * a new arrows reference is needed to fire the useEffect (simulating
 * the re-render that moveTask's setArrows/setTasks would cause).
 */
function renderAndTrigger(
  opts: Parameters<typeof useMoveAutoRepair>[0],
  movedKey: string,
  laneId: string,
) {
  const { result, rerender } = renderHook((props: typeof opts) => useMoveAutoRepair(props), {
    initialProps: opts,
  })
  result.current.triggerMoveRepairCheck(movedKey, laneId)
  // Simulate moveTask's state changes causing a re-render
  rerender({ ...opts, arrows: [...opts.arrows] })
  return { result, rerender }
}

/* --------------------------------------------------------- */
/* shared setup                                              */
/* --------------------------------------------------------- */

describe('useMoveAutoRepair', () => {
  let addConfirmToast: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    addConfirmToast = vi.fn()
  })

  /* ======================================================= */
  /* Skip conditions                                         */
  /* ======================================================= */

  describe('skip conditions', () => {
    it('should not show toast when lane has fewer than 3 nodes in chain', () => {
      const arrows: InternalArrow[] = [mkArrow('a1', 'l0_r0', 'l0_r1')]
      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r1: { label: 'B', lid: 'l0', rid: 'r1', nodeId: 'n2' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }]
      const setArrows = vi.fn() as unknown as Dispatch<SetStateAction<InternalArrow[]>>

      renderAndTrigger({ arrows, setArrows, tasks, rows, addConfirmToast }, 'l0_r1', 'l0')

      expect(addConfirmToast).not.toHaveBeenCalled()
    })

    it('should not show toast when movedKey is not in chain', () => {
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

      renderAndTrigger({ arrows, setArrows, tasks, rows, addConfirmToast }, 'l0_r3', 'l0')

      expect(addConfirmToast).not.toHaveBeenCalled()
    })

    it('should not show toast when chain order matches position order', () => {
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

      renderAndTrigger({ arrows, setArrows, tasks, rows, addConfirmToast }, 'l0_r1', 'l0')

      expect(addConfirmToast).not.toHaveBeenCalled()
    })

    it('should not show toast when lane has no chain arrows', () => {
      const arrows: InternalArrow[] = []
      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r1: { label: 'B', lid: 'l0', rid: 'r1', nodeId: 'n2' },
        l0_r2: { label: 'C', lid: 'l0', rid: 'r2', nodeId: 'n3' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
      const setArrows = vi.fn() as unknown as Dispatch<SetStateAction<InternalArrow[]>>

      renderAndTrigger({ arrows, setArrows, tasks, rows, addConfirmToast }, 'l0_r0', 'l0')

      expect(addConfirmToast).not.toHaveBeenCalled()
    })
  })

  /* ======================================================= */
  /* Happy path                                              */
  /* ======================================================= */

  describe('happy path', () => {
    it('should show confirm toast with correct message/detail/crossingCount for 5-node chain', () => {
      const arrows: InternalArrow[] = [
        mkArrow('a1', 'l0_r0', 'l0_r1'),
        mkArrow('a2', 'l0_r1', 'l0_r2'),
        mkArrow('a3', 'l0_r2', 'l0_r3'),
        mkArrow('a4', 'l0_r3', 'l0_r4'),
      ]
      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r1: { label: 'B', lid: 'l0', rid: 'r4', nodeId: 'n2' },
        l0_r2: { label: 'C', lid: 'l0', rid: 'r1', nodeId: 'n3' },
        l0_r3: { label: 'D', lid: 'l0', rid: 'r2', nodeId: 'n4' },
        l0_r4: { label: 'E', lid: 'l0', rid: 'r3', nodeId: 'n5' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }, { id: 'r3' }, { id: 'r4' }]
      const setArrows = vi.fn() as unknown as Dispatch<SetStateAction<InternalArrow[]>>

      renderAndTrigger({ arrows, setArrows, tasks, rows, addConfirmToast }, 'l0_r1', 'l0')

      expect(addConfirmToast).toHaveBeenCalledOnce()
      const toast = addConfirmToast.mock.calls[0][0]
      expect(toast.message).toBe('接続順を修復しますか？')
      expect(toast.detail).toBe('接続順を修復: A → C → D → E → B')
      expect(toast.crossingCount).toBe(4)
      expect(typeof toast.onConfirm).toBe('function')
    })

    it('should show correct crossingCount (2) for 3-node chain with mismatch', () => {
      const arrows: InternalArrow[] = [
        mkArrow('a1', 'l0_r0', 'l0_r1'),
        mkArrow('a2', 'l0_r1', 'l0_r2'),
      ]
      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r1: { label: 'B', lid: 'l0', rid: 'r2', nodeId: 'n2' },
        l0_r2: { label: 'C', lid: 'l0', rid: 'r1', nodeId: 'n3' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
      const setArrows = vi.fn() as unknown as Dispatch<SetStateAction<InternalArrow[]>>

      renderAndTrigger({ arrows, setArrows, tasks, rows, addConfirmToast }, 'l0_r1', 'l0')

      expect(addConfirmToast).toHaveBeenCalledOnce()
      expect(addConfirmToast.mock.calls[0][0].crossingCount).toBe(2)
    })
  })

  /* ======================================================= */
  /* onConfirm execution                                     */
  /* ======================================================= */

  describe('onConfirm execution', () => {
    it('should replace old chain arrows with position-sorted arrows and preserve cross-lane arrows', () => {
      const initialArrows: InternalArrow[] = [
        mkArrow('a1', 'l0_r0', 'l0_r1'),
        mkArrow('a2', 'l0_r1', 'l0_r2'),
        mkArrow('a3', 'l0_r0', 'l1_r0'),
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

      renderAndTrigger(
        { arrows: initialArrows, setArrows, tasks, rows, addConfirmToast },
        'l0_r1',
        'l0',
      )

      const toast = addConfirmToast.mock.calls[0][0]
      toast.onConfirm()

      expect(setArrows).toHaveBeenCalled()
      expect(currentArrows.find((a) => a.id === 'a3')).toBeDefined()
      expect(currentArrows.find((a) => a.id === 'a1')).toBeUndefined()
      expect(currentArrows.find((a) => a.id === 'a2')).toBeUndefined()

      const newChainArrows = currentArrows.filter((a) => a.id !== 'a3')
      expect(newChainArrows).toHaveLength(2)
      const fromTos = newChainArrows.map((a) => `${a.from}->${a.to}`)
      expect(fromTos).toContain('l0_r0->l0_r2')
      expect(fromTos).toContain('l0_r2->l0_r1')
    })

    it('should not preserve comments when pairs change', () => {
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

      renderAndTrigger(
        { arrows: initialArrows, setArrows, tasks, rows, addConfirmToast },
        'l0_r1',
        'l0',
      )

      addConfirmToast.mock.calls[0][0].onConfirm()

      const arrowAC = currentArrows.find((a) => a.from === 'l0_r0' && a.to === 'l0_r2')
      expect(arrowAC).toBeDefined()
      expect(arrowAC!.comment).toBe('')

      const arrowCB = currentArrows.find((a) => a.from === 'l0_r2' && a.to === 'l0_r1')
      expect(arrowCB).toBeDefined()
      expect(arrowCB!.comment).toBe('')
    })

    it('should preserve comments when same pair exists in new chain', () => {
      const initialArrows: InternalArrow[] = [
        mkArrow('a1', 'l0_r0', 'l0_r1', '保持コメント'),
        mkArrow('a2', 'l0_r1', 'l0_r2'),
        mkArrow('a3', 'l0_r2', 'l0_r3'),
      ]
      let currentArrows = [...initialArrows]
      const setArrows = vi.fn((updater: (prev: InternalArrow[]) => InternalArrow[]) => {
        currentArrows = updater(currentArrows)
      }) as unknown as Dispatch<SetStateAction<InternalArrow[]>>

      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r1: { label: 'B', lid: 'l0', rid: 'r1', nodeId: 'n2' },
        l0_r2: { label: 'C', lid: 'l0', rid: 'r3', nodeId: 'n3' },
        l0_r3: { label: 'D', lid: 'l0', rid: 'r2', nodeId: 'n4' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }, { id: 'r3' }]

      renderAndTrigger(
        { arrows: initialArrows, setArrows, tasks, rows, addConfirmToast },
        'l0_r2',
        'l0',
      )

      addConfirmToast.mock.calls[0][0].onConfirm()

      const arrowAB = currentArrows.find((a) => a.from === 'l0_r0' && a.to === 'l0_r1')
      expect(arrowAB).toBeDefined()
      expect(arrowAB!.comment).toBe('保持コメント')
    })

    it('should pass crossingCount to addConfirmToast for useToast success message', () => {
      const initialArrows: InternalArrow[] = [
        mkArrow('a1', 'l0_r0', 'l0_r1'),
        mkArrow('a2', 'l0_r1', 'l0_r2'),
      ]
      const setArrows = vi.fn() as unknown as Dispatch<SetStateAction<InternalArrow[]>>

      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r1: { label: 'B', lid: 'l0', rid: 'r2', nodeId: 'n2' },
        l0_r2: { label: 'C', lid: 'l0', rid: 'r1', nodeId: 'n3' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]

      renderAndTrigger(
        { arrows: initialArrows, setArrows, tasks, rows, addConfirmToast },
        'l0_r1',
        'l0',
      )

      const toast = addConfirmToast.mock.calls[0][0]
      expect(toast.crossingCount).toBe(2)
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

      expect(() => {
        renderAndTrigger({ arrows, setArrows, tasks, rows, addConfirmToast }, 'l0_r0', 'l0')
      }).not.toThrow()
    })

    it('should detect on target lane when move is to a different lane', () => {
      const arrows: InternalArrow[] = [
        mkArrow('a1', 'l1_r0', 'l1_r1'),
        mkArrow('a2', 'l1_r1', 'l1_r2'),
      ]
      const tasks: Record<string, TaskData> = {
        l1_r0: { label: 'X', lid: 'l1', rid: 'r0', nodeId: 'n1' },
        l1_r1: { label: 'Y', lid: 'l1', rid: 'r2', nodeId: 'n2' },
        l1_r2: { label: 'Z', lid: 'l1', rid: 'r1', nodeId: 'n3' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
      const setArrows = vi.fn() as unknown as Dispatch<SetStateAction<InternalArrow[]>>

      renderAndTrigger({ arrows, setArrows, tasks, rows, addConfirmToast }, 'l1_r1', 'l1')

      expect(addConfirmToast).toHaveBeenCalledOnce()
      const toast = addConfirmToast.mock.calls[0][0]
      expect(toast.detail).toContain('X')
      expect(toast.detail).toContain('Z')
      expect(toast.detail).toContain('Y')
    })

    it('should not carry over color/dash style attributes to new arrows', () => {
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

      renderAndTrigger(
        { arrows: initialArrows, setArrows, tasks, rows, addConfirmToast },
        'l0_r1',
        'l0',
      )

      addConfirmToast.mock.calls[0][0].onConfirm()

      for (const a of currentArrows) {
        expect(a.color).toBeUndefined()
        expect(a.dash).toBeUndefined()
      }
    })
  })

  /* ======================================================= */
  /* cross-lane rewire                                       */
  /* ======================================================= */

  describe('cross-lane rewire', () => {
    it('should show cross-lane toast after chain reconnection onConfirm when old tail had cross-lane arrow', () => {
      // Chain: A(r0) → B(r1) → C(r2) → D(r3), D has cross-lane arrow to X(l1)
      // After move: B moves to r3 → proposed: A→C→D→B, old tail=D, new tail=B
      // X must be below old tail D(r2) for cross-lane rewire to trigger
      const initialArrows: InternalArrow[] = [
        mkArrow('a1', 'l0_r0', 'l0_r1'),
        mkArrow('a2', 'l0_r1', 'l0_r2'),
        mkArrow('a3', 'l0_r2', 'l0_r3'),
        mkArrow('cross1', 'l0_r3', 'l1_r0', 'メモ'),
      ]
      let currentArrows = [...initialArrows]
      const setArrows = vi.fn((updater: SetStateAction<InternalArrow[]>) => {
        if (typeof updater === 'function') {
          currentArrows = updater(currentArrows)
        }
      }) as unknown as Dispatch<SetStateAction<InternalArrow[]>>

      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r1: { label: 'B', lid: 'l0', rid: 'r3', nodeId: 'n2' },
        l0_r2: { label: 'C', lid: 'l0', rid: 'r1', nodeId: 'n3' },
        l0_r3: { label: 'D', lid: 'l0', rid: 'r2', nodeId: 'n4' },
        l1_r0: { label: 'X', lid: 'l1', rid: 'r3', nodeId: 'n5' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }, { id: 'r3' }]

      const { rerender } = renderAndTrigger(
        { arrows: initialArrows, setArrows, tasks, rows, addConfirmToast },
        'l0_r1',
        'l0',
      )

      // Toast 1: chain reconnection
      expect(addConfirmToast).toHaveBeenCalledOnce()
      const chainToast = addConfirmToast.mock.calls[0][0]
      chainToast.onConfirm()

      // After onConfirm, rerender with updated arrows to trigger cross-lane useEffect
      addConfirmToast.mockClear()
      rerender({ arrows: [...currentArrows], setArrows, tasks, rows, addConfirmToast })

      // Toast 2: cross-lane rewire
      expect(addConfirmToast).toHaveBeenCalledOnce()
      const crossToast = addConfirmToast.mock.calls[0][0]
      expect(crossToast.message).toBe('横矢印の張り替え')
      expect(crossToast.detail).toContain('D')
      expect(crossToast.detail).toContain('B')
      expect(crossToast.detail).toContain('X')
      expect(crossToast.crossingCount).toBe(1)
    })

    it('should rewire arrow from old tail to new tail on cross-lane toast onConfirm', () => {
      const initialArrows: InternalArrow[] = [
        mkArrow('a1', 'l0_r0', 'l0_r1'),
        mkArrow('a2', 'l0_r1', 'l0_r2'),
        mkArrow('a3', 'l0_r2', 'l0_r3'),
        mkArrow('cross1', 'l0_r3', 'l1_r0', '引継ぎメモ'),
      ]
      let currentArrows = [...initialArrows]
      const setArrows = vi.fn((updater: SetStateAction<InternalArrow[]>) => {
        if (typeof updater === 'function') {
          currentArrows = updater(currentArrows)
        }
      }) as unknown as Dispatch<SetStateAction<InternalArrow[]>>

      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r1: { label: 'B', lid: 'l0', rid: 'r3', nodeId: 'n2' },
        l0_r2: { label: 'C', lid: 'l0', rid: 'r1', nodeId: 'n3' },
        l0_r3: { label: 'D', lid: 'l0', rid: 'r2', nodeId: 'n4' },
        l1_r0: { label: 'X', lid: 'l1', rid: 'r3', nodeId: 'n5' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }, { id: 'r3' }]

      const { rerender } = renderAndTrigger(
        { arrows: initialArrows, setArrows, tasks, rows, addConfirmToast },
        'l0_r1',
        'l0',
      )

      // Execute chain reconnection
      addConfirmToast.mock.calls[0][0].onConfirm()
      addConfirmToast.mockClear()
      rerender({ arrows: [...currentArrows], setArrows, tasks, rows, addConfirmToast })

      // Execute cross-lane rewire
      addConfirmToast.mock.calls[0][0].onConfirm()

      // Verify: cross-lane arrow now from new tail (l0_r1) to l1_r0
      const crossArrow = currentArrows.find((a) => a.to === 'l1_r0')
      expect(crossArrow).toBeDefined()
      expect(crossArrow!.from).toBe('l0_r1')
      expect(crossArrow!.comment).toBe('引継ぎメモ')
    })

    it('should not show cross-lane toast when old tail has no cross-lane arrows', () => {
      const initialArrows: InternalArrow[] = [
        mkArrow('a1', 'l0_r0', 'l0_r1'),
        mkArrow('a2', 'l0_r1', 'l0_r2'),
      ]
      let currentArrows = [...initialArrows]
      const setArrows = vi.fn((updater: SetStateAction<InternalArrow[]>) => {
        if (typeof updater === 'function') {
          currentArrows = updater(currentArrows)
        }
      }) as unknown as Dispatch<SetStateAction<InternalArrow[]>>

      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r1: { label: 'B', lid: 'l0', rid: 'r2', nodeId: 'n2' },
        l0_r2: { label: 'C', lid: 'l0', rid: 'r1', nodeId: 'n3' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]

      const { rerender } = renderAndTrigger(
        { arrows: initialArrows, setArrows, tasks, rows, addConfirmToast },
        'l0_r1',
        'l0',
      )

      // Execute chain reconnection
      addConfirmToast.mock.calls[0][0].onConfirm()
      addConfirmToast.mockClear()
      rerender({ arrows: [...currentArrows], setArrows, tasks, rows, addConfirmToast })

      // No cross-lane toast
      expect(addConfirmToast).not.toHaveBeenCalled()
    })
  })
})
