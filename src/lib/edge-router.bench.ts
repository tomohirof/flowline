import { bench, describe } from 'vitest'
import { routeAllArrows } from './edge-router'
import type { ArrowLike, ArrowResolveContext } from './edge-router'

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

const makeCtx = (i: number): ArrowResolveContext => ({
  from: { x: (i % 10) * 100, y: Math.floor(i / 10) * 100 },
  to: {
    x: ((i + 1) % 10) * 100,
    y: Math.floor((i + 1) / 10) * 100,
  },
  config: { hw: 50, hh: 25, rh: 100 },
  nodeObstacles: [],
})

describe('routeAllArrows benchmark', () => {
  for (const n of [10, 50, 100, 200]) {
    bench(`E=${n} edges`, () => {
      const arrows = makeSyntheticArrows(n)
      routeAllArrows(arrows, (a) => {
        const i = parseInt(a.id.slice(1))
        return makeCtx(i)
      })
    })
  }
})
