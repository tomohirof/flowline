import styles from './HowItWorksSection.module.css'
import landingStyles from '../landing.module.css'

const steps = [
  {
    number: 1,
    title: 'レーンを定義',
    desc: '部門や役割に合わせてスイムレーンを作成。ドラッグ操作で簡単に追加できます。',
  },
  {
    number: 2,
    title: 'ノードを配置',
    desc: 'タスクや判断ポイントをノードとして配置し、矢印でつなげてフローを完成させます。',
  },
  {
    number: 3,
    title: '共有・エクスポート',
    desc: 'URLで共有したり、画像としてエクスポート。チーム全員がすぐにアクセスできます。',
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className={styles.section}>
      <div className={landingStyles.container}>
        <h2 className={landingStyles.sectionTitle}>3ステップで始める</h2>
        <p className={landingStyles.sectionSub}>シンプルな操作で、すぐにフロー図を作成できます</p>

        <div className={styles.steps}>
          {steps.map((step) => (
            <div key={step.number} className={styles.step}>
              <div className={styles.stepNumber}>{step.number}</div>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepDesc}>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
