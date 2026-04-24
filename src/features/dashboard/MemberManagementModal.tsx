import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../../lib/api'
import styles from './MemberManagementModal.module.css'

interface Member {
  id: string
  email: string
  name: string
  joinedAt?: string
}
interface MembersResponse {
  owner: Member
  editors: Member[]
}
interface InviteLinkResponse {
  inviteToken: string
  inviteUrl: string
}

interface Props {
  projectId: string
  currentUserId: string
  isOwner: boolean
  onClose: () => void
}

export function MemberManagementModal({ projectId, currentUserId, isOwner, onClose }: Props) {
  const { t } = useTranslation(['project'])
  const [members, setMembers] = useState<MembersResponse | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<MembersResponse>(`/projects/${projectId}/members`)
      setMembers(data)
    } catch {
      setError('読み込みに失敗しました')
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  const handleGenerate = async () => {
    setBusy(true)
    try {
      const res = await apiFetch<InviteLinkResponse>(`/projects/${projectId}/invite-link`, {
        method: 'POST',
      })
      setInviteUrl(res.inviteUrl)
    } catch {
      setError('招待リンクの生成に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  const handleRevoke = async () => {
    if (!window.confirm(t('project:memberManagement.inviteLink.revokeConfirm'))) return
    setBusy(true)
    try {
      await apiFetch(`/projects/${projectId}/invite-link`, { method: 'DELETE' })
      setInviteUrl(null)
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const handleRemove = async (userId: string, name: string) => {
    if (
      !window.confirm(
        t('project:memberManagement.removeConfirm', { name, defaultValue: `Remove ${name}?` }),
      )
    )
      return
    setBusy(true)
    try {
      await apiFetch(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' })
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        data-testid="member-modal"
      >
        <h3 className={styles.title}>
          {t('project:memberManagement.title', { defaultValue: 'Members' })}
        </h3>
        {error && <div className={styles.error}>{error}</div>}

        {isOwner && (
          <section className={styles.inviteSection} data-testid="invite-link-section">
            <h4>
              {t('project:memberManagement.inviteLink.heading', { defaultValue: 'Invite link' })}
            </h4>
            {inviteUrl ? (
              <>
                <div className={styles.inviteUrl} data-testid="invite-url">
                  {inviteUrl}
                </div>
                <button type="button" onClick={() => void handleCopy()}>
                  {copied
                    ? t('project:memberManagement.inviteLink.copySuccess', {
                        defaultValue: 'Copied',
                      })
                    : t('project:memberManagement.inviteLink.copy', { defaultValue: 'Copy' })}
                </button>
                <button type="button" onClick={() => void handleRevoke()} disabled={busy}>
                  {t('project:memberManagement.inviteLink.revoke', { defaultValue: 'Revoke' })}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={busy}
                data-testid="generate-invite-link-btn"
              >
                {t('project:memberManagement.inviteLink.generate', {
                  defaultValue: 'Generate invite link',
                })}
              </button>
            )}
          </section>
        )}

        <section className={styles.listSection}>
          <h4>
            {t('project:memberManagement.memberList', { defaultValue: 'Current members' })}
          </h4>
          {members && (
            <ul>
              <li>
                <span aria-hidden="true">👑</span>
                <strong>{members.owner.name}</strong>
                <span className={styles.badge}>
                  {t('project:memberManagement.ownerBadge', { defaultValue: 'Owner' })}
                </span>
                {members.owner.id === currentUserId && (
                  <span className={styles.you}>
                    ({t('project:memberManagement.you', { defaultValue: 'you' })})
                  </span>
                )}
              </li>
              {members.editors.map((m) => (
                <li key={m.id}>
                  <span aria-hidden="true">✏️</span>
                  <span>{m.name}</span>
                  {m.id === currentUserId && (
                    <span className={styles.you}>
                      ({t('project:memberManagement.you', { defaultValue: 'you' })})
                    </span>
                  )}
                  {isOwner && m.id !== currentUserId && (
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => void handleRemove(m.id, m.name)}
                      disabled={busy}
                      data-testid={`remove-btn-${m.id}`}
                    >
                      {t('project:memberManagement.remove', { defaultValue: 'Remove' })}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
