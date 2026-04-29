import type { InternalArrow, ArrowPathResult } from './types'
import type { TaskData, MemoData } from '../features/editor/types'
import { exitPt, entryPt, buildArrowPath } from './arrow-routing'
import type { Point, Bbox } from './arrow-routing'

/* --------------------------------------------------------- */
/* calcArrowPath types                                       */
/* --------------------------------------------------------- */

interface NodePos {
  x: number
  y: number
}

interface ArrowConfig {
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
export function calcArrowPath(
  from: NodePos,
  to: NodePos,
  config: ArrowConfig,
  obstacles?: Bbox[],
): ArrowPathResult {
  const f: Point = { x: from.x, y: from.y }
  const t: Point = { x: to.x, y: to.y }
  const s = exitPt(f, t, config.hw, config.hh, config.rh, config.fromShape)
  const e = entryPt(t, f, config.hw, config.hh, config.rh, config.toShape)
  return buildArrowPath(s, e, f, t, obstacles)
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
 * Replace multiple keys in a single pass using a keyMap.
 * Used for batch-moving multiple nodes at once.
 */
export function remapArrowsBatch(
  arrows: InternalArrow[],
  keyMap: Map<string, string>,
): InternalArrow[] {
  return arrows.map((a) => ({
    ...a,
    from: keyMap.get(a.from) ?? a.from,
    to: keyMap.get(a.to) ?? a.to,
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

/* --------------------------------------------------------- */
/* calcMultiDropTargets                                      */
/* --------------------------------------------------------- */

/**
 * Calculate target cell keys for a multi-node drop.
 * Returns a Set of target keys if all cells are valid, or null if drop is invalid.
 */
export function calcMultiDropTargets(
  anchorTarget: { li: number; ri: number; key: string },
  anchorKey: string,
  selected: Set<string>,
  tasks: Record<string, { lid: string; rid: string }>,
  liMap: Record<string, number>,
  riMap: Record<string, number>,
  lanes: { id: string }[],
  rows: { id: string }[],
): Set<string> | null {
  const anchorTask = tasks[anchorKey]
  if (!anchorTask) return null
  const anchorLi = liMap[anchorTask.lid]
  const anchorRi = riMap[anchorTask.rid]
  const dLi = anchorTarget.li - anchorLi
  const dRi = anchorTarget.ri - anchorRi

  const ky = (lid: string, rid: string) => `${lid}_${rid}`
  const targets = new Set<string>()

  for (const k of selected) {
    const t = tasks[k]
    if (!t) return null
    const newLi = liMap[t.lid] + dLi
    const newRi = riMap[t.rid] + dRi
    if (newLi < 0 || newLi >= lanes.length || newRi < 0 || newRi >= rows.length) return null
    const targetKey = ky(lanes[newLi].id, rows[newRi].id)
    if (tasks[targetKey] && !selected.has(targetKey)) return null
    targets.add(targetKey)
  }
  return targets
}

/* --------------------------------------------------------- */
/* detectCrossLaneRewire                                     */
/* --------------------------------------------------------- */

export interface CrossLaneRewire {
  arrowId: string
  oldFrom: string
  newFrom: string
  to: string
  comment: string
}

/**
 * チェーン再接続で末尾ノードが変わった場合、旧末尾のクロスレーン矢印を
 * 新末尾に張り替える提案を返す。
 *
 * 条件:
 * - 旧末尾 !== 新末尾
 * - 新末尾の行インデックス > 旧末尾の行インデックス（下方向に伸びた場合のみ）
 * - 旧末尾から別レーンへの矢印が存在する
 */
/* --------------------------------------------------------- */
/* swapKeys — 2ノードの位置交換                               */
/* --------------------------------------------------------- */

interface SwapResult {
  tasks: Record<string, TaskData>
  arrows: InternalArrow[]
  order: string[]
  memos: Record<string, MemoData>
  newKeyA: string
  newKeyB: string
}

/**
 * 2つのノードのコンテンツ（label, nodeId, スタイル）のみを入れ替える。
 * キー・矢印・順序は変更しない。同一レーン限定。異なるレーンや存在しないキーの場合は null を返す。
 */
export function swapKeys(
  tasks: Record<string, TaskData>,
  arrows: InternalArrow[],
  order: string[],
  memos: Record<string, MemoData>,
  draggedKey: string,
  targetKey: string,
): SwapResult | null {
  const draggedTask = tasks[draggedKey]
  const targetTask = tasks[targetKey]
  if (!draggedTask || !targetTask) return null
  if (draggedTask.lid !== targetTask.lid) return null
  if (draggedTask.rid === targetTask.rid) return null

  // キーは維持し、コンテンツ（label, nodeId, スタイル）だけを入れ替える
  const newTasks = { ...tasks }
  newTasks[draggedKey] = {
    ...draggedTask,
    label: targetTask.label,
    nodeId: targetTask.nodeId,
    bg: targetTask.bg,
    strokeColor: targetTask.strokeColor,
    dash: targetTask.dash,
    shape: targetTask.shape,
  }
  newTasks[targetKey] = {
    ...targetTask,
    label: draggedTask.label,
    nodeId: draggedTask.nodeId,
    bg: draggedTask.bg,
    strokeColor: draggedTask.strokeColor,
    dash: draggedTask.dash,
    shape: draggedTask.shape,
  }

  // memos: コンテンツに追従して入れ替え
  const newMemos = { ...memos }
  const memoA = memos[draggedKey]
  const memoB = memos[targetKey]
  delete newMemos[draggedKey]
  delete newMemos[targetKey]
  if (memoA !== undefined) newMemos[targetKey] = memoA
  if (memoB !== undefined) newMemos[draggedKey] = memoB

  // order, arrows はキー変更なしのためそのまま
  // newKeyA = targetKey（ドラッグ元の内容が入った先）
  // newKeyB = draggedKey（ターゲットの内容が入った先）
  return {
    tasks: newTasks,
    arrows,
    order,
    memos: newMemos,
    newKeyA: targetKey,
    newKeyB: draggedKey,
  }
}

export function detectCrossLaneRewire(
  currentChain: string[],
  proposedChain: string[],
  arrows: { id: string; from: string; to: string; comment: string }[],
  tasks: Record<string, { lid: string; rid: string }>,
  rows: { id: string }[],
): CrossLaneRewire[] {
  if (currentChain.length === 0 || proposedChain.length === 0) return []

  const oldTail = currentChain[currentChain.length - 1]
  const newTail = proposedChain[proposedChain.length - 1]
  if (oldTail === newTail) return []

  if (!tasks[oldTail] || !tasks[newTail]) return []

  const rowIndex = new Map(rows.map((r, i) => [r.id, i]))
  const oldRow = rowIndex.get(tasks[oldTail].rid) ?? 0
  const newRow = rowIndex.get(tasks[newTail].rid) ?? 0
  if (newRow <= oldRow) return []

  const oldTailLane = tasks[oldTail].lid
  return arrows
    .filter((a) => {
      if (a.from !== oldTail) return false
      if (tasks[a.to] == null) return false
      if (tasks[a.to].lid === oldTailLane) return false
      const toRow = rowIndex.get(tasks[a.to].rid) ?? 0
      return toRow > oldRow
    })
    .map((a) => ({
      arrowId: a.id,
      oldFrom: oldTail,
      newFrom: newTail,
      to: a.to,
      comment: a.comment,
    }))
}
