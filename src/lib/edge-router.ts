import { calcArrowPath } from './flow-engine'
import type { ArrowConfig } from './flow-engine'
import { segmentsToBboxes } from './arrow-routing'
import type { Point, Bbox, EdgeSegment } from './arrow-routing'
import type { ArrowPathResult } from './types'

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
  const sorted = arrows
    .map((a, i) => ({ arrow: a, originalIndex: i }))
    .sort((a, b) => a.arrow.id.localeCompare(b.arrow.id))

  const priorEdges = new Map<string, { segments: EdgeSegment[]; from: string; to: string }>()
  const results = new Array<ArrowPathResult | null>(arrows.length)

  for (const { arrow, originalIndex } of sorted) {
    const ctx = resolveContext(arrow)
    if (!ctx) {
      results[originalIndex] = null
      continue
    }

    const foreignSegments: EdgeSegment[] = []
    for (const prior of priorEdges.values()) {
      if (
        prior.from === arrow.from ||
        prior.from === arrow.to ||
        prior.to === arrow.from ||
        prior.to === arrow.to
      ) {
        continue
      }
      foreignSegments.push(...prior.segments)
    }

    const edgeObstacles = segmentsToBboxes(foreignSegments)
    const obstacles = [...ctx.nodeObstacles, ...edgeObstacles]

    const result = calcArrowPath(ctx.from, ctx.to, ctx.config, obstacles)
    results[originalIndex] = result

    if (result) {
      priorEdges.set(arrow.id, {
        segments: result.segments,
        from: arrow.from,
        to: arrow.to,
      })
    }
  }

  return results
}
