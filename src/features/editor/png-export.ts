const MAX_LONG_EDGE = 8000

export interface PixelRatioDecision {
  pixelRatio: number
  downgraded: boolean
  abort: boolean
}

export function pickPixelRatio(width: number, height: number): PixelRatioDecision {
  const longEdge = Math.max(width, height)
  if (longEdge * 2 <= MAX_LONG_EDGE) {
    return { pixelRatio: 2, downgraded: false, abort: false }
  }
  if (longEdge <= MAX_LONG_EDGE) {
    return { pixelRatio: 1, downgraded: true, abort: false }
  }
  return { pixelRatio: 1, downgraded: false, abort: true }
}
