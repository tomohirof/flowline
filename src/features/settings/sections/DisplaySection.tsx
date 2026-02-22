import type { Settings } from '../types'
import { Section } from '../components/Section'
import { SettingRow } from '../components/SettingRow'
import { Toggle } from '../components/Toggle'

interface DisplaySectionProps {
  settings: Settings
  onToggle: (key: keyof Settings) => void
}

export function DisplaySection({ settings, onToggle }: DisplaySectionProps) {
  return (
    <Section title="表示設定" desc="エディタの見た目をカスタマイズします">
      <SettingRow label="ドットグリッド表示" desc="キャンバス背景のドットグリッドパターン">
        <Toggle checked={settings.showDotGrid} onChange={() => onToggle('showDotGrid')} />
      </SettingRow>
      <SettingRow label="ノード順番バッジ" desc="ノード右下の作成順番号を表示">
        <Toggle checked={settings.showOrderBadge} onChange={() => onToggle('showOrderBadge')} />
      </SettingRow>
      <SettingRow label="レーンカラーバー" desc="レーンヘッダー下のカラーライン">
        <Toggle checked={settings.showLaneColorBar} onChange={() => onToggle('showLaneColorBar')} />
      </SettingRow>
    </Section>
  )
}
