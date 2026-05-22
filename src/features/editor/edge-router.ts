import { calcArrowPath } from '../../lib/flow-engine'
import { segmentsToBboxes } from '../../lib/arrow-routing'
import type { Point, Bbox, EdgeSegment } from '../../lib/arrow-routing'
import type { ArrowPathResult, ArrowSide } from '../../lib/types'

export interface ArrowConfig {
  hw: number
  hh: number
  rh: number
  fromShape?: 'diamond'
  toShape?: 'diamond'
  fromSide?: ArrowSide
  toSide?: ArrowSide
}

export interface ArrowResolveContext {
  from: Point
  to: Point
  config: ArrowConfig
  nodeObstacles: Bbox[]
}

export interface ArrowLike {
  id: string
  from: string
  to: string
}

/**
 * 複数エッジを id 順に逐次ルーティング。先行エッジの segments を後続エッジの障害物に
 * 含める（マルチエッジ協調）。ただし from/to のいずれかを共有するエッジ間は除外
 * （自然な収束を妨げないため）。
 *
 * @param arrows ルーティング対象のエッジ配列。元の順序は結果配列に保持される。
 * @param resolveContext 各 arrow から計算コンテキストを解決するコールバック。null
 *   を返すとそのエッジはスキップされ、結果に null が入る。
 * @returns arrows[i] に対応する ArrowPathResult | null の配列。
 */
export function routeAllArrows<T extends ArrowLike>(
  arrows: T[],
  resolveContext: (arrow: T) => ArrowResolveContext | null,
): Array<ArrowPathResult | null> {
  const indexedArrows = arrows.map((a, i) => ({ arrow: a, originalIndex: i }))
  const sorted = [...indexedArrows].sort((a, b) =>
    a.arrow.id.localeCompare(b.arrow.id),
  )

  const priorSegmentsByEdge = new Map<string, EdgeSegment[]>()
  const edgeEndpoints = new Map<string, { from: string; to: string }>()
  const results = new Array<ArrowPathResult | null>(arrows.length)

  for (const { arrow, originalIndex } of sorted) {
    const ctx = resolveContext(arrow)
    if (!ctx) {
      results[originalIndex] = null
      continue
    }

    const foreignSegments: EdgeSegment[] = []
    for (const [eid, segs] of priorSegmentsByEdge) {
      const ep = edgeEndpoints.get(eid)!
      if (
        ep.from === arrow.from ||
        ep.from === arrow.to ||
        ep.to === arrow.from ||
        ep.to === arrow.to
      ) {
        continue
      }
      foreignSegments.push(...segs)
    }

    const edgeObstacles = segmentsToBboxes(foreignSegments)
    const obstacles = [...ctx.nodeObstacles, ...edgeObstacles]

    const result = calcArrowPath(ctx.from, ctx.to, ctx.config, obstacles)
    results[originalIndex] = result

    if (result) {
      priorSegmentsByEdge.set(arrow.id, result.segments)
      edgeEndpoints.set(arrow.id, { from: arrow.from, to: arrow.to })
    }
  }

  return results
}
