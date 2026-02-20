import styles from './ProductPreview.module.css'

const lanes = [
  {
    name: '企画',
    color: '#7C5CFC',
    nodes: ['要件定義', 'スケジュール策定'],
  },
  {
    name: 'システム',
    color: '#5B8DEF',
    nodes: ['設計レビュー', '実装・テスト'],
  },
  {
    name: '事務局',
    color: '#4ECDC4',
    nodes: ['承認フロー', 'リリース通知'],
  },
]

export function ProductPreview() {
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
