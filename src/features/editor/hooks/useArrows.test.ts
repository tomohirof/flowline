// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useArrows } from './useArrows'
import type { InternalArrow, TaskData, RowData, InternalLane } from '../types'

describe('useArrows', () => {
  const defaultOptions = () => ({
    initialArrows: [] as InternalArrow[],
    tasks: {} as Record<string, TaskData>,
    rows: [{ id: 'r0' }, { id: 'r1' }] as RowData[],
    lanes: [{ id: 'l0', name: 'Lane1', ci: 0 }] as InternalLane[],
    autoConnect: true,
  })

  it('should initialize with provided arrows', () => {
    const arrows: InternalArrow[] = [{ id: 'a1', from: 'x', to: 'y', comment: '' }]
    const { result } = renderHook(() => useArrows({ ...defaultOptions(), initialArrows: arrows }))
    expect(result.current.arrows).toEqual(arrows)
  })

  it('should expose setArrows for external mutation', () => {
    const { result } = renderHook(() => useArrows(defaultOptions()))
    act(() => {
      result.current.setArrows([{ id: 'a2', from: 'a', to: 'b', comment: 'test' }])
    })
    expect(result.current.arrows).toHaveLength(1)
    expect(result.current.arrows[0].id).toBe('a2')
  })

  it('should initialize with empty arrows by default', () => {
    const { result } = renderHook(() => useArrows(defaultOptions()))
    expect(result.current.arrows).toEqual([])
  })

  it('should initialize recentInsertedRow as null', () => {
    const { result } = renderHook(() => useArrows(defaultOptions()))
    expect(result.current.recentInsertedRow).toBeNull()
  })

  describe('autoConnectOnCreate', () => {
    it('should add arrow from closest upstream when autoConnect is enabled', () => {
      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
      }
      const { result } = renderHook(() => useArrows({ ...defaultOptions(), tasks }))
      act(() => {
        result.current.autoConnectOnCreate('l0_r1', 1, 0)
      })
      expect(result.current.arrows).toHaveLength(1)
      expect(result.current.arrows[0].from).toBe('l0_r0')
      expect(result.current.arrows[0].to).toBe('l0_r1')
    })

    it('should not add arrow when autoConnect is disabled', () => {
      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
      }
      const { result } = renderHook(() =>
        useArrows({ ...defaultOptions(), tasks, autoConnect: false }),
      )
      act(() => {
        result.current.autoConnectOnCreate('l0_r1', 1, 0)
      })
      expect(result.current.arrows).toHaveLength(0)
    })

    it('should not add arrow when no tasks exist', () => {
      const { result } = renderHook(() => useArrows(defaultOptions()))
      act(() => {
        result.current.autoConnectOnCreate('l0_r0', 0, 0)
      })
      expect(result.current.arrows).toHaveLength(0)
    })

    it('should not add arrow when no upstream node exists', () => {
      const tasks: Record<string, TaskData> = {
        l0_r1: { label: 'B', lid: 'l0', rid: 'r1', nodeId: 'n2' },
      }
      const { result } = renderHook(() => useArrows({ ...defaultOptions(), tasks }))
      act(() => {
        result.current.autoConnectOnCreate('l0_r0', 0, 0)
      })
      expect(result.current.arrows).toHaveLength(0)
    })

    it('should generate arrow with non-empty id and empty comment', () => {
      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
      }
      const { result } = renderHook(() => useArrows({ ...defaultOptions(), tasks }))
      act(() => {
        result.current.autoConnectOnCreate('l0_r1', 1, 0)
      })
      expect(result.current.arrows[0].id).toBeTruthy()
      expect(result.current.arrows[0].comment).toBe('')
    })

    it('should auto-split existing arrow when inserting between linked nodes in same lane', () => {
      // A(l0,r0) → C(l0,r2), insert B at (l0,r1)
      // Expected: A→B, B→C (A→C is removed)
      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r1: { label: 'B', lid: 'l0', rid: 'r1', nodeId: 'n2' },
        l0_r2: { label: 'C', lid: 'l0', rid: 'r2', nodeId: 'n3' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
      const arrows: InternalArrow[] = [{ id: 'a1', from: 'l0_r0', to: 'l0_r2', comment: 'c1' }]
      const { result } = renderHook(() =>
        useArrows({
          ...defaultOptions(),
          tasks,
          rows,
          initialArrows: arrows,
        }),
      )
      act(() => {
        result.current.autoConnectOnCreate('l0_r1', 1, 0)
      })
      expect(result.current.arrows).toHaveLength(2)
      const pairs = result.current.arrows.map((a) => `${a.from}->${a.to}`).sort()
      expect(pairs).toEqual(['l0_r0->l0_r1', 'l0_r1->l0_r2'])
      expect(result.current.arrows.find((a) => a.id === 'a1')).toBeUndefined()
      const downstream = result.current.arrows.find(
        (a) => a.from === 'l0_r1' && a.to === 'l0_r2',
      )
      expect(downstream?.comment).toBe('c1')
    })

    it('should not auto-split when bestKey is in same row as new node', () => {
      // A(l0,r0) → B(l1,r0), insert C at (r0, l2)
      // bestKey should be B (same-row). No split.
      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l1_r0: { label: 'B', lid: 'l1', rid: 'r0', nodeId: 'n2' },
      }
      const rows: RowData[] = [{ id: 'r0' }]
      const lanes: InternalLane[] = [
        { id: 'l0', name: 'L0', ci: 0 },
        { id: 'l1', name: 'L1', ci: 1 },
        { id: 'l2', name: 'L2', ci: 2 },
      ]
      const arrows: InternalArrow[] = [{ id: 'a1', from: 'l0_r0', to: 'l1_r0', comment: '' }]
      const { result } = renderHook(() =>
        useArrows({
          ...defaultOptions(),
          tasks,
          rows,
          lanes,
          initialArrows: arrows,
        }),
      )
      act(() => {
        result.current.autoConnectOnCreate('l2_r0', 0, 2)
      })
      expect(result.current.arrows).toHaveLength(2)
      expect(result.current.arrows.find((a) => a.id === 'a1')).toBeDefined()
    })

    it('should auto-split multiple downstream arrows when upstream has several', () => {
      // A(l0,r0) → C(l0,r2), A → D(l1,r2), insert B at (l0,r1)
      // Expected: A→B, B→C, B→D
      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r1: { label: 'B', lid: 'l0', rid: 'r1', nodeId: 'n2' },
        l0_r2: { label: 'C', lid: 'l0', rid: 'r2', nodeId: 'n3' },
        l1_r2: { label: 'D', lid: 'l1', rid: 'r2', nodeId: 'n4' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
      const lanes: InternalLane[] = [
        { id: 'l0', name: 'L0', ci: 0 },
        { id: 'l1', name: 'L1', ci: 1 },
      ]
      const arrows: InternalArrow[] = [
        { id: 'a1', from: 'l0_r0', to: 'l0_r2', comment: '' },
        { id: 'a2', from: 'l0_r0', to: 'l1_r2', comment: '' },
      ]
      const { result } = renderHook(() =>
        useArrows({
          ...defaultOptions(),
          tasks,
          rows,
          lanes,
          initialArrows: arrows,
        }),
      )
      act(() => {
        result.current.autoConnectOnCreate('l0_r1', 1, 0)
      })
      expect(result.current.arrows).toHaveLength(3)
      const pairs = result.current.arrows.map((a) => `${a.from}->${a.to}`).sort()
      expect(pairs).toEqual(['l0_r0->l0_r1', 'l0_r1->l0_r2', 'l0_r1->l1_r2'])
    })
  })

  describe('detectCrossing', () => {
    it('should call addConfirmToast when crossing arrows exist', () => {
      const addConfirmToast = vi.fn()
      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r2: { label: 'B', lid: 'l0', rid: 'r2', nodeId: 'n2' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
      const arrows: InternalArrow[] = [{ id: 'a1', from: 'l0_r0', to: 'l0_r2', comment: '' }]
      const { result } = renderHook(() =>
        useArrows({
          ...defaultOptions(),
          tasks,
          rows,
          initialArrows: arrows,
        }),
      )
      act(() => {
        result.current.setRecentInsertedRow({ rowId: 'r1' })
      })
      act(() => {
        result.current.detectCrossing('r1', 'l0_r1', '新ノード', addConfirmToast)
      })
      expect(addConfirmToast).toHaveBeenCalledOnce()
      expect(addConfirmToast.mock.calls[0][0].message).toBe(
        '挿入した行を経由するよう矢印を整理しますか？',
      )
      expect(addConfirmToast.mock.calls[0][0].crossingCount).toBe(1)
      expect(result.current.recentInsertedRow).toBeNull()
    })

    it('should not call addConfirmToast when no crossing arrows', () => {
      const addConfirmToast = vi.fn()
      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r1: { label: 'B', lid: 'l0', rid: 'r1', nodeId: 'n2' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
      const arrows: InternalArrow[] = [{ id: 'a1', from: 'l0_r0', to: 'l0_r1', comment: '' }]
      const { result } = renderHook(() =>
        useArrows({
          ...defaultOptions(),
          tasks,
          rows,
          initialArrows: arrows,
        }),
      )
      act(() => {
        result.current.setRecentInsertedRow({ rowId: 'r2' })
      })
      act(() => {
        result.current.detectCrossing('r2', 'l0_r2', 'C', addConfirmToast)
      })
      expect(addConfirmToast).not.toHaveBeenCalled()
    })

    it('should not detect crossing when recentInsertedRow is null', () => {
      const addConfirmToast = vi.fn()
      const { result } = renderHook(() => useArrows(defaultOptions()))
      act(() => {
        result.current.detectCrossing('r0', 'l0_r0', 'X', addConfirmToast)
      })
      expect(addConfirmToast).not.toHaveBeenCalled()
    })

    it('should not detect crossing when rid does not match recentInsertedRow', () => {
      const addConfirmToast = vi.fn()
      const { result } = renderHook(() => useArrows(defaultOptions()))
      act(() => {
        result.current.setRecentInsertedRow({ rowId: 'r0' })
      })
      act(() => {
        result.current.detectCrossing('r1', 'l0_r1', 'X', addConfirmToast)
      })
      expect(addConfirmToast).not.toHaveBeenCalled()
    })

    it('should provide working onConfirm that reorganizes arrows', () => {
      const addConfirmToast = vi.fn()
      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'A', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r2: { label: 'B', lid: 'l0', rid: 'r2', nodeId: 'n2' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
      const arrows: InternalArrow[] = [{ id: 'a1', from: 'l0_r0', to: 'l0_r2', comment: '' }]
      const { result } = renderHook(() =>
        useArrows({
          ...defaultOptions(),
          tasks,
          rows,
          initialArrows: arrows,
        }),
      )
      act(() => {
        result.current.setRecentInsertedRow({ rowId: 'r1' })
      })
      act(() => {
        result.current.detectCrossing('r1', 'l0_r1', 'C', addConfirmToast)
      })
      const toastArg = addConfirmToast.mock.calls[0][0]
      act(() => {
        toastArg.onConfirm()
      })
      expect(result.current.arrows).toHaveLength(2)
      const froms = result.current.arrows.map((a) => a.from).sort()
      const tos = result.current.arrows.map((a) => a.to).sort()
      expect(froms).toContain('l0_r0')
      expect(froms).toContain('l0_r1')
      expect(tos).toContain('l0_r1')
      expect(tos).toContain('l0_r2')
    })

    it('should include detail text with arrow labels in toast', () => {
      const addConfirmToast = vi.fn()
      const tasks: Record<string, TaskData> = {
        l0_r0: { label: 'タスクA', lid: 'l0', rid: 'r0', nodeId: 'n1' },
        l0_r2: { label: 'タスクB', lid: 'l0', rid: 'r2', nodeId: 'n2' },
      }
      const rows: RowData[] = [{ id: 'r0' }, { id: 'r1' }, { id: 'r2' }]
      const arrows: InternalArrow[] = [{ id: 'a1', from: 'l0_r0', to: 'l0_r2', comment: '' }]
      const { result } = renderHook(() =>
        useArrows({
          ...defaultOptions(),
          tasks,
          rows,
          initialArrows: arrows,
        }),
      )
      act(() => {
        result.current.setRecentInsertedRow({ rowId: 'r1' })
      })
      act(() => {
        result.current.detectCrossing('r1', 'l0_r1', '新ノード', addConfirmToast)
      })
      const toastArg = addConfirmToast.mock.calls[0][0]
      expect(toastArg.detail).toContain('タスクA')
      expect(toastArg.detail).toContain('タスクB')
      expect(toastArg.detail).toContain('新ノード')
    })

    it('should clear recentInsertedRow even when no crossing found', () => {
      const addConfirmToast = vi.fn()
      const { result } = renderHook(() => useArrows(defaultOptions()))
      act(() => {
        result.current.setRecentInsertedRow({ rowId: 'r0' })
      })
      expect(result.current.recentInsertedRow).toEqual({ rowId: 'r0' })
      act(() => {
        result.current.detectCrossing('r0', 'l0_r0', 'X', addConfirmToast)
      })
      expect(result.current.recentInsertedRow).toBeNull()
      expect(addConfirmToast).not.toHaveBeenCalled()
    })
  })
})
