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

function detectVerticalDetour(s: Point, e: Point, obstacles: Bbox[]): { detourX: number } | null {
  // 垂直直線でなければ迂回しない
  if (Math.abs(e.x - s.x) >= 2) return null

  const yLow = Math.min(s.y, e.y)
  const yHigh = Math.max(s.y, e.y)
  // 注: 上向き同一レーン矢印では exitPt/entryPt がサイド出口（c.x ± hw）を返すため
  // s.x はレーン中心ではなく `lane center ± bboxW/2` になりうる。一方、collectVerticalObstacles
  // 側はレーン中心を colX に渡している。そのため同一レーンの障害ノード b.x との差は最大で
  // bboxW/2 となるが、下記の `< b.w/2 + 2` 判定が `bboxW/2 < bboxW/2 + 2` を保証するため
  // 同一列の障害は確実に検出される（マージン設計でカバー）。
  const colX = s.x

  // 垂直移動がなければ迂回対象なし
  if (yLow >= yHigh - 1) return null

  // 経路上の障害ノード = 同一列（colX と X が重なる）かつ Y が始終点の間
  const inCol = obstacles.filter(
    (b) =>
      Math.abs(b.x - colX) < b.w / 2 + 2 && b.y - b.h / 2 < yHigh - 1 && b.y + b.h / 2 > yLow + 1,
  )
  if (inCol.length === 0) return null

  // 左右塞がり判定（Y 重なりするノードが直左/直右に存在するか）
  // 前提: obstacles 配列には呼び出し側で「同一列＋直左列＋直右列のみ」をフィルタ済み
  const yOverlap = (a: Bbox, b: Bbox) => Math.abs(a.y - b.y) < (a.h + b.h) / 2
  const rightBlocked = inCol.some((obs) =>
    obstacles.some((b) => b.x > obs.x + 1 && yOverlap(obs, b)),
  )
  const leftBlocked = inCol.some((obs) =>
    obstacles.some((b) => b.x < obs.x - 1 && yOverlap(obs, b)),
  )

  // 方向決定: 右空きなら右、右塞がり＆左空きなら左、両塞がりは右優先
  const goRight = !rightBlocked || leftBlocked

  // detourX: 障害ノード群の最右端 + マージン or 最左端 - マージン
  const detourX = goRight
    ? Math.max(...inCol.map((o) => o.x + o.w / 2)) + DETOUR_MARGIN
    : Math.min(...inCol.map((o) => o.x - o.w / 2)) - DETOUR_MARGIN

  return { detourX }
}

type DiagonalDetourResult =
  | { kind: 'shift-my'; my: number }
  | { kind: 'target-detour'; my: number; detourX: number; approachY: number }
  | { kind: 'source-detour'; departY: number; detourX: number; my: number }
  | {
      kind: 'both-detour'
      departY: number
      sourceDetourX: number
      my: number
      targetDetourX: number
      approachY: number
    }

/**
 * 斜め配置矢印 (異行×異レーン) の Z字パス 3 セグメント (source 縦/中央水平/target 縦) と
 * 障害ノードの衝突を判定し、迂回パスを記述する DiagonalDetourResult を返す。
 * 障害なしまたは斜めでない (水平・垂直直線) ときは null を返す。
 *
 * 優先順位:
 *   sourceColHit && targetColHit → 'both-detour' (8 セグ)
 *   targetColHit                 → 'target-detour' (6 セグ、core ケース)
 *   sourceColHit                 → 'source-detour' (6 セグ、鏡像)
 *   middleRowHit のみ             → 'shift-my' (4 セグ維持)
 */
