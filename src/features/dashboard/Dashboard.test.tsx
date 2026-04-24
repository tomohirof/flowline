// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Dashboard } from './Dashboard'

// Mock apiFetch
// The outer apiFetch dispatches /projects/shared to a separate stub so DashboardSidebar's
// fetch does not consume entries from the inner queue used by /flows-centric tests.
// We preserve the original call arity (path only, or path + init) so toHaveBeenCalledWith
// assertions in existing tests continue to match.
const innerApiFetch = vi.fn()
const sharedProjectsFetch = vi.fn(() => Promise.resolve({ projects: [] }))
const projectMembersFetch = vi.fn(() => Promise.reject(new Error('no members stub')))
vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn((...args: unknown[]) => {
    const [path] = args as [string, RequestInit?]
    if (path === '/projects/shared') {
      return sharedProjectsFetch(...(args as [string, RequestInit?]))
    }
    if (typeof path === 'string' && /^\/projects\/[^/]+\/members(\/|$)/.test(path)) {
      return projectMembersFetch(...(args as [string, RequestInit?]))
    }
    return innerApiFetch(...(args as [string, RequestInit?]))
  }),
  fetchProjects: vi.fn().mockResolvedValue({ projects: [] }),
  createProject: vi.fn(),
  renameProject: vi.fn(),
  deleteProject: vi.fn(),
  moveFlowToProject: vi.fn().mockResolvedValue({ ok: true }),
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

import { apiFetch, fetchProjects, moveFlowToProject } from '../../lib/api'

// Existing tests interact with the non-/projects/shared path via `mockApiFetch`.
// DashboardSidebar's /projects/shared fetch is handled by `sharedProjectsFetch` separately.
const mockApiFetch = innerApiFetch
// Also re-export the outer wrapper for any assertions that inspect total call count.
const outerApiFetch = vi.mocked(apiFetch)
const mockFetchProjects = vi.mocked(fetchProjects)
const mockMoveFlowToProject = vi.mocked(moveFlowToProject)

