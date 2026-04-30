/**
 * Result of upstream lookup. `splitArrowId` is set only when matched via
 * Step 2.5 (the new node lies on an existing arrow's path), telling the
 * caller to splice that specific arrow rather than all outgoing arrows.
 */
export type UpstreamResult = {
  key: string
  splitArrowId?: string
}

/**
 * Find the closest upstream node key for auto-connection.
 *
 * Priority:
 * 1. Same-row nodes: closest by lane distance (bidirectional),
 *    with tail nodes preferred over non-tails at equal distance.
 * 2. Same-lane upstream: closest row in the same lane (tail or non-tail).
 *    Handles insertions between already-linked nodes within the same lane.
 * 3. Upstream tails (previous rows): closest by row index,
 *    with flow-connected tails preferred over isolated at same row.
 *
 * @returns The upstream lookup result, or null if none found.
 */
export function findClosestUpstream(
  tasks: Record<string, { lid: string; rid: string }>,
  rows: { id: string }[],
  lanes: { id: string }[],
  newRi: number,
  newLi: number,
  arrows: { id: string; from: string; to: string }[],
): UpstreamResult | null {
  const outgoing = new Set(arrows.map((a) => a.from))
  const incoming = new Set(arrows.map((a) => a.to))
  const allKeys = Object.keys(tasks)
  const tails = allKeys.filter((k) => !outgoing.has(k))

  // 1. Same-row: closest by lane distance (bidirectional)
  //    Tiebreaker: prefer tails over non-tails
  {
    let bestKey: string | null = null
    let bestDist = Infinity
    let bestIsTail = false
    for (const key of allKeys) {
      const task = tasks[key]
      const tRi = rows.findIndex((r) => r.id === task.rid)
      if (tRi !== newRi) continue
      const tLi = lanes.findIndex((l) => l.id === task.lid)
      if (tLi < 0 || tLi === newLi) continue
      const dist = Math.abs(tLi - newLi)
      const isTail = !outgoing.has(key)
      if (dist < bestDist || (dist === bestDist && isTail && !bestIsTail)) {
        bestKey = key
        bestDist = dist
        bestIsTail = isTail
      }
    }
    if (bestKey) return { key: bestKey }
  }

  // 2. Same-lane upstream: pick the closest (largest tRi < newRi) node in the same lane.
  //    A same-lane predecessor is the natural upstream even when it already has outgoing
  //    arrows, because the user is inserting a new step into an existing chain.
  {
    let bestKey: string | null = null
    let bestRi = -1
    for (const key of allKeys) {
      const task = tasks[key]
      const tLi = lanes.findIndex((l) => l.id === task.lid)
      if (tLi !== newLi) continue
      const tRi = rows.findIndex((r) => r.id === task.rid)
      if (tRi < 0 || tRi >= newRi) continue
      if (tRi > bestRi) {
        bestKey = key
        bestRi = tRi
      }
    }
    if (bestKey) return { key: bestKey }
  }

  // 3. Upstream tails: closest by row, flow-connected as tiebreaker
  {
    let bestKey: string | null = null
    let bestRi = -1
    let bestLi = -1
    let bestIsFlow = false
    for (const key of tails) {
      const task = tasks[key]
      const tRi = rows.findIndex((r) => r.id === task.rid)
      const tLi = lanes.findIndex((l) => l.id === task.lid)
      if (tRi < 0 || tLi < 0) continue
      if (tRi >= newRi) continue

      const isFlow = incoming.has(key)
      if (
        tRi > bestRi ||
        (tRi === bestRi && isFlow && !bestIsFlow) ||
        (tRi === bestRi && isFlow === bestIsFlow && tLi > bestLi)
      ) {
        bestKey = key
        bestRi = tRi
        bestLi = tLi
        bestIsFlow = isFlow
      }
    }
    return bestKey ? { key: bestKey } : null
  }
}

/**
 * Find arrows that cross over the inserted row.
 *
 * A "crossing" arrow has its `from` node above insertedRowIndex
 * and its `to` node below insertedRowIndex.
 */
export function findCrossingArrows(
  arrows: { id: string; from: string; to: string; comment: string }[],
  tasks: Record<string, { lid: string; rid: string }>,
  rows: { id: string }[],
  insertedRowIndex: number,
): { id: string; from: string; to: string; comment: string }[] {
  return arrows.filter((arrow) => {
    const fromTask = tasks[arrow.from]
    const toTask = tasks[arrow.to]
    if (!fromTask || !toTask) return false

    const fromRi = rows.findIndex((r) => r.id === fromTask.rid)
    const toRi = rows.findIndex((r) => r.id === toTask.rid)
    if (fromRi < 0 || toRi < 0) return false

    return fromRi < insertedRowIndex && toRi > insertedRowIndex
  })
}

/**
 * Compute bridge arrows when deleting nodes.
 *
 * For each deleted node, pairs its incoming arrows (from external nodes)
 * with its outgoing arrows (to external nodes) to create bridges,
 * preserving flow continuity.
 */
export function computeBridgeArrows(
  deletingKeys: Set<string>,
  currentArrows: { id: string; from: string; to: string; comment: string }[],
): { from: string; to: string; comment: string }[] {
  const incoming = currentArrows.filter((a) => deletingKeys.has(a.to) && !deletingKeys.has(a.from))
  const outgoing = currentArrows.filter((a) => deletingKeys.has(a.from) && !deletingKeys.has(a.to))

  const existing = new Set(currentArrows.map((a) => `${a.from}->${a.to}`))

  const bridges: { from: string; to: string; comment: string }[] = []
  const seen = new Set<string>()

  for (const inc of incoming) {
    for (const out of outgoing) {
      const key = `${inc.from}->${out.to}`
      if (inc.from === out.to) continue
      if (existing.has(key)) continue
      if (seen.has(key)) continue
      seen.add(key)
      bridges.push({ from: inc.from, to: out.to, comment: '' })
    }
  }

  return bridges
}
