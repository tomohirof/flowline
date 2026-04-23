import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../../lib/api'
import styles from './InvitationsSection.module.css'

interface Invitation {
  id: number
  code: string
  expiresAt: string
  revokedAt: string | null
  createdAt: string
  createdBy: string
  status: 'active' | 'expired' | 'revoked'
}

export function InvitationsSection() {
  const { t, i18n } = useTranslation(['admin'])
  const [list, setList] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [issuedCode, setIssuedCode] = useState<string | null>(null)
  const [days, setDays] = useState(7)
  const [submitting, setSubmitting] = useState(false)
  const [revokingId, setRevokingId] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiFetch<{ invitations: Invitation[] }>('/admin/invitations')
      setList(data.invitations)
    } catch {
      setError(t('admin:invitations.loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const handleIssue = async () => {
    setError(null)
    try {
      setSubmitting(true)
      const res = await apiFetch<{ code: string }>('/admin/invitations', {
        method: 'POST',
        body: JSON.stringify({ expiresInDays: days }),
      })
      setIssuedCode(res.code)
      await load()
    } catch {
      setError(t('admin:invitations.createError'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleRevoke = async (id: number) => {
    if (!window.confirm(t('admin:invitations.revokeConfirm'))) return
    setError(null)
    try {
      setRevokingId(id)
      await apiFetch(`/admin/invitations/${id}/revoke`, { method: 'POST' })
      await load()
    } catch {
      setError(t('admin:invitations.revokeError'))
    } finally {
      setRevokingId(null)
    }
  }

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard might be unavailable — ignore
    }
  }

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(i18n.language)

  return (
    <section className={styles.section} data-testid="invitations-section">
      <div className={styles.header}>
        <h2 className={styles.title}>{t('admin:invitations.title')}</h2>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={() => {
            setIssuedCode(null)
            setDays(7)
            setModalOpen(true)
          }}
          data-testid="invitations-create-btn"
        >
          {t('admin:invitations.create')}
        </button>
      </div>

      {error && (
        <div className={styles.error} data-testid="invitations-error">
          {error}
        </div>
      )}

      {loading ? (
        <p data-testid="invitations-loading">...</p>
      ) : list.length === 0 ? (
        <p className={styles.empty} data-testid="invitations-empty">
          {t('admin:invitations.empty')}
        </p>
      ) : (
        <table className={styles.table} data-testid="invitations-table">
          <thead>
            <tr>
              <th>{t('admin:invitations.columns.code')}</th>
              <th>{t('admin:invitations.columns.expiresAt')}</th>
              <th>{t('admin:invitations.columns.status')}</th>
              <th>{t('admin:invitations.columns.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((inv) => (
              <tr key={inv.id} data-testid={`invitation-row-${inv.id}`}>
                <td className={styles.codeCell}>{inv.code}</td>
                <td>{formatDate(inv.expiresAt)}</td>
                <td>
                  <span className={`${styles.badge} ${styles[inv.status]}`}>
                    {t(`admin:invitations.status.${inv.status}`)}
                  </span>
                </td>
                <td>
                  {inv.status === 'active' && (
                    <button
                      type="button"
                      className={styles.dangerBtn}
                      disabled={revokingId === inv.id}
                      onClick={() => void handleRevoke(inv.id)}
                      data-testid={`revoke-btn-${inv.id}`}
                    >
                      {t('admin:invitations.revoke')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <div
          className={styles.modalBackdrop}
          onClick={() => setModalOpen(false)}
          role="presentation"
        >
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            data-testid="invitations-modal"
          >
            {issuedCode ? (
              <>
                <h3 className={styles.modalTitle}>{t('admin:invitations.modal.title')}</h3>
                <p>{t('admin:invitations.codeDisplayHint')}</p>
                <div className={styles.issuedCode} data-testid="issued-code">
                  {issuedCode}
                </div>
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => void handleCopy(issuedCode)}
                    data-testid="issued-copy-btn"
                  >
                    {copied ? t('admin:invitations.copySuccess') : t('admin:invitations.copy')}
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => {
                      setModalOpen(false)
                      setIssuedCode(null)
                    }}
                  >
                    {t('admin:invitations.modal.cancel')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className={styles.modalTitle}>{t('admin:invitations.modal.title')}</h3>
                <p>{t('admin:invitations.modal.expiresInDays')}</p>
                <div className={styles.presets}>
                  {[7, 14, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`${styles.presetBtn} ${days === d ? styles.presetActive : ''}`}
                      onClick={() => setDays(d)}
                      data-testid={`preset-${d}`}
                    >
                      {t(`admin:invitations.modal.presets.${d}`)}
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    className={styles.customInput}
                    data-testid="custom-days-input"
                    aria-label={t('admin:invitations.modal.custom')}
                  />
                </div>
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    disabled={submitting}
                    onClick={() => void handleIssue()}
                    data-testid="invitations-issue-btn"
                  >
                    {t('admin:invitations.modal.issue')}
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => setModalOpen(false)}
                  >
                    {t('admin:invitations.modal.cancel')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
