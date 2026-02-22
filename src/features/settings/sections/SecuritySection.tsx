import { useState } from 'react'
import { Section } from '../components/Section'
import styles from './SecuritySection.module.css'

interface SecuritySectionProps {
  onPasswordChange: (current: string, newPw: string) => Promise<string | null>
  onDeleteAccount: () => Promise<void>
}

export function SecuritySection({ onPasswordChange, onDeleteAccount }: SecuritySectionProps) {
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
      setDeleteError(e instanceof Error ? e.message : 'アカウントの削除に失敗しました')
      setConfirmDelete(false)
    }
  }

  return (
    <Section title="セキュリティ" desc="アカウントの安全性を管理します">
      <div className={styles.wrapper}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>現在のパスワード</label>
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
          <label className={styles.fieldLabel}>新しいパスワード</label>
          <input
            type="password"
            className={styles.input}
            placeholder="8文字以上"
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
            パスワードを変更しました
          </div>
        )}

        <button
          className={styles.submitButton}
          onClick={handlePasswordSubmit}
          data-testid="change-password-button"
        >
          パスワードを変更
        </button>
      </div>

      <div className={styles.dangerZone}>
        <h4 className={styles.dangerTitle}>危険ゾーン</h4>
        <p className={styles.dangerDesc}>
          アカウントを削除すると、すべてのデータが完全に消去されます。この操作は取り消せません。
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
          {confirmDelete ? '本当に削除する' : 'アカウントを削除'}
        </button>
      </div>
    </Section>
  )
}
