// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToast } from './useToast'

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('should initialize with empty toasts', () => {
    const { result } = renderHook(() => useToast())
    expect(result.current.toasts).toEqual([])
  })

  it('should add a confirm toast', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.addConfirmToast({
        message: 'テスト',
        detail: '詳細',
        onConfirm: vi.fn(),
        crossingCount: 2,
      })
    })
    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].type).toBe('confirm')
    expect(result.current.toasts[0].message).toBe('テスト')
    expect(result.current.toasts[0].detail).toBe('詳細')
    expect(result.current.toasts[0].crossingCount).toBe(2)
  })

  it('should deduplicate confirm toasts (only one confirm at a time)', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.addConfirmToast({ message: '1つ目' })
    })
    act(() => {
      result.current.addConfirmToast({ message: '2つ目' })
    })
    const confirms = result.current.toasts.filter((t) => t.type === 'confirm')
    expect(confirms).toHaveLength(1)
    expect(confirms[0].message).toBe('2つ目')
  })

  it('should dismiss a toast by id', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.addConfirmToast({ message: 'dismiss me' })
    })
    const id = result.current.toasts[0].id
    act(() => {
      result.current.dismissToast(id)
    })
    expect(result.current.toasts).toHaveLength(0)
  })

  it('should confirm a toast: call onConfirm, replace with success', () => {
    const onConfirm = vi.fn()
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.addConfirmToast({
        message: 'confirm me',
        onConfirm,
        crossingCount: 3,
      })
    })
    const id = result.current.toasts[0].id
    act(() => {
      result.current.confirmToast(id, 3)
    })
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].type).toBe('success')
    expect(result.current.toasts[0].message).toBe('3本の矢印を整理しました')
  })

  it('should auto-dismiss success toasts after 3 seconds', () => {
    const onConfirm = vi.fn()
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.addConfirmToast({ message: 'x', onConfirm, crossingCount: 1 })
    })
    const id = result.current.toasts[0].id
    act(() => {
      result.current.confirmToast(id, 1)
    })
    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].type).toBe('success')

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current.toasts).toHaveLength(0)
  })

  it('should not dismiss confirm toasts automatically', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.addConfirmToast({ message: 'stay' })
    })
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(result.current.toasts).toHaveLength(1)
  })

  // Edge cases from testing.md checklist

  it('should handle dismiss with non-existent id gracefully', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.addConfirmToast({ message: 'keep me' })
    })
    act(() => {
      result.current.dismissToast('non-existent-id')
    })
    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].message).toBe('keep me')
  })

  it('should handle confirmToast with non-existent id gracefully', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.addConfirmToast({ message: 'keep me' })
    })
    act(() => {
      result.current.confirmToast('non-existent-id', 1)
    })
    // Original toast should remain unchanged, no success toast added
    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].type).toBe('confirm')
    expect(result.current.toasts[0].message).toBe('keep me')
  })

  it('should use default crossingCount of 1 when undefined', () => {
    const onConfirm = vi.fn()
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.addConfirmToast({ message: 'no count', onConfirm })
    })
    const id = result.current.toasts[0].id
    act(() => {
      result.current.confirmToast(id)
    })
    expect(result.current.toasts[0].type).toBe('success')
    expect(result.current.toasts[0].message).toBe('1本の矢印を整理しました')
  })

  it('should handle crossingCount of 0', () => {
    const onConfirm = vi.fn()
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.addConfirmToast({ message: 'zero', onConfirm, crossingCount: 0 })
    })
    const id = result.current.toasts[0].id
    act(() => {
      result.current.confirmToast(id, 0)
    })
    expect(result.current.toasts[0].type).toBe('success')
    expect(result.current.toasts[0].message).toBe('0本の矢印を整理しました')
  })

  it('should assign unique ids to each toast', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.addConfirmToast({ message: 'first' })
    })
    const firstId = result.current.toasts[0].id
    act(() => {
      result.current.dismissToast(firstId)
    })
    act(() => {
      result.current.addConfirmToast({ message: 'second' })
    })
    expect(result.current.toasts[0].id).not.toBe(firstId)
  })

  // --- Error toast tests ---

  it('should add an error toast', () => {
    const onRetry = vi.fn()
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.addErrorToast({
        message: '保存に失敗しました',
        detail: 'ネットワークエラー',
        onRetry,
      })
    })
    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].type).toBe('error')
    expect(result.current.toasts[0].message).toBe('保存に失敗しました')
    expect(result.current.toasts[0].detail).toBe('ネットワークエラー')
    expect(result.current.toasts[0].onRetry).toBe(onRetry)
  })

  it('should deduplicate error toasts (only one error at a time)', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.addErrorToast({ message: '1つ目のエラー' })
    })
    act(() => {
      result.current.addErrorToast({ message: '2つ目のエラー' })
    })
    const errors = result.current.toasts.filter((t) => t.type === 'error')
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe('2つ目のエラー')
  })

  it('should not auto-dismiss error toasts', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.addErrorToast({ message: 'エラー' })
    })
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].type).toBe('error')
  })

  it('should dismiss error toast by id', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.addErrorToast({ message: 'dismiss me' })
    })
    const id = result.current.toasts[0].id
    act(() => {
      result.current.dismissToast(id)
    })
    expect(result.current.toasts).toHaveLength(0)
  })

  it('should add success toast via addSuccessToast', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.addSuccessToast({ message: '修復しました' })
    })
    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].type).toBe('success')
    expect(result.current.toasts[0].message).toBe('修復しました')
  })

  it('should allow error and confirm toasts to coexist', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.addConfirmToast({ message: '確認トースト' })
    })
    act(() => {
      result.current.addErrorToast({ message: 'エラートースト' })
    })
    expect(result.current.toasts).toHaveLength(2)
    const types = result.current.toasts.map((t) => t.type)
    expect(types).toContain('confirm')
    expect(types).toContain('error')
  })

  // --- Info toast tests ---

  it('adds an info-typed toast', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.addInfoToast({ message: 'Saved at 1x' })
    })
    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].type).toBe('info')
    expect(result.current.toasts[0].message).toBe('Saved at 1x')
  })

  it('auto-dismisses info toasts after 3 seconds (same as success)', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.addInfoToast({ message: 'hello' })
    })
    expect(result.current.toasts).toHaveLength(1)
    act(() => {
      vi.advanceTimersByTime(3100)
    })
    expect(result.current.toasts).toHaveLength(0)
  })
})
