import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Section } from '../components/Section'
import styles from './SecuritySection.module.css'

interface SecuritySectionProps {
  onPasswordChange: (current: string, newPw: string) => Promise<string | null>
  onDeleteAccount: () => Promise<void>
}

export function SecuritySection({ onPasswordChange, onDeleteAccount }: SecuritySectionProps) {
  const { t } = useTranslation('settings')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handlePasswordSubmit = async () => {
    if (!currentPassword || !newPassword) return
    setPasswordError(null)
    setPasswordSuccess(false)
    const error = await onPasswordChange(currentPassword, newPassword)
    if (error) {
      setPasswordError(error)
    } else {
      setPasswordSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setTimeout(() => setPasswordSuccess(false), 3000)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleteError(null)
    try {
      await onDeleteAccount()
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : t('security.deleteAccountFailed'))
      setConfirmDelete(false)
    }
  }

  return (
    <Section title={t('security.title')} desc={t('security.desc')}>
      <div className={styles.wrapper}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>{t('security.currentPassword')}</label>
          <input
            type="password"
            className={styles.input}
            placeholder="••••••••"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            data-testid="current-password-input"
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>{t('security.newPassword')}</label>
          <input
            type="password"
            className={styles.input}
            placeholder={t('security.newPasswordPlaceholder')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            data-testid="new-password-input"
          />
        </div>

        {passwordError && (
          <div className={styles.errorMsg} data-testid="password-error">
            {passwordError}
          </div>
        )}
        {passwordSuccess && (
          <div className={styles.successMsg} data-testid="password-success">
            {t('security.passwordChanged')}
          </div>
        )}

        <button
          className={styles.submitButton}
          onClick={handlePasswordSubmit}
          data-testid="change-password-button"
        >
          {t('security.changePassword')}
        </button>
      </div>

      <div className={styles.dangerZone}>
        <h4 className={styles.dangerTitle}>{t('security.dangerZone')}</h4>
        <p className={styles.dangerDesc}>
          {t('security.deleteAccountWarning')}
        </p>
        {deleteError && (
          <div className={styles.errorMsg} data-testid="delete-error">
            {deleteError}
          </div>
        )}
        <button
          className={styles.deleteButton}
          onClick={handleDelete}
          data-testid="delete-account-button"
        >
          {confirmDelete ? t('security.deleteAccountConfirm') : t('security.deleteAccount')}
        </button>
      </div>
    </Section>
  )
}
