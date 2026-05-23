import type { ArrowSide } from './types'

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

export interface EdgeSegment {
  orientation: 'h' | 'v'
  fixed: number
  /** [start, end]: 進行方向に沿った座標。start > end も許容される */
  range: [number, number]
}

const DETOUR_MARGIN = 14
// 迂回パスの target 直前で水平切り返しを行う距離。
// 最終セグメントを水平にすることで矢印先端が target 側面に水平進入する。
// 値は DETOUR_MARGIN と同値だが意図が異なる（迂回 Y オフセット vs 水平進入 X オフセット）ため別定数とする。
const APPROACH_GAP = 14
// 迂回パスの始点直後で水平に出てから垂直に折れる距離。
// APPROACH_GAP と対称設計（同値）で、始点側もノード端から少し横に進んでから下降させる。
const DEPART_GAP = 14

// Bbox 同士の X 軸重なり判定 (中心間距離が半径合計より小)
const xOverlap = (a: Bbox, b: Bbox): boolean => Math.abs(a.x - b.x) < (a.w + b.w) / 2
// Bbox 同士の Y 軸重なり判定 (中心間距離が半径合計より小)
const yOverlap = (a: Bbox, b: Bbox): boolean => Math.abs(a.y - b.y) < (a.h + b.h) / 2

