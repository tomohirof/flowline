const FALLBACK_LW = 178
const MIN_LW = 160

/**
 * コンテナ幅とレーン数からレーン幅を動的に算出する。
 * @param containerWidth - コンテナの幅（px）
 * @param laneCount - レーン数
 * @param margin - 左右マージン（px）
 * @param gap - レーン間ギャップ（px）
 * @returns レーン幅（px）
 */
export function calcLaneWidth(
  containerWidth: number,
  laneCount: number,
  margin: number,
  gap: number,
): number {
  if (
    !Number.isFinite(containerWidth) ||
    !Number.isFinite(laneCount) ||
    containerWidth <= 0 ||
    laneCount <= 0
  ) {
    return FALLBACK_LW
  }
  const available = containerWidth - margin * 2 - (laneCount - 1) * gap
  return Math.max(MIN_LW, Math.floor(available / laneCount))
}
