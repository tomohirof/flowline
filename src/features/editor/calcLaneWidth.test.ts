import { describe, it, expect } from 'vitest'
import { calcLaneWidth } from './calcLaneWidth'

describe('calcLaneWidth', () => {
  // 基本定数: LM=28, G=6
  // 計算式: available = containerWidth - LM*2 - (laneCount-1)*G
  //         LW = Math.floor(available / laneCount)

  it('should distribute width evenly across 4 lanes on 1440px container', () => {
    // available = 1440 - 28*2 - 3*6 = 1440 - 56 - 18 = 1366
    // LW = floor(1366 / 4) = 341
    const result = calcLaneWidth(1440, 4, 28, 6)
    expect(result).toBe(341)
  })

  it('should distribute width evenly across 2 lanes on 1440px container', () => {
    // available = 1440 - 56 - 6 = 1378
    // LW = floor(1378 / 2) = 689
    const result = calcLaneWidth(1440, 2, 28, 6)
    expect(result).toBe(689)
  })

  it('should return minimum 160px when container is too narrow', () => {
    // available = 200 - 56 - 18 = 126
    // floor(126 / 4) = 31 → clamped to 160
    const result = calcLaneWidth(200, 4, 28, 6)
    expect(result).toBe(160)
  })

  it('should return fallback 178px when containerWidth is 0', () => {
    const result = calcLaneWidth(0, 4, 28, 6)
    expect(result).toBe(178)
  })

  it('should return fallback 178px when laneCount is 0', () => {
    const result = calcLaneWidth(1440, 0, 28, 6)
    expect(result).toBe(178)
  })

  it('should handle single lane', () => {
    // available = 1440 - 56 - 0 = 1384
    // LW = floor(1384 / 1) = 1384
    const result = calcLaneWidth(1440, 1, 28, 6)
    expect(result).toBe(1384)
  })

  it('should handle many lanes that would exceed minimum', () => {
    // available = 1440 - 56 - 19*6 = 1440 - 56 - 114 = 1270
    // LW = floor(1270 / 20) = 63 → clamped to 160
    const result = calcLaneWidth(1440, 20, 28, 6)
    expect(result).toBe(160)
  })

  // エッジケース: 負の数
  it('should return fallback 178px when containerWidth is negative', () => {
    const result = calcLaneWidth(-100, 4, 28, 6)
    expect(result).toBe(178)
  })

  it('should return fallback 178px when laneCount is negative', () => {
    const result = calcLaneWidth(1440, -1, 28, 6)
    expect(result).toBe(178)
  })

  // エッジケース: NaN / Infinity
  it('should return fallback 178px when containerWidth is NaN', () => {
    const result = calcLaneWidth(NaN, 4, 28, 6)
    expect(result).toBe(178)
  })

  it('should return fallback 178px when laneCount is NaN', () => {
    const result = calcLaneWidth(1440, NaN, 28, 6)
    expect(result).toBe(178)
  })

  it('should return fallback 178px when containerWidth is Infinity', () => {
    const result = calcLaneWidth(Infinity, 4, 28, 6)
    expect(result).toBe(178)
  })

  it('should return fallback 178px when laneCount is Infinity', () => {
    const result = calcLaneWidth(1440, Infinity, 28, 6)
    expect(result).toBe(178)
  })
})