// エッジセグメント由来の薄い線分 Bbox かどうか判定する。
// `segmentsToBboxes` は水平セグメントを `h=1`、垂直セグメントを `w=1` で生成するため
// `h < 3 || w < 3` で識別できる。塞がり判定（up/down/left/right blocked）でこの種の
// 線分を除外する用途で使う。経路上の障害物判定（inRow/inCol）には引き続き使う。
const isThinSegment = (b: Bbox): boolean => b.h < 3 || b.w < 3

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
  // 注: routeAllArrows がエッジセグメント由来の薄い Bbox を obstacles に追加する場合がある。
  // それら（h<3 または w<3）は別行を遠くで通っていても xOverlap で誤って塞がり判定を
  // 引き起こすため、塞がり判定からは除外する（経路上の障害物判定 inRow には残す）。
  const downBlocked = inRow.some((obs) =>
    obstacles.some((b) => !isThinSegment(b) && b.y > obs.y + 1 && xOverlap(obs, b)),
  )
  const upBlocked = inRow.some((obs) =>
    obstacles.some((b) => !isThinSegment(b) && b.y < obs.y - 1 && xOverlap(obs, b)),
  )

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
  // 注: routeAllArrows がエッジセグメント由来の薄い Bbox を obstacles に追加する場合がある。
  // それら（h<3 または w<3）は別列を遠くで通っていても yOverlap で誤って塞がり判定を
  // 引き起こすため、塞がり判定からは除外する（経路上の障害物判定 inCol には残す）。
  const rightBlocked = inCol.some((obs) =>
    obstacles.some((b) => !isThinSegment(b) && b.x > obs.x + 1 && yOverlap(obs, b)),
  )
  const leftBlocked = inCol.some((obs) =>
    obstacles.some((b) => !isThinSegment(b) && b.x < obs.x - 1 && yOverlap(obs, b)),
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
 * 右優先で迂回 X を決定する。hits 中のいずれかが Y 重なりするブロッカーを直右に持てば右塞がり、
 * 直左に持てば左塞がり。両塞がりなら右優先 (#333 と整合)。
 *
 * blockers は方向判定対象のブロッカー候補。target/source 列同士の相互ブロッキングを防ぐ
 * ため、both-detour では呼び出し側が反対側列の hits を除外した blockers を渡す。
 */
function pickDetourX(hits: Bbox[], blockers: Bbox[]): number {
  // 薄い線分 (エッジセグメント由来 Bbox) は方向判定から除外。
  // detectDetour / detectVerticalDetour と同じ理由 (yOverlap 誤判定を防ぐ)。
  const rightBlocked = hits.some((obs) =>
    blockers.some((b) => !isThinSegment(b) && b.x > obs.x + 1 && yOverlap(obs, b)),
  )
  const leftBlocked = hits.some((obs) =>
    blockers.some((b) => !isThinSegment(b) && b.x < obs.x - 1 && yOverlap(obs, b)),
  )
  const goRight = !rightBlocked || leftBlocked
  return goRight
    ? Math.max(...hits.map((o) => o.x + o.w / 2)) + DETOUR_MARGIN
    : Math.min(...hits.map((o) => o.x - o.w / 2)) - DETOUR_MARGIN
}

/**
 * 始点 from から終点 to に向けて gap 分だけオフセットした値を返す。
 * 自己交差防止のため |to - from| / 2 で clamp。depart Y / approach Y / X の計算で共通化。
 */
function clampOffset(from: number, to: number, gap: number): number {
  const sign = Math.sign(to - from)
  const halfDist = Math.abs(to - from) / 2
  return from + sign * Math.min(gap, halfDist)
}

/**
 * 中央水平セグメント (y=my) に重なる middleRowHits があれば my をシフトした値を返す。
 * シフトは「下塞がりかどうか」で方向を決め、障害の下/上 + DETOUR_MARGIN に配置する。
 * シフト後の値が [s.y, e.y] 範囲を逸脱する場合は原 my を返す (range-check 失敗時のフォールバック)。
 *
 * source-detour / target-detour / both-detour の各 kind で共通利用する。
 */
function computeShiftedMy(
  s: Point,
  e: Point,
  my: number,
  middleRowHits: Bbox[],
  obstacles: Bbox[],
): number {
  if (middleRowHits.length === 0) return my

  // 上下塞がり判定は中央行と source/target 行の間にある障害だけを対象にする。
  // source/target 行 (s.y / e.y) に位置する障害は矢印の端点付近で吸収されるため、
  // 中央水平の Y シフト方向には影響しない。
  const yLow = Math.min(s.y, e.y)
  const yHigh = Math.max(s.y, e.y)
  const inBetween = (b: Bbox) => b.y > yLow + b.h / 2 + 1 && b.y < yHigh - b.h / 2 - 1
  // 薄い線分 (エッジセグメント由来 Bbox) は塞がり判定から除外。
  // detectDetour / detectVerticalDetour と同じ理由 (xOverlap 誤判定を防ぐ)。
  const downBlocked = middleRowHits.some((obs) =>
    obstacles.some((b) => !isThinSegment(b) && b.y > obs.y + 1 && inBetween(b) && xOverlap(obs, b)),
  )
  const upBlocked = middleRowHits.some((obs) =>
    obstacles.some((b) => !isThinSegment(b) && b.y < obs.y - 1 && inBetween(b) && xOverlap(obs, b)),
  )
  const goDown = !downBlocked || upBlocked
  const shiftedMy = goDown
    ? Math.max(...middleRowHits.map((o) => o.y + o.h / 2)) + DETOUR_MARGIN
    : Math.min(...middleRowHits.map((o) => o.y - o.h / 2)) - DETOUR_MARGIN

  // range-check: source 行 / target 行を侵食しないこと
  // 複数障害の高さが異なる場合に保守的な (最も厳しい) 余白を取るため max を使う。
  const bboxHMax = Math.max(...middleRowHits.map((o) => o.h))
  const lo = yLow + bboxHMax / 2 + 1
  const hi = yHigh - bboxHMax / 2 - 1
  // 範囲外 → 元の my を返す。
  // 注意: 呼び出し元が source/target/both-detour を選択しており column detour が
  // 既に発生する場合、この経路では middleRowHits の障害は回避されない。これは
  // shift-my の単独経路 (L270+) のような escalation 機構を持たないためで、
  // 行間が狭い稀なケースで残存しうる既知の制約。
  if (shiftedMy >= lo && shiftedMy <= hi) return shiftedMy
  return my
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
      Math.abs(b.x - s.x) < b.w / 2 + 2 && b.y - b.h / 2 < yHigh - 1 && b.y + b.h / 2 > yLow + 1
    )
  })

  // target 列衝突: target 縦セグメント (my → e.y) と重なる障害
  const targetColHits = obstacles.filter((b) => {
    const yLow = Math.min(my, e.y)
    const yHigh = Math.max(my, e.y)
    return (
      Math.abs(b.x - e.x) < b.w / 2 + 2 && b.y - b.h / 2 < yHigh - 1 && b.y + b.h / 2 > yLow + 1
    )
  })

  // 中央水平セグメント衝突: Y ≈ my で X が source-target 間 (早期計算で全 kind 分岐に提供)
  // source/target 列の hit は対応する column detour で既に回避済みのため除外し、
  // 純粋に中央水平セグメント上のみに存在する障害だけを評価対象にする。
  const sourceColSet = new Set(sourceColHits)
  const targetColSet = new Set(targetColHits)
  const middleRowHits = obstacles.filter((b) => {
    if (sourceColSet.has(b) || targetColSet.has(b)) return false
    const xLow = Math.min(s.x, e.x)
    const xHigh = Math.max(s.x, e.x)
    return Math.abs(b.y - my) < b.h / 2 + 2 && b.x - b.w / 2 < xHigh - 1 && b.x + b.w / 2 > xLow + 1
  })

  if (sourceColHits.length > 0 && targetColHits.length > 0) {
    // 相互ブロッキング回避: 反対側列の hits は方向判定から除外。対応する迂回パスで既に回避済み。
    const targetIds = new Set(targetColHits)
    const sourceIds = new Set(sourceColHits)
    const srcBlockers = obstacles.filter((b) => !targetIds.has(b))
    const tgtBlockers = obstacles.filter((b) => !sourceIds.has(b))
    const sourceDetourX = pickDetourX(sourceColHits, srcBlockers)
    const targetDetourX = pickDetourX(targetColHits, tgtBlockers)
    const shiftedMy = computeShiftedMy(s, e, my, middleRowHits, obstacles)
    const departY = clampOffset(s.y, shiftedMy, DEPART_GAP)
    const approachY = clampOffset(e.y, shiftedMy, APPROACH_GAP)
    return { kind: 'both-detour', departY, sourceDetourX, my: shiftedMy, targetDetourX, approachY }
  }

  if (targetColHits.length > 0 && sourceColHits.length === 0) {
    const detourX = pickDetourX(targetColHits, obstacles)
    const shiftedMy = computeShiftedMy(s, e, my, middleRowHits, obstacles)
    const approachY = clampOffset(e.y, shiftedMy, APPROACH_GAP)
    return { kind: 'target-detour', my: shiftedMy, detourX, approachY }
  }

  if (sourceColHits.length > 0 && targetColHits.length === 0) {
    const detourX = pickDetourX(sourceColHits, obstacles)
    const shiftedMy = computeShiftedMy(s, e, my, middleRowHits, obstacles)
    const departY = clampOffset(s.y, shiftedMy, DEPART_GAP)
    return { kind: 'source-detour', departY, detourX, my: shiftedMy }
  }

  // 到達条件: sourceColHits / targetColHits は共に空 (上方の if ブロックが早期 return している)
  if (middleRowHits.length > 0) {
    // 薄い線分 (エッジセグメント由来 Bbox) は方向判定から除外。
    // detectDetour / detectVerticalDetour と同じ理由 (xOverlap 誤判定を防ぐ)。
    const downBlocked = middleRowHits.some((obs) =>
      obstacles.some((b) => !isThinSegment(b) && b.y > obs.y + 1 && xOverlap(obs, b)),
    )
    const upBlocked = middleRowHits.some((obs) =>
      obstacles.some((b) => !isThinSegment(b) && b.y < obs.y - 1 && xOverlap(obs, b)),
    )
    const goDown = !downBlocked || upBlocked
    const shiftedMy = goDown
      ? Math.max(...middleRowHits.map((o) => o.y + o.h / 2)) + DETOUR_MARGIN
      : Math.min(...middleRowHits.map((o) => o.y - o.h / 2)) - DETOUR_MARGIN

    // ガード: shiftedMy が source 行 / target 行を侵食しないこと
    // 複数障害の高さが異なる場合に保守的な (最も厳しい) 余白を取るため max を使う。
    const yLow = Math.min(s.y, e.y)
    const yHigh = Math.max(s.y, e.y)
    const bboxHMax = Math.max(...middleRowHits.map((o) => o.h))
    const lo = yLow + bboxHMax / 2 + 1
    const hi = yHigh - bboxHMax / 2 - 1
    if (shiftedMy >= lo && shiftedMy <= hi) {
      return { kind: 'shift-my', my: shiftedMy }
    }
    // 範囲外 → 中央水平セグメントが中間行障害を避けるよう kind を決める。
    //
    // target-detour の中央水平は [s.x, detourX]、source-detour は [detourX, e.x]。
    // detourX は障害の左右どちらかに DETOUR_MARGIN 取られているため、s.x と e.x の
    // どちらが detourX と同じ側にあるかで衝突しない kind が決まる。
    // 左→右 (s.x < e.x) でも右→左 (s.x > e.x) でも幾何学的に正しく判定できる (#359)。
    const detourX = pickDetourX(middleRowHits, obstacles)
    const obsRight = Math.max(...middleRowHits.map((o) => o.x + o.w / 2))
    const obsLeft = Math.min(...middleRowHits.map((o) => o.x - o.w / 2))
    // source-detour 中央水平 = [min(detourX, e.x), max(detourX, e.x)]
    // 障害区間 [obsLeft, obsRight] と重ならなければ source-detour が安全
    const sourceLow = Math.min(detourX, e.x)
    const sourceHigh = Math.max(detourX, e.x)
    const sourceDetourClear = sourceLow >= obsRight || sourceHigh <= obsLeft
    if (sourceDetourClear) {
      const departY = clampOffset(s.y, my, DEPART_GAP)
      return { kind: 'source-detour', departY, detourX, my }
    }
    // source-detour が衝突する場合は target-detour 中央水平 [s.x, detourX] が片側に収まる
    const approachY = clampOffset(e.y, my, APPROACH_GAP)
    return { kind: 'target-detour', my, detourX, approachY }
  }

  return null
}

