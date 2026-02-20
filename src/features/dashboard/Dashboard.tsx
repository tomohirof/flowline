import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import type { FlowListResponse, FlowSummary } from '../editor/types'
import { FlowCard } from './FlowCard'
import { DEFAULT_FLOW_TITLE, DEFAULT_FLOW_THEME_ID, createDefaultLanes } from './constants'
import styles from './Dashboard.module.css'

export function Dashboard() {
  const [flows, setFlows] = useState<FlowSummary[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState<boolean>(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const navigate = useNavigate()

  const loadFlows = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiFetch<FlowListResponse>('/flows')
      setFlows(data.flows)
    } catch {
      setError('フロー一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFlows()
  }, [loadFlows])

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

  const handleDelete = async (id: string, title: string) => {
    if (deletingId) return
    if (!window.confirm(`「${title}」を削除しますか？`)) return

    setDeletingId(id)
    try {
      await apiFetch(`/flows/${id}`, { method: 'DELETE' })
      setFlows((prev) => prev.filter((f) => f.id !== id))
    } catch {
      setError('フローの削除に失敗しました')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div data-testid="dashboard" className={styles.container}>
      {/* ヘッダー */}
      <div className={styles.header}>
        <h1 className={styles.title}>マイフロー</h1>
        <button
          data-testid="create-flow-button"
          onClick={handleCreate}
          disabled={creating}
          className={`${styles.createBtn} ${creating ? styles.createBtnDisabled : ''}`}
        >
          {creating ? '作成中...' : '+ 新規作成'}
        </button>
      </div>

      {/* エラー表示 */}
      {error && (
        <div data-testid="dashboard-error" className={styles.error}>
          {error}
        </div>
      )}

      {/* コンテンツ */}
      {loading ? (
        <div data-testid="dashboard-loading" className={styles.loading}>
          <p className={styles.loadingText}>読み込み中...</p>
        </div>
      ) : flows.length === 0 ? (
        <div data-testid="dashboard-empty" className={styles.empty}>
          <div className={styles.emptyIcon}>+</div>
          <p className={styles.emptyTitle}>フローがまだありません。新規作成してみましょう！</p>
          <p className={styles.emptySubtitle}>「+ 新規作成」ボタンで最初のフローを作成できます</p>
        </div>
      ) : (
        <div data-testid="dashboard-grid" className={styles.grid}>
          {flows.map((flow) => (
            <FlowCard
              key={flow.id}
              flow={flow}
              onDelete={handleDelete}
              deleting={deletingId === flow.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
