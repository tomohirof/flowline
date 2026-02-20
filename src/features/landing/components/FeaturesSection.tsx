import styles from './FeaturesSection.module.css'
import landingStyles from '../landing.module.css'

const features = [
  {
    icon: '\u2630',
    title: 'スイムレーン設計',
    desc: '部門・役割ごとにレーンを分けて、業務の責任範囲を明確に可視化できます。',
  },
  {
    icon: '\u2194',
    title: 'スマート接続',
    desc: 'ノード間を直感的に接続。矢印の自動ルーティングで美しいフロー図を作成。',
  },
  {
    icon: '\u26A1',
    title: 'リアルタイム編集',
    desc: '変更が即座に反映されるライブプレビュー。ストレスのない編集体験。',
  },
  {
    icon: '\u21A9',
    title: 'Undo / Redo',
    desc: '操作の取り消し・やり直しに完全対応。安心して編集できます。',
  },
  {
    icon: '\u2728',
    title: 'テーマシステム',
    desc: 'ライト・ダークテーマを切り替え。好みに合わせた作業環境を。',
  },
  {
    icon: '\u2B07',
    title: 'エクスポート',
    desc: 'PNG・SVG形式でエクスポート。プレゼン資料やドキュメントにすぐ活用。',
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className={styles.section}>
      <div className={landingStyles.container}>
        <h2 className={landingStyles.sectionTitle}>すべての機能を、ひとつに</h2>
        <p className={landingStyles.sectionSub}>業務フロー設計に必要な機能をすべて備えています</p>
      </div>

      <div className={styles.grid}>
        {features.map((f) => (
          <div key={f.title} className={styles.card}>
            <div className={styles.icon}>{f.icon}</div>
            <h3 className={styles.cardTitle}>{f.title}</h3>
            <p className={styles.cardDesc}>{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
