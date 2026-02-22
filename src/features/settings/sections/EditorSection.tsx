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
  return (
    <>
      <Section title="ノード作成" desc="新しいノードを作成する際の挙動を設定します">
        <SettingRow
          label="同じ行にノード作成時、テキストをコピー"
          desc="隣のレーンの同じ行にノードを作成すると、元のノードのラベルが引き継がれます"
        >
          <Toggle
            checked={settings.copyLabelOnSameRow}
            onChange={() => onToggle('copyLabelOnSameRow')}
          />
        </SettingRow>
        <SettingRow label="自動接続" desc="新規ノードを前のノードに自動で矢印接続します">
          <Toggle checked={settings.autoConnect} onChange={() => onToggle('autoConnect')} />
        </SettingRow>
        <SettingRow
          label="最終行で自動行追加"
          desc="最後の行にノードを配置すると、新しい空行が自動追加されます"
        >
          <Toggle checked={settings.autoAddRow} onChange={() => onToggle('autoAddRow')} />
        </SettingRow>
        <SettingRow
          label="作成後すぐに編集"
          desc="ノード作成後、自動的にラベル編集モードに入ります"
        >
          <Toggle
            checked={settings.enterEditOnCreate}
            onChange={() => onToggle('enterEditOnCreate')}
          />
        </SettingRow>
      </Section>

      <Section title="接続線のデフォルト" desc="新しい接続線の初期スタイルを設定します">
        <SettingRow label="線のスタイル">
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { id: 'solid', label: '実線' },
              { id: 'dashed', label: '破線' },
              { id: 'dotted', label: '点線' },
            ].map((s) => (
              <Tag
                key={s.id}
                label={s.label}
                active={settings.defaultArrowStyle === s.id}
                onClick={() => onSet('defaultArrowStyle', s.id)}
              />
            ))}
          </div>
        </SettingRow>
      </Section>

      <Section title="デフォルトテーマ">
        <SettingRow label="新規ファイルのテーマ">
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { id: 'cloud', label: 'Cloud' },
              { id: 'midnight', label: 'Midnight' },
              { id: 'blueprint', label: 'Blueprint' },
            ].map((t) => (
              <Tag
                key={t.id}
                label={t.label}
                active={settings.defaultTheme === t.id}
                onClick={() => onSet('defaultTheme', t.id)}
              />
            ))}
          </div>
        </SettingRow>
      </Section>
    </>
  )
}
