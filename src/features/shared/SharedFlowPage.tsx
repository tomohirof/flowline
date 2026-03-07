import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BRAND } from '../../constants/brand'
import { apiFetch, ApiError } from '../../lib/api'
import type { Flow, FlowDetailResponse } from '../editor/types'
import { SharedFlowViewer } from './SharedFlowViewer'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import styles from './SharedFlowPage.module.css'

export function SharedFlowPage() {
  const { t } = useTranslation('shared')
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
          document.title = `${BRAND.name} - ${data.flow.title}`
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setError(err.message)
          } else {
            setError(t('errorLoad'))
          }
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
      document.title = BRAND.name
    }
  }, [token])

  if (!token) {
    return (
      <div
        data-testid="shared-flow-error"
        className={`${styles.centerScreenColumn} ${styles.error}`}
      >
        <p className={styles.errorMessage}>{t('errorNoToken')}</p>
        <a href="/" className={styles.topLink}>
          {t('topLink')}
        </a>
      </div>
    )
  }

  if (loading) {
    return (
      <div data-testid="shared-flow-loading">
        <LoadingSpinner fullScreen />
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
          {t('topLink')}
        </a>
      </div>
    )
  }

  if (!flow) {
    return null
  }

  return <SharedFlowViewer flow={flow} />
}