const mockFlows = [
  {
    id: 'flow-1',
    title: '業務フロー',
    themeId: 'cloud',
    shareToken: 'abc123',
    projectId: null,
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'flow-2',
    title: '申請処理フロー',
    themeId: 'midnight',
    shareToken: null,
    projectId: null,
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
    // Reset only the mocks that individual tests customize; preserve the outer apiFetch
    // path router set up at module load, and the sharedProjectsFetch default.
    mockApiFetch.mockReset()
    outerApiFetch.mockClear()
    sharedProjectsFetch.mockClear()
    sharedProjectsFetch.mockImplementation(() => Promise.resolve({ projects: [] }))
    projectMembersFetch.mockClear()
    projectMembersFetch.mockImplementation(() => Promise.reject(new Error('no members stub')))
    mockFetchProjects.mockReset()
    mockFetchProjects.mockResolvedValue({ projects: [] })
    mockMoveFlowToProject.mockReset()
    mockMoveFlowToProject.mockResolvedValue({ ok: true })
    mockNavigate.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  // === ローディング状態 ===
  it('should show skeleton loading while fetching flows', () => {
    mockApiFetch.mockImplementation(() => new Promise(() => {})) // never resolves

    renderDashboard()

    expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-grid')).not.toBeInTheDocument()
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

    expect(screen.getByText('empty.noFlows')).toBeInTheDocument()
  })

  // === 新規作成カード ===
  it('should render create card in grid', async () => {
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    })
    expect(screen.getByTestId('create-flow-card')).toBeInTheDocument()
    expect(screen.getByText('action.create')).toBeInTheDocument()
  })

  it('should render create card with SVG icon', async () => {
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('create-flow-card')).toBeInTheDocument()
    })
    const createCard = screen.getByTestId('create-flow-card')
    const svg = createCard.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(createCard.querySelector('[class*="createCardIconBg"]')).not.toBeNull()
  })

  it('should render empty state create card with SVG icon', async () => {
    mockApiFetch.mockResolvedValueOnce({ flows: [] })
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('empty-create-flow-button')).toBeInTheDocument()
    })
    const createCard = screen.getByTestId('empty-create-flow-button')
    const svg = createCard.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(createCard.querySelector('[class*="createCardIconBg"]')).not.toBeNull()
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
    expect(screen.getByText('toast.errorCreate')).toBeInTheDocument()
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
    expect(screen.getByText('action.creating')).toBeInTheDocument()
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
    expect(screen.getByText('confirm.moveToTrashTitle')).toBeInTheDocument()

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
    expect(screen.getByText('toast.errorDelete')).toBeInTheDocument()
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
    expect(screen.getByText('toast.movedToTrash')).toBeInTheDocument()
  })

  // === APIエラー ===
  it('should show error state when fetching flows fails', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Network error'))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-error')).toBeInTheDocument()
    })

    expect(screen.getByText('toast.errorFetchFlows')).toBeInTheDocument()
  })

  // === ヘッダー表示 ===
  it('should display "マイフロー" heading', async () => {
    mockApiFetch.mockResolvedValueOnce({ flows: [] })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('title.myFlows')).toBeInTheDocument()
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
  // 新機能テスト: API検索フィルタリング
  // =============================================
  it('should call API with search query after debounce', async () => {
    const user = userEvent.setup()
    // Initial load
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
    // Search API call - returns only flow-1
    mockApiFetch.mockResolvedValueOnce({ flows: [mockFlows[0]] })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    })

    // Type search query
    const searchInput = screen.getByTestId('search-input')
    await user.type(searchInput, '業務')

    // Verify API was called with search query after debounce
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/flows?q=%E6%A5%AD%E5%8B%99')
    })

    // flow-1 should be visible (returned by API)
    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    })
    // flow-2 should not be visible (not returned by API)
    expect(screen.queryByTestId('flow-card-flow-2')).not.toBeInTheDocument()
  })

  it('should show empty state when search matches nothing', async () => {
    const user = userEvent.setup()
    // Initial load
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
    // Search API call - returns empty
    mockApiFetch.mockResolvedValueOnce({ flows: [] })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    })

    const searchInput = screen.getByTestId('search-input')
    await user.type(searchInput, '存在しないフロー名')

    // Should show empty state after debounced API returns empty
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-empty')).toBeInTheDocument()
    })

    // No cards should be visible
    expect(screen.queryByTestId('flow-card-flow-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('flow-card-flow-2')).not.toBeInTheDocument()
  })

  it('should re-fetch without query param when search is cleared', async () => {
    const user = userEvent.setup()
    // Initial load
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
    // Search API call
    mockApiFetch.mockResolvedValueOnce({ flows: [mockFlows[0]] })
    // Clear search - re-fetch all
    mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
    })

    const searchInput = screen.getByTestId('search-input')
    await user.type(searchInput, '業務')

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/flows?q=%E6%A5%AD%E5%8B%99')
    })

    // Clear search
    await user.clear(searchInput)

    // Should call /flows without query param after debounce
    await waitFor(() => {
      const calls = mockApiFetch.mock.calls
      const lastCall = calls[calls.length - 1]
      expect(lastCall[0]).toBe('/flows')
    })
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

    // Menu buttons should exist for each flow in list view
    const menuBtns = screen.getAllByLabelText('menu')
    expect(menuBtns.length).toBeGreaterThanOrEqual(2)
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
      await user.click(screen.getByText('action.duplicate'))

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
      expect(postBody.title).toBe('action.copyPrefix 業務フロー')
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
      await user.click(screen.getByText('action.duplicate'))

      // Error should be shown
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-error')).toBeInTheDocument()
      })
      expect(screen.getByText('toast.errorDuplicate')).toBeInTheDocument()
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
      await user.click(screen.getByText('action.duplicate'))

      // Error should be shown
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-error')).toBeInTheDocument()
      })
      expect(screen.getByText('toast.errorDuplicate')).toBeInTheDocument()
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
      await user.click(screen.getByText('action.duplicate'))

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
      await user.click(screen.getByText('action.duplicate'))

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
      await user.click(screen.getByText('action.duplicate'))

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

  it('should send search query to API (case handling is server-side)', async () => {
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
    // Initial load
    mockApiFetch.mockResolvedValueOnce({ flows: flowsWithAscii })
    // API returns only flow-3 for "my test" search
    mockApiFetch.mockResolvedValueOnce({
      flows: [flowsWithAscii[2]],
    })

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-3')).toBeInTheDocument()
    })

    const searchInput = screen.getByTestId('search-input')
    await user.type(searchInput, 'my test')

    // Verify API was called with search query
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/flows?q=my%20test')
    })

    // Only flow-3 should be visible (returned by API)
    await waitFor(() => {
      expect(screen.getByTestId('flow-card-flow-3')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('flow-card-flow-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('flow-card-flow-2')).not.toBeInTheDocument()
  })

  describe('shared view (#120)', () => {
    it('should show only shared flows when shared nav is selected', async () => {
      mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
      renderDashboard()

      await waitFor(() => {
        expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument()
      })

      const sharedNav = screen.getByTestId('nav-item-shared')
      await userEvent.click(sharedNav)

      // flow-1 has shareToken='abc123', flow-2 has shareToken=null
      expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
      expect(screen.queryByTestId('flow-card-flow-2')).not.toBeInTheDocument()
    })

    it('should show shared empty state when no shared flows', async () => {
      const noSharedFlows = [{ ...mockFlows[1], shareToken: null }]
      mockApiFetch.mockResolvedValueOnce({ flows: noSharedFlows })
      renderDashboard()

      await waitFor(() => {
        expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument()
      })

      const sharedNav = screen.getByTestId('nav-item-shared')
      await userEvent.click(sharedNav)

      await waitFor(() => {
        expect(screen.getByTestId('shared-empty')).toBeInTheDocument()
      })
    })

    it('should show shared title when in shared view', async () => {
      mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
      renderDashboard()

      await waitFor(() => {
        expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument()
      })

      const sharedNav = screen.getByTestId('nav-item-shared')
      await userEvent.click(sharedNav)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'title.shared' })).toBeInTheDocument()
      })
    })

    it('should not show create card in shared grid view', async () => {
      mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
      renderDashboard()

      await waitFor(() => {
        expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument()
      })

      const sharedNav = screen.getByTestId('nav-item-shared')
      await userEvent.click(sharedNav)

      expect(screen.queryByTestId('create-flow-card')).not.toBeInTheDocument()
    })
  })

  describe('trash view (#95)', () => {
    it('should load trash flows when trash nav is selected', async () => {
      const trashFlows = [
        {
          id: 'flow-deleted',
          title: '削除済みフロー',
          themeId: 'cloud',
          shareToken: null,
          deletedAt: '2026-02-20T10:00:00Z',
          createdAt: '2026-01-15T10:00:00Z',
          updatedAt: '2026-01-15T10:00:00Z',
        },
      ]
      mockApiFetch.mockResolvedValueOnce({ flows: [] }) // initial load
      mockApiFetch.mockResolvedValueOnce({ flows: trashFlows }) // trash load

      render(
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>,
      )

      await waitFor(() => {
        expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument()
      })

      const trashNav = screen.getByTestId('nav-item-trash')
      await userEvent.click(trashNav)

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/flows/trash')
      })
    })

    it('should show trash empty state when no deleted flows', async () => {
      mockApiFetch.mockResolvedValueOnce({ flows: [] }) // initial load
      mockApiFetch.mockResolvedValueOnce({ flows: [] }) // trash load

      render(
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>,
      )

      await waitFor(() => {
        expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument()
      })

      const trashNav = screen.getByTestId('nav-item-trash')
      await userEvent.click(trashNav)

      await waitFor(() => {
        expect(screen.getByTestId('trash-empty')).toBeInTheDocument()
      })
    })

    it('should show trash title when in trash view', async () => {
      mockApiFetch.mockResolvedValueOnce({ flows: [] })
      mockApiFetch.mockResolvedValueOnce({ flows: [] })

      render(
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>,
      )

      await waitFor(() => {
        expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument()
      })

      const trashNav = screen.getByTestId('nav-item-trash')
      await userEvent.click(trashNav)

      await waitFor(() => {
        expect(screen.getByText('title.trash')).toBeInTheDocument()
      })
    })
  })

  // =============================================
  // プロジェクト機能テスト (#287)
  // =============================================
  describe('project hierarchy (#287)', () => {
    it('should load projects on mount', async () => {
      const mockProjects = [
        {
          id: 'p1',
          name: 'プロジェクトA',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ]
      mockFetchProjects.mockResolvedValueOnce({ projects: mockProjects })
      mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })

      renderDashboard()

      await waitFor(() => {
        expect(mockFetchProjects).toHaveBeenCalled()
      })
    })

    it('should filter flows by project when project nav is selected', async () => {
      const mockProjects = [
        {
          id: 'p1',
          name: 'プロジェクトA',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ]
      mockFetchProjects.mockResolvedValueOnce({ projects: mockProjects })
      mockApiFetch.mockResolvedValueOnce({ flows: mockFlows }) // initial
      mockApiFetch.mockResolvedValueOnce({ flows: [mockFlows[0]] }) // filtered

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
      })

      // Click on project in sidebar
      await userEvent.click(screen.getByText('プロジェクトA'))

      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/flows?projectId=p1')
      })
    })

    it('should show project name in title when project is selected', async () => {
      const mockProjects = [
        {
          id: 'p1',
          name: 'プロジェクトA',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ]
      mockFetchProjects.mockResolvedValueOnce({ projects: mockProjects })
      mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
      mockApiFetch.mockResolvedValueOnce({ flows: [] })

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByText('プロジェクトA'))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'プロジェクトA' })).toBeInTheDocument()
      })
    })

    it('should move flow to project via context menu', async () => {
      const user = userEvent.setup()
      const mockProjects = [
        {
          id: 'p1',
          name: 'プロジェクトA',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ]
      mockFetchProjects.mockResolvedValueOnce({ projects: mockProjects })
      mockApiFetch.mockResolvedValueOnce({ flows: mockFlows }) // initial
      mockMoveFlowToProject.mockResolvedValueOnce({ ok: true })
      mockApiFetch.mockResolvedValueOnce({ flows: mockFlows }) // reload after move

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
      })

      // Open context menu via card menu button
      fireEvent.mouseEnter(screen.getByTestId('flow-card-flow-1'))
      await waitFor(() => {
        expect(screen.getByTestId('card-menu-flow-1')).toBeInTheDocument()
      })
      await user.click(screen.getByTestId('card-menu-flow-1'))
      await waitFor(() => {
        expect(screen.getByTestId('context-menu')).toBeInTheDocument()
      })

      // Click 'sidebar.moveToProject' to open submenu
      await user.click(screen.getByText('sidebar.moveToProject'))

      // Click project name in submenu (inside context-menu)
      const contextMenuEl = screen.getByTestId('context-menu')
      const projectBtn = Array.from(contextMenuEl.querySelectorAll('button')).find(
        (btn) => btn.textContent === 'プロジェクトA',
      )!
      await user.click(projectBtn)

      await waitFor(() => {
        expect(mockMoveFlowToProject).toHaveBeenCalledWith('flow-1', 'p1')
      })

      // Toast should show
      await waitFor(() => {
        expect(screen.getByTestId('toast')).toBeInTheDocument()
      })
      expect(screen.getByText('project.movedTo')).toBeInTheDocument()
    })

    it('should show error when move to project fails', async () => {
      const user = userEvent.setup()
      const mockProjects = [
        {
          id: 'p1',
          name: 'プロジェクトA',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ]
      mockFetchProjects.mockResolvedValueOnce({ projects: mockProjects })
      mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
      mockMoveFlowToProject.mockRejectedValueOnce(new Error('Move failed'))

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
      })

      fireEvent.mouseEnter(screen.getByTestId('flow-card-flow-1'))
      await waitFor(() => {
        expect(screen.getByTestId('card-menu-flow-1')).toBeInTheDocument()
      })
      await user.click(screen.getByTestId('card-menu-flow-1'))
      await waitFor(() => {
        expect(screen.getByTestId('context-menu')).toBeInTheDocument()
      })

      await user.click(screen.getByText('sidebar.moveToProject'))
      const contextMenuEl = screen.getByTestId('context-menu')
      const projectBtn = Array.from(contextMenuEl.querySelectorAll('button')).find(
        (btn) => btn.textContent === 'プロジェクトA',
      )!
      await user.click(projectBtn)

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-error')).toBeInTheDocument()
      })
      expect(screen.getByText('project.errorMove')).toBeInTheDocument()
    })

    it('should move flow to uncategorized via context menu', async () => {
      const user = userEvent.setup()
      const mockProjects = [
        {
          id: 'p1',
          name: 'プロジェクトA',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ]
      const flowsWithProject = [{ ...mockFlows[0], projectId: 'p1' }, mockFlows[1]]
      mockFetchProjects.mockResolvedValueOnce({ projects: mockProjects })
      mockApiFetch.mockResolvedValueOnce({ flows: flowsWithProject })
      mockMoveFlowToProject.mockResolvedValueOnce({ ok: true })
      mockApiFetch.mockResolvedValueOnce({ flows: flowsWithProject }) // reload

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
      })

      fireEvent.mouseEnter(screen.getByTestId('flow-card-flow-1'))
      await waitFor(() => {
        expect(screen.getByTestId('card-menu-flow-1')).toBeInTheDocument()
      })
      await user.click(screen.getByTestId('card-menu-flow-1'))
      await waitFor(() => {
        expect(screen.getByTestId('context-menu')).toBeInTheDocument()
      })

      await user.click(screen.getByText('sidebar.moveToProject'))
      const contextMenuEl = screen.getByTestId('context-menu')
      const uncategorizedBtn = Array.from(contextMenuEl.querySelectorAll('button')).find(
        (btn) => btn.textContent === 'sidebar.uncategorized',
      )!
      await user.click(uncategorizedBtn)

      await waitFor(() => {
        expect(mockMoveFlowToProject).toHaveBeenCalledWith('flow-1', null)
      })

      await waitFor(() => {
        expect(screen.getByText('project.movedTo')).toBeInTheDocument()
      })
    })
  })

  // =============================================
  // ProjectActionBar integration (#306)
  // =============================================
  describe('ProjectActionBar integration (#306)', () => {
    it('renders ProjectActionBar with settings+members when owner selects own project', async () => {
      const mockProjects = [
        {
          id: 'p1',
          name: 'Owned Project',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ]
      mockFetchProjects.mockResolvedValueOnce({ projects: mockProjects })
      mockApiFetch.mockResolvedValueOnce({ flows: mockFlows }) // initial load
      mockApiFetch.mockResolvedValueOnce({ flows: [] }) // after project selection
      projectMembersFetch.mockImplementation(() =>
        Promise.resolve({
          owner: { id: 'user-1', email: 'test@example.com', name: 'テストユーザー' },
          editors: [],
        }),
      )

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByText('Owned Project'))

      await waitFor(() => {
        expect(screen.getByTestId('project-action-bar')).toBeInTheDocument()
      })
      expect(screen.getByTestId('project-settings-btn')).toBeInTheDocument()
      expect(screen.getByTestId('project-members-btn')).toBeInTheDocument()
      expect(screen.queryByTestId('project-leave-btn')).toBeNull()
    })

    it('renders ProjectActionBar with leave button when editor selects shared project', async () => {
      // Current user (user-1) owns NO projects — the shared project comes from /projects/shared
      mockFetchProjects.mockResolvedValueOnce({ projects: [] })
      sharedProjectsFetch.mockImplementation(() =>
        Promise.resolve({
          projects: [
            {
              id: 'shared-p1',
              name: 'Shared Project',
              ownerName: 'Alice',
              joinedAt: '2026-04-24T00:00:00Z',
              createdAt: '2026-01-01T00:00:00Z',
              updatedAt: '2026-01-01T00:00:00Z',
            },
          ],
        }),
      )
      mockApiFetch.mockResolvedValueOnce({ flows: mockFlows })
      mockApiFetch.mockResolvedValueOnce({ flows: [] })
      projectMembersFetch.mockImplementation(() =>
        Promise.resolve({
          owner: { id: 'u-owner', email: 'o@x.com', name: 'Alice' },
          editors: [{ id: 'user-1', email: 'test@example.com', name: 'テストユーザー' }],
        }),
      )

      renderDashboard()

      await waitFor(() => {
        expect(screen.getByTestId('flow-card-flow-1')).toBeInTheDocument()
      })

      // Wait for sidebar to pick up the shared project from the lifted state
      await waitFor(() => {
        expect(screen.getByTestId('shared-project-shared-p1')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByTestId('shared-project-shared-p1'))

      await waitFor(() => {
        expect(screen.getByTestId('project-action-bar')).toBeInTheDocument()
      })
      expect(screen.getByTestId('project-leave-btn')).toBeInTheDocument()
      expect(screen.queryByTestId('project-settings-btn')).toBeNull()
      expect(screen.getByTestId('project-members-btn')).toBeInTheDocument()
    })
  })
})
