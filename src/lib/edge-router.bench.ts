import { bench, describe } from 'vitest'
import { routeAllArrows } from './edge-router'
import type { ArrowLike, ArrowResolveContext } from './edge-router'
import type { Bbox } from './arrow-routing'

const makeSyntheticArrows = (n: number): ArrowLike[] => {
  const arrows: ArrowLike[] = []
  for (let i = 0; i < n; i++) {
    arrows.push({
      id: `a${i.toString().padStart(4, '0')}`,
      from: `node${i}`,
      to: `node${(i + 1) % n}`,
    })
  }
  return arrows
}

// 全ノード相当の Bbox を生成（10×10 グリッド上に展開する）。
// 現実のフローでは routeAllArrows に各エッジ分の nodeObstacles が渡されるため、
// ベンチでも合成 Bbox を含めて計測する。
const makeNodeObstacles = (totalNodes: number): Bbox[] =>
  Array.from({ length: totalNodes }, (_, j) => ({
    x: (j % 10) * 100,
    y: Math.floor(j / 10) * 100,
    w: 80,
    h: 40,
  }))

const makeCtx = (i: number, nodeObstacles: Bbox[]): ArrowResolveContext => ({
  from: { x: (i % 10) * 100, y: Math.floor(i / 10) * 100 },
  to: {
    x: ((i + 1) % 10) * 100,
    y: Math.floor((i + 1) / 10) * 100,
  },
  config: { hw: 50, hh: 25, rh: 100 },
  nodeObstacles,
})

describe('routeAllArrows benchmark', () => {
  for (const n of [10, 50, 100, 200]) {
    bench(`E=${n} edges`, () => {
      const arrows = makeSyntheticArrows(n)
      const nodeObstacles = makeNodeObstacles(n)
      routeAllArrows(arrows, (a) => {
        const i = parseInt(a.id.slice(1))
        return makeCtx(i, nodeObstacles)
      })
    })
  }
})