interface ArrowPath {
  d: string
  mx: number
  my: number
  segments: EdgeSegment[]
}

/** Diamond shape half-diagonal (vertex distance from center) */
export const DS = 34

/**
 * ドラッグ起点座標 (origin) とノード中心 (center) の位置関係から
 * どの side （頂点/辺）から線を出すかを判定する。
 *
 * |dx| > |dy| → 水平軸（left/right）、それ以外 → 垂直軸（top/bottom）。
 * dx=dy=0 のエッジケースは 'bottom' に決定的にフォールバックする。
 */
export const deriveFromSide = (
  origin: { x: number; y: number },
  center: { x: number; y: number },
): ArrowSide => {
  const dx = origin.x - center.x
  const dy = origin.y - center.y
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left'
  return dy >= 0 ? 'bottom' : 'top'
}

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
  fromSide?: ArrowSide,
): Point => {
  const dx = o.x - c.x,
    dy = o.y - c.y

  if (shape === 'diamond') {
    if (fromSide === 'top') return { x: c.x, y: c.y - DS }
    if (fromSide === 'right') return { x: c.x + DS, y: c.y }
    if (fromSide === 'bottom') return { x: c.x, y: c.y + DS }
    if (fromSide === 'left') return { x: c.x - DS, y: c.y }
    if (Math.abs(dx) < 1 && dy > 0) return { x: c.x, y: c.y + DS }
    if (Math.abs(dx) < 1 && dy <= 0) return { x: c.x, y: c.y - DS }
    if (dx >= 0) return { x: c.x + DS, y: c.y }
    return { x: c.x - DS, y: c.y }
  }

  // 四角形でも fromSide があれば優先（#355）
  if (fromSide === 'top') return { x: c.x, y: c.y - hh }
  if (fromSide === 'right') return { x: c.x + hw, y: c.y }
  if (fromSide === 'bottom') return { x: c.x, y: c.y + hh }
  if (fromSide === 'left') return { x: c.x - hw, y: c.y }

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
  toSide?: ArrowSide,
): Point => {
  const dx = o.x - c.x,
    dy = o.y - c.y

  if (shape === 'diamond') {
    if (toSide === 'top') return { x: c.x, y: c.y - DS }
    if (toSide === 'right') return { x: c.x + DS, y: c.y }
    if (toSide === 'bottom') return { x: c.x, y: c.y + DS }
    if (toSide === 'left') return { x: c.x - DS, y: c.y }
    if (dy < -rh * 0.3) return { x: c.x, y: c.y - DS }
    if (dy > rh * 0.3) return { x: c.x, y: c.y + DS }
    if (dx > 0) return { x: c.x + DS, y: c.y }
    return { x: c.x - DS, y: c.y }
  }

  // 四角形でも toSide があれば優先（#355）
  if (toSide === 'top') return { x: c.x, y: c.y - hh }
  if (toSide === 'right') return { x: c.x + hw, y: c.y }
  if (toSide === 'bottom') return { x: c.x, y: c.y + hh }
  if (toSide === 'left') return { x: c.x - hw, y: c.y }

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

/** ドロップ点とターゲットノード中心から接続先 side を判定する。
 *  deriveFromSide と同一ロジック（dx/dy の符号と絶対値比較）。 */
export const deriveToSide = deriveFromSide

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
      const segments: EdgeSegment[] = [
        { orientation: 'h', fixed: s.y, range: [s.x, departX] },         // s.x → departX
        { orientation: 'v', fixed: departX, range: [s.y, detourY] },      // s.y → detourY
        { orientation: 'h', fixed: detourY, range: [departX, approachX] }, // departX → approachX
        { orientation: 'v', fixed: approachX, range: [detourY, e.y] },    // detourY → e.y
        { orientation: 'h', fixed: e.y, range: [approachX, e.x] },        // approachX → e.x
      ]
      return { d: segmentsToD(segments), mx: (s.x + e.x) / 2, my: detourY, segments }
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
      const segments: EdgeSegment[] = [
        { orientation: 'v', fixed: s.x, range: [s.y, departY] },          // s.y → departY
        { orientation: 'h', fixed: departY, range: [s.x, detourX] },       // s.x → detourX
        { orientation: 'v', fixed: detourX, range: [departY, approachY] }, // departY → approachY
        { orientation: 'h', fixed: approachY, range: [detourX, e.x] },     // detourX → e.x
        { orientation: 'v', fixed: e.x, range: [approachY, e.y] },         // approachY → e.y
      ]
      return { d: segmentsToD(segments), mx: detourX, my: (s.y + e.y) / 2, segments }
    }

    const dDetour = detectDiagonalDetour(s, e, obstacles)
    if (dDetour) {
      switch (dDetour.kind) {
        case 'target-detour': {
          const { my, detourX, approachY } = dDetour
          const segments: EdgeSegment[] = [
            { orientation: 'v', fixed: s.x, range: [s.y, my] },           // s.y → my
            { orientation: 'h', fixed: my, range: [s.x, detourX] },        // s.x → detourX
            { orientation: 'v', fixed: detourX, range: [my, approachY] },  // my → approachY
            { orientation: 'h', fixed: approachY, range: [detourX, e.x] }, // detourX → e.x
            { orientation: 'v', fixed: e.x, range: [approachY, e.y] },     // approachY → e.y
          ]
          return { d: segmentsToD(segments), mx: (s.x + detourX) / 2, my, segments }
        }
        case 'source-detour': {
          const { departY, detourX, my } = dDetour
          const segments: EdgeSegment[] = [
            { orientation: 'v', fixed: s.x, range: [s.y, departY] },       // s.y → departY
            { orientation: 'h', fixed: departY, range: [s.x, detourX] },   // s.x → detourX
            { orientation: 'v', fixed: detourX, range: [departY, my] },     // departY → my
            { orientation: 'h', fixed: my, range: [detourX, e.x] },         // detourX → e.x
            { orientation: 'v', fixed: e.x, range: [my, e.y] },             // my → e.y
          ]
          return { d: segmentsToD(segments), mx: (detourX + e.x) / 2, my, segments }
        }
        case 'both-detour': {
          const { departY, sourceDetourX, my, targetDetourX, approachY } = dDetour
          const segments: EdgeSegment[] = [
            { orientation: 'v', fixed: s.x, range: [s.y, departY] },                          // s.y → departY
            { orientation: 'h', fixed: departY, range: [s.x, sourceDetourX] },                // s.x → sourceDetourX
            { orientation: 'v', fixed: sourceDetourX, range: [departY, my] },                 // departY → my
            { orientation: 'h', fixed: my, range: [sourceDetourX, targetDetourX] },           // sourceDetourX → targetDetourX
            { orientation: 'v', fixed: targetDetourX, range: [my, approachY] },               // my → approachY
            { orientation: 'h', fixed: approachY, range: [targetDetourX, e.x] },              // targetDetourX → e.x
            { orientation: 'v', fixed: e.x, range: [approachY, e.y] },                        // approachY → e.y
          ]
          return { d: segmentsToD(segments), mx: (sourceDetourX + targetDetourX) / 2, my, segments }
        }
        case 'shift-my': {
          const { my } = dDetour
          const segments: EdgeSegment[] = [
            { orientation: 'v', fixed: s.x, range: [s.y, my] },   // s.y → my
            { orientation: 'h', fixed: my, range: [s.x, e.x] },    // s.x → e.x
            { orientation: 'v', fixed: e.x, range: [my, e.y] },    // my → e.y
          ]
          return { d: segmentsToD(segments), mx: (s.x + e.x) / 2, my, segments }
        }
        default: {
          const _exhaustive: never = dDetour
          throw new Error(
            `Unhandled DiagonalDetourResult kind: ${(_exhaustive as { kind: string }).kind}`,
          )
        }
      }
    }
  }

  let mx: number
  let my: number
  let segments: EdgeSegment[] = []

  // 直線パス: ほぼ垂直またはほぼ水平
  if (Math.abs(dx) < 2 || Math.abs(dy) < 2) {
    mx = (s.x + e.x) / 2
    my = (s.y + e.y) / 2
    if (Math.abs(dx) < 2) {
      // 垂直直線
      segments = [{ orientation: 'v', fixed: s.x, range: [s.y, e.y] }]  // s.y → e.y
    } else {
      // 水平直線
      segments = [{ orientation: 'h', fixed: s.y, range: [s.x, e.x] }]  // s.x → e.x
    }
  } else {
    // 出口が縦方向かどうかを判定（ノード中心との差で判別）
    const sV = Math.abs(s.y - fc.y) > Math.abs(s.x - fc.x)
    const eV = Math.abs(e.y - tc.y) > Math.abs(e.x - tc.x)

    if (sV && eV) {
      // 両方縦出口: Z字パス（横方向に折り返す）→ ラベルは中央水平セグメント上
      const cmy = (s.y + e.y) / 2
      mx = (s.x + e.x) / 2
      my = cmy
      segments = [
        { orientation: 'v', fixed: s.x, range: [s.y, cmy] },   // s.y → cmy
        { orientation: 'h', fixed: cmy, range: [s.x, e.x] },    // s.x → e.x
        { orientation: 'v', fixed: e.x, range: [cmy, e.y] },    // cmy → e.y
      ]
    } else if (!sV && !eV) {
      // 両方横出口: Z字パス（縦方向に折り返す）→ ラベルは中央垂直セグメント上
      const cmx = (s.x + e.x) / 2
      mx = cmx
      my = (s.y + e.y) / 2
      segments = [
        { orientation: 'h', fixed: s.y, range: [s.x, cmx] },   // s.x → cmx
        { orientation: 'v', fixed: cmx, range: [s.y, e.y] },    // s.y → e.y
        { orientation: 'h', fixed: e.y, range: [cmx, e.x] },    // cmx → e.x
      ]
    } else if (sV) {
      // 縦出口→横入口: L字パス → ラベルは長辺の中点
      segments = [
        { orientation: 'v', fixed: s.x, range: [s.y, e.y] },   // s.y → e.y
        { orientation: 'h', fixed: e.y, range: [s.x, e.x] },    // s.x → e.x
      ]
      if (Math.abs(e.y - s.y) >= Math.abs(e.x - s.x)) {
        // 縦辺が長い（または等長）: 縦辺の中点
        mx = s.x
        my = (s.y + e.y) / 2
      } else {
        // 横辺が長い: 横辺の中点
        mx = (s.x + e.x) / 2
        my = e.y
      }
    } else {
      // 横出口→縦入口: L字パス → ラベルは長辺の中点
      segments = [
        { orientation: 'h', fixed: s.y, range: [s.x, e.x] },   // s.x → e.x
        { orientation: 'v', fixed: e.x, range: [s.y, e.y] },    // s.y → e.y
      ]
      if (Math.abs(e.x - s.x) >= Math.abs(e.y - s.y)) {
        // 横辺が長い（または等長）: 横辺の中点
        mx = (s.x + e.x) / 2
        my = s.y
      } else {
        // 縦辺が長い: 縦辺の中点
        mx = e.x
        my = (s.y + e.y) / 2
      }
    }
  }

  return { d: segmentsToD(segments), mx, my, segments }
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

