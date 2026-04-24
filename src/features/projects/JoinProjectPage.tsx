import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch, ApiError } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import styles from './JoinProjectPage.module.css'

type SyncStatus = 'initial' | 'joining' | 'require-beta' | 'invalid'
type ApiStatus = 'success' | 'already' | 'invalid' | 'error' | null

export function JoinProjectPage() {
  const { token } = useParams<{ token: string }>()
  const { t } = useTranslation(['project'])
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [apiStatus, setApiStatus] = useState<ApiStatus>(null)

  const syncStatus: SyncStatus = useMemo(() => {
    if (loading) return 'initial'
    if (!user) return 'require-beta'
    if (!token) return 'invalid'
    return 'joining'
  }, [loading, user, token])

  const status = apiStatus ?? syncStatus

  useEffect(() => {
    if (syncStatus !== 'joining' || !token) return

    let cancelled = false
    apiFetch<{ projectId: string; role: string; alreadyMember?: boolean }>(
      `/projects/join/${token}`,
      { method: 'POST' },
    )
      .then((res) => {
        if (cancelled) return
        setApiStatus(res.alreadyMember ? 'already' : 'success')
        setTimeout(() => navigate(`/flows?project=${res.projectId}`, { replace: true }), 1200)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) {
          setApiStatus('invalid')
        } else {
          setApiStatus('error')
        }
      })
    return () => {
      cancelled = true
    }
  }, [syncStatus, token, navigate])

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        {t('project:joinPage.title', { defaultValue: 'Join project' })}
      </h1>
      {status === 'joining' && (
        <p>{t('project:joinPage.joining', { defaultValue: 'Joining...' })}</p>
      )}
      {status === 'success' && (
        <p>{t('project:joinPage.success', { projectName: '', defaultValue: 'Joined' })}</p>
      )}
      {status === 'already' && (
        <p>{t('project:joinPage.alreadyMember', { defaultValue: "You're already a member" })}</p>
      )}
      {status === 'invalid' && (
        <>
          <p>
            {t('project:joinPage.tokenInvalid', { defaultValue: 'This invite link is invalid' })}
          </p>
          <Link to="/" className={styles.link}>
            {t('project:joinPage.goToLanding', { defaultValue: 'Back to landing' })}
          </Link>
        </>
      )}
      {status === 'error' && (
        <>
          <p>
            {t('project:joinPage.error', {
              defaultValue: '通信エラーが発生しました。時間をおいて再度お試しください。',
            })}
          </p>
          <Link to="/" className={styles.link}>
            {t('project:joinPage.goToLanding', { defaultValue: 'Back to landing' })}
          </Link>
        </>
      )}
      {status === 'require-beta' && (
        <>
          <p>
            {t('project:joinPage.requireBetaInvite', {
              defaultValue: 'You need to register with a beta invitation code first.',
            })}
          </p>
          <Link to="/" className={styles.link}>
            {t('project:joinPage.goToLanding', { defaultValue: 'Back to landing' })}
          </Link>
        </>
      )}
    </div>
  )
}
