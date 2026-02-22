import type { Settings } from '../types'
import { Section } from '../components/Section'
import { SettingRow } from '../components/SettingRow'
import { Toggle } from '../components/Toggle'

interface NotificationSectionProps {
  settings: Settings
  onToggle: (key: keyof Settings) => void
}

export function NotificationSection({ settings, onToggle }: NotificationSectionProps) {
  return (
    <Section title="通知設定" desc="メールやアプリ内の通知を管理します">
      <SettingRow label="メール通知" desc="共有ファイルの更新やコメント時にメール通知を受け取る">
        <Toggle checked={settings.notifications} onChange={() => onToggle('notifications')} />
      </SettingRow>
      <SettingRow label="ブラウザ通知" desc="リアルタイム編集の通知をブラウザで受け取る">
        <Toggle checked={false} onChange={() => {}} />
      </SettingRow>
    </Section>
  )
}
