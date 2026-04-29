/** 内部矢印データ（DOM/React非依存） */
export interface InternalArrow {
  id: string
  from: string
  to: string
  comment: string
  color?: string
  dash?: string
  bidirectional?: boolean
}

/** 矢印パス計算結果（DOM/React非依存） */
export interface ArrowPathResult {
  d: string
  mx: number
  my: number
}
