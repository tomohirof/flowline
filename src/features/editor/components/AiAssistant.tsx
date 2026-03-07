import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../../../lib/api'
import type { Lane, Node, Arrow } from '../types'
import styles from './AiAssistant.module.css'

interface AiFlowResult {
  title: string
  lanes: Lane[]
  nodes: Node[]
  arrows: Arrow[]
}

interface AiAssistantProps {
  flowId: string | null
  aiEnabled: boolean
  onFlowGenerated: (flow: AiFlowResult) => void
}

export function AiAssistant({ flowId, aiEnabled, onFlowGenerated }: AiAssistantProps) {
  const { t } = useTranslation('editor')
  const [expanded, setExpanded] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus textarea when panel expands
  useEffect(() => {
    if (expanded) {
      textareaRef.current?.focus()
    }
  }, [expanded])

  if (!aiEnabled) {
    return null
  }

  const handleSubmit = async () => {
    const trimmed = prompt.trim()
    if (!trimmed) {
      setError(t('ai.emptyPrompt'))
      return
    }

    setLoading(true)
    setError(null)

    try {
      const endpoint = flowId != null ? `/ai/${flowId}/edit` : '/ai/generate'

      const data = await apiFetch<{ flow: AiFlowResult }>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ prompt: trimmed }),
      })

      onFlowGenerated(data.flow)
      setPrompt('')
      setExpanded(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('ai.errorRequest'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={`${styles.container} ${expanded ? styles.expanded : styles.collapsed}`}
      data-testid="ai-assistant"
    >
      <button
        className={styles.toggleBtn}
        onClick={() => setExpanded((p) => !p)}
        data-testid="ai-assistant-toggle"
        aria-label={expanded ? t('ai.closeAria') : t('ai.openAria')}
      >
        <span className={styles.toggleIcon}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.27A7 7 0 0 1 14 23h-4a7 7 0 0 1-6.73-4H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
            <circle cx="9.5" cy="15.5" r="1" fill="currentColor" />
            <circle cx="14.5" cy="15.5" r="1" fill="currentColor" />
          </svg>
        </span>
        <span className={styles.toggleLabel}>{t('ai.title')}</span>
        <span className={styles.toggleChevron}>{expanded ? '\u25BC' : '\u25B2'}</span>
      </button>

      {expanded && (
        <div className={styles.panel} data-testid="ai-assistant-panel">
          <div className={styles.inputArea}>
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                flowId != null
                  ? t('ai.placeholderEdit')
                  : t('ai.placeholderGenerate')
              }
              rows={3}
              disabled={loading}
              data-testid="ai-prompt-input"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
            />
            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={loading}
              data-testid="ai-submit-btn"
            >
              {loading ? (
                <span className={styles.spinner} data-testid="ai-loading-spinner" />
              ) : (
                t('ai.generate')
              )}
            </button>
          </div>

          {error && (
            <div className={styles.error} data-testid="ai-error">
              {error}
            </div>
          )}

          <div className={styles.hint}>{t('ai.submitHint')}</div>
        </div>
      )}
    </div>
  )
}
