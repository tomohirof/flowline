// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import { Toast } from './Toast'

afterEach(() => cleanup())

describe('Toast', () => {
  it('should render message', () => {
    render(<Toast message="操作が完了しました" onClose={vi.fn()} />)
    expect(screen.getByText('操作が完了しました')).toBeInTheDocument()
  })

  it('should render icon when provided', () => {
    render(<Toast message="削除しました" icon="🗑" onClose={vi.fn()} />)
    expect(screen.getByText('🗑')).toBeInTheDocument()
  })

  it('should call onClose after 2500ms', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<Toast message="テスト" onClose={onClose} />)
    expect(onClose).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(2500)
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('should not render icon when not provided', () => {
    render(<Toast message="テスト" onClose={vi.fn()} />)
    const toast = screen.getByTestId('toast')
    expect(toast.children).toHaveLength(1) // only message span
  })
})
