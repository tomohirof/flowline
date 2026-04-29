export interface Point {
  x: number
  y: number
}

export interface Bbox {
  x: number // 中心 X
  y: number // 中心 Y
  w: number // 幅
  h: number // 高さ
}

const DETOUR_MARGIN = 14
// 迂回パスの target 直前で水平切り返しを行う距離。
// 最終セグメントを水平にすることで矢印先端が target 側面に水平進入する。
// 値は DETOUR_MARGIN と同値だが意図が異なる（迂回 Y オフセット vs 水平進入 X オフセット）ため別定数とする。
const APPROACH_GAP = 14
// 迂回パスの始点直後で水平に出てから垂直に折れる距離。
// APPROACH_GAP と対称設計（同値）で、始点側もノード端から少し横に進んでから下降させる。
const DEPART_GAP = 14

function detectDetour(s: Point, e: Point, obstacles: Bbox[]): { detourY: number } | null {
  // 水平直線でなければ迂回しない
  if (Math.abs(e.y - s.y) >= 2) return null

  const xLow = Math.min(s.x, e.x)
  const xHigh = Math.max(s.x, e.x)
  const rowY = s.y

  // 水平移動がなければ迂回対象なし
  if (xLow >= xHigh - 1) return null

  // 経路上の障害ノード = 同一行（rowY と Y が重なる）かつ X が始終点の間
  const inRow = obstacles.filter(
    (b) =>
      Math.abs(b.y - rowY) < b.h / 2 + 2 && b.x - b.w / 2 < xHigh - 1 && b.x + b.w / 2 > xLow + 1,
  )
  if (inRow.length === 0) return null

  // 上下塞がり判定（X 重なりするノードが直上/直下に存在するか）
  // 前提: obstacles 配列には呼び出し側で「同一行＋直上行＋直下行のみ」をフィルタ済み
  // のノードが入っていること（collectObstacles ヘルパーがこれを保証する）。Y 距離の
  // 厳密チェックを省略しているのはこの前提のため。
  const xOverlap = (a: Bbox, b: Bbox) => Math.abs(a.x - b.x) < (a.w + b.w) / 2
  const downBlocked = inRow.some((obs) =>
    obstacles.some((b) => b.y > obs.y + 1 && xOverlap(obs, b)),
  )
  const upBlocked = inRow.some((obs) => obstacles.some((b) => b.y < obs.y - 1 && xOverlap(obs, b)))

  // 方向決定: 下空きなら下、下塞がり＆上空きなら上、両塞がりは下優先
  const goDown = !downBlocked || upBlocked

  // detourY: 障害ノード群の最下端 + マージン or 最上端 - マージン
  const detourY = goDown
    ? Math.max(...inRow.map((o) => o.y + o.h / 2)) + DETOUR_MARGIN
    : Math.min(...inRow.map((o) => o.y - o.h / 2)) - DETOUR_MARGIN

  return { detourY }
}

interface ArrowPath {
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
  // 下方向から来る: 横（左右端）に接続（exitPtの上方向と対称）
  if (dy > rh * 0.3) return { x: c.x + (dx >= 0 ? hw : -hw), y: c.y }
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
export const buildArrowPath = (
  s: Point,
  e: Point,
  fc: Point,
  tc: Point,
  obstacles?: Bbox[],
): ArrowPath => {
  const dx = e.x - s.x,
    dy = e.y - s.y

  // 迂回モード: 同一行で経路上に障害ノードがある場合
  if (obstacles && obstacles.length > 0) {
    const detour = detectDetour(s, e, obstacles)
    if (detour) {
      const { detourY } = detour
      // |e.x - s.x| / 2 で clamp。ノード幅が縮小しても departX/approachX が反対側を越えて
      // パスが自己交差するのを防ぐ防御コード（detectDetour で水平距離は保証されるが、レイアウト
      // 変更時の silent breakage 回避用）。DEPART_GAP/APPROACH_GAP が同値（対称設計）の場合、
      // clamp が効くと中央で接合する。
      const dx = e.x - s.x
      const sign = Math.sign(dx)
      const halfDx = Math.abs(dx) / 2
      const departX = s.x + sign * Math.min(DEPART_GAP, halfDx)
      const approachX = e.x - sign * Math.min(APPROACH_GAP, halfDx)
      // 6 セグメント: M → 水平(departX まで) → 垂直(detourY まで) → 水平(approachX まで)
      //               → 垂直(e.y まで) → 水平(e.x へ進入)
      const d = `M${s.x},${s.y} L${departX},${s.y} L${departX},${detourY} L${approachX},${detourY} L${approachX},${e.y} L${e.x},${e.y}`
      return { d, mx: (s.x + e.x) / 2, my: detourY }
    }
  }

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

export interface ObstacleNode {
  key: string
  cx: number // 中心 X
  cy: number // 中心 Y
}

interface CollectObstaclesArgs {
  nodes: ObstacleNode[]
  fromKey: string
  toKey: string
  fromCx: number
  toCx: number
  rowY: number
  rowH: number // 行高さ（直上/直下行判定用）
  bboxW: number // 全ノード共通の bbox 幅。呼び出し側の TW を渡す。
  bboxH: number // 全ノード共通の bbox 高さ。呼び出し側の TH を渡す。
}

/**
 * 矢印の同一行・直上行・直下行にあるノードを bbox 配列に変換する。
 * 同一行は from-to 間レーンに限定。直上/直下行は X 制限なしで含める（上下塞がり判定用）。
 * from/to 自身および 2 行以上離れたノードは除外する。
 *
 * 呼び出し側は同一行（fromRow === toRow）のときのみ本関数を呼ぶ想定。
 * rowY には fromNode の Y 座標を渡すこと。
 *
 * 注意: 固定グリッドレイアウトを前提に、dy が `bboxH/2 + 2` と `rowH - bboxH/2` の間
 * にあるノード（典型値 30〜56px）は意図的に除外される。これはレイアウトアニメーション中の
 * 中間状態などを obstacle 扱いしないための保守的な設計。
 */
export function collectObstacles(args: CollectObstaclesArgs): Bbox[] {
  const { nodes, fromKey, toKey, fromCx, toCx, rowY, rowH, bboxW, bboxH } = args
  const xLow = Math.min(fromCx, toCx)
  const xHigh = Math.max(fromCx, toCx)
  const result: Bbox[] = []
  for (const n of nodes) {
    if (n.key === fromKey || n.key === toKey) continue
    const dy = Math.abs(n.cy - rowY)
    const onRow = dy < bboxH / 2 + 2
    // 直上/直下行のみを採用（dy が rowH に近い）。2行以上離れたノードは除外。
    const onAdjacentRow = !onRow && dy > rowH - bboxH / 2 && dy < rowH + bboxH / 2
    if (onRow) {
      // 同一行: from-to 間レーンに限定（始終点 X は除外）
      if (n.cx > xLow + 1 && n.cx < xHigh - 1) {
        result.push({ x: n.cx, y: n.cy, w: bboxW, h: bboxH })
      }
    } else if (onAdjacentRow) {
      // 直上/直下行: 上下塞がり判定用に X 制限なしで含める
      result.push({ x: n.cx, y: n.cy, w: bboxW, h: bboxH })
    }
  }
  return result
}