interface BuildObstaclesArgs {
  nodes: ObstacleNode[]
  fromKey: string
  toKey: string
  fromCx: number
  fromCy: number
  toCx: number
  toCy: number
  sameRow: boolean
  sameLane: boolean
  rowH: number
  colW: number
  bboxW: number
  bboxH: number
}

/**
 * 矢印の幾何状態 (同一行 / 同一レーン / 斜め配置) に応じて obstacles を組み立てる。
 * FlowEditor / SharedFlowViewer の重複を吸収。返り値は detectDetour / detectVerticalDetour /
 * detectDiagonalDetour にそのまま渡せる Bbox 配列。
 */
export function buildObstacles(args: BuildObstaclesArgs): Bbox[] {
  const {
    nodes,
    fromKey,
    toKey,
    fromCx,
    fromCy,
    toCx,
    toCy,
    sameRow,
    sameLane,
    rowH,
    colW,
    bboxW,
    bboxH,
  } = args
  if (sameRow) {
    return collectObstacles({
      nodes,
      fromKey,
      toKey,
      fromCx,
      toCx,
      rowY: fromCy,
      rowH,
      bboxW,
      bboxH,
    })
  }
  if (sameLane) {
    return collectVerticalObstacles({
      nodes,
      fromKey,
      toKey,
      fromCy,
      toCy,
      colX: fromCx,
      colW,
      bboxW,
      bboxH,
    })
  }
  return collectDiagonalObstacles({
    nodes,
    fromKey,
    toKey,
    fromCx,
    fromCy,
    toCx,
    toCy,
    rowH,
    colW,
    bboxW,
    bboxH,
  })
}

