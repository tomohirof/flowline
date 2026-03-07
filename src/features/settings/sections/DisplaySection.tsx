import { useTranslation } from 'react-i18next'
import type { Settings } from '../types'
import { Section } from '../components/Section'
import { SettingRow } from '../components/SettingRow'
import { Toggle } from '../components/Toggle'

interface DisplaySectionProps {
  settings: Settings
  onToggle: (key: keyof Settings) => void
}

export function DisplaySection({ settings, onToggle }: DisplaySectionProps) {
  const { t } = useTranslation('settings')
  return (
    <Section title={t('display.title')} desc={t('display.desc')}>
      <SettingRow label={t('display.dotGrid')} desc={t('display.dotGridDesc')}>
        <Toggle checked={settings.showDotGrid} onChange={() => onToggle('showDotGrid')} />
      </SettingRow>
      <SettingRow label={t('display.orderBadge')} desc={t('display.orderBadgeDesc')}>
        <Toggle checked={settings.showOrderBadge} onChange={() => onToggle('showOrderBadge')} />
      </SettingRow>
      <SettingRow label={t('display.laneColorBar')} desc={t('display.laneColorBarDesc')}>
        <Toggle checked={settings.showLaneColorBar} onChange={() => onToggle('showLaneColorBar')} />
      </SettingRow>
    </Section>
  )
}
