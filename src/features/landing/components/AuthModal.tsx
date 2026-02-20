import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'
import { ApiError } from '../../../lib/api'
import styles from './AuthModal.module.css'

type AuthMode = 'login' | 'register'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode: AuthMode
}

export function AuthModal({ isOpen, onClose, initialMode }: AuthModalProps) {
  const navigate = useNavigate()
  const { login, register } = useAuth()

  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Reset form when mode changes
  const switchMode = useCallback((newMode: AuthMode) => {
    setMode(newMode)
    setError(null)
    setInfo(null)
    setName('')
    setEmail('')
    setPassword('')
  }, [])

  // Reset when initialMode changes
  const [prevInitialMode, setPrevInitialMode] = useState(initialMode)
  if (prevInitialMode !== initialMode) {
    setPrevInitialMode(initialMode)
    switchMode(initialMode)
  }

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)
      setSubmitting(true)

      try {
        if (mode === 'login') {
          await login(email, password)
        } else {
          await register(email, password, name)
        }
        onClose()
        navigate('/flows')
      } catch (err: unknown) {
        if (err instanceof ApiError) {
          setError(err.message)
        } else if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('エラーが発生しました')
        }
      } finally {
        setSubmitting(false)
      }
    },
    [mode, email, password, name, login, register, onClose, navigate],
  )

  const handleGoogleClick = useCallback(() => {
    setInfo('Googleログインは準備中です')
  }, [])

  const handleForgotClick = useCallback(() => {
    setInfo('パスワードリセットは準備中です')
  }, [])

  if (!isOpen) return null

  return (
    <div
      className={styles.overlay}
      data-testid="auth-modal-overlay"
      onClick={onClose}
    >
      <div
        className={styles.modal}
        data-testid="auth-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${mode === 'login' ? styles.tabActive : ''}`}
            onClick={() => switchMode('login')}
          >
            ログイン
          </button>
          <button
            className={`${styles.tab} ${mode === 'register' ? styles.tabActive : ''}`}
            onClick={() => switchMode('register')}
          >
            新規登録
          </button>
        </div>

        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        {info && <div className={styles.info}>{info}</div>}

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className={styles.field}>
              <input
                className={styles.input}
                type="text"
                placeholder="お名前"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className={styles.field}>
            <input
              className={styles.input}
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <input
              className={styles.input}
              type="password"
              placeholder="パスワード"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          {mode === 'login' && (
            <button type="button" className={styles.forgotLink} onClick={handleForgotClick}>
              パスワードをお忘れですか？
            </button>
          )}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={submitting}
            data-testid="auth-submit"
          >
            {submitting
              ? '処理中...'
              : mode === 'login'
                ? 'ログイン'
                : 'アカウント作成'}
          </button>
        </form>

        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          <span>または</span>
          <span className={styles.dividerLine} />
        </div>

        <button className={styles.googleBtn} onClick={handleGoogleClick}>
          Googleで続ける
        </button>
      </div>
    </div>
  )
}
