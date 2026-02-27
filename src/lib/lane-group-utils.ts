/**
 * Lane Group Utilities
 *
 * Shared helpers for lane grouping logic used by both
 * FlowEditor and SharedFlowViewer.
 */

interface GroupLane {
  groupId?: string
  groupRole?: 'parent' | 'sub'
}

/** Returns true if the lane is the parent of a group. */
export function isGroupParent(lane: GroupLane): boolean {
  return lane.groupRole === 'parent' && !!lane.groupId
}

/** Returns true if the lane is a sub-lane within a group. */
export function isGroupSub(lane: GroupLane): boolean {
  return lane.groupRole === 'sub' && !!lane.groupId
}

/**
 * Calculates the total rendered width of a lane group.
 *
 * For ungrouped lanes returns the single lane width (LW).
 * For grouped lanes returns: memberCount * LW + (memberCount - 1) * G
 *
 * @param parentLane - The parent lane (or any lane to query its group)
 * @param lanes - All lanes in the flow
 * @param LW - Single lane width in pixels
 * @param G - Gap between lanes in pixels
 */
export function getGroupWidth(
  parentLane: GroupLane,
  lanes: GroupLane[],
  LW: number,
  G: number,
): number {
  if (!parentLane.groupId) return LW
  const members = lanes.filter((l) => l.groupId === parentLane.groupId)
  return members.length * LW + (members.length - 1) * G
}
