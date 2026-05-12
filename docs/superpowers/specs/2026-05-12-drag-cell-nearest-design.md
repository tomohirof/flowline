# Drag Cell Nearest — 候補セルの最近接追従

- Issue: [#344](https://github.com/tomohirof/flowline/issues/344) fix: ノードドラッグ時、下の行の候補（破線）が下限付近まで行かないと表示されない
- 作成日: 2026-05-12

## 背景

FlowEditor のノードドラッグ中、移動先候補を示す紫の破線インジケータは `dragOver` ステートで描画される (`FlowEditor.tsx:2335`, `2364-2376`)。`dragOver` を決定する `cellFromPos(sx, sy)` (`FlowEditor.tsx:923-932`) は、カーソル座標がセル矩形（幅 `LW` × 高さ `RH=84`）に厳密に内包される場合のみ該当セルを返す。

ドラッグ中、ソースノード本体は元位置に `opacity={0.3}` で残存し、カーソルに追従するゴーストノードは描画されていない。そのためカーソル位置のみで候補セルが決まる仕組みである。

### 何が問題か

- カーソルが行境界をまたいだ直後でも、行内でカーソルが下端付近に到達するまでユーザーには「どこに落ちるか」が視覚的に伝わらないと感じられる
- 厳密内包条件のため、グリッド外（端のレーンの外側、最下行より下）にカーソルが出ると候補が一切表示されない
- 上下移動・左右移動・マルチドラッグいずれでも同じ判定関数を経由するため、挙動が一貫して鈍い

## 期待動作

カーソル位置に応じて **最も近い中心を持つセル** を候補化する。具体的には:

- 行方向: カーソルが目標行の **上端を超えた瞬間** に当該行が候補化
- レーン方向: カーソルが隣レーンの **中心線を越えた瞬間** に当該レーンが候補化
- グリッド範囲外（最下行より下・最上行より上・両端レーンの外側）にカーソルが出た場合は **端のセルを候補化**
- ソースセル自身は候補化しない（既存の `cell.key !== dragging.key` ガードに任せる）
- マルチドラッグでも同じ判定を共有

## 設計

### 関数の切り出し

現状 `FlowEditor.tsx` 内のクロージャである `cellFromPos` を、`src/lib/flow-engine.ts` にピュア関数として切り出す。

**理由:**
- React コンポーネントを起動せずユニットテスト可能にする
- `calcMultiDropTargets` 等の既存ピュア関数と並べて配置することで責務が揃う
- グリッド座標→セル変換は描画と独立した純粋なロジック

**シグネチャ案:**

```ts
export interface CellInfo {
  lid: string
  rid: string
  li: number
  ri: number
  key: string
}

export interface GridGeometry {
  TM: number
  HH: number
  RH: number
  LM: number
  LW: number
  G: number
}

export function cellFromPos(
  sx: number,
  sy: number,
  lanes: { id: string }[],
  rows: { id: string }[],
  geom: GridGeometry,
): CellInfo | null
```

`FlowEditor.tsx` 側は薄いラッパで呼び出す（`laneX` などのクロージャは引数化により不要）。

### 判定ロジック

```ts
if (lanes.length === 0 || rows.length === 0) return null

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

// 行: カーソル sy が行上端を超えた瞬間に次行へ → Math.floor
const riRaw = Math.floor((sy - (geom.TM + geom.HH)) / geom.RH)
const ri = clamp(riRaw, 0, rows.length - 1)

// レーン: 隣レーンの中心線を越えた瞬間に切替 → Math.round
const liRaw = Math.round((sx - geom.LM) / (geom.LW + geom.G))
const li = clamp(liRaw, 0, lanes.length - 1)

return {
  lid: lanes[li].id,
  rid: rows[ri].id,
  li,
  ri,
  key: `${lanes[li].id}_${rows[ri].id}`,
}
```

#### 判定方式の選択理由

| 軸 | 選択 | 理由 |
|---|---|---|
| 行 | `Math.floor` | 行上端を踏み込んだ瞬間に候補が次行へ移るのが直感的。受け入れ条件と一致 |
| レーン | `Math.round` | レーンは矩形の中心線で切り替わるのが自然（左右方向は等幅で隣接） |

行を `Math.round` にすると「行の上半分は前の行、下半分は次の行」となり、ノードが行をまたぐ実感より遅れて感じられる。今回のバグの主訴がまさにこれなので `Math.floor` を採用する。

### 影響範囲

| 場所 | 変更 |
|---|---|
| `src/lib/flow-engine.ts` | `cellFromPos` 関数を新規 export |
| `src/lib/flow-engine.test.ts` | `cellFromPos` のユニットテストを追加 |
| `src/features/editor/FlowEditor.tsx:923-932` | `cellFromPos` の実装を削除し、新関数を呼び出すラッパに置換 |
| `src/features/editor/FlowEditor.tsx:990, 1011-1023, 997-1009` | 呼び出し側の修正なし（`cellFromPos` の戻り値型は据え置き） |

`onSvgMouseMove` 内の既存ガード `if (cell && cell.key !== dragging.key)` および `calcMultiDropTargets` の `newLi/newRi` 範囲チェックはそのまま機能する。範囲外クランプにより `cell` は基本的に非 null となるが、ソースセルにクランプされた場合は既存の self-cell ガードで `dragOver` を立てない。

### 設計上の判断

- **`cell.key === dragging.key` ガードは維持**: 範囲外クランプでソースセルに「自然に戻る」ケースが増えるため、このガードが効くことが重要。
- **マルチドラッグの整合性**: `calcMultiDropTargets` は `anchorTarget` の `li`, `ri` を起点に全選択ノードを平行移動する。アンカーが端にクランプされても、選択ノードの一部が範囲外 (`newLi < 0` 等) になれば既存ロジックで `null` を返し、`dragOverMulti` は立たない。これは現在の挙動と一致する。
- **行間ギャップなし**: `RH=84` は行同士が隙間なく連続する設計なので、`Math.floor((sy - top) / RH)` が `0..rows.length-1` のいずれかに確実に対応する。

## テスト

### ユニットテスト（`flow-engine.test.ts`）

`describe('cellFromPos', ...)` を追加。共通フィクスチャ:
- `lanes = [{id:'L0'}, {id:'L1'}, {id:'L2'}]`
- `rows = [{id:'R0'}, {id:'R1'}, {id:'R2'}]`
- `geom = { TM: 24, HH: 46, RH: 84, LM: 28, LW: 200, G: 12 }`
- 各セルの上端: `TM + HH + ri * RH = 70 + ri * 84` → R0: y=70, R1: y=154, R2: y=238
- 各レーンの左端: `LM + li * (LW + G) = 28 + li * 212` → L0: x=28, L1: x=240, L2: x=452

| ケース | 入力 | 期待 |
|---|---|---|
| R0 上端 | `(x=128, y=70)` | R0/L0 |
| R0 中央 | `(x=128, y=112)` | R0/L0 |
| R0 下端1px手前 | `(x=128, y=153)` | R0/L0 |
| R1 上端境界（**現状バグ**） | `(x=128, y=154)` | R1/L0 |
| R1 上端1px下 | `(x=128, y=155)` | R1/L0 |
| 最下行より下（クランプ） | `(x=128, y=10000)` | R2/L0 |
| 最上行より上（クランプ） | `(x=128, y=0)` | R0/L0 |
| 最左より左（クランプ） | `(x=-100, y=112)` | R0/L0 |
| 最右より右（クランプ） | `(x=10000, y=112)` | R0/L2 |
| L0/L1 中心線左1px | `(x=128+5, y=112)` ※L0中心x=128, L1中心x=340, 中点x=234, 中点-1=233 | R0/L0 |
| L0/L1 中心線右1px | `x=235` | R0/L1 |
| lanes=[] | `(x=0, y=0, lanes=[])` | null |
| rows=[] | `(x=0, y=0, rows=[])` | null |

レーンの中点境界の正確な x は `LM + (LW + G/2) - G/2 = LM + LW + G/2 - G/2` 要計算で確定する。テスト記述時に geometry から導出する。

### 既存テストとの整合

`flow-engine.test.ts` の既存 `calcMultiDropTargets` ケースは `cellFromPos` を直接使わないため影響なし。`FlowEditor.tsx` のE2E（あれば）でドラッグ系を回帰確認する。

### 実画面検証（Playwright/手動）

- 1ノードを上下にドラッグし、カーソルが行境界を踏み込んだ瞬間に破線が切り替わること
- 1ノードを左右にドラッグし、レーン中心線を越えた瞬間に破線が切り替わること
- 複数選択ドラッグでも同じ滑らかさで追従すること
- カーソルをグリッド外（下端の余白）に出した場合、最下行が候補化されること
- 異レーンの占有セルにアンカーがクランプされた場合、`dragOver` が立たないこと（既存制約維持）

## 受け入れ条件（issue再掲）

- [ ] ノードを下方向にドラッグした際、カーソルが目標行の上端を超えた時点で破線候補が表示される
- [ ] 上方向ドラッグでも同様にスムーズに候補が切り替わる
- [ ] レーン間（左右）の移動でも同様に最近接で追従する
- [ ] マルチドラッグでも候補追従が同じ滑らかさで動く
- [ ] 既存テスト全pass

## 非対応・スコープ外

- ドラッグ中のゴーストノード描画追加（カーソル位置にノードの半透明プレビューを出す等）は今回スコープ外
- 矢印中継点・メモ要素のドラッグは本変更の対象外
