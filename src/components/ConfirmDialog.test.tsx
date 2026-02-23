// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  afterEach(() => {
    cleanup()
  })

  const defaultProps = {
    title: 'テスト確認',
    message: '本当に実行しますか？',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }

  it('should render title and message', () => {
    render(<ConfirmDialog {...defaultProps} />)
    expect(screen.getByText('テスト確認')).toBeInTheDocument()
    expect(screen.getByText('本当に実行しますか？')).toBeInTheDocument()
  })

  it('should call onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('should call onCancel when cancel button clicked', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />)
    fireEvent.click(screen.getByTestId('confirm-dialog-cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('should call onCancel when overlay clicked', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />)
    fireEvent.click(screen.getByTestId('confirm-dialog-overlay'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('should call onCancel when ESC key pressed', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('should show custom confirmLabel', () => {
    render(<ConfirmDialog {...defaultProps} confirmLabel="削除する" />)
    expect(screen.getByTestId('confirm-dialog-confirm')).toHaveTextContent('削除する')
  })

  it('should show default confirmLabel "OK" when not specified', () => {
    render(<ConfirmDialog {...defaultProps} />)
    expect(screen.getByTestId('confirm-dialog-confirm')).toHaveTextContent('OK')
  })

  it('should apply danger style when danger prop is true', () => {
    render(<ConfirmDialog {...defaultProps} danger />)
    const btn = screen.getByTestId('confirm-dialog-confirm')
    expect(btn.className).toContain('danger')
  })
})
