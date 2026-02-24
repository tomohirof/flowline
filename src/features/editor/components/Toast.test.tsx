// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { ToastList } from './Toast'
import type { ToastData } from '../hooks/useToast'

describe('ToastList', () => {
  it('should render nothing when toasts is empty', () => {
    const { container } = render(<ToastList toasts={[]} onDismiss={vi.fn()} onConfirm={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })

  it('should render confirm toast with skip and organize buttons', () => {
    const toasts: ToastData[] = [
      {
        id: 't1',
        type: 'confirm',
        message: '整理しますか？',
        detail: 'A → B → C に変更',
        crossingCount: 1,
      },
    ]
    const { container } = render(
      <ToastList toasts={toasts} onDismiss={vi.fn()} onConfirm={vi.fn()} />,
    )
    expect(container.querySelector('[data-testid="toast-confirm"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="toast-skip-btn"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="toast-organize-btn"]')).toBeTruthy()
    expect(container.textContent).toContain('整理しますか？')
    expect(container.textContent).toContain('A → B → C に変更')
  })

  it('should render success toast without buttons', () => {
    const toasts: ToastData[] = [{ id: 't2', type: 'success', message: '2本の矢印を整理しました' }]
    const { container } = render(
      <ToastList toasts={toasts} onDismiss={vi.fn()} onConfirm={vi.fn()} />,
    )
    expect(container.querySelector('[data-testid="toast-success"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="toast-skip-btn"]')).toBeNull()
    expect(container.querySelector('[data-testid="toast-organize-btn"]')).toBeNull()
    expect(container.textContent).toContain('2本の矢印を整理しました')
  })

  it('should call onDismiss when skip button is clicked', () => {
    const onDismiss = vi.fn()
    const toasts: ToastData[] = [{ id: 't1', type: 'confirm', message: 'x', crossingCount: 1 }]
    const { container } = render(
      <ToastList toasts={toasts} onDismiss={onDismiss} onConfirm={vi.fn()} />,
    )
    fireEvent.click(container.querySelector('[data-testid="toast-skip-btn"]')!)
    expect(onDismiss).toHaveBeenCalledWith('t1')
  })

  it('should call onConfirm when organize button is clicked', () => {
    const onConfirm = vi.fn()
    const toasts: ToastData[] = [{ id: 't1', type: 'confirm', message: 'x', crossingCount: 3 }]
    const { container } = render(
      <ToastList toasts={toasts} onDismiss={vi.fn()} onConfirm={onConfirm} />,
    )
    fireEvent.click(container.querySelector('[data-testid="toast-organize-btn"]')!)
    expect(onConfirm).toHaveBeenCalledWith('t1', 3)
  })

  // Edge case: multiple toasts rendered simultaneously
  it('should render multiple toasts', () => {
    const toasts: ToastData[] = [
      { id: 't1', type: 'confirm', message: 'Confirm msg', crossingCount: 2 },
      { id: 't2', type: 'success', message: 'Success msg' },
    ]
    const { container } = render(
      <ToastList toasts={toasts} onDismiss={vi.fn()} onConfirm={vi.fn()} />,
    )
    expect(container.querySelector('[data-testid="toast-confirm"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="toast-success"]')).toBeTruthy()
    expect(container.textContent).toContain('Confirm msg')
    expect(container.textContent).toContain('Success msg')
  })

  // Edge case: confirm toast without detail
  it('should render confirm toast without detail when detail is undefined', () => {
    const toasts: ToastData[] = [
      { id: 't1', type: 'confirm', message: 'No detail', crossingCount: 1 },
    ]
    const { container } = render(
      <ToastList toasts={toasts} onDismiss={vi.fn()} onConfirm={vi.fn()} />,
    )
    expect(container.querySelector('[data-testid="toast-confirm"]')).toBeTruthy()
    expect(container.textContent).toContain('No detail')
    // detail div should not exist
    expect(container.textContent).not.toContain('A →')
  })

  // Edge case: onConfirm called with undefined crossingCount
  it('should call onConfirm with undefined crossingCount when not provided', () => {
    const onConfirm = vi.fn()
    const toasts: ToastData[] = [{ id: 't1', type: 'confirm', message: 'x' }]
    const { container } = render(
      <ToastList toasts={toasts} onDismiss={vi.fn()} onConfirm={onConfirm} />,
    )
    fireEvent.click(container.querySelector('[data-testid="toast-organize-btn"]')!)
    expect(onConfirm).toHaveBeenCalledWith('t1', undefined)
  })
})
