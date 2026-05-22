import type { ArrowSide } from '../../shared/types'
import type { EdgeSegment } from './arrow-routing'
export type { ArrowSide }

/** 内部矢印データ（DOM/React非依存） */
export interface InternalArrow {
  id: string
  from: string
  to: string
  comment: string
  color?: string
  dash?: string
  bidirectional?: boolean
  /** 接続元ノードのどの頂点/辺から線を出すか。未指定なら自動。 */
  fromSide?: ArrowSide
  /** 接続先ノードのどの頂点/辺に線を入れるか。未指定なら自動。 */
  toSide?: ArrowSide
}

/** 矢印パス計算結果（DOM/React非依存） */
export interface ArrowPathResult {
  d: string
  mx: number
  my: number
  segments: EdgeSegment[]
}
