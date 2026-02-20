import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { apiFetch, ApiError } from '../../lib/api'
import type { Flow, FlowDetailResponse } from '../editor/types'
import { SharedFlowViewer } from './SharedFlowViewer'

export function SharedFlowPage() {
  const { token } = useParams<{ token: string }>()
  const [flow, setFlow] = useState<Flow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      return
    }

    let cancelled = false

    apiFetch<FlowDetailResponse>(`/shared/${token}`)
      .then((data) => {
        if (!cancelled) {
          setFlow(data.flow)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setError(err.message)
          } else {
            setError('共有フローの読み込みに失敗しました')
          }
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [token])

  if (!token) {
    return (
      <div
        data-testid="shared-flow-error"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: "'DM Sans','Noto Sans JP','Helvetica Neue',sans-serif",
          color: '#E06060',
          gap: 12,
        }}
      >
        <p style={{ fontSize: 16, fontWeight: 600 }}>共有トークンが指定されていません</p>
        <a href="/" style={{ fontSize: 14, color: '#7C5CFC' }}>
          Flowline トップへ
        </a>
      </div>
    )
  }

  if (loading) {
    return (
      <div
        data-testid="shared-flow-loading"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: "'DM Sans','Noto Sans JP','Helvetica Neue',sans-serif",
          color: '#999',
        }}
      >
        <p>読み込み中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div
        data-testid="shared-flow-error"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: "'DM Sans','Noto Sans JP','Helvetica Neue',sans-serif",
          color: '#E06060',
          gap: 12,
        }}
      >
        <p style={{ fontSize: 16, fontWeight: 600 }}>{error}</p>
        <a href="/" style={{ fontSize: 14, color: '#7C5CFC' }}>
          Flowline トップへ
        </a>
      </div>
    )
  }

  if (!flow) {
    return null
  }

  return <SharedFlowViewer flow={flow} />
}