/**
 * EdgeSegment[] を「線分を表す薄い Bbox」配列に変換する。
 * マルチエッジ協調ルーティングで、既存エッジの線分を後続エッジの障害物として
 * detectDetour 系に渡すための変換ヘルパー。
 *
 * - 水平セグメント: 中央点 ((r0+r1)/2, fixed)、幅=range の長さ、高さ=1
 * - 垂直セグメント: 中央点 (fixed, (r0+r1)/2)、幅=1、高さ=range の長さ
 * - range[0] > range[1] でも絶対値で長さを取り、min/max を中央計算に使う
 *
 * 退化ケース（zero-length）: range[0] === range[1] の場合、平行軸方向の長さは 0 となる。
 * これは「点状の線分」を意味し、直交軸方向のみ厚さ 1 を保つ。
 * 水平セグメントなら `{w:0, h:1}`、垂直なら `{w:1, h:0}`。
 * 長さを 1 に水増ししない（実態に忠実に degenerate を表現する）方針。
 */
export const JUMP_RADIUS = 5
/** ジャンパーアーク半径にマージンを加えた交差検出用の余裕幅。detectCrossings（Task C1）で使用予定。 */
export const CROSSING_MARGIN = JUMP_RADIUS + 2

/**
 * EdgeSegment[] と各セグメントのジャンパー位置から SVG path d 属性を生成する。
 * jumpsPerSegment は segment index → 跨ぎ位置（H セグメントなら x 座標）の配列。
 * V セグメントには跨ぎが入らない（規約上）。
 *
 * 注: jumps なしモード（jumpsPerSegment 省略）は段階4 実装前でも使える。
 * range は進行方向順 [start, end] を前提とする（start > end も許容）。
 */
