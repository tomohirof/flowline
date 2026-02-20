// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShareDialog } from './ShareDialog'

// Mock apiFetch
vi.mock('../../../lib/api', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

import { apiFetch } from '../../../lib/api'

const mockApiFetch = vi.mocked(apiFetch)

describe('ShareDialog', () => {
  let mockWriteText: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockWriteText = vi.fn().mockResolvedValue(undefined)
    // Mock clipboard using defineProperty since clipboard is a getter-only property
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    cleanup()
  })

  const defaultProps = {
    flowId: 'flow-1',
    shareToken: null as string | null,
    onShareChange: vi.fn(),
    onClose: vi.fn(),
  }

  function renderDialog(props = defaultProps) {
    return render(<ShareDialog {...props} />)
  }

  // ========================================
  // Basic rendering
  // ========================================
  it('should render share dialog with title', () => {
    renderDialog()

    expect(screen.getByTestId('share-dialog')).toBeInTheDocument()
    expect(screen.getByText('共有設定')).toBeInTheDocument()
  })

  it('should show share toggle in off state when no shareToken', () => {
    renderDialog()

    const toggle = screen.getByTestId('share-toggle')
    expect(toggle).toBeInTheDocument()
  })

  it('should show share toggle in on state when shareToken exists', () => {
    renderDialog({
      ...defaultProps,
      shareToken: 'existing-token',
    })

    expect(screen.getByTestId('share-url-display')).toBeInTheDocument()
  })

  // ========================================
  // Enable sharing
  // ========================================
  it('should call POST /api/flows/:id/share when enabling', async () => {
    const user = userEvent.setup()
    const onShareChange = vi.fn()
    mockApiFetch.mockResolvedValueOnce({ shareToken: 'new-token', shareUrl: '/shared/new-token' })

    renderDialog({
      ...defaultProps,
      onShareChange,
    })

    await user.click(screen.getByTestId('share-toggle'))

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/flows/flow-1/share', { method: 'POST' })
    })

    expect(onShareChange).toHaveBeenCalledWith('new-token')
  })

  it('should show share URL after enabling', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce({ shareToken: 'new-token', shareUrl: '/shared/new-token' })

    renderDialog({
      ...defaultProps,
      onShareChange: vi.fn(),
    })

    await user.click(screen.getByTestId('share-toggle'))

    await waitFor(() => {
      expect(screen.getByTestId('share-url-display')).toBeInTheDocument()
    })
  })

  it('should show error when enabling share fails', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockRejectedValueOnce(new Error('Server error'))

    renderDialog()

    await user.click(screen.getByTestId('share-toggle'))

    await waitFor(() => {
      expect(screen.getByTestId('share-error')).toBeInTheDocument()
    })
  })

  // ========================================
  // Disable sharing
  // ========================================
  it('should call DELETE /api/flows/:id/share when disabling', async () => {
    const user = userEvent.setup()
    const onShareChange = vi.fn()
    mockApiFetch.mockResolvedValueOnce({ message: '共有を解除しました' })

    renderDialog({
      ...defaultProps,
      shareToken: 'existing-token',
      onShareChange,
    })

    await user.click(screen.getByTestId('share-toggle'))

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/flows/flow-1/share', { method: 'DELETE' })
    })

    expect(onShareChange).toHaveBeenCalledWith(null)
  })

  it('should hide share URL after disabling', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce({ message: '共有を解除しました' })

    renderDialog({
      ...defaultProps,
      shareToken: 'existing-token',
      onShareChange: vi.fn(),
    })

    await user.click(screen.getByTestId('share-toggle'))

    await waitFor(() => {
      expect(screen.queryByTestId('share-url-display')).not.toBeInTheDocument()
    })
  })

  // ========================================
  // Copy link
  // ========================================
  it('should copy share URL to clipboard when copy button clicked', async () => {
    const user = userEvent.setup()
    const writeTextSpy = vi.fn().mockResolvedValue(undefined)
    // Override navigator.clipboard directly on the window object
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      writable: true,
      configurable: true,
    })

    renderDialog({
      ...defaultProps,
      shareToken: 'copy-token',
    })

    await user.click(screen.getByTestId('copy-share-url'))

    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledWith(expect.stringContaining('/shared/copy-token'))
    })
  })

  it('should show copied feedback after copying', async () => {
    const user = userEvent.setup()

    renderDialog({
      ...defaultProps,
      shareToken: 'copy-token',
    })

    await user.click(screen.getByTestId('copy-share-url'))

    await waitFor(() => {
      expect(screen.getByText('コピーしました')).toBeInTheDocument()
    })
  })

  // ========================================
  // Close
  // ========================================
  it('should call onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    renderDialog({
      ...defaultProps,
      onClose,
    })

    await user.click(screen.getByTestId('share-dialog-close'))

    expect(onClose).toHaveBeenCalled()
  })

  // ========================================
  // Loading state
  // ========================================
  it('should disable toggle while API call is in progress', async () => {
    const user = userEvent.setup()
    // API call never resolves
    mockApiFetch.mockImplementation(() => new Promise(() => {}))

    renderDialog()

    await user.click(screen.getByTestId('share-toggle'))

    // Toggle should be disabled while loading
    expect(screen.getByTestId('share-toggle')).toBeDisabled()
  })
})
