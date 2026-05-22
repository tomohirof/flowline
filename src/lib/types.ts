/** ひし形ノードの接続元として使う頂点/辺。未指定なら自動（ターゲット方向から推定）。 */
export type ArrowSide = 'top' | 'right' | 'bottom' | 'left'

/** 内部矢印データ（DOM/React非依存） */
export interface InternalArrow {
  id: string
  from: string
  to: string
  comment: string
  color?: string
  dash?: string
  bidirectional?: boolean
  /** 接続元ノードのどの頂点/辺から線を出すか。diamond ノードのみ意味を持つ。 */
  fromSide?: ArrowSide
}

/** 矢印パス計算結果（DOM/React非依存） */
export interface ArrowPathResult {
  d: string
  mx: number
  my: number
}
