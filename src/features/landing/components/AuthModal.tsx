import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../../hooks/useAuth'
import { ApiError } from '../../../lib/api'
import styles from './AuthModal.module.css'

type AuthMode = 'login' | 'register' | 'verify'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode: 'login' | 'register'
  onSuccess?: () => void
}

export function AuthModal({ isOpen, onClose, initialMode, onSuccess }: AuthModalProps) {
  const navigate = useNavigate()
  const { t } = useTranslation(['auth', 'common'])
  const { login, resendVerification } = useAuth()

  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verifyEmail, setVerifyEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const switchMode = useCallback((newMode: AuthMode) => {
    setMode(newMode)
    setError(null)
    setInfo(null)
    setEmail('')
    setPassword('')
  }, [])

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
        await login(email, password)
        onClose()
        if (onSuccess) {
          onSuccess()
        } else {
          navigate('/flows')
        }
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 403) {
          setVerifyEmail(email)
          setMode('verify')
          return
        }
        if (err instanceof ApiError) {
          setError(err.message)
        } else if (err instanceof Error) {
          setError(err.message)
        } else {
          setError(t('auth:error'))
        }
      } finally {
        setSubmitting(false)
      }
    },
    [email, password, login, onClose, navigate, onSuccess, t],
  )

  const handleResend = useCallback(async () => {
    setSubmitting(true)
    setError(null)
    try {
      await resendVerification(verifyEmail)
      setInfo(t('auth:emailResent'))
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError(t('auth:emailResendFailed'))
      }
    } finally {
      setSubmitting(false)
    }
  }, [verifyEmail, resendVerification, t])

  const handleGoogleClick = useCallback(() => {
    setInfo(t('auth:googleLoginPending'))
  }, [t])

  const handleForgotClick = useCallback(() => {
    setInfo(t('auth:passwordResetPending'))
  }, [t])

  if (!isOpen) return null

  return (
    <div className={styles.overlay} data-testid="auth-modal-overlay">
      <div className={styles.modal} data-testid="auth-modal">
        <button className={styles.closeBtn} onClick={onClose} aria-label={t('auth:close')}>
          &#x2715;
        </button>
        {mode !== 'verify' && (
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${mode === 'login' ? styles.tabActive : ''}`}
              onClick={() => switchMode('login')}
            >
              {t('auth:login')}
            </button>
            <button
              className={`${styles.tab} ${mode === 'register' ? styles.tabActive : ''}`}
              onClick={() => switchMode('register')}
            >
              {t('auth:register')}
            </button>
          </div>
        )}

        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        {info && <div className={styles.info}>{info}</div>}

        {mode === 'verify' ? (
          <div className={styles.verifyContainer}>
            <div className={styles.verifyIcon}>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#7C5CFC"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
            <h2 className={styles.verifyTitle}>{t('auth:verifyEmail.title')}</h2>
            <div className={styles.verifyEmailCard}>{verifyEmail}</div>
            <p className={styles.verifyText}>{t('auth:verifyEmail.description')}</p>
            <p className={styles.verifyNote}>{t('auth:verifyEmail.checkSpam')}</p>
            <button
              type="button"
              className={styles.submitBtn}
              onClick={handleResend}
              disabled={submitting}
            >
              {submitting ? t('auth:verifyEmail.resending') : t('auth:verifyEmail.resend')}
            </button>
            <button type="button" className={styles.backLink} onClick={() => switchMode('login')}>
              {t('auth:verifyEmail.backToLogin')}
            </button>
          </div>
        ) : mode === 'register' ? (
          <div className={styles.closedBetaContainer} data-testid="closed-beta-notice">
            <h2 className={styles.closedBetaTitle}>{t('auth:closedBeta.title')}</h2>
            <p className={styles.closedBetaDescription}>{t('auth:closedBeta.description')}</p>
            <button type="button" className={styles.submitBtn} onClick={() => switchMode('login')}>
              {t('auth:closedBeta.backToLogin')}
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              <div className={styles.field}>
                <input
                  className={styles.input}
                  type="email"
                  placeholder={t('auth:form.email')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className={styles.field}>
                <input
                  className={styles.input}
                  type="password"
                  placeholder={t('auth:form.password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              <button type="button" className={styles.forgotLink} onClick={handleForgotClick}>
                {t('auth:form.forgotPassword')}
              </button>

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={submitting}
                data-testid="auth-submit"
              >
                {submitting ? t('auth:form.processing') : t('auth:form.loginButton')}
              </button>
            </form>

            <div className={styles.divider}>
              <span className={styles.dividerLine} />
              <span>{t('common:or')}</span>
              <span className={styles.dividerLine} />
            </div>

            <button className={styles.googleBtn} onClick={handleGoogleClick}>
              {t('auth:form.continueWithGoogle')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