export function segmentsToD(
  segments: EdgeSegment[],
  jumpsPerSegment?: Map<number, number[]>,
): string {
  if (segments.length === 0) return ''
  const first = segments[0]
  const startX = first.orientation === 'h' ? first.range[0] : first.fixed
  const startY = first.orientation === 'v' ? first.range[0] : first.fixed
  let d = `M${startX},${startY}`
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const endX = seg.orientation === 'h' ? seg.range[1] : seg.fixed
    const endY = seg.orientation === 'v' ? seg.range[1] : seg.fixed
    const jumps = jumpsPerSegment?.get(i)
    if (seg.orientation === 'h' && jumps && jumps.length > 0) {
      const goingRight = seg.range[0] < seg.range[1]
      // 進行方向順に跨ぎ点を並べる（始点→終点へ）
      const sorted = [...jumps].sort((a, b) => (goingRight ? a - b : b - a))
      // sweep: 進行方向に応じた弧の向き。常に「上膨らみ」になる組み合わせ（右進行=1, 左進行=0）
      const sweep = goingRight ? 1 : 0
      const r = JUMP_RADIUS
      for (const jx of sorted) {
        const beforeX = goingRight ? jx - r : jx + r
        const afterX = goingRight ? jx + r : jx - r
        d += ` L${beforeX},${seg.fixed} A${r},${r} 0 0 ${sweep} ${afterX},${seg.fixed}`
      }
    }
    d += ` L${endX},${endY}`
  }
  return d
}

