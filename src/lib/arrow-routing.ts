export interface Point {
  x: number
  y: number
}

export interface ArrowPath {
  d: string
  mx: number
  my: number
}

/** Diamond shape half-diagonal (vertex distance from center) */
export const DS = 34

/**
 * ノード中心 c から相手ノード中心 o に向かう矢印の出口点を計算する。
 * FlowEditor の threshold ベースのロジックを共通化したもの。
 *
 * hw: ノード半幅, hh: ノード半高さ, rh: 行高さ（閾値計算に使用）
 * shape: オプションのノード形状（'diamond' の場合は菱形頂点から出る）
 */
export const exitPt = (
  c: Point,
  o: Point,
  hw: number,
  hh: number,
  rh: number,
  shape?: 'diamond',
): Point => {
  const dx = o.x - c.x,
    dy = o.y - c.y

  if (shape === 'diamond') {
    if (Math.abs(dx) < 1 && dy > 0) return { x: c.x, y: c.y + DS }
    if (Math.abs(dx) < 1 && dy <= 0) return { x: c.x, y: c.y - DS }
    if (dx >= 0) return { x: c.x + DS, y: c.y }
    return { x: c.x - DS, y: c.y }
  }

  // 同位置
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return { x: c.x, y: c.y + hh }
  // 下方向: 下部から出る
  if (dy > rh * 0.3) return { x: c.x, y: c.y + hh }
  // 上方向: 横から出る（dx の符号で左右を決定）
  if (dy < -rh * 0.3) return { x: c.x + (dx >= 0 ? hw : -hw), y: c.y }
  // 水平方向
  if (Math.abs(dx) > 1) return { x: c.x + (dx > 0 ? hw : -hw), y: c.y }
  // フォールバック
  return { x: c.x, y: c.y + hh }
}

/**
 * ノード中心 c への矢印の入口点を計算する。
 * o は接続元のノード中心。
 * shape: オプションのノード形状（'diamond' の場合は菱形頂点に入る）
 */
export const entryPt = (
  c: Point,
  o: Point,
  hw: number,
  hh: number,
  rh: number,
  shape?: 'diamond',
): Point => {
  const dx = o.x - c.x,
    dy = o.y - c.y

  if (shape === 'diamond') {
    if (dy < -rh * 0.3) return { x: c.x, y: c.y - DS }
    if (dy > rh * 0.3) return { x: c.x, y: c.y + DS }
    if (dx > 0) return { x: c.x + DS, y: c.y }
    return { x: c.x - DS, y: c.y }
  }

  // 同位置
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return { x: c.x, y: c.y - hh }
  // 上方向から来る: 上部に接続
  if (dy < -rh * 0.3) return { x: c.x, y: c.y - hh }
  // 下方向から来る: 下部に接続
  if (dy > rh * 0.3) return { x: c.x, y: c.y + hh }
  // 水平方向
  if (Math.abs(dx) > 1) return { x: c.x + (dx > 0 ? hw : -hw), y: c.y }
  // フォールバック
  return { x: c.x, y: c.y - hh }
}

/**
 * 始点 s から終点 e への矢印パス(SVG path d属性)を生成する。
 * fc: 始点ノード中心, tc: 終点ノード中心（出口方向の判定に使用）
 *
 * 戻り値の mx, my はラベル配置用の中間点。
 */
export const buildArrowPath = (s: Point, e: Point, fc: Point, tc: Point): ArrowPath => {
  const dx = e.x - s.x,
    dy = e.y - s.y
  let d: string

  // 直線パス: ほぼ垂直またはほぼ水平
  if (Math.abs(dx) < 2 || Math.abs(dy) < 2) {
    d = `M${s.x},${s.y} L${e.x},${e.y}`
  } else {
    // 出口が縦方向かどうかを判定（ノード中心との差で判別）
    const sV = Math.abs(s.y - fc.y) > Math.abs(s.x - fc.x)
    const eV = Math.abs(e.y - tc.y) > Math.abs(e.x - tc.x)

    if (sV && eV) {
      // 両方縦出口: Z字パス（横方向に折り返す）
      const my = (s.y + e.y) / 2
      d = `M${s.x},${s.y} L${s.x},${my} L${e.x},${my} L${e.x},${e.y}`
    } else if (!sV && !eV) {
      // 両方横出口: Z字パス（縦方向に折り返す）
      const mx = (s.x + e.x) / 2
      d = `M${s.x},${s.y} L${mx},${s.y} L${mx},${e.y} L${e.x},${e.y}`
    } else if (sV) {
      // 縦出口→横入口: L字パス
      d = `M${s.x},${s.y} L${s.x},${e.y} L${e.x},${e.y}`
    } else {
      // 横出口→縦入口: L字パス
      d = `M${s.x},${s.y} L${e.x},${s.y} L${e.x},${e.y}`
    }
  }

  return { d, mx: (s.x + e.x) / 2, my: (s.y + e.y) / 2 }
}
