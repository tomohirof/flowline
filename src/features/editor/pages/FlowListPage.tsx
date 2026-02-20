import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch } from '../../../lib/api'
import {
  DEFAULT_FLOW_TITLE,
  DEFAULT_FLOW_THEME_ID,
  createDefaultLanes,
} from '../../dashboard/constants'
import type { FlowListResponse, FlowSummary } from '../types'
import styles from './FlowListPage.module.css'

export function FlowListPage() {
  const [flows, setFlows] = useState<FlowSummary[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState<boolean>(false)
  const navigate = useNavigate()

  const loadFlows = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiFetch<FlowListResponse>('/flows')
      setFlows(data.flows)
      setError(null)
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

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>フロー一覧</h1>
        <button
          data-testid="create-flow-button"
          onClick={handleCreate}
          disabled={creating}
          className={styles.createButton}
        >
          {creating ? '作成中...' : '+ 新しいフロー'}
        </button>
      </div>

      {error && <div className={styles.errorMessage}>{error}</div>}

      {loading ? (
        <p className={styles.loading}>読み込み中...</p>
      ) : flows.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>フローがまだありません</p>
          <p className={styles.emptyDescription}>
            「+ 新しいフロー」ボタンで最初のフローを作成しましょう
          </p>
        </div>
      ) : (
        <div className={styles.flowList}>
          {flows.map((flow) => (
            <Link
              key={flow.id}
              to={`/flows/${flow.id}`}
              data-testid={`flow-item-${flow.id}`}
              className={styles.flowItem}
            >
              <div>
                <div className={styles.flowTitle}>{flow.title}</div>
                <div className={styles.flowDate}>更新: {formatDate(flow.updatedAt)}</div>
              </div>
              <span className={styles.flowArrow}>{'\u2192'}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
