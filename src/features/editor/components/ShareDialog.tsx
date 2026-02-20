import { useState } from 'react'
import { apiFetch } from '../../../lib/api'
import styles from './ShareDialog.module.css'

interface ShareDialogProps {
  flowId: string
  shareToken: string | null
  onShareChange: (token: string | null) => void
  onClose: () => void
}

interface ShareResponse {
  shareToken: string
  shareUrl: string
}

export function ShareDialog({ flowId, shareToken, onShareChange, onClose }: ShareDialogProps) {
  const [currentToken, setCurrentToken] = useState<string | null>(shareToken)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const isShared = currentToken !== null

  const getShareUrl = () => {
    return `${window.location.origin}/shared/${currentToken}`
  }

  const handleToggle = async () => {
    setLoading(true)
    setError(null)
    setCopied(false)

    try {
      if (isShared) {
        // Disable sharing
        await apiFetch(`/flows/${flowId}/share`, { method: 'DELETE' })
        setCurrentToken(null)
        onShareChange(null)
      } else {
        // Enable sharing
        const data = await apiFetch<ShareResponse>(`/flows/${flowId}/share`, { method: 'POST' })
        setCurrentToken(data.shareToken)
        onShareChange(data.shareToken)
      }
    } catch {
      setError('共有設定の変更に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API might fail in some browsers
    }
  }

  return (
    <div
      data-testid="share-dialog"
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>共有設定</h3>
          <button data-testid="share-dialog-close" onClick={onClose} className={styles.closeButton}>
            x
          </button>
        </div>

        <div className={styles.toggleRow}>
          <span className={styles.toggleLabel}>URLで共有</span>
          <button
            data-testid="share-toggle"
            onClick={handleToggle}
            disabled={loading}
            className={`${styles.toggleTrack} ${isShared ? styles.toggleTrackActive : ''} ${loading ? styles.toggleTrackLoading : ''}`}
          >
            <div className={`${styles.toggleKnob} ${isShared ? styles.toggleKnobActive : ''}`} />
          </button>
        </div>

        {error && (
          <div data-testid="share-error" className={styles.error}>
            {error}
          </div>
        )}

        {isShared && (
          <div data-testid="share-url-display" className={styles.urlDisplay}>
            <div className={styles.urlContainer}>
              <span className={styles.urlText}>{getShareUrl()}</span>
              <button
                data-testid="copy-share-url"
                onClick={handleCopy}
                className={`${styles.copyBtn} ${copied ? styles.copyBtnCopied : ''}`}
              >
                {copied ? 'コピーしました' : 'コピー'}
              </button>
            </div>
            <p className={styles.hint}>このURLを知っている人は誰でも閲覧できます（編集不可）</p>
          </div>
        )}
      </div>
    </div>
  )
}
