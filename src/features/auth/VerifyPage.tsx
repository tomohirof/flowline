import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import styles from './VerifyPage.module.css'

export function VerifyPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { refreshAuth } = useAuth()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>(
    token ? 'verifying' : 'error',
  )
  const [error, setError] = useState(token ? '' : '認証トークンが見つかりません')

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
        setError(err instanceof Error ? err.message : '認証に失敗しました')
      })
  }, [token, navigate, refreshAuth])

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {status === 'verifying' && <p className={styles.text}>メールアドレスを確認中...</p>}
        {status === 'success' && (
          <>
            <div className={styles.checkIcon}>✓</div>
            <h2 className={styles.title}>メール認証が完了しました！</h2>
            <p className={styles.text}>ダッシュボードにリダイレクトします...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h2 className={styles.title}>認証に失敗しました</h2>
            <p className={styles.errorText}>{error}</p>
            <button className={styles.btn} onClick={() => navigate('/')}>
              トップに戻る
            </button>
          </>
        )}
      </div>
    </div>
  )
}
