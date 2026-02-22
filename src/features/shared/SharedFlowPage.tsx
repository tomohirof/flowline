import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { apiFetch, ApiError } from '../../lib/api'
import type { Flow, FlowDetailResponse } from '../editor/types'
import { SharedFlowViewer } from './SharedFlowViewer'
import styles from './SharedFlowPage.module.css'

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
          document.title = `Flowline - ${data.flow.title}`
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
      document.title = 'Flowline'
    }
  }, [token])

  if (!token) {
    return (
      <div
        data-testid="shared-flow-error"
        className={`${styles.centerScreenColumn} ${styles.error}`}
      >
        <p className={styles.errorMessage}>共有トークンが指定されていません</p>
        <a href="/" className={styles.topLink}>
          Flowline トップへ
        </a>
      </div>
    )
  }

  if (loading) {
    return (
      <div data-testid="shared-flow-loading" className={`${styles.centerScreen} ${styles.loading}`}>
        <p>読み込み中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div
        data-testid="shared-flow-error"
        className={`${styles.centerScreenColumn} ${styles.error}`}
      >
        <p className={styles.errorMessage}>{error}</p>
        <a href="/" className={styles.topLink}>
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
