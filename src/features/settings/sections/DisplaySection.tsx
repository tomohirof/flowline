import { useTranslation } from 'react-i18next'
import type { Settings } from '../types'
import { Section } from '../components/Section'
import { SettingRow } from '../components/SettingRow'
import { Toggle } from '../components/Toggle'

interface DisplaySectionProps {
  settings: Settings
  onToggle: (key: keyof Settings) => void
  onSet: (key: keyof Settings, value: string) => void
}

export function DisplaySection({ settings, onToggle, onSet }: DisplaySectionProps) {
  const { t, i18n } = useTranslation('settings')
  return (
    <Section title={t('display.title')} desc={t('display.desc')}>
      <SettingRow label={t('display.language')} desc={t('display.languageDesc')}>
        <select
          value={settings.language}
          onChange={(e) => {
            onSet('language', e.target.value)
            i18n.changeLanguage(e.target.value)
          }}
          data-testid="language-select"
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid #ddd',
            fontSize: 13,
            background: '#fff',
            color: '#1a1a2e',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="ja">日本語</option>
          <option value="en">English</option>
        </select>
      </SettingRow>
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
