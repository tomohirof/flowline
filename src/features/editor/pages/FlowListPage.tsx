import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch } from '../../../lib/api'
import {
  DEFAULT_FLOW_TITLE,
  DEFAULT_FLOW_THEME_ID,
  createDefaultLanes,
} from '../../dashboard/constants'
import type { FlowListResponse, FlowSummary } from '../types'

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
    <div
      style={{
        maxWidth: 800,
        margin: '0 auto',
        padding: '32px 24px',
        fontFamily: "'DM Sans','Noto Sans JP','Helvetica Neue',sans-serif",
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>フロー一覧</h1>
        <button
          data-testid="create-flow-button"
          onClick={handleCreate}
          disabled={creating}
          style={{
            height: 36,
            padding: '0 16px',
            background: '#7C5CFC',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: creating ? 'not-allowed' : 'pointer',
            opacity: creating ? 0.6 : 1,
            fontFamily: 'inherit',
          }}
        >
          {creating ? '作成中...' : '+ 新しいフロー'}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            background: '#FFEBEE',
            color: '#C62828',
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#999', textAlign: 'center', padding: 40 }}>読み込み中...</p>
      ) : flows.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 60,
            color: '#999',
          }}
        >
          <p style={{ fontSize: 16, marginBottom: 8 }}>フローがまだありません</p>
          <p style={{ fontSize: 13 }}>「+ 新しいフロー」ボタンで最初のフローを作成しましょう</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {flows.map((flow) => (
            <Link
              key={flow.id}
              to={`/flows/${flow.id}`}
              data-testid={`flow-item-${flow.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                background: '#fff',
                borderRadius: 10,
                border: '1px solid #E8E8EE',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'all 0.1s',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.borderColor = '#7C5CFC'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.borderColor = '#E8E8EE'
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#444' }}>{flow.title}</div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                  更新: {formatDate(flow.updatedAt)}
                </div>
              </div>
              <span style={{ fontSize: 16, color: '#CCC' }}>{'\u2192'}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
