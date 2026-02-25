import type { InternalArrow, ArrowPathResult } from './types'
import { exitPt, entryPt, buildArrowPath } from './arrow-routing'
import type { Point } from './arrow-routing'

/* --------------------------------------------------------- */
/* calcArrowPath types                                       */
/* --------------------------------------------------------- */

export interface NodePos {
  x: number
  y: number
}

export interface ArrowConfig {
  hw: number
  hh: number
  rh: number
  fromShape?: 'diamond'
  toShape?: 'diamond'
}

/* --------------------------------------------------------- */
/* calcArrowPath                                             */
/* --------------------------------------------------------- */

/**
 * ノード中心座標とサイズ設定から、矢印のSVGパスを計算する。
 * exitPt → entryPt → buildArrowPath の順に呼び出す薄いラッパー。
 */
export function calcArrowPath(from: NodePos, to: NodePos, config: ArrowConfig): ArrowPathResult {
  const f: Point = { x: from.x, y: from.y }
  const t: Point = { x: to.x, y: to.y }
  const s = exitPt(f, t, config.hw, config.hh, config.rh, config.fromShape)
  const e = entryPt(t, f, config.hw, config.hh, config.rh, config.toShape)
  return buildArrowPath(s, e, f, t)
}

/**
 * 指定レーン内の矢印チェーンをたどり、チェーン順のkey配列を返す。
 * チェーンの起点は「同レーン内で incoming がないノード」。
 * 循環参照は visited Set で安全に停止する。
 *
 * 注意: 同一レーン内に非連結な複数チェーン（例: A→B と C→D）が存在する場合、
 * 最初のheadから到達可能なチェーンのみを返す。現状のエディタではレーン内チェーンは
 * 常に単一連結であることを前提としている。
 */
export function findChain(
  arrows: { from: string; to: string }[],
  tasks: Record<string, { lid: string; rid: string }>,
  laneId: string,
): string[] {
  const laneKeys = new Set(Object.keys(tasks).filter((k) => tasks[k].lid === laneId))
  if (laneKeys.size === 0) return []

  // Build adjacency for same-lane nodes only
  const adj = new Map<string, string[]>()
  const hasIncoming = new Set<string>()
  let hasEdges = false
  for (const a of arrows) {
    if (!laneKeys.has(a.from) || !laneKeys.has(a.to)) continue
    hasEdges = true
    if (!adj.has(a.from)) adj.set(a.from, [])
    adj.get(a.from)!.push(a.to)
    hasIncoming.add(a.to)
  }

  // No edges in this lane → no chain
  if (!hasEdges) return []

  // Find chain head: lane node with no incoming from same lane
  const heads = [...laneKeys].filter((k) => !hasIncoming.has(k))
  if (heads.length === 0) {
    // All nodes have incoming (full cycle) — pick any
    heads.push([...laneKeys][0])
  }

  // Walk from head, using visited Set to prevent infinite loop
  const visited = new Set<string>()
  const chain: string[] = []
  let current: string | undefined = heads[0]
  while (current && !visited.has(current)) {
    visited.add(current)
    chain.push(current)
    const nexts: string[] = adj.get(current) || []
    current = nexts.find((n: string) => laneKeys.has(n) && !visited.has(n))
  }

  return chain
}

/**
 * Replace occurrences of `oldKey` with `newKey` in the `from` / `to` fields
 * of every arrow.  Returns a new array — the original is not mutated.
 */
export function remapArrows(
  arrows: InternalArrow[],
  oldKey: string,
  newKey: string,
): InternalArrow[] {
  return arrows.map((a) => ({
    ...a,
    from: a.from === oldKey ? newKey : a.from,
    to: a.to === oldKey ? newKey : a.to,
  }))
}

/**
 * Remove arrows whose `from` or `to` key appears in `deletedKeys`.
 * Returns a new array — the original is not mutated.
 */
export function filterArrowsByDeletedKeys(
  arrows: InternalArrow[],
  deletedKeys: Set<string>,
): InternalArrow[] {
  return arrows.filter((a) => !deletedKeys.has(a.from) && !deletedKeys.has(a.to))
}

/**
 * チェーンの現在順と行位置順を比較し、並び替えが必要か判定する。
 */
export function detectReorder(
  chain: string[],
  tasks: Record<string, { rid: string }>,
  rows: { id: string }[],
): { changed: boolean; current: string[]; proposed: string[] } {
  if (chain.length <= 1) {
    return { changed: false, current: [...chain], proposed: [...chain] }
  }

  const rowIndex = new Map(rows.map((r, i) => [r.id, i]))
  const proposed = [...chain].sort((a, b) => {
    const riA = rowIndex.get(tasks[a]?.rid) ?? 0
    const riB = rowIndex.get(tasks[b]?.rid) ?? 0
    return riA - riB
  })

  const changed = chain.some((k, i) => k !== proposed[i])
  return { changed, current: [...chain], proposed }
}

/**
 * 位置順のkey配列から隣接ペアの矢印配列を生成する。
 */
export function reconnectChain(sortedKeys: string[]): { from: string; to: string }[] {
  const arrows: { from: string; to: string }[] = []
  for (let i = 0; i < sortedKeys.length - 1; i++) {
    arrows.push({ from: sortedKeys[i], to: sortedKeys[i + 1] })
  }
  return arrows
}
