import { useTranslation } from 'react-i18next'
import styles from './ProductPreview.module.css'

const laneColors = ['#7C5CFC', '#5B8DEF', '#4ECDC4']

const fallbackLanes = ['企画', 'システム', '事務局']
const fallbackNodes = [
  ['要件定義', 'スケジュール策定'],
  ['設計レビュー', '実装・テスト'],
  ['承認フロー', 'リリース通知'],
]

export function ProductPreview() {
  const { t } = useTranslation('landing')
  const rawLanes = t('preview.lanes', { returnObjects: true })
  const rawNodes = t('preview.nodes', { returnObjects: true })

  const laneNames = Array.isArray(rawLanes) ? rawLanes : fallbackLanes
  const nodeLabels = Array.isArray(rawNodes) ? rawNodes : fallbackNodes

  const lanes = laneNames.map((name, i) => ({
    name,
    color: laneColors[i],
    nodes: nodeLabels[i] ?? [],
  }))

  return (
    <div data-testid="product-preview" className={styles.preview}>
      <div className={styles.window}>
        <div className={styles.titleBar}>
          <span className={`${styles.dot} ${styles.dotRed}`} />
          <span className={`${styles.dot} ${styles.dotYellow}`} />
          <span className={`${styles.dot} ${styles.dotGreen}`} />
        </div>

        <div className={styles.editor}>
          {lanes.map((lane) => (
            <div key={lane.name} className={styles.lane}>
              <div className={styles.laneHeader}>
                <span className={styles.laneDot} style={{ background: lane.color }} />
                {lane.name}
              </div>
              <div className={styles.laneBody}>
                {lane.nodes.map((node) => (
                  <div key={node} className={styles.node}>
                    {node}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
