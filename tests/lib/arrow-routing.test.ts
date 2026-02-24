import { describe, it, expect } from 'vitest'
import { exitPt, entryPt, buildArrowPath } from '../../src/lib/arrow-routing'

const RH = 84

describe('exitPt', () => {
  const hw = 76,
    hh = 28

  it('同位置のノードは下部から出る', () => {
    const c = { x: 100, y: 100 },
      o = { x: 100, y: 100 }
    expect(exitPt(c, o, hw, hh, RH)).toEqual({ x: 100, y: 128 })
  })

  it('下方向のノード（dy > RH*0.3）は下部から出る', () => {
    const c = { x: 100, y: 100 },
      o = { x: 300, y: 200 }
    expect(exitPt(c, o, hw, hh, RH)).toEqual({ x: 100, y: 128 })
  })

  it('上方向のノード（dy < -RH*0.3）は右側から出る', () => {
    const c = { x: 100, y: 200 },
      o = { x: 300, y: 100 }
    expect(exitPt(c, o, hw, hh, RH)).toEqual({ x: 176, y: 200 })
  })

  it('上方向・左側のノードは左側から出る', () => {
    const c = { x: 300, y: 200 },
      o = { x: 100, y: 100 }
    expect(exitPt(c, o, hw, hh, RH)).toEqual({ x: 224, y: 200 })
  })

  it('水平方向のノード（小さいdy）は右側から出る', () => {
    const c = { x: 100, y: 100 },
      o = { x: 300, y: 110 }
    expect(exitPt(c, o, hw, hh, RH)).toEqual({ x: 176, y: 100 })
  })

  // エッジケース: 境界値テスト
  it('dy がちょうど RH*0.3 の境界付近では浮動小数点の影響で下部から出る', () => {
    // 84 * 0.3 = 25.2 だが、100 + 25.2 - 100 = 25.200000000000003（浮動小数点）
    // よって dy > rh * 0.3 が true になり、下部出口となる
    const threshold = RH * 0.3
    const c = { x: 100, y: 100 },
      o = { x: 300, y: 100 + threshold }
    expect(exitPt(c, o, hw, hh, RH)).toEqual({ x: 100, y: 128 })
  })

  it('負の座標でも正しく計算する', () => {
    const c = { x: -100, y: -100 },
      o = { x: -300, y: -200 }
    // dy = -100 < -RH*0.3, dx = -200 < 0 なので左側
    expect(exitPt(c, o, hw, hh, RH)).toEqual({ x: -176, y: -100 })
  })

  it('座標が0のケース', () => {
    const c = { x: 0, y: 0 },
      o = { x: 200, y: 200 }
    // dy = 200 > RH*0.3 なので下部
    expect(exitPt(c, o, hw, hh, RH)).toEqual({ x: 0, y: 28 })
  })

  it('dxがほぼ0でdyが正のケースは下部から出る', () => {
    const c = { x: 100, y: 100 },
      o = { x: 100.5, y: 200 }
    // dy = 100 > RH*0.3 なので下部
    expect(exitPt(c, o, hw, hh, RH)).toEqual({ x: 100, y: 128 })
  })
})

describe('entryPt', () => {
  const hw = 76,
    hh = 28

  it('同位置のノードは上部に接続', () => {
    const c = { x: 100, y: 100 },
      o = { x: 100, y: 100 }
    expect(entryPt(c, o, hw, hh, RH)).toEqual({ x: 100, y: 72 })
  })

  it('上方向からの矢印（dy < -RH*0.3）は上部に接続', () => {
    const c = { x: 300, y: 200 },
      o = { x: 100, y: 100 }
    expect(entryPt(c, o, hw, hh, RH)).toEqual({ x: 300, y: 172 })
  })

  it('下方向からの矢印（dy > RH*0.3）は下部に接続', () => {
    const c = { x: 100, y: 100 },
      o = { x: 100, y: 200 }
    expect(entryPt(c, o, hw, hh, RH)).toEqual({ x: 100, y: 128 })
  })

  it('水平方向は左側に接続', () => {
    const c = { x: 300, y: 100 },
      o = { x: 100, y: 110 }
    expect(entryPt(c, o, hw, hh, RH)).toEqual({ x: 224, y: 100 })
  })

  // エッジケース: 境界値テスト
  it('dy がちょうど -RH*0.3 の境界値では水平方向として扱う', () => {
    const threshold = RH * 0.3 // 25.2
    const c = { x: 300, y: 200 },
      o = { x: 100, y: 200 - threshold }
    // dy === -RH*0.3 は < にも > にも該当しないため、|dx| > 1 の分岐へ
    expect(entryPt(c, o, hw, hh, RH)).toEqual({ x: 224, y: 200 })
  })

  it('負の座標でも正しく計算する', () => {
    const c = { x: -200, y: -100 },
      o = { x: -400, y: -200 }
    // dy = -100 < -RH*0.3 なので上部
    expect(entryPt(c, o, hw, hh, RH)).toEqual({ x: -200, y: -128 })
  })

  it('座標が0のケース', () => {
    const c = { x: 0, y: 0 },
      o = { x: 0, y: -100 }
    // dy = -100 < -RH*0.3 なので上部
    expect(entryPt(c, o, hw, hh, RH)).toEqual({ x: 0, y: -28 })
  })

  it('右側からの水平接続', () => {
    const c = { x: 100, y: 100 },
      o = { x: 300, y: 110 }
    // dy = 10, |dx| = 200 > 1 なので dx > 0 → 右側(hw)
    expect(entryPt(c, o, hw, hh, RH)).toEqual({ x: 176, y: 100 })
  })
})

