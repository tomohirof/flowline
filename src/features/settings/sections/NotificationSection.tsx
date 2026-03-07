import { useTranslation } from 'react-i18next'
import type { Settings } from '../types'
import { Section } from '../components/Section'
import { SettingRow } from '../components/SettingRow'
import { Toggle } from '../components/Toggle'

interface NotificationSectionProps {
  settings: Settings
  onToggle: (key: keyof Settings) => void
}

export function NotificationSection({ settings, onToggle }: NotificationSectionProps) {
  const { t } = useTranslation('settings')
  return (
    <Section title={t('notification.title')} desc={t('notification.desc')}>
      <SettingRow label={t('notification.email')} desc={t('notification.emailDesc')}>
        <Toggle checked={settings.notifications} onChange={() => onToggle('notifications')} />
      </SettingRow>
      <SettingRow label={t('notification.browser')} desc={t('notification.browserDesc')}>
        <Toggle checked={false} onChange={() => {}} />
      </SettingRow>
    </Section>
  )
}
