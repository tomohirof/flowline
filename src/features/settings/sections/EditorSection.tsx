import { useTranslation } from 'react-i18next'
import type { Settings } from '../types'
import { Section } from '../components/Section'
import { SettingRow } from '../components/SettingRow'
import { Toggle } from '../components/Toggle'
import { Tag } from '../components/Tag'

interface EditorSectionProps {
  settings: Settings
  onToggle: (key: keyof Settings) => void
  onSet: (key: keyof Settings, value: string) => void
}

export function EditorSection({ settings, onToggle, onSet }: EditorSectionProps) {
  const { t } = useTranslation('settings')
  return (
    <>
      <Section title={t('editor.nodeCreation.title')} desc={t('editor.nodeCreation.desc')}>
        <SettingRow
          label={t('editor.nodeCreation.copyLabel')}
          desc={t('editor.nodeCreation.copyLabelDesc')}
        >
          <Toggle
            checked={settings.copyLabelOnSameRow}
            onChange={() => onToggle('copyLabelOnSameRow')}
          />
        </SettingRow>
        <SettingRow label={t('editor.nodeCreation.autoConnect')} desc={t('editor.nodeCreation.autoConnectDesc')}>
          <Toggle checked={settings.autoConnect} onChange={() => onToggle('autoConnect')} />
        </SettingRow>
        <SettingRow
          label={t('editor.nodeCreation.autoAddRow')}
          desc={t('editor.nodeCreation.autoAddRowDesc')}
        >
          <Toggle checked={settings.autoAddRow} onChange={() => onToggle('autoAddRow')} />
        </SettingRow>
        <SettingRow
          label={t('editor.nodeCreation.editOnCreate')}
          desc={t('editor.nodeCreation.editOnCreateDesc')}
        >
          <Toggle
            checked={settings.enterEditOnCreate}
            onChange={() => onToggle('enterEditOnCreate')}
          />
        </SettingRow>
      </Section>

      <Section title={t('editor.arrowDefault.title')} desc={t('editor.arrowDefault.desc')}>
        <SettingRow label={t('editor.arrowDefault.lineStyle')}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { id: 'solid', labelKey: 'editor.arrowDefault.solid' },
              { id: 'dashed', labelKey: 'editor.arrowDefault.dashed' },
              { id: 'dotted', labelKey: 'editor.arrowDefault.dotted' },
            ].map((s) => (
              <Tag
                key={s.id}
                label={t(s.labelKey)}
                active={settings.defaultArrowStyle === s.id}
                onClick={() => onSet('defaultArrowStyle', s.id)}
              />
            ))}
          </div>
        </SettingRow>
      </Section>

      <Section title={t('editor.theme.title')}>
        <SettingRow label={t('editor.theme.desc')}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { id: 'cloud', label: 'Cloud' },
              { id: 'midnight', label: 'Midnight' },
              { id: 'blueprint', label: 'Blueprint' },
            ].map((th) => (
              <Tag
                key={th.id}
                label={th.label}
                active={settings.defaultTheme === th.id}
                onClick={() => onSet('defaultTheme', th.id)}
              />
            ))}
          </div>
        </SettingRow>
      </Section>
    </>
  )
}