export interface EdgeWithSegments {
  id: string
  segments: EdgeSegment[]
}

export interface Crossing {
  x: number
  y: number
  jumperEdgeId: string         // 跨ぐ側（H セグメントを持つエッジ）
  jumperSegmentIndex: number   // そのエッジの何番目の segment か
}

/**
 * 全エッジ間の H × V 交差を列挙する。
 * 規約: 水平セグメントが垂直セグメントを跨ぐ（H が jumper）。
 * 同一エッジ内の交差は無視（自己ループ防止）。
 *
 * ループ順序 (i, j, si 昇順) と push 順序が決定論性の根拠。
 */
export function detectCrossings(edges: EdgeWithSegments[]): Crossing[] {
  const out: Crossing[] = []
  for (let i = 0; i < edges.length; i++) {
    for (let j = 0; j < edges.length; j++) {
      if (i === j) continue
      for (let si = 0; si < edges[i].segments.length; si++) {
        const segH = edges[i].segments[si]
        if (segH.orientation !== 'h') continue
        for (const segV of edges[j].segments) {
          if (segV.orientation !== 'v') continue
          const hLow = Math.min(segH.range[0], segH.range[1])
          const hHigh = Math.max(segH.range[0], segH.range[1])
          const vLow = Math.min(segV.range[0], segV.range[1])
          const vHigh = Math.max(segV.range[0], segV.range[1])
          if (
            hLow + CROSSING_MARGIN < segV.fixed && segV.fixed < hHigh - CROSSING_MARGIN &&
            vLow + CROSSING_MARGIN < segH.fixed && segH.fixed < vHigh - CROSSING_MARGIN
          ) {
            out.push({
              x: segV.fixed,
              y: segH.fixed,
              jumperEdgeId: edges[i].id,
              jumperSegmentIndex: si,
            })
          }
        }
      }
    }
  }
  return out
}

export function segmentsToBboxes(segments: EdgeSegment[]): Bbox[] {
  return segments.map((s) => {
    const r0 = Math.min(s.range[0], s.range[1])
    const r1 = Math.max(s.range[0], s.range[1])
    // 退化ケース（r0 === r1）では len=0。長さを偽装せず degenerate を保つ。
    const len = Math.max(r1 - r0, 0)
    return s.orientation === 'h'
      ? { x: (r0 + r1) / 2, y: s.fixed, w: len, h: 1 }
      : { x: s.fixed, y: (r0 + r1) / 2, w: 1, h: len }
  })
}
