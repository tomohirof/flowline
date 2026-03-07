import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import styles from './VerifyPage.module.css'

export function VerifyPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useTranslation('auth')
  const { refreshAuth } = useAuth()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>(
    token ? 'verifying' : 'error',
  )
  const [error, setError] = useState(token ? '' : t('verify.tokenNotFound'))

  useEffect(() => {
    if (!token) return

    apiFetch<{ verified: boolean }>(`/auth/verify?token=${token}`)
      .then(async () => {
        setStatus('success')
        await refreshAuth()
        setTimeout(() => navigate('/flows', { replace: true }), 2000)
      })
      .catch((err) => {
        setStatus('error')
        setError(err instanceof Error ? err.message : t('verify.failed'))
      })
  }, [token, navigate, refreshAuth, t])

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {status === 'verifying' && <p className={styles.text}>{t('verify.verifying')}</p>}
        {status === 'success' && (
          <>
            <div className={styles.checkIcon}>✓</div>
            <h2 className={styles.title}>{t('verify.success')}</h2>
            <p className={styles.text}>{t('verify.redirecting')}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h2 className={styles.title}>{t('verify.failed')}</h2>
            <p className={styles.errorText}>{error}</p>
            <button className={styles.btn} onClick={() => navigate('/')}>
              {t('verify.backToTop')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
