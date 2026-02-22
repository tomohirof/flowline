import type { Settings } from '../types'
import { Section } from '../components/Section'
import { SettingRow } from '../components/SettingRow'
import { Toggle } from '../components/Toggle'

interface InteractionSectionProps {
  settings: Settings
  onToggle: (key: keyof Settings) => void
}

export function InteractionSection({ settings, onToggle }: InteractionSectionProps) {
  return (
    <Section title="操作設定" desc="マウスやキーボードの操作方法をカスタマイズします">
      <SettingRow
        label="ダブルクリックで編集"
        desc="OFFの場合、シングルクリックで編集モードに入ります"
      >
        <Toggle
          checked={settings.doubleClickToEdit}
          onChange={() => onToggle('doubleClickToEdit')}
        />
      </SettingRow>
      <SettingRow
        label="\u2318Z / Ctrl+Z でundo"
        desc="キーボードショートカットによる操作の取り消し"
      >
        <Toggle checked={true} onChange={() => {}} />
      </SettingRow>
      <SettingRow label="Delete / Backspace で削除" desc="選択中のノードや矢印をキーで削除">
        <Toggle checked={true} onChange={() => {}} />
      </SettingRow>
    </Section>
  )
}
