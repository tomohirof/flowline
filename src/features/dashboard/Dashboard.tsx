import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import type { FlowListResponse, FlowSummary } from '../editor/types'
import { FlowCard } from './FlowCard'

export function Dashboard() {
  const [flows, setFlows] = useState<FlowSummary[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState<boolean>(false)
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
          title: '無題のフロー',
          themeId: 'cloud',
          lanes: [
            { id: crypto.randomUUID(), name: '企業', colorIndex: 0, position: 0 },
            { id: crypto.randomUUID(), name: 'システム', colorIndex: 1, position: 1 },
            { id: crypto.randomUUID(), name: '事務局', colorIndex: 2, position: 2 },
            { id: crypto.randomUUID(), name: 'ユーザー', colorIndex: 3, position: 3 },
          ],
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
    if (!window.confirm(`「${title}」を削除しますか？`)) return

    try {
      await apiFetch(`/flows/${id}`, { method: 'DELETE' })
      setFlows((prev) => prev.filter((f) => f.id !== id))
    } catch {
      setError('フローの削除に失敗しました')
    }
  }

  return (
    <div
      data-testid="dashboard"
      style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '32px 24px',
        fontFamily: "'DM Sans','Noto Sans JP','Helvetica Neue',sans-serif",
      }}
    >
      {/* ヘッダー */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 28,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#333' }}>マイフロー</h1>
        <button
          data-testid="create-flow-button"
          onClick={handleCreate}
          disabled={creating}
          style={{
            height: 40,
            padding: '0 20px',
            background: '#7C5CFC',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: creating ? 'not-allowed' : 'pointer',
            opacity: creating ? 0.6 : 1,
            fontFamily: 'inherit',
            transition: 'opacity 0.15s',
          }}
        >
          {creating ? '作成中...' : '+ 新規作成'}
        </button>
      </div>

      {/* エラー表示 */}
      {error && (
        <div
          data-testid="dashboard-error"
          style={{
            padding: '12px 16px',
            background: '#FFEBEE',
            color: '#C62828',
            borderRadius: 8,
            marginBottom: 20,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* コンテンツ */}
      {loading ? (
        <div
          data-testid="dashboard-loading"
          style={{ color: '#999', textAlign: 'center', padding: 60 }}
        >
          <p style={{ fontSize: 14 }}>読み込み中...</p>
        </div>
      ) : flows.length === 0 ? (
        <div
          data-testid="dashboard-empty"
          style={{
            textAlign: 'center',
            padding: '80px 24px',
            color: '#999',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              margin: '0 auto 16px',
              background: '#F5F3FF',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
            }}
          >
            +
          </div>
          <p style={{ fontSize: 16, marginBottom: 8, color: '#666' }}>
            フローがまだありません。新規作成してみましょう！
          </p>
          <p style={{ fontSize: 13, color: '#AAA' }}>
            「+ 新規作成」ボタンで最初のフローを作成できます
          </p>
        </div>
      ) : (
        <div
          data-testid="dashboard-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
          }}
        >
          {flows.map((flow) => (
            <FlowCard key={flow.id} flow={flow} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
