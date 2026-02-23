import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import type { FlowListResponse, FlowSummary, FlowDetailResponse } from '../editor/types'
import { FlowCard } from './FlowCard'
import { FlowContextMenu } from './FlowContextMenu'
import { DashboardTopBar } from './DashboardTopBar'
import { DashboardSidebar } from './DashboardSidebar'
import { UserMenuPanel } from '../../components/UserMenuPanel'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Toast } from '../../components/Toast'
import { PALETTES } from '../editor/theme-constants'
import { formatRelativeTime } from '../../utils/formatRelativeTime'
import { DEFAULT_FLOW_TITLE, DEFAULT_FLOW_THEME_ID, createDefaultLanes } from './constants'
import { useAuth } from '../../hooks/useAuth'
import { DashboardSkeleton } from './DashboardSkeleton'
import styles from './Dashboard.module.css'

type SortMode = 'updated' | 'name'
type ViewMode = 'grid' | 'list'

const DEFAULT_LANE_COUNT = 3

export function Dashboard() {
  const [flows, setFlows] = useState<FlowSummary[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState<boolean>(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [trashFlows, setTrashFlows] = useState<FlowSummary[]>([])
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)

  const [modal, setModal] = useState<{
    title: string
    message: string
    onConfirm: () => void
    danger?: boolean
    confirmLabel?: string
  } | null>(null)
  const [toast, setToast] = useState<{ message: string; icon?: string } | null>(null)

  const [menuOpen, setMenuOpen] = useState(false)

  // New features state
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('updated')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [selectedNav, setSelectedNav] = useState('recent')

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    flowId: string
    x: number
    y: number
  } | null>(null)

  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const userName = user?.name ?? ''

  const initialLoadDone = useRef(false)

  const loadFlows = useCallback(async (query?: string) => {
    try {
      if (!initialLoadDone.current) {
        setLoading(true)
      }
      setError(null)
      const url = query ? `/flows?q=${encodeURIComponent(query)}` : '/flows'
      const data = await apiFetch<FlowListResponse>(url)
      setFlows(data.flows)
      initialLoadDone.current = true
    } catch {
      setError('フロー一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadTrashFlows = useCallback(async () => {
    try {
      setError(null)
      const data = await apiFetch<FlowListResponse>('/flows/trash')
      setTrashFlows(data.flows)
    } catch {
      setError('ゴミ箱の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    const trimmed = searchQuery.trim()
    const timer = setTimeout(() => {
      loadFlows(trimmed || undefined)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, loadFlows])

  useEffect(() => {
    if (selectedNav === 'trash') {
      loadTrashFlows()
    }
  }, [selectedNav, loadTrashFlows])

  const sortedFlows = useMemo(() => {
    if (sortMode === 'name') {
      return [...flows].sort((a, b) => a.title.localeCompare(b.title, 'ja'))
    }
    // 'updated' = newest first (API default order)
    return flows
  }, [flows, sortMode])

  const handleCreate = async () => {
    if (creating) return
    setCreating(true)
    setError(null)
    try {
      const data = await apiFetch<{ flow: { id: string } }>('/flows', {
        method: 'POST',
        body: JSON.stringify({
          title: DEFAULT_FLOW_TITLE,
          themeId: DEFAULT_FLOW_THEME_ID,
          lanes: createDefaultLanes(),
          nodes: [],
          arrows: [],
        }),
      })
      navigate(`/flows/${data.flow.id}`)
    } catch {
      setError('フローの作成に失敗しました')
      setCreating(false)
    }
  }

  const handleDelete = (id: string, title: string) => {
    if (deletingId) return
    setModal({
      title: 'ゴミ箱に移動',
      message: `「${title}」をゴミ箱に移動しますか？`,
      confirmLabel: '移動する',
      danger: true,
      onConfirm: async () => {
        setModal(null)
        setDeletingId(id)
        try {
          await apiFetch(`/flows/${id}`, { method: 'DELETE' })
          setFlows((prev) => prev.filter((f) => f.id !== id))
          setToast({ message: 'ゴミ箱に移動しました', icon: '🗑' })
        } catch {
          setError('フローの削除に失敗しました')
        } finally {
          setDeletingId(null)
        }
      },
    })
  }

  const handleRestore = async (id: string) => {
    try {
      await apiFetch(`/flows/${id}/restore`, { method: 'POST' })
      setTrashFlows((prev) => prev.filter((f) => f.id !== id))
      setToast({ message: 'フローを復元しました', icon: '♻️' })
    } catch {
      setError('フローの復元に失敗しました')
    }
  }

  const handlePermanentDelete = (id: string, title: string) => {
    setModal({
      title: '完全に削除',
      message: `完全に削除すると復元できません。「${title}」を本当に削除しますか？`,
      confirmLabel: '完全に削除',
      danger: true,
      onConfirm: async () => {
        setModal(null)
        try {
          await apiFetch(`/flows/${id}/permanent`, { method: 'DELETE' })
          setTrashFlows((prev) => prev.filter((f) => f.id !== id))
        } catch {
          setError('フローの完全削除に失敗しました')
        }
      },
    })
  }

  const handleRename = async (id: string, newTitle: string) => {
    setRenamingId(null)
    // Optimistic update
    setFlows((prev) => prev.map((f) => (f.id === id ? { ...f, title: newTitle } : f)))
    try {
      await apiFetch(`/flows/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: newTitle }),
      })
    } catch {
      setError('フロー名の変更に失敗しました')
      // Revert on failure
      const trimmed = searchQuery.trim()
      loadFlows(trimmed || undefined)
    }
  }

  const handleContextMenu = (id: string, x: number, y: number) => {
    setContextMenu({ flowId: id, x, y })
  }

  const handleCloseContextMenu = () => {
    setContextMenu(null)
  }

  // Context menu actions
  const contextFlow = contextMenu
    ? (selectedNav === 'trash' ? trashFlows : flows).find((f) => f.id === contextMenu.flowId)
    : null

  const handleContextOpen = () => {
    if (contextMenu) {
      navigate(`/flows/${contextMenu.flowId}`)
      setContextMenu(null)
    }
  }

  const handleContextRename = () => {
    if (contextMenu) {
      setRenamingId(contextMenu.flowId)
      setContextMenu(null)
    }
  }

  const handleContextDelete = () => {
    if (contextMenu && contextFlow) {
      handleDelete(contextMenu.flowId, contextFlow.title)
      setContextMenu(null)
    }
  }

  const handleDuplicate = async (id: string) => {
    if (duplicatingId) return
    setDuplicatingId(id)
    setError(null)
    try {
      const data = await apiFetch<FlowDetailResponse>(`/flows/${id}`)
      const original = data.flow

      const laneIdMap = new Map<string, string>()
      const nodeIdMap = new Map<string, string>()

      const newLanes = original.lanes.map((lane) => {
        const newId = crypto.randomUUID()
        laneIdMap.set(lane.id, newId)
        return { ...lane, id: newId }
      })

      const newNodes = original.nodes.map((node) => {
        const newId = crypto.randomUUID()
        nodeIdMap.set(node.id, newId)
        return {
          ...node,
          id: newId,
          laneId: laneIdMap.get(node.laneId) ?? node.laneId,
        }
      })

      const newArrows = original.arrows.map((arrow) => ({
        ...arrow,
        id: crypto.randomUUID(),
        fromNodeId: nodeIdMap.get(arrow.fromNodeId) ?? arrow.fromNodeId,
        toNodeId: nodeIdMap.get(arrow.toNodeId) ?? arrow.toNodeId,
      }))

      const result = await apiFetch<{ flow: { id: string } }>('/flows', {
        method: 'POST',
        body: JSON.stringify({
          title: `コピー ${original.title}`,
          themeId: original.themeId,
          lanes: newLanes,
          nodes: newNodes,
          arrows: newArrows,
        }),
      })

      navigate(`/flows/${result.flow.id}`)
    } catch {
      setError('フローの複製に失敗しました')
    } finally {
      setDuplicatingId(null)
    }
  }

  const handleContextDuplicate = () => {
    if (contextMenu) {
      handleDuplicate(contextMenu.flowId)
      setContextMenu(null)
    }
  }

  // Lane colors for list view
  const laneColors = PALETTES.slice(0, DEFAULT_LANE_COUNT).map((p) => p.dot)

  return (
    <div data-testid="dashboard" className={styles.layout}>
      {loading ? (
        <DashboardSkeleton />
      ) : (
        <div className={styles.contentFadeIn}>
          {/* Top Bar */}
          <DashboardTopBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            userName={userName}
            onToggleMenu={() => setMenuOpen((v) => !v)}
          />

          <div className={styles.body}>
            {/* Sidebar */}
            <DashboardSidebar
              selectedNav={selectedNav}
              onNavChange={setSelectedNav}
              userName={userName}
            />

            {/* Main content area */}
            <div className={styles.main}>
              {/* Sub-header: nav label + sort + view toggle */}
              <div className={styles.subheader}>
                <h1 className={styles.title}>
                  {selectedNav === 'trash' ? 'ゴミ箱' : 'マイフロー'}
                </h1>
                {selectedNav !== 'trash' && (
                  <div className={styles.controls}>
                    <select
                      data-testid="sort-select"
                      value={sortMode}
                      onChange={(e) => setSortMode(e.target.value as SortMode)}
                      className={styles.sortSelect}
                    >
                      <option value="updated">更新日</option>
                      <option value="name">名前</option>
                    </select>

                    <div className={styles.viewToggle}>
                      <button
                        data-testid="view-grid-button"
                        onClick={() => setViewMode('grid')}
                        className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.viewBtnActive : ''}`}
                        aria-label="グリッド表示"
                      >
                        ▦
                      </button>
                      <button
                        data-testid="view-list-button"
                        onClick={() => setViewMode('list')}
                        className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewBtnActive : ''}`}
                        aria-label="リスト表示"
                      >
                        ☰
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div data-testid="dashboard-error" className={styles.error}>
                  {error}
                </div>
              )}

              {/* Content */}
              {selectedNav === 'trash' ? (
                trashFlows.length === 0 ? (
                  <div data-testid="trash-empty" className={styles.empty}>
                    <div className={styles.emptyIcon}>▢</div>
                    <p className={styles.emptyTitle}>ゴミ箱は空です</p>
                    <p className={styles.emptySubtitle}>削除したフローはここに表示されます</p>
                  </div>
                ) : (
                  <div data-testid="trash-grid" className={styles.grid}>
                    {trashFlows.map((flow) => (
                      <FlowCard
                        key={flow.id}
                        flow={flow}
                        onDelete={handlePermanentDelete}
                        onRename={handleRename}
                        onContextMenu={handleContextMenu}
                        deleting={deletingId === flow.id}
                        isHovered={hoveredId === flow.id}
                        onHover={setHoveredId}
                        renamingId={renamingId}
                        isTrash
                        onRestore={handleRestore}
                      />
                    ))}
                  </div>
                )
              ) : sortedFlows.length === 0 ? (
                <div data-testid="dashboard-empty" className={styles.empty}>
                  <div className={styles.emptyIcon}>+</div>
                  <p className={styles.emptyTitle}>
                    {searchQuery.trim()
                      ? '検索条件に一致するフローがありません'
                      : 'フローがまだありません。新規作成してみましょう！'}
                  </p>
                  {!searchQuery.trim() && (
                    <p className={styles.emptySubtitle}>下のボタンから最初のフローを作成できます</p>
                  )}
                  {!searchQuery.trim() && (
                    <button
                      data-testid="empty-create-flow-button"
                      onClick={handleCreate}
                      disabled={creating}
                      className={`${styles.createCard} ${creating ? styles.createCardDisabled : ''}`}
                      style={{ marginTop: '16px', width: '200px', height: '120px' }}
                    >
                      <span className={styles.createCardIcon}>+</span>
                      <span className={styles.createCardText}>
                        {creating ? '作成中...' : '新規作成'}
                      </span>
                    </button>
                  )}
                </div>
              ) : viewMode === 'grid' ? (
                <div data-testid="dashboard-grid" className={styles.grid}>
                  <button
                    data-testid="create-flow-card"
                    onClick={handleCreate}
                    disabled={creating}
                    className={`${styles.createCard} ${creating ? styles.createCardDisabled : ''}`}
                  >
                    <span className={styles.createCardIcon}>+</span>
                    <span className={styles.createCardText}>
                      {creating ? '作成中...' : '新規作成'}
                    </span>
                  </button>
                  {sortedFlows.map((flow) => (
                    <FlowCard
                      key={flow.id}
                      flow={flow}
                      onDelete={handleDelete}
                      onRename={handleRename}
                      onContextMenu={handleContextMenu}
                      deleting={deletingId === flow.id}
                      isHovered={hoveredId === flow.id}
                      onHover={setHoveredId}
                      renamingId={renamingId}
                    />
                  ))}
                </div>
              ) : (
                <div data-testid="dashboard-list" className={styles.list}>
                  {/* List header */}
                  <div className={styles.listHeader}>
                    <span className={styles.listHeaderName}>名前</span>
                    <span className={styles.listHeaderUpdated}>更新日</span>
                    <span className={styles.listHeaderLanes}>レーン</span>
                    <span className={styles.listHeaderActions} />
                  </div>
                  {sortedFlows.map((flow) => (
                    <div
                      key={flow.id}
                      data-testid={`flow-card-${flow.id}`}
                      className={styles.listRow}
                    >
                      <div className={styles.listName}>
                        <Link
                          to={`/flows/${flow.id}`}
                          data-testid={`flow-link-${flow.id}`}
                          className={styles.listLink}
                        >
                          {flow.title}
                        </Link>
                        {flow.shareToken && (
                          <span
                            data-testid={`share-badge-${flow.id}`}
                            className={styles.shareBadge}
                          >
                            共有中
                          </span>
                        )}
                      </div>
                      <div className={styles.listUpdated}>{formatRelativeTime(flow.updatedAt)}</div>
                      <div className={styles.listLanes}>
                        {laneColors.map((color, i) => (
                          <span
                            key={i}
                            className={styles.laneDot}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <div className={styles.listActions}>
                        <button
                          className={styles.menuBtn}
                          onClick={(e) => {
                            e.stopPropagation()
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                            handleContextMenu(flow.id, rect.left, rect.bottom)
                          }}
                          aria-label="メニュー"
                        >
                          &#x22EF;
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Context Menu */}
          {contextMenu && (
            <FlowContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              onOpen={handleContextOpen}
              onRename={handleContextRename}
              onDuplicate={handleContextDuplicate}
              onDelete={handleContextDelete}
              onClose={handleCloseContextMenu}
              isTrash={selectedNav === 'trash'}
              onRestore={() => {
                if (contextMenu) {
                  handleRestore(contextMenu.flowId)
                  setContextMenu(null)
                }
              }}
              onPermanentDelete={() => {
                if (contextMenu && contextFlow) {
                  handlePermanentDelete(contextMenu.flowId, contextFlow.title)
                  setContextMenu(null)
                }
              }}
            />
          )}

          <UserMenuPanel
            isOpen={menuOpen}
            onClose={() => setMenuOpen(false)}
            userName={userName}
            userEmail={user?.email ?? ''}
            onLogout={logout}
          />
        </div>
      )}

      {/* modal と toast は loading中も外に出す */}
      {modal && (
        <ConfirmDialog
          title={modal.title}
          message={modal.message}
          onConfirm={modal.onConfirm}
          onCancel={() => setModal(null)}
          danger={modal.danger}
          confirmLabel={modal.confirmLabel}
        />
      )}
      {toast && <Toast message={toast.message} icon={toast.icon} onClose={() => setToast(null)} />}
    </div>
  )
}
