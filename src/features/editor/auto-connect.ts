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
): string | null {
  let bestKey: string | null = null
  let bestRi = -1
  let bestLi = -1

  for (const [key, task] of Object.entries(tasks)) {
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
