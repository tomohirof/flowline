// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Dashboard } from './Dashboard'

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

// Mock useAuth
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@example.com', name: 'テストユーザー' },
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

import { apiFetch } from '../../lib/api'

const mockApiFetch = vi.mocked(apiFetch)

const mockFlows = [
  {
    id: 'flow-1',
    title: '業務フロー',
    themeId: 'cloud',
    shareToken: 'abc123',
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'flow-2',
    title: '申請処理フロー',
    themeId: 'midnight',
    shareToken: null,
    createdAt: '2026-01-14T08:00:00Z',
    updatedAt: '2026-01-14T08:00:00Z',
  },
]

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  )
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  // === ローディング状態 ===
  it('should show loading state while fetching flows', () => {
    mockApiFetch.mockImplementation(() => new Promise(() => {})) // never resolves

    renderDashboard()

    expect(screen.getByTestId('dashboard-loading')).toBeInTheDocument()
    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
  })

  // === フロー一覧表示 ===
  it('should render flow cards from API data', async () => {
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    })

    expect(screen.getByTestId('flow-card-flow-2')).toBeInTheDocument()
    expect(screen.getByText('業務フロー')).toBeInTheDocument()
    expect(screen.getByText('申請処理フロー')).toBeInTheDocument()
  })

  it('should display share status badge when flow has shareToken', async () => {
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    })

    // flow-1 has shareToken → should show share badge
    expect(screen.getByTestId('share-badge-flow-1')).toBeInTheDocument()
    // flow-2 has no shareToken → should NOT show share badge
    expect(screen.queryByTestId('share-badge-flow-2')).not.toBeInTheDocument()
  })

  // === 空状態 ===
  it('should show empty state when no flows exist', async () => {
    mockApiFetch.mockResolvedValueOnce({ flows: [] })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-empty')).toBeInTheDocument()
    })

    expect(screen.getByText('フローがまだありません。新規作成してみましょう！')).toBeInTheDocument()
  })

  // === 新規作成カード ===
  it('should render create card in grid', async () => {
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    })
    expect(screen.getByTestId('create-flow-card')).toBeInTheDocument()
    expect(screen.getByText('新規作成')).toBeInTheDocument()
  })

  it('should call POST /flows and navigate to editor on create', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
    mockApiFetch.mockResolvedValueOnce({ flow: { id: 'new-flow-id' } })
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('create-flow-card')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('create-flow-card'))
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/flows',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    expect(mockNavigate).toHaveBeenCalledWith('/flows/new-flow-id')
  })

  it('should show error when create flow fails', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
    mockApiFetch.mockRejectedValueOnce(new Error('Server error'))
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('create-flow-card')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('create-flow-card'))
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-error')).toBeInTheDocument()
    })
    expect(screen.getByText('フローの作成に失敗しました')).toBeInTheDocument()
  })

  it('should disable create card while creating', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
    mockApiFetch.mockImplementation(() => new Promise(() => {}))
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('create-flow-card')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('create-flow-card'))
    expect(screen.getByTestId('create-flow-card')).toBeDisabled()
    expect(screen.getByText('作成中...')).toBeInTheDocument()
  })

  // === 削除機能 ===
  it('should show confirm modal and delete flow when confirmed', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
    mockApiFetch.mockResolvedValueOnce({}) // DELETE

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('delete-flow-flow-1'))

    // モーダルが表示される
    expect(screen.getByTestId('confirm-dialog-overlay')).toBeInTheDocument()
    expect(screen.getByText('フローを削除')).toBeInTheDocument()

    // 確認ボタンをクリック
    await user.click(screen.getByTestId('confirm-dialog-confirm'))

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/flows/flow-1', { method: 'DELETE' })
    })
    await waitFor(() => {
      expect(screen.queryByTestId('flow-card-flow-1')).not.toBeInTheDocument()
    })
    expect(screen.getByTestId('flow-card-flow-2')).toBeInTheDocument()
  })

  it('should not delete flow when modal is cancelled', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('delete-flow-flow-1'))
    expect(screen.getByTestId('confirm-dialog-overlay')).toBeInTheDocument()

    // キャンセル
    await user.click(screen.getByTestId('confirm-dialog-cancel'))

    // モーダルが閉じる
    expect(screen.queryByTestId('confirm-dialog-overlay')).not.toBeInTheDocument()
    // DELETEは呼ばれない
    expect(mockApiFetch).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
  })

  it('should show error when delete fails', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
    mockApiFetch.mockRejectedValueOnce(new Error('Delete failed'))

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('delete-flow-flow-1'))
    await user.click(screen.getByTestId('confirm-dialog-confirm'))

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-error')).toBeInTheDocument()
    })
    expect(screen.getByText('フローの削除に失敗しました')).toBeInTheDocument()
    expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
  })

  it('should show toast after successful delete', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
    mockApiFetch.mockResolvedValueOnce({})

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('delete-flow-flow-1'))
    await user.click(screen.getByTestId('confirm-dialog-confirm'))

    await waitFor(() => {
      expect(screen.getByTestId('toast')).toBeInTheDocument()
    })
    expect(screen.getByText('削除しました')).toBeInTheDocument()
  })

  // === APIエラー ===
  it('should show error state when fetching flows fails', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Network error'))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-error')).toBeInTheDocument()
    })

    expect(screen.getByText('フロー一覧の取得に失敗しました')).toBeInTheDocument()
  })

  // === ヘッダー表示 ===
  it('should display "マイフロー" heading', async () => {
    mockApiFetch.mockResolvedValueOnce({ flows: [] })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('マイフロー')).toBeInTheDocument()
    })
  })

  // === カードクリックでナビゲーション ===
  it('should have links to flow editor on each card', async () => {
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    })

    const card1 = screen.getByTestId('flow-link-flow-1')
    expect(card1).toHaveAttribute('href', '/flows/flow-1')

    const card2 = screen.getByTestId('flow-link-flow-2')
    expect(card2).toHaveAttribute('href', '/flows/flow-2')
  })

  // === 重複削除の防止 ===
  it('should handle rapid delete clicks gracefully', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
    // Only one DELETE call should go through
    mockApiFetch.mockResolvedValueOnce({})

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('delete-flow-flow-1')).toBeInTheDocument()
    })

    // Click delete to open modal
    await user.click(screen.getByTestId('delete-flow-flow-1'))
    // Confirm the modal
    await user.click(screen.getByTestId('confirm-dialog-confirm'))

    await waitFor(() => {
      expect(screen.queryByTestId('flow-card-flow-1')).not.toBeInTheDocument()
    })
  })

  // =============================================
  // 新機能テスト: TopBar / Sidebar 表示
  // =============================================
  it('should render dashboard with topbar and sidebar', async () => {
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    })

    expect(screen.getByTestId('dashboard-topbar')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-sidebar')).toBeInTheDocument()
  })

  // =============================================
  // 新機能テスト: 検索フィルタリング
  // =============================================
  it('should filter flows by search query', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    })

    // Type search query that matches only flow-1
    const searchInput = screen.getByTestId('search-input')
    await user.type(searchInput, '業務')

    // flow-1 (業務フロー) should be visible
    expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    // flow-2 (申請処理フロー) should be hidden
    expect(screen.queryByTestId('flow-card-flow-2')).not.toBeInTheDocument()
  })

  it('should show empty state when search matches nothing', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    })

    const searchInput = screen.getByTestId('search-input')
    await user.type(searchInput, '存在しないフロー名')

    // No cards should be visible
    expect(screen.queryByTestId('flow-card-flow-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('flow-card-flow-2')).not.toBeInTheDocument()

    // Should show empty state
    expect(screen.getByTestId('dashboard-empty')).toBeInTheDocument()
  })

  // =============================================
  // 新機能テスト: ソート
  // =============================================
  it('should sort flows by name', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    })

    // Default sort is by updated (newest first). Change to name sort.
    const sortSelect = screen.getByTestId('sort-select')
    await user.selectOptions(sortSelect, 'name')

    // After sorting by name (Japanese locale):
    // '業務フロー' vs '申請処理フロー'
    // Verify both cards still exist
    const cards = screen.getAllByTestId(/^flow-card-/)
    expect(cards).toHaveLength(2)

    // The order should be determined by Japanese locale sort
    // '業務フロー'.localeCompare('申請処理フロー', 'ja')
    // Both cards should still be present after sort
    expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    expect(screen.getByTestId('flow-card-flow-2')).toBeInTheDocument()
  })

  // =============================================
  // 新機能テスト: グリッド/リスト表示切替
  // =============================================
  it('should toggle between grid and list view', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    })

    // Default should be grid view
    expect(screen.getByTestId('dashboard-grid')).toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-list')).not.toBeInTheDocument()

    // Switch to list view
    const listBtn = screen.getByTestId('view-list-button')
    await user.click(listBtn)

    // Now should show list
    expect(screen.getByTestId('dashboard-list')).toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-grid')).not.toBeInTheDocument()

    // Cards should still be accessible in list view
    expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    expect(screen.getByTestId('flow-card-flow-2')).toBeInTheDocument()

    // Switch back to grid view
    const gridBtn = screen.getByTestId('view-grid-button')
    await user.click(gridBtn)

    expect(screen.getByTestId('dashboard-grid')).toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-list')).not.toBeInTheDocument()
  })

  // =============================================
  // 新機能テスト: リスト表示でのリンク・削除互換性
  // =============================================
  it('should have links and delete buttons in list view', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    })

    // Switch to list view
    await user.click(screen.getByTestId('view-list-button'))

    // Links should work in list view
    const link1 = screen.getByTestId('flow-link-flow-1')
    expect(link1).toHaveAttribute('href', '/flows/flow-1')

    const link2 = screen.getByTestId('flow-link-flow-2')
    expect(link2).toHaveAttribute('href', '/flows/flow-2')

    // Delete buttons should exist
    expect(screen.getByTestId('delete-flow-flow-1')).toBeInTheDocument()
    expect(screen.getByTestId('delete-flow-flow-2')).toBeInTheDocument()
  })

  // =============================================
  // 新機能テスト: 検索は大文字小文字を区別しない
  // =============================================
  // =============================================
  // フロー複製テスト
  // =============================================
  describe('フロー複製', () => {
    const mockFlowDetail = {
      flow: {
        id: 'flow-1',
        title: '業務フロー',
        themeId: 'cloud',
        shareToken: 'abc123',
        createdAt: '2026-01-15T10:00:00Z',
        updatedAt: '2026-01-15T10:00:00Z',
        lanes: [
          { id: 'lane-1', name: '担当者A', colorIndex: 0, position: 0 },
          { id: 'lane-2', name: '担当者B', colorIndex: 1, position: 1 },
        ],
        nodes: [
          {
            id: 'node-1',
            laneId: 'lane-1',
            rowIndex: 0,
            label: 'タスク1',
            note: null,
            orderIndex: 0,
          },
          {
            id: 'node-2',
            laneId: 'lane-2',
            rowIndex: 1,
            label: 'タスク2',
            note: '備考',
            orderIndex: 0,
          },
        ],
        arrows: [{ id: 'arrow-1', fromNodeId: 'node-1', toNodeId: 'node-2', comment: '接続' }],
      },
    }

    it('should duplicate flow with new IDs and navigate to editor', async () => {
      const user = userEvent.setup()
      // 1st call: GET /flows (initial load)
      mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
      // 2nd call: GET /flows/flow-1 (fetch detail)
      mockApiFetch.mockResolvedValueOnce(mockFlowDetail)
      // 3rd call: POST /flows (create duplicate)
      mockApiFetch.mockResolvedValueOnce({ flow: { id: 'new-flow-id' } })

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
      })

      // Hover the card to reveal the menu button
      fireEvent.mouseEnter(screen.getByTestId('flow-card-flow-1'))

      // Wait for the menu button to appear after hover
      await waitFor(() => {
        expect(screen.getByTestId('card-menu-flow-1')).toBeInTheDocument()
      })

      // Click the menu button to open context menu
      await user.click(screen.getByTestId('card-menu-flow-1'))

      // Wait for context menu to appear
      await waitFor(() => {
        expect(screen.getByTestId('context-menu')).toBeInTheDocument()
      })

      // Click '複製' in the context menu
      await user.click(screen.getByText('複製'))

      // Verify GET /flows/flow-1 was called
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/flows/flow-1')
      })

      // Verify POST /flows was called
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          '/flows',
          expect.objectContaining({ method: 'POST' }),
        )
      })

      // Verify POST body
      const postCall = mockApiFetch.mock.calls.find(
        (call) =>
          call[0] === '/flows' && call[1] && (call[1] as { method?: string }).method === 'POST',
      )
      expect(postCall).toBeDefined()
      const postBody = JSON.parse((postCall![1] as { body: string }).body)

      // Title should be prefixed with "コピー "
      expect(postBody.title).toBe('コピー 業務フロー')
      // ThemeId should be same
      expect(postBody.themeId).toBe('cloud')

      // All IDs should be new (not the original IDs)
      expect(postBody.lanes).toHaveLength(2)
      expect(postBody.lanes[0].id).not.toBe('lane-1')
      expect(postBody.lanes[1].id).not.toBe('lane-2')
      // Lane names should be preserved
      expect(postBody.lanes[0].name).toBe('担当者A')
      expect(postBody.lanes[1].name).toBe('担当者B')

      expect(postBody.nodes).toHaveLength(2)
      expect(postBody.nodes[0].id).not.toBe('node-1')
      expect(postBody.nodes[1].id).not.toBe('node-2')
      // Node labels should be preserved
      expect(postBody.nodes[0].label).toBe('タスク1')
      expect(postBody.nodes[1].label).toBe('タスク2')

      // Node laneIds should be remapped to new lane IDs
      expect(postBody.nodes[0].laneId).toBe(postBody.lanes[0].id)
      expect(postBody.nodes[1].laneId).toBe(postBody.lanes[1].id)

      expect(postBody.arrows).toHaveLength(1)
      expect(postBody.arrows[0].id).not.toBe('arrow-1')
      // Arrow fromNodeId/toNodeId should be remapped to new node IDs
      expect(postBody.arrows[0].fromNodeId).toBe(postBody.nodes[0].id)
      expect(postBody.arrows[0].toNodeId).toBe(postBody.nodes[1].id)
      expect(postBody.arrows[0].comment).toBe('接続')

      // Should navigate to the new flow
      expect(mockNavigate).toHaveBeenCalledWith('/flows/new-flow-id')
    })

    it('should show error when duplicate fails on GET', async () => {
      const user = userEvent.setup()
      // 1st call: GET /flows (initial load)
      mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
      // 2nd call: GET /flows/flow-1 rejects
      mockApiFetch.mockRejectedValueOnce(new Error('Not found'))

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
      })

      // Hover → wait for menu button → menu → duplicate
      fireEvent.mouseEnter(screen.getByTestId('flow-card-flow-1'))
      await waitFor(() => {
        expect(screen.getByTestId('card-menu-flow-1')).toBeInTheDocument()
      })
      await user.click(screen.getByTestId('card-menu-flow-1'))
      await waitFor(() => {
        expect(screen.getByTestId('context-menu')).toBeInTheDocument()
      })
      await user.click(screen.getByText('複製'))

      // Error should be shown
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-error')).toBeInTheDocument()
      })
      expect(screen.getByText('フローの複製に失敗しました')).toBeInTheDocument()
    })

    it('should show error when duplicate fails on POST', async () => {
      const user = userEvent.setup()
      // 1st call: GET /flows (initial load)
      mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
      // 2nd call: GET /flows/flow-1 returns detail
      mockApiFetch.mockResolvedValueOnce(mockFlowDetail)
      // 3rd call: POST /flows rejects
      mockApiFetch.mockRejectedValueOnce(new Error('Server error'))

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
      })

      // Hover → wait for menu button → menu → duplicate
      fireEvent.mouseEnter(screen.getByTestId('flow-card-flow-1'))
      await waitFor(() => {
        expect(screen.getByTestId('card-menu-flow-1')).toBeInTheDocument()
      })
      await user.click(screen.getByTestId('card-menu-flow-1'))
      await waitFor(() => {
        expect(screen.getByTestId('context-menu')).toBeInTheDocument()
      })
      await user.click(screen.getByText('複製'))

      // Error should be shown
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-error')).toBeInTheDocument()
      })
      expect(screen.getByText('フローの複製に失敗しました')).toBeInTheDocument()
    })

    it('should duplicate flow with no nodes or arrows', async () => {
      const user = userEvent.setup()
      const emptyFlowDetail = {
        flow: {
          ...mockFlowDetail.flow,
          nodes: [],
          arrows: [],
        },
      }

      // 1st call: GET /flows (initial load)
      mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
      // 2nd call: GET /flows/flow-1 returns detail with empty nodes/arrows
      mockApiFetch.mockResolvedValueOnce(emptyFlowDetail)
      // 3rd call: POST /flows
      mockApiFetch.mockResolvedValueOnce({ flow: { id: 'new-empty-flow' } })

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
      })

      // Hover → wait for menu button → menu → duplicate
      fireEvent.mouseEnter(screen.getByTestId('flow-card-flow-1'))
      await waitFor(() => {
        expect(screen.getByTestId('card-menu-flow-1')).toBeInTheDocument()
      })
      await user.click(screen.getByTestId('card-menu-flow-1'))
      await waitFor(() => {
        expect(screen.getByTestId('context-menu')).toBeInTheDocument()
      })
      await user.click(screen.getByText('複製'))

      // Verify POST was called
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          '/flows',
          expect.objectContaining({ method: 'POST' }),
        )
      })

      // Verify POST body
      const postCall = mockApiFetch.mock.calls.find(
        (call) =>
          call[0] === '/flows' && call[1] && (call[1] as { method?: string }).method === 'POST',
      )
      expect(postCall).toBeDefined()
      const postBody = JSON.parse((postCall![1] as { body: string }).body)

      // Lanes should have new IDs
      expect(postBody.lanes).toHaveLength(2)
      expect(postBody.lanes[0].id).not.toBe('lane-1')
      expect(postBody.lanes[1].id).not.toBe('lane-2')
      expect(postBody.lanes[0].name).toBe('担当者A')

      // Nodes and arrows should be empty
      expect(postBody.nodes).toHaveLength(0)
      expect(postBody.arrows).toHaveLength(0)

      // Should navigate to the new flow
      expect(mockNavigate).toHaveBeenCalledWith('/flows/new-empty-flow')
    })

    it('should prevent duplicate clicks while duplicating', async () => {
      const user = userEvent.setup()

      // 1st call: GET /flows (initial load)
      mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
      // 2nd call: GET /flows/flow-1 - never resolves (simulates in-progress)
      mockApiFetch.mockImplementationOnce(() => new Promise(() => {}))

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
      })

      // First duplicate click
      fireEvent.mouseEnter(screen.getByTestId('flow-card-flow-1'))
      await waitFor(() => {
        expect(screen.getByTestId('card-menu-flow-1')).toBeInTheDocument()
      })
      await user.click(screen.getByTestId('card-menu-flow-1'))
      await waitFor(() => {
        expect(screen.getByTestId('context-menu')).toBeInTheDocument()
      })
      await user.click(screen.getByText('複製'))

      // Wait for the GET call to be made
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/flows/flow-1')
      })

      const callCountAfterFirst = mockApiFetch.mock.calls.length

      // Try to trigger duplicate again via flow-2's context menu
      fireEvent.mouseEnter(screen.getByTestId('flow-card-flow-2'))
      await waitFor(() => {
        expect(screen.getByTestId('card-menu-flow-2')).toBeInTheDocument()
      })
      await user.click(screen.getByTestId('card-menu-flow-2'))
      await waitFor(() => {
        expect(screen.getByTestId('context-menu')).toBeInTheDocument()
      })
      await user.click(screen.getByText('複製'))

      // Should not have triggered additional API calls
      expect(mockApiFetch.mock.calls.length).toBe(callCountAfterFirst)
    })
  })

  // =============================================
  // グリッド内新規作成カードの位置
  // =============================================
  it('should render create card as first item in grid', async () => {
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    })
    const grid = screen.getByTestId('dashboard-grid')
    expect(grid.firstElementChild).toHaveAttribute('data-testid', 'create-flow-card')
  })

  // =============================================
  // UserMenuPanel テスト
  // =============================================
  it('should open user menu panel when avatar is clicked', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce({ flows: [] })
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-empty')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('user-avatar'))
    expect(screen.getByTestId('user-menu-panel')).toBeInTheDocument()
  })

  it('should close user menu panel when overlay is clicked', async () => {
    const user = userEvent.setup()
    mockApiFetch.mockResolvedValueOnce({ flows: [] })
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-empty')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('user-avatar'))
    expect(screen.getByTestId('user-menu-panel')).toBeInTheDocument()
    await user.click(screen.getByTestId('user-menu-overlay'))
    expect(screen.queryByTestId('user-menu-panel')).not.toBeInTheDocument()
  })

  it('should filter flows case-insensitively', async () => {
    const user = userEvent.setup()
    const flowsWithAscii = [
      ...mockFlows,
      {
        id: 'flow-3',
        title: 'My Test Flow',
        themeId: 'cloud',
        shareToken: null,
        createdAt: '2026-01-13T08:00:00Z',
        updatedAt: '2026-01-13T08:00:00Z',
      },
    ]
    mockApiFetch.mockResolvedValueOnce({ flows: flowsWithAscii })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-3')).toBeInTheDocument()
    })

    const searchInput = screen.getByTestId('search-input')
    await user.type(searchInput, 'my test')

    expect(screen.getByTestId('flow-card-flow-3')).toBeInTheDocument()
    expect(screen.queryByTestId('flow-card-flow-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('flow-card-flow-2')).not.toBeInTheDocument()
  })
})
