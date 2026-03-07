import { useTranslation } from 'react-i18next'
import { Section } from '../components/Section'
import styles from './ProfileSection.module.css'

interface ProfileSectionProps {
  name: string
  email: string
  onNameChange: (v: string) => void
}

export function ProfileSection({ name, email, onNameChange }: ProfileSectionProps) {
  const { t } = useTranslation('settings')
  const initial = name.charAt(0).toUpperCase() || '?'

  return (
    <Section title={t('profile.title')} desc={t('profile.desc')}>
      <div className={styles.wrapper}>
        <div className={styles.avatarRow}>
          <div className={styles.avatar} data-testid="profile-avatar">
            {initial}
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>{t('profile.name')}</label>
          <input
            className={styles.input}
            value={name}
            placeholder={t('profile.namePlaceholder')}
            onChange={(e) => onNameChange(e.target.value)}
            data-testid="profile-name-input"
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>{t('profile.email')}</label>
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
