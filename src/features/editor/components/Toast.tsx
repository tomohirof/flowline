import type { ToastData } from '../hooks/useToast'
import styles from './Toast.module.css'

interface ToastListProps {
  toasts: ToastData[]
  onDismiss: (id: string) => void
  onConfirm: (id: string, crossingCount?: number) => void
}

export function ToastList({ toasts, onDismiss, onConfirm }: ToastListProps) {
  if (toasts.length === 0) return null

  return (
    <>
      {toasts.map((toast) => (
        <div key={toast.id} data-testid={`toast-${toast.type}`} className={styles.toast}>
          <div className={styles.content}>
            <div
              className={`${styles.icon}${toast.type === 'error' ? ` ${styles.iconError}` : ''}`}
            >
              {toast.type === 'confirm' ? '↻' : toast.type === 'error' ? '⚠' : '✓'}
            </div>
            <div className={styles.body}>
              <div className={styles.message}>{toast.message}</div>
              {toast.detail && <div className={styles.detail}>{toast.detail}</div>}
              {toast.type === 'confirm' && (
                <div className={styles.actions}>
                  <button
                    data-testid="toast-skip-btn"
                    onClick={() => onDismiss(toast.id)}
                    className={styles.skipBtn}
                  >
                    {toast.skipLabel ?? 'スキップ'}
                  </button>
                  <button
                    data-testid="toast-organize-btn"
                    onClick={() => onConfirm(toast.id, toast.crossingCount)}
                    className={styles.organizeBtn}
                  >
                    {toast.confirmLabel ?? '整理する'}
                  </button>
                </div>
              )}
              {toast.type === 'error' && (
                <div className={styles.actions}>
                  <button
                    data-testid="toast-close-btn"
                    onClick={() => onDismiss(toast.id)}
                    className={styles.skipBtn}
                  >
                    閉じる
                  </button>
                  {toast.onRetry && (
                    <button
                      data-testid="toast-retry-btn"
                      onClick={() => toast.onRetry?.()}
                      className={styles.retryBtn}
                    >
                      再試行
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
