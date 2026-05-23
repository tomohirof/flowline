import { calcArrowPath } from './flow-engine'
import type { ArrowConfig } from './flow-engine'
import { segmentsToBboxes, detectCrossings, segmentsToD } from './arrow-routing'
import type { Point, Bbox, EdgeSegment, EdgeWithSegments } from './arrow-routing'
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

/**
 * routeAllArrows の出力に対し、エッジ間の H×V 交差を検出して水平セグメントに
 * ジャンパー弧を挿入した d を再生成する。既存 routeAllArrows の挙動は変更しない。
 *
 * 規約: H が V を跨ぐ（H 側に弧が乗る）。
 *
 * @param arrows ルーティング対象のエッジ配列
 * @param resolveContext 各 arrow から計算コンテキストを解決するコールバック
 * @returns arrows[i] に対応する ArrowPathResult | null の配列
 *   交差なしのエッジは routeAllArrows と同一の結果。
 *   交差ありの H セグメントを含むエッジは d のみが再生成される（segments は不変）。
 */
export function routeAllArrowsWithJumpers<T extends ArrowLike>(
  arrows: T[],
  resolveContext: (arrow: T) => ArrowResolveContext | null,
): Array<ArrowPathResult | null> {
  // 1パス目: 既存 routeAllArrows で全 segments 確定
  const paths = routeAllArrows(arrows, resolveContext)

  // 2パス目: 交差検出
  const edgesForCrossing: EdgeWithSegments[] = []
  for (let i = 0; i < arrows.length; i++) {
    const p = paths[i]
    if (p) edgesForCrossing.push({ id: arrows[i].id, segments: p.segments })
  }
  const crossings = detectCrossings(edgesForCrossing)

  if (crossings.length === 0) return paths

  // jumperEdgeId → segmentIndex → x[] のマップを構築
  const jumpsByEdge = new Map<string, Map<number, number[]>>()
  for (const c of crossings) {
    let segMap = jumpsByEdge.get(c.jumperEdgeId)
    if (!segMap) {
      segMap = new Map()
      jumpsByEdge.set(c.jumperEdgeId, segMap)
    }
    let arr = segMap.get(c.jumperSegmentIndex)
    if (!arr) {
      arr = []
      segMap.set(c.jumperSegmentIndex, arr)
    }
    arr.push(c.x)
  }

  // 3パス目: d 再生成（ジャンパー対象のエッジのみ）
  return paths.map((p, i) => {
    if (!p) return null
    const jumps = jumpsByEdge.get(arrows[i].id)
    if (!jumps) return p
    return { ...p, d: segmentsToD(p.segments, jumps) }
  })
}
