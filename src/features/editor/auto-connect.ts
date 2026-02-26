/**
 * Find the closest upstream node key for auto-connection.
 *
 * Upstream = node in a higher row, or same row but left lane.
 * "Closest" = highest row index among upstream, then highest lane index.
 *
 * @returns The task key of the closest upstream node, or null if none found.
 */
export function findClosestUpstream(
  tasks: Record<string, { lid: string; rid: string }>,
  rows: { id: string }[],
  lanes: { id: string }[],
  newRi: number,
  newLi: number,
  arrows: { from: string; to: string }[],
): string | null {
  // Build outgoing/incoming sets from arrows
  const outgoing = new Set(arrows.map((a) => a.from))
  const incoming = new Set(arrows.map((a) => a.to))

  // Tail nodes: no outgoing arrows
  const allKeys = Object.keys(tasks)
  const tails = allKeys.filter((k) => !outgoing.has(k))

  // Prefer flow-connected tails (have incoming), fall back to all tails
  const flowTails = tails.filter((k) => incoming.has(k))

  const findBest = (candidates: string[]): string | null => {
    let bestKey: string | null = null
    let bestRi = -1
    let bestLi = -1

    for (const key of candidates) {
      const task = tasks[key]
      const tRi = rows.findIndex((r) => r.id === task.rid)
      const tLi = lanes.findIndex((l) => l.id === task.lid)
      if (tRi < 0 || tLi < 0) continue

      // Must be upstream: higher row, or same row with left lane
      if (tRi > newRi) continue
      if (tRi === newRi && tLi >= newLi) continue

      // Pick closest: maximize row index, then lane index
      if (tRi > bestRi || (tRi === bestRi && tLi > bestLi)) {
        bestKey = key
        bestRi = tRi
        bestLi = tLi
      }
    }

    return bestKey
  }

  // 1. Same-row tails: strongest signal (fixes #265)
  const sameRowTails = tails.filter((k) => {
    const task = tasks[k]
    const tRi = rows.findIndex((r) => r.id === task.rid)
    return tRi === newRi
  })
  if (sameRowTails.length > 0) {
    const sameRowResult = findBest(sameRowTails)
    if (sameRowResult) return sameRowResult
  }

  // 2. Flow-connected tails from previous rows
  const result = flowTails.length > 0 ? findBest(flowTails) : null
  if (result) return result

  // 3. Fall back to all tails
  return findBest(tails)
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
