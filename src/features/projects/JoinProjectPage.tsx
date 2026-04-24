import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch, ApiError } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import styles from './JoinProjectPage.module.css'

type Status = 'initial' | 'joining' | 'success' | 'already' | 'invalid' | 'require-beta'

export function JoinProjectPage() {
  const { token } = useParams<{ token: string }>()
  const { t } = useTranslation(['project'])
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [status, setStatus] = useState<Status>('initial')

  useEffect(() => {
    if (loading) return
    if (!user) {
      setStatus('require-beta')
      return
    }
    if (!token) {
      setStatus('invalid')
      return
    }
    setStatus('joining')
    apiFetch<{ projectId: string; role: string; alreadyMember?: boolean }>(
      `/projects/join/${token}`,
      { method: 'POST' },
    )
      .then((res) => {
        if (res.alreadyMember) {
          setStatus('already')
          setTimeout(
            () => navigate(`/flows?project=${res.projectId}`, { replace: true }),
            1200,
          )
        } else {
          setStatus('success')
          setTimeout(
            () => navigate(`/flows?project=${res.projectId}`, { replace: true }),
            1200,
          )
        }
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          setStatus('invalid')
        } else {
          setStatus('invalid')
        }
      })
  }, [loading, user, token, navigate])

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
        <p>
          {t('project:joinPage.alreadyMember', { defaultValue: "You're already a member" })}
        </p>
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
      {status === 'require-beta' && (
        <>
          <p>
            {t('project:joinPage.requireBetaInvite', {
              defaultValue:
                'You need to register with a beta invitation code first.',
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
