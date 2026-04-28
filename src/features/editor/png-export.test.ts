// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { pickPixelRatio } from './png-export'

describe('pickPixelRatio', () => {
  it('returns pixelRatio=2 and downgraded=false for small flows (≤4000 long edge)', () => {
    expect(pickPixelRatio(100, 100)).toEqual({
      pixelRatio: 2,
      downgraded: false,
      abort: false,
    })
  })

  it('returns pixelRatio=2 at the 4000px boundary', () => {
    expect(pickPixelRatio(4000, 4000)).toEqual({
      pixelRatio: 2,
      downgraded: false,
      abort: false,
    })
  })

  it('downgrades to pixelRatio=1 when 2x would exceed 8000 long edge', () => {
    expect(pickPixelRatio(5000, 3000)).toEqual({
      pixelRatio: 1,
      downgraded: true,
      abort: false,
    })
  })

  it('aborts when 1x already exceeds 8000 long edge', () => {
    expect(pickPixelRatio(9000, 100)).toEqual({
      pixelRatio: 1,
      downgraded: false,
      abort: true,
    })
  })
})