export function detectDiagonalDetour(
  s: Point,
  e: Point,
  obstacles: Bbox[],
): DiagonalDetourResult | null {
  if (Math.abs(e.x - s.x) < 2 || Math.abs(e.y - s.y) < 2) return null
  if (obstacles.length === 0) return null

  const my = (s.y + e.y) / 2

  // source 列衝突: source 縦セグメント (s.y → my) と重なる障害
  const sourceColHits = obstacles.filter((b) => {
    const yLow = Math.min(s.y, my)
    const yHigh = Math.max(s.y, my)
    return (
      Math.abs(b.x - s.x) < b.w / 2 + 2 &&
      b.y - b.h / 2 < yHigh - 1 &&
      b.y + b.h / 2 > yLow + 1
    )
  })

  // target 列衝突: target 縦セグメント (my → e.y) と重なる障害
  const targetColHits = obstacles.filter((b) => {
    const yLow = Math.min(my, e.y)
    const yHigh = Math.max(my, e.y)
    return (
      Math.abs(b.x - e.x) < b.w / 2 + 2 &&
      b.y - b.h / 2 < yHigh - 1 &&
      b.y + b.h / 2 > yLow + 1
    )
  })

  if (targetColHits.length > 0 && sourceColHits.length === 0) {
    // 方向決定: target 列障害の左右塞がり判定
    const yOverlap = (a: Bbox, b: Bbox) => Math.abs(a.y - b.y) < (a.h + b.h) / 2
    const rightBlocked = targetColHits.some((obs) =>
      obstacles.some((b) => b.x > obs.x + 1 && yOverlap(obs, b)),
    )
    const leftBlocked = targetColHits.some((obs) =>
      obstacles.some((b) => b.x < obs.x - 1 && yOverlap(obs, b)),
    )
    const goRight = !rightBlocked || leftBlocked
    const detourX = goRight
      ? Math.max(...targetColHits.map((o) => o.x + o.w / 2)) + DETOUR_MARGIN
      : Math.min(...targetColHits.map((o) => o.x - o.w / 2)) - DETOUR_MARGIN
    const sign = Math.sign(e.y - my)
    const halfDy = Math.abs(e.y - my) / 2
    const approachY = e.y - sign * Math.min(APPROACH_GAP, halfDy)
    return { kind: 'target-detour', my, detourX, approachY }
  }

  return null
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

  // 迂回モード: 同一行（水平直線）または同一レーン（垂直直線）で経路上に障害ノードがある場合
  if (obstacles && obstacles.length > 0) {
    const detour = detectDetour(s, e, obstacles)
    if (detour) {
      const { detourY } = detour
      // |e.x - s.x| / 2 で clamp。ノード幅が縮小しても departX/approachX が反対側を越えて
      // パスが自己交差するのを防ぐ防御コード（detectDetour で水平距離は保証されるが、レイアウト
      // 変更時の silent breakage 回避用）。DEPART_GAP/APPROACH_GAP が同値（対称設計）の場合、
      // clamp が効くと中央で接合する（縮退ケースでは中央水平セグメントがゼロ長になる）。
      const sign = Math.sign(dx)
      const halfDx = Math.abs(dx) / 2
      const departX = s.x + sign * Math.min(DEPART_GAP, halfDx)
      const approachX = e.x - sign * Math.min(APPROACH_GAP, halfDx)
      // 6 セグメント: M → 水平(departX まで) → 垂直(detourY まで) → 水平(approachX まで)
      //               → 垂直(e.y まで) → 水平(e.x へ進入)
      const d = `M${s.x},${s.y} L${departX},${s.y} L${departX},${detourY} L${approachX},${detourY} L${approachX},${e.y} L${e.x},${e.y}`
      return { d, mx: (s.x + e.x) / 2, my: detourY }
    }

    const vDetour = detectVerticalDetour(s, e, obstacles)
    if (vDetour) {
      const { detourX } = vDetour
      // |e.y - s.y| / 2 で clamp。横版（上方の detectDetour ブロック）と対称な防御コードで、
      // ノード高が縮小しても departY/approachY が反対側を越えて自己交差するのを防ぐ。
      // 縮退ケースでは中央垂直セグメントがゼロ長になる。
      const sign = Math.sign(dy)
      const halfDy = Math.abs(dy) / 2
      const departY = s.y + sign * Math.min(DEPART_GAP, halfDy)
      const approachY = e.y - sign * Math.min(APPROACH_GAP, halfDy)
      // 6 セグメント: M → 垂直(departY まで) → 水平(detourX まで) → 垂直(approachY まで)
      //               → 水平(e.x まで) → 垂直(e.y へ進入)
      const d = `M${s.x},${s.y} L${s.x},${departY} L${detourX},${departY} L${detourX},${approachY} L${e.x},${approachY} L${e.x},${e.y}`
      return { d, mx: detourX, my: (s.y + e.y) / 2 }
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

interface CollectVerticalObstaclesArgs {
  nodes: ObstacleNode[]
  fromKey: string
  toKey: string
  fromCy: number // 始点 Y
  toCy: number // 終点 Y
  colX: number // 同一列 X（始点・終点共通）
  colW: number // 列ピッチ（FlowEditor の LW + G を渡す）
  bboxW: number
  bboxH: number
}

/**
 * 矢印の同一列・直左列・直右列にあるノードを bbox 配列に変換する（縦版）。
 * 同一列は from-to 間レンジに限定。直左/直右列は Y 制限なしで含める（左右塞がり判定用）。
 * from/to 自身および 2 列以上離れたノードは除外する。
 *
 * 呼び出し側は同一レーン（fromLane === toLane）のときのみ本関数を呼ぶ想定。
 * colX には fromNode の X 座標を渡すこと（同一レーンなので toNode.x と等価）。
 *
 * collectObstacles の対称版。横版の rowH に相当するのが colW（レーンピッチ）。
 */
export function collectVerticalObstacles(args: CollectVerticalObstaclesArgs): Bbox[] {
  const { nodes, fromKey, toKey, fromCy, toCy, colX, colW, bboxW, bboxH } = args
  const yLow = Math.min(fromCy, toCy)
  const yHigh = Math.max(fromCy, toCy)
  const result: Bbox[] = []
  for (const n of nodes) {
    if (n.key === fromKey || n.key === toKey) continue
    const dx = Math.abs(n.cx - colX)
    const onCol = dx < bboxW / 2 + 2
    // 直左/直右列のみを採用（dx が colW に近い）。2列以上離れたノードは除外。
    const onAdjacentCol = !onCol && dx > colW - bboxW / 2 && dx < colW + bboxW / 2
    if (onCol) {
      // 同一列: from-to 間レンジに限定（始終点 Y は除外）
      if (n.cy > yLow + 1 && n.cy < yHigh - 1) {
        result.push({ x: n.cx, y: n.cy, w: bboxW, h: bboxH })
      }
    } else if (onAdjacentCol) {
      // 直左/直右列: 左右塞がり判定用に Y 制限なしで含める
      result.push({ x: n.cx, y: n.cy, w: bboxW, h: bboxH })
    }
  }
  return result
}

interface CollectDiagonalObstaclesArgs {
  nodes: ObstacleNode[]
  fromKey: string
  toKey: string
  fromCx: number
  fromCy: number
  toCx: number
  toCy: number
  rowH: number
  colW: number
  bboxW: number
  bboxH: number
}

/**
 * 斜め配置矢印 (異行×異レーン) の Z字パスに沿った障害ノードを bbox 配列で返す。
 * source 列・target 列・中央行・各列の隣接列を広めに収集し、detector 側で再フィルタする。
 * from/to 自身と Z字パスから離れたノードは除外する。
 */
export function collectDiagonalObstacles(args: CollectDiagonalObstaclesArgs): Bbox[] {
  const { nodes, fromKey, toKey, fromCx, fromCy, toCx, toCy, rowH, colW, bboxW, bboxH } = args
  const yLow = Math.min(fromCy, toCy)
  const yHigh = Math.max(fromCy, toCy)
  const result: Bbox[] = []
  for (const n of nodes) {
    if (n.key === fromKey || n.key === toKey) continue
    const onSourceCol = Math.abs(n.cx - fromCx) < bboxW / 2 + 2
    const onTargetCol = Math.abs(n.cx - toCx) < bboxW / 2 + 2
    const inZRangeY = n.cy > yLow + 1 && n.cy < yHigh - 1
    if ((onSourceCol || onTargetCol) && inZRangeY) {
      result.push({ x: n.cx, y: n.cy, w: bboxW, h: bboxH })
      continue
    }
    const midY = (fromCy + toCy) / 2
    const onMiddleRow = Math.abs(n.cy - midY) < bboxH / 2 + 2
    const xLow = Math.min(fromCx, toCx)
    const xHigh = Math.max(fromCx, toCx)
    const inZRangeX = n.cx > xLow + 1 && n.cx < xHigh - 1
    if (onMiddleRow && inZRangeX) {
      result.push({ x: n.cx, y: n.cy, w: bboxW, h: bboxH })
      continue
    }
    // 隣接列は同一列を除外 (colW <= bboxW の縮退ケース防御。
    // collectObstacles / collectVerticalObstacles と同じ防御パターン)
    const onSourceAdjacentCol =
      !onSourceCol &&
      Math.abs(n.cx - fromCx) > colW - bboxW / 2 &&
      Math.abs(n.cx - fromCx) < colW + bboxW / 2
    const onTargetAdjacentCol =
      !onTargetCol &&
      Math.abs(n.cx - toCx) > colW - bboxW / 2 &&
      Math.abs(n.cx - toCx) < colW + bboxW / 2
    const inExtendedY = n.cy >= yLow - rowH / 2 && n.cy <= yHigh + rowH / 2
    if ((onSourceAdjacentCol || onTargetAdjacentCol) && inExtendedY) {
      result.push({ x: n.cx, y: n.cy, w: bboxW, h: bboxH })
    }
  }
  return result
}
