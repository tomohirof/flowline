import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import styles from './VerifyPage.module.css'

export function VerifyPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [error, setError] = useState('')
  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('認証トークンが見つかりません')
      return
    }

    apiFetch<{ verified: boolean }>(`/auth/verify?token=${token}`)
      .then(() => {
        setStatus('success')
        setTimeout(() => navigate('/flows', { replace: true }), 2000)
      })
      .catch((err) => {
        setStatus('error')
        setError(err instanceof Error ? err.message : '認証に失敗しました')
      })
  }, [token, navigate])

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
