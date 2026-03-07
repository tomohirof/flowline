import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
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

const CreateCardIcon = () => (
  <span className={styles.createCardIconBg}>
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#7C5CFC"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  </span>
)

export function Dashboard() {
  const { t, i18n } = useTranslation(['dashboard', 'common'])
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

  const loadFlows = useCallback(
    async (query?: string) => {
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
        setError(t('dashboard:toast.errorFetchFlows'))
      } finally {
        setLoading(false)
      }
    },
    [t],
  )

  const loadTrashFlows = useCallback(async () => {
    try {
      setError(null)
      const data = await apiFetch<FlowListResponse>('/flows/trash')
      setTrashFlows(data.flows)
    } catch {
      setError(t('dashboard:toast.errorFetchTrash'))
    } finally {
      setLoading(false)
    }
  }, [t])

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

  const displayedFlows = useMemo(() => {
    if (selectedNav === 'shared') {
      return sortedFlows.filter((f) => f.shareToken !== null)
    }
    return sortedFlows
  }, [selectedNav, sortedFlows])

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
      setError(t('dashboard:toast.errorCreate'))
      setCreating(false)
    }
  }

  const handleDelete = (id: string, title: string) => {
    if (deletingId) return
    setModal({
      title: t('dashboard:confirm.moveToTrashTitle'),
      message: t('dashboard:confirm.moveToTrashMessage', { title }),
      confirmLabel: t('dashboard:confirm.moveToTrashConfirm'),
      danger: true,
      onConfirm: async () => {
        setModal(null)
        setDeletingId(id)
        try {
          await apiFetch(`/flows/${id}`, { method: 'DELETE' })
          setFlows((prev) => prev.filter((f) => f.id !== id))
          setToast({ message: t('dashboard:toast.movedToTrash'), icon: '🗑' })
        } catch {
          setError(t('dashboard:toast.errorDelete'))
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
      setToast({ message: t('dashboard:toast.restored'), icon: '♻️' })
    } catch {
      setError(t('dashboard:toast.errorRestore'))
    }
  }

  const handlePermanentDelete = (id: string, title: string) => {
    setModal({
      title: t('dashboard:confirm.permanentDeleteTitle'),
      message: t('dashboard:confirm.permanentDeleteMessage', { title }),
      confirmLabel: t('dashboard:confirm.permanentDeleteConfirm'),
      danger: true,
      onConfirm: async () => {
        setModal(null)
        try {
          await apiFetch(`/flows/${id}/permanent`, { method: 'DELETE' })
          setTrashFlows((prev) => prev.filter((f) => f.id !== id))
        } catch {
          setError(t('dashboard:toast.errorPermanentDelete'))
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
      setError(t('dashboard:toast.errorRename'))
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
          title: `${t('dashboard:action.copyPrefix')} ${original.title}`,
          themeId: original.themeId,
          lanes: newLanes,
          nodes: newNodes,
          arrows: newArrows,
        }),
      })

      navigate(`/flows/${result.flow.id}`)
    } catch {
      setError(t('dashboard:toast.errorDuplicate'))
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
                  {selectedNav === 'trash'
                    ? t('dashboard:title.trash')
                    : selectedNav === 'shared'
                      ? t('dashboard:title.shared')
                      : t('dashboard:title.myFlows')}
                </h1>
                {selectedNav !== 'trash' && (
                  <div className={styles.controls}>
                    <select
                      data-testid="sort-select"
                      value={sortMode}
                      onChange={(e) => setSortMode(e.target.value as SortMode)}
                      className={styles.sortSelect}
                    >
                      <option value="updated">{t('dashboard:sort.updatedAt')}</option>
                      <option value="name">{t('dashboard:sort.name')}</option>
                    </select>

                    <div className={styles.viewToggle}>
                      <button
                        data-testid="view-grid-button"
                        onClick={() => setViewMode('grid')}
                        className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.viewBtnActive : ''}`}
                        aria-label={t('dashboard:view.grid')}
                      >
                        ▦
                      </button>
                      <button
                        data-testid="view-list-button"
                        onClick={() => setViewMode('list')}
                        className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewBtnActive : ''}`}
                        aria-label={t('dashboard:view.list')}
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
                    <p className={styles.emptyTitle}>{t('dashboard:empty.trash')}</p>
                    <p className={styles.emptySubtitle}>{t('dashboard:empty.trashDesc')}</p>
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
              ) : displayedFlows.length === 0 ? (
                selectedNav === 'shared' ? (
                  <div data-testid="shared-empty" className={styles.empty}>
                    <div className={styles.emptyIcon}>⊡</div>
                    <p className={styles.emptyTitle}>
                      {searchQuery.trim()
                        ? t('dashboard:empty.sharedSearch')
                        : t('dashboard:empty.sharedNoFlows')}
                    </p>
                    {!searchQuery.trim() && (
                      <p className={styles.emptySubtitle}>{t('dashboard:empty.sharedEmpty')}</p>
                    )}
                  </div>
                ) : (
                  <div data-testid="dashboard-empty" className={styles.empty}>
                    <div className={styles.emptyIcon}>+</div>
                    <p className={styles.emptyTitle}>
                      {searchQuery.trim()
                        ? t('dashboard:empty.noFlowsSearch')
                        : t('dashboard:empty.noFlows')}
                    </p>
                    {!searchQuery.trim() && (
                      <p className={styles.emptySubtitle}>{t('dashboard:empty.noFlowsDesc')}</p>
                    )}
                    {!searchQuery.trim() && (
                      <button
                        data-testid="empty-create-flow-button"
                        onClick={handleCreate}
                        disabled={creating}
                        className={`${styles.createCard} ${creating ? styles.createCardDisabled : ''}`}
                        style={{ marginTop: '16px', width: '200px' }}
                      >
                        <CreateCardIcon />
                        <span className={styles.createCardText}>
                          {creating ? t('dashboard:action.creating') : t('dashboard:action.create')}
                        </span>
                      </button>
                    )}
                  </div>
                )
              ) : viewMode === 'grid' ? (
                <div data-testid="dashboard-grid" className={styles.grid}>
                  {selectedNav !== 'shared' && (
                    <button
                      data-testid="create-flow-card"
                      onClick={handleCreate}
                      disabled={creating}
                      className={`${styles.createCard} ${creating ? styles.createCardDisabled : ''}`}
                    >
                      <CreateCardIcon />
                      <span className={styles.createCardText}>
                        {creating ? t('dashboard:action.creating') : t('dashboard:action.create')}
                      </span>
                    </button>
                  )}
                  {displayedFlows.map((flow) => (
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
                    <span className={styles.listHeaderName}>{t('dashboard:table.name')}</span>
                    <span className={styles.listHeaderUpdated}>
                      {t('dashboard:table.updatedAt')}
                    </span>
                    <span className={styles.listHeaderLanes}>{t('dashboard:table.lanes')}</span>
                    <span className={styles.listHeaderActions} />
                  </div>
                  {displayedFlows.map((flow) => (
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
                            {t('dashboard:action.shared')}
                          </span>
                        )}
                      </div>
                      <div className={styles.listUpdated}>
                        {formatRelativeTime(flow.updatedAt, i18n.language)}
                      </div>
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
                          aria-label={t('common:menu')}
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
