// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AiAssistant } from './AiAssistant'

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

describe('AiAssistant', () => {
  const defaultProps = {
    flowId: 'flow-1' as string | null,
    aiEnabled: true,
    onFlowGenerated: vi.fn(),
  }

  const mockFlowResult = {
    title: 'AI Generated Flow',
    lanes: [{ id: 'lane-1', name: 'Department A', colorIndex: 0, position: 0 }],
    nodes: [
      {
        id: 'node-1',
        laneId: 'lane-1',
        rowIndex: 0,
        label: 'Step 1',
        note: null,
        orderIndex: 0,
      },
    ],
    arrows: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  // ========================================
  // Conditional Rendering
  // ========================================
  it('should render nothing when aiEnabled is false', () => {
    const { container } = render(<AiAssistant {...defaultProps} aiEnabled={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('should render AI assistant panel when aiEnabled is true', () => {
    render(<AiAssistant {...defaultProps} />)
    expect(screen.getByTestId('ai-assistant')).toBeInTheDocument()
    expect(screen.getByTestId('ai-assistant-toggle')).toBeInTheDocument()
  })

  // ========================================
  // Toggle Expand / Collapse
  // ========================================
  it('should expand panel when toggle is clicked', async () => {
    const user = userEvent.setup()
    render(<AiAssistant {...defaultProps} />)

    // Panel should be collapsed initially
    expect(screen.queryByTestId('ai-assistant-panel')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('ai-assistant-toggle'))

    expect(screen.getByTestId('ai-assistant-panel')).toBeInTheDocument()
    expect(screen.getByTestId('ai-prompt-input')).toBeInTheDocument()
    expect(screen.getByTestId('ai-submit-btn')).toBeInTheDocument()
  })

  it('should collapse panel when toggle is clicked again', async () => {
    const user = userEvent.setup()
    render(<AiAssistant {...defaultProps} />)

    // Expand
    await user.click(screen.getByTestId('ai-assistant-toggle'))
    expect(screen.getByTestId('ai-assistant-panel')).toBeInTheDocument()

    // Collapse
    await user.click(screen.getByTestId('ai-assistant-toggle'))
    expect(screen.queryByTestId('ai-assistant-panel')).not.toBeInTheDocument()
  })

  // ========================================
  // Submit - Success
  // ========================================
  it('should submit prompt and call onFlowGenerated on success', async () => {
    const user = userEvent.setup()
    const onFlowGenerated = vi.fn()
    mockApiFetch.mockResolvedValueOnce({ flow: mockFlowResult })

    render(<AiAssistant {...defaultProps} onFlowGenerated={onFlowGenerated} />)

    // Expand panel
    await user.click(screen.getByTestId('ai-assistant-toggle'))

    // Type prompt
    await user.type(screen.getByTestId('ai-prompt-input'), 'Create a flow')

    // Submit
    await user.click(screen.getByTestId('ai-submit-btn'))

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/ai/flow-1/edit', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'Create a flow' }),
      })
    })

    expect(onFlowGenerated).toHaveBeenCalledWith(mockFlowResult)
  })

  it('should use /ai/generate endpoint when flowId is null', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce({ flow: mockFlowResult })

    render(<AiAssistant {...defaultProps} flowId={null} />)

    await user.click(screen.getByTestId('ai-assistant-toggle'))
    await user.type(screen.getByTestId('ai-prompt-input'), 'Generate a new flow')
    await user.click(screen.getByTestId('ai-submit-btn'))

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/ai/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'Generate a new flow' }),
      })
    })
  })

  it('should clear prompt and collapse after successful generation', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce({ flow: mockFlowResult })

    render(<AiAssistant {...defaultProps} />)

    await user.click(screen.getByTestId('ai-assistant-toggle'))
    await user.type(screen.getByTestId('ai-prompt-input'), 'My prompt')
    await user.click(screen.getByTestId('ai-submit-btn'))

    await waitFor(() => {
      // Panel should collapse after success
      expect(screen.queryByTestId('ai-assistant-panel')).not.toBeInTheDocument()
    })
  })

  // ========================================
  // Error Handling
  // ========================================
  it('should show error message on API failure', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockRejectedValueOnce(new Error('AI service unavailable'))

    render(<AiAssistant {...defaultProps} />)

    await user.click(screen.getByTestId('ai-assistant-toggle'))
    await user.type(screen.getByTestId('ai-prompt-input'), 'Some prompt')
    await user.click(screen.getByTestId('ai-submit-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('ai-error')).toBeInTheDocument()
    })

    expect(screen.getByText('AI service unavailable')).toBeInTheDocument()
  })

  it('should show error for non-Error rejection', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockRejectedValueOnce('unknown error')

    render(<AiAssistant {...defaultProps} />)

    await user.click(screen.getByTestId('ai-assistant-toggle'))
    await user.type(screen.getByTestId('ai-prompt-input'), 'Some prompt')
    await user.click(screen.getByTestId('ai-submit-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('ai-error')).toBeInTheDocument()
    })

    expect(screen.getByText('AIリクエストに失敗しました')).toBeInTheDocument()
  })

  // ========================================
  // Validation
  // ========================================
  it('should show validation error when prompt is empty', async () => {
    const user = userEvent.setup()

    render(<AiAssistant {...defaultProps} />)

    await user.click(screen.getByTestId('ai-assistant-toggle'))

    // Submit without typing anything
    await user.click(screen.getByTestId('ai-submit-btn'))

    expect(screen.getByTestId('ai-error')).toBeInTheDocument()
    expect(screen.getByText('プロンプトを入力してください')).toBeInTheDocument()

    // API should not have been called
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('should show validation error when prompt is only whitespace', async () => {
    const user = userEvent.setup()

    render(<AiAssistant {...defaultProps} />)

    await user.click(screen.getByTestId('ai-assistant-toggle'))
    await user.type(screen.getByTestId('ai-prompt-input'), '   ')
    await user.click(screen.getByTestId('ai-submit-btn'))

    expect(screen.getByTestId('ai-error')).toBeInTheDocument()
    expect(screen.getByText('プロンプトを入力してください')).toBeInTheDocument()
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  // ========================================
  // Loading State
  // ========================================
  it('should show loading spinner during API call', async () => {
    const user = userEvent.setup()
    // API call never resolves
    mockApiFetch.mockImplementation(() => new Promise(() => {}))

    render(<AiAssistant {...defaultProps} />)

    await user.click(screen.getByTestId('ai-assistant-toggle'))
    await user.type(screen.getByTestId('ai-prompt-input'), 'Generate flow')
    await user.click(screen.getByTestId('ai-submit-btn'))

    expect(screen.getByTestId('ai-loading-spinner')).toBeInTheDocument()
    expect(screen.getByTestId('ai-submit-btn')).toBeDisabled()
    expect(screen.getByTestId('ai-prompt-input')).toBeDisabled()
  })

  // ========================================
  // Edge Cases
  // ========================================
  it('should clear previous error when submitting a new prompt', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockRejectedValueOnce(new Error('First error'))

    render(<AiAssistant {...defaultProps} />)

    await user.click(screen.getByTestId('ai-assistant-toggle'))
    await user.type(screen.getByTestId('ai-prompt-input'), 'Prompt 1')
    await user.click(screen.getByTestId('ai-submit-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('ai-error')).toBeInTheDocument()
    })

    // Submit again with new prompt
    mockApiFetch.mockResolvedValueOnce({ flow: mockFlowResult })
    await user.clear(screen.getByTestId('ai-prompt-input'))
    await user.type(screen.getByTestId('ai-prompt-input'), 'Prompt 2')
    await user.click(screen.getByTestId('ai-submit-btn'))

    await waitFor(() => {
      expect(screen.queryByTestId('ai-error')).not.toBeInTheDocument()
    })
  })
})
