import { useState } from 'react'
import { apiFetch } from '../../../lib/api'

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
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        background: 'rgba(0,0,0,0.3)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 24,
          width: 400,
          maxWidth: '90vw',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#333' }}>共有設定</h3>
          <button
            data-testid="share-dialog-close"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 18,
              cursor: 'pointer',
              color: '#999',
              padding: '4px 8px',
              borderRadius: 4,
            }}
          >
            x
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 14, color: '#555' }}>URLで共有</span>
          <button
            data-testid="share-toggle"
            onClick={handleToggle}
            disabled={loading}
            style={{
              width: 48,
              height: 26,
              borderRadius: 13,
              border: 'none',
              background: isShared ? '#7C5CFC' : '#DDD',
              cursor: loading ? 'not-allowed' : 'pointer',
              position: 'relative',
              transition: 'background 0.2s',
              opacity: loading ? 0.6 : 1,
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                background: '#fff',
                position: 'absolute',
                top: 3,
                left: isShared ? 25 : 3,
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
            />
          </button>
        </div>

        {error && (
          <div
            data-testid="share-error"
            style={{
              background: '#FFF0F0',
              color: '#E53935',
              padding: '8px 12px',
              borderRadius: 6,
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        {isShared && (
          <div data-testid="share-url-display" style={{ marginTop: 4 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#F8F8FC',
                border: '1px solid #E0E0E8',
                borderRadius: 8,
                padding: '8px 12px',
              }}
            >
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: '#555',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {getShareUrl()}
              </span>
              <button
                data-testid="copy-share-url"
                onClick={handleCopy}
                style={{
                  background: copied ? '#E8F5E9' : '#7C5CFC',
                  color: copied ? '#2E7D32' : '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                }}
              >
                {copied ? 'コピーしました' : 'コピー'}
              </button>
            </div>
            <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
              このURLを知っている人は誰でも閲覧できます（編集不可）
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
