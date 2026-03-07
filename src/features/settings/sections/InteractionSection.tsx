import { useTranslation } from 'react-i18next'
import type { Settings } from '../types'
import { Section } from '../components/Section'
import { SettingRow } from '../components/SettingRow'
import { Toggle } from '../components/Toggle'

interface InteractionSectionProps {
  settings: Settings
  onToggle: (key: keyof Settings) => void
}

export function InteractionSection({ settings, onToggle }: InteractionSectionProps) {
  const { t } = useTranslation('settings')
  return (
    <Section title={t('interaction.title')} desc={t('interaction.desc')}>
      <SettingRow
        label={t('interaction.doubleClickEdit')}
        desc={t('interaction.doubleClickEditDesc')}
      >
        <Toggle
          checked={settings.doubleClickToEdit}
          onChange={() => onToggle('doubleClickToEdit')}
        />
      </SettingRow>
      <SettingRow
        label={t('interaction.undoShortcut')}
        desc={t('interaction.undoShortcutDesc')}
      >
        <Toggle checked={true} onChange={() => {}} disabled />
      </SettingRow>
      <SettingRow
        label={t('interaction.deleteShortcut')}
        desc={t('interaction.deleteShortcutDesc')}
      >
        <Toggle checked={true} onChange={() => {}} disabled />
      </SettingRow>
    </Section>
  )
}
