/**
 * 新規フロー作成時のデフォルト設定
 */
export const DEFAULT_FLOW_TITLE = '無題のフロー'

export const DEFAULT_FLOW_THEME_ID = 'cloud'

export interface DefaultLane {
  name: string
  colorIndex: number
  position: number
}

export const DEFAULT_LANES: DefaultLane[] = [
  { name: '企業', colorIndex: 0, position: 0 },
  { name: 'システム', colorIndex: 1, position: 1 },
  { name: '事務局', colorIndex: 2, position: 2 },
  { name: 'ユーザー', colorIndex: 3, position: 3 },
]

/**
 * デフォルトレーンにランダムIDを付与してAPI送信用のデータを生成する
 */
export function createDefaultLanes() {
  return DEFAULT_LANES.map((lane) => ({
    id: crypto.randomUUID(),
    ...lane,
  }))
}
