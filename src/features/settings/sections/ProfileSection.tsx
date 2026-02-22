import { Section } from '../components/Section'
import styles from './ProfileSection.module.css'

interface ProfileSectionProps {
  name: string
  email: string
  onNameChange: (v: string) => void
}

export function ProfileSection({ name, email, onNameChange }: ProfileSectionProps) {
  const initial = name.charAt(0).toUpperCase() || '?'

  return (
    <Section title="プロフィール" desc="アカウント情報を管理します">
      <div className={styles.wrapper}>
        <div className={styles.avatarRow}>
          <div className={styles.avatar} data-testid="profile-avatar">
            {initial}
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>名前</label>
          <input
            className={styles.input}
            value={name}
            placeholder="名前"
            onChange={(e) => onNameChange(e.target.value)}
            data-testid="profile-name-input"
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>メールアドレス</label>
          <input
            className={`${styles.input} ${styles.inputReadonly}`}
            value={email}
            readOnly
            data-testid="profile-email-input"
          />
        </div>
      </div>
    </Section>
  )
}
