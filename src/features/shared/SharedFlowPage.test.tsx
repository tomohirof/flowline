// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SharedFlowPage } from './SharedFlowPage'
import type { Flow } from '../editor/types'

// Mock apiFetch
vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

import { apiFetch, ApiError } from '../../lib/api'

const mockApiFetch = vi.mocked(apiFetch)

const mockSharedFlow: Flow = {
  id: 'flow-1',
  title: 'Shared Test Flow',
  themeId: 'cloud',
  shareToken: 'test-token-123',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  lanes: [{ id: 'lane-1', name: 'Lane 1', colorIndex: 0, position: 0 }],
  nodes: [
    { id: 'node-1', laneId: 'lane-1', rowIndex: 0, label: 'Task 1', note: null, orderIndex: 0 },
  ],
  arrows: [],
}

function renderSharedPage(token: string = 'test-token-123') {
  return render(
    <MemoryRouter initialEntries={[`/shared/${token}`]}>
      <Routes>
        <Route path="/shared/:token" element={<SharedFlowPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SharedFlowPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  // ========================================
  // Loading state
  // ========================================
  it('should show loading state while fetching shared flow', () => {
    mockApiFetch.mockImplementation(() => new Promise(() => {}))

    renderSharedPage()

    expect(screen.getByTestId('shared-flow-loading')).toBeInTheDocument()
    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
  })

  // ========================================
  // Success state
  // ========================================
  it('should fetch shared flow from GET /api/shared/:token', async () => {
    mockApiFetch.mockResolvedValueOnce({ flow: mockSharedFlow })

    renderSharedPage()

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/shared/test-token-123')
    })
  })

  it('should render shared flow in read-only mode', async () => {
    mockApiFetch.mockResolvedValueOnce({ flow: mockSharedFlow })

    renderSharedPage()

    await waitFor(() => {
      expect(screen.getByTestId('shared-flow-view')).toBeInTheDocument()
    })
  })

  it('should display flow title', async () => {
    mockApiFetch.mockResolvedValueOnce({ flow: mockSharedFlow })

    renderSharedPage()

    await waitFor(() => {
      expect(screen.getByText('Shared Test Flow')).toBeInTheDocument()
    })
  })

  it('should show "Flowlineで作成" footer', async () => {
    mockApiFetch.mockResolvedValueOnce({ flow: mockSharedFlow })

    renderSharedPage()

    await waitFor(() => {
      expect(screen.getByTestId('shared-flow-footer')).toBeInTheDocument()
      expect(screen.getByText('Flowlineで作成')).toBeInTheDocument()
    })
  })

  // ========================================
  // Error state
  // ========================================
  it('should show 404 error when token is invalid', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError(404, '共有フローが見つかりません'))

    renderSharedPage('invalid-token')

    await waitFor(() => {
      expect(screen.getByTestId('shared-flow-error')).toBeInTheDocument()
    })

    expect(screen.getByText('共有フローが見つかりません')).toBeInTheDocument()
  })

  it('should show error for network failures', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Network error'))

    renderSharedPage()

    await waitFor(() => {
      expect(screen.getByTestId('shared-flow-error')).toBeInTheDocument()
    })

    expect(screen.getByText('共有フローの読み込みに失敗しました')).toBeInTheDocument()
  })

  // ========================================
  // Read-only behavior
  // ========================================
  it('should not render editing UI elements', async () => {
    mockApiFetch.mockResolvedValueOnce({ flow: mockSharedFlow })

    renderSharedPage()

    await waitFor(() => {
      expect(screen.getByTestId('shared-flow-view')).toBeInTheDocument()
    })

    // Should not have sidebar tools
    expect(screen.queryByText('選択')).not.toBeInTheDocument()
    // Should not have save status
    expect(screen.queryByTestId('save-status')).not.toBeInTheDocument()
  })

  // ========================================
  // Edge cases
  // ========================================
  it('should handle flow with empty lanes, nodes, and arrows', async () => {
    const emptyFlow: Flow = {
      ...mockSharedFlow,
      lanes: [],
      nodes: [],
      arrows: [],
    }
    mockApiFetch.mockResolvedValueOnce({ flow: emptyFlow })

    renderSharedPage()

    await waitFor(() => {
      expect(screen.getByTestId('shared-flow-view')).toBeInTheDocument()
    })
  })
})