describe('buildArrowPath', () => {
  it('垂直の直線パス（dx < 2）', () => {
    const s = { x: 100, y: 128 },
      e = { x: 100, y: 172 }
    const fc = { x: 100, y: 100 },
      tc = { x: 100, y: 200 }
    expect(buildArrowPath(s, e, fc, tc)).toEqual({
      d: 'M100,128 L100,172',
      mx: 100,
      my: 150,
    })
  })

  it('水平の直線パス（dy < 2）', () => {
    const s = { x: 176, y: 100 },
      e = { x: 224, y: 100 }
    const fc = { x: 100, y: 100 },
      tc = { x: 300, y: 100 }
    expect(buildArrowPath(s, e, fc, tc)).toEqual({
      d: 'M176,100 L224,100',
      mx: 200,
      my: 100,
    })
  })

  it('両方が縦出口の場合はZ字パス', () => {
    const s = { x: 100, y: 128 },
      e = { x: 300, y: 172 }
    const fc = { x: 100, y: 100 },
      tc = { x: 300, y: 200 }
    expect(buildArrowPath(s, e, fc, tc)).toEqual({
      d: 'M100,128 L100,150 L300,150 L300,172',
      mx: 200,
      my: 150,
    })
  })

  it('両方が横出口の場合はZ字パス', () => {
    const s = { x: 176, y: 100 },
      e = { x: 224, y: 200 }
    const fc = { x: 100, y: 100 },
      tc = { x: 300, y: 200 }
    expect(buildArrowPath(s, e, fc, tc)).toEqual({
      d: 'M176,100 L200,100 L200,200 L224,200',
      mx: 200,
      my: 150,
    })
  })

  it('縦出口→横入口のL字パス', () => {
    const s = { x: 100, y: 128 },
      e = { x: 224, y: 200 }
    const fc = { x: 100, y: 100 },
      tc = { x: 300, y: 200 }
    expect(buildArrowPath(s, e, fc, tc)).toEqual({
      d: 'M100,128 L100,200 L224,200',
      mx: 162,
      my: 164,
    })
  })

  it('横出口→縦入口のL字パス', () => {
    const s = { x: 176, y: 100 },
      e = { x: 300, y: 172 }
    const fc = { x: 100, y: 100 },
      tc = { x: 300, y: 200 }
    expect(buildArrowPath(s, e, fc, tc)).toEqual({
      d: 'M176,100 L300,100 L300,172',
      mx: 238,
      my: 136,
    })
  })

  // エッジケース
  it('完全に同じ始点と終点', () => {
    const s = { x: 100, y: 100 },
      e = { x: 100, y: 100 }
    const fc = { x: 100, y: 80 },
      tc = { x: 100, y: 120 }
    expect(buildArrowPath(s, e, fc, tc)).toEqual({
      d: 'M100,100 L100,100',
      mx: 100,
      my: 100,
    })
  })

  it('負の座標でも正しくパスを生成する', () => {
    const s = { x: -100, y: -128 },
      e = { x: -100, y: -172 }
    const fc = { x: -100, y: -100 },
      tc = { x: -100, y: -200 }
    expect(buildArrowPath(s, e, fc, tc)).toEqual({
      d: 'M-100,-128 L-100,-172',
      mx: -100,
      my: -150,
    })
  })
})

describe('diamond shape', () => {
  describe('exitPt with diamond', () => {
    it('should exit from bottom vertex when target is directly below', () => {
      const result = exitPt({ x: 100, y: 100 }, { x: 100, y: 200 }, 76, 28, 84, 'diamond')
      expect(result).toEqual({ x: 100, y: 134 })
    })

    it('should exit from right vertex when target is to the right', () => {
      const result = exitPt({ x: 100, y: 100 }, { x: 300, y: 100 }, 76, 28, 84, 'diamond')
      expect(result).toEqual({ x: 134, y: 100 })
    })

    it('should exit from left vertex when target is to the left', () => {
      const result = exitPt({ x: 100, y: 100 }, { x: -50, y: 100 }, 76, 28, 84, 'diamond')
      expect(result).toEqual({ x: 66, y: 100 })
    })

    it('should exit from top vertex when target is directly above', () => {
      const result = exitPt({ x: 100, y: 200 }, { x: 100, y: 50 }, 76, 28, 84, 'diamond')
      expect(result).toEqual({ x: 100, y: 166 })
    })

    it('should exit from top vertex when target is at same position', () => {
      const result = exitPt({ x: 100, y: 100 }, { x: 100, y: 100 }, 76, 28, 84, 'diamond')
      expect(result).toEqual({ x: 100, y: 66 })
    })
  })

  describe('entryPt with diamond', () => {
    it('should enter from top vertex when source is above', () => {
      const result = entryPt({ x: 100, y: 200 }, { x: 100, y: 50 }, 76, 28, 84, 'diamond')
      expect(result).toEqual({ x: 100, y: 166 })
    })

    it('should enter from bottom vertex when source is below', () => {
      const result = entryPt({ x: 100, y: 100 }, { x: 100, y: 300 }, 76, 28, 84, 'diamond')
      expect(result).toEqual({ x: 100, y: 134 })
    })

    it('should enter from right vertex when source is to the right', () => {
      const result = entryPt({ x: 100, y: 100 }, { x: 300, y: 100 }, 76, 28, 84, 'diamond')
      expect(result).toEqual({ x: 134, y: 100 })
    })
  })

  describe('backward compatibility', () => {
    it('exitPt without shape should work as before', () => {
      const result = exitPt({ x: 100, y: 100 }, { x: 100, y: 200 }, 76, 28, 84)
      expect(result).toEqual({ x: 100, y: 128 })
    })

    it('entryPt without shape should work as before', () => {
      const result = entryPt({ x: 100, y: 200 }, { x: 100, y: 50 }, 76, 28, 84)
      expect(result).toEqual({ x: 100, y: 172 })
    })
  })
})
