# ノードドラッグの activation distance 導入

- Issue: [#347](https://github.com/tomohirof/flowline/issues/347)
- Date: 2026-05-22
- Status: Design approved

## 背景

`src/features/editor/FlowEditor.tsx` のノードドラッグは、mousedown と同時に `setDragging` を呼び、`onSvgMouseMove` で 1px でもカーソルが動くと `cellFromPos` が隣セルを判定して `dragOver` に登録する。直近の PR #345 で `cellFromPos` が「最近接セルにクランプ」する仕様になったため、上下方向にわずかでも動くと隣の行が drop ターゲットとなり、mouseUp で `swapInsertNodes` が実行されてしまう。

結果として、同一レーン内に縦に並ぶノードを単にクリックしただけでも、1mm 程度の手ブレで意図せず順序が入れ替わる誤操作が頻発している。

## 修正方針

dnd-kit / react-dnd で採用される定番パターンに倣い、ドラッグ開始の **activation distance** を導入する。mousedown 位置から **スクリーン座標 6px** カーソルが移動するまでは `dragOver` を確定させない。これにより、6px 未満の手ブレは mouseUp 時にノーオペとなり、明確なドラッグ操作のみが swap を発火させる。

## アーキテクチャ

### 状態モデルの拡張

`src/features/editor/types.ts` の `DragState` を以下に拡張する。

```ts
export interface DragState {
  key: string
  multi?: boolean
  startClientX: number
  startClientY: number
  activated: boolean
}
```

- `startClientX/startClientY`: mousedown 時の `e.clientX/e.clientY`（スクリーン座標。zoom 非依存）
- `activated`: しきい値 6px を超えたか。false で初期化し、超過時に true に切替。同じドラッグセッション中は不可逆。
- `multi` ドラッグでも同じ構造を使用する。

定数 `DRAG_ACTIVATION_DISTANCE = 6` を `FlowEditor.tsx` 冒頭で定義する。

### ハンドラの変更

#### `onDragStart` (`FlowEditor.tsx:941`)

mousedown 時のスクリーン座標を保持し、`activated: false` で初期化する。

```ts
const onDragStart = (k: string, e: React.MouseEvent): void => {
  e.stopPropagation()
  e.preventDefault()
  if (connectFrom || editing) return
  const base = { startClientX: e.clientX, startClientY: e.clientY, activated: false }
  if (multiSel.size > 0 && multiSel.has(k)) {
    setDragging({ key: k, multi: true, ...base })
  } else {
    setDragging({ key: k, ...base })
    setMultiSel(new Set())
  }
  setSelTask(null)
  setSelArrow(null)
  setSelLane(null)
}
```

#### `onSvgMouseMove` (`FlowEditor.tsx:982-1018`) — activation gate 追加

```ts
if (!dragging) return

// activation gate
if (!dragging.activated) {
  const dx = e.clientX - dragging.startClientX
  const dy = e.clientY - dragging.startClientY
  if (Math.hypot(dx, dy) < DRAG_ACTIVATION_DISTANCE) {
    return // dragOver は触らない（null のまま）
  }
  setDragging({ ...dragging, activated: true })
  // 同じ event 内で従来ロジックへ進める
}

const cell = cellFromPos(pt.x, pt.y)
if (dragging.multi) { ... } else { ... } // 既存ロジック
```

- ユークリッド距離（`Math.hypot`）で円形しきい値を判定。
- 一度 `activated: true` になれば残りの move では従来通り `cellFromPos` → `setDragOver` を実行。
- `dragging.multi` 分岐の**前**に置くため、single / multi 両方に同じゲートが適用される。

#### `onSvgMouseUp` (`FlowEditor.tsx:1054-1082`)

変更なし。activation 未達なら `dragOver` が `null` のままなので、既存の `if (dragOver)` 分岐に入らず、結果的に何も起きずに `setDragging(null)` で終了する（＝クリック扱いのノーオペ）。

## データフロー

```
mousedown
  → onDragStart: setDragging({ key, activated:false, startClientX, startClientY })

mousemove (距離 < 6px)
  → onSvgMouseMove: activation gate で early return → dragOver は null のまま

mousemove (距離 >= 6px に到達)
  → onSvgMouseMove: setDragging({ ...prev, activated:true }) → cellFromPos / setDragOver を実行

以降の mousemove
  → onSvgMouseMove: activated:true のため activation gate を skip → 従来通り

mouseup
  → onSvgMouseUp:
      activated 未達 → dragOver:null のため何も発火せず setDragging(null)
      activated 済み → 既存ロジックで swapInsertNodes / moveTask / moveMultiTasks
```

## 設計判断

| 項目 | 決定 | 理由 |
|---|---|---|
| 状態保持場所 | `DragState` 拡張 | ドラッグセッションのライフサイクル状態として一貫。`setDragging(null)` 1 回でクリーンアップ。 |
| 座標系 | スクリーン座標 (`clientX/Y`) | zoom 非依存。SVG 座標だと拡大時はゆるく、縮小時は厳しくなり挙動がブレる。 |
| しきい値 | 6px | macOS 標準のクリック許容範囲と同等。設定 UI は設けない（issue で確定）。 |
| 距離計算 | ユークリッド距離 (`Math.hypot`) | 円形しきい値。軸ごとや Chebyshev より自然。 |
| マルチドラッグ | 同じゲートを適用 | single / multi で挙動を分けない。 |
| activation の永続性 | 不可逆 (true 後は false に戻らない) | 標準的なドラッグ挙動。 |

## スコープ外

| 観点 | 理由 |
|---|---|
| メモのドラッグ (`onMemoMouseDown`, `:1023-1026`) | 既に mouseUp 時 3px 未満で編集モード突入の判定あり。挙動が異なる。 |
| 接続ドラッグ（矢印作成、`connectFrom`） | 別系統。誤動作の報告なし。 |
| `cellFromPos` の境界判定ロジック (`flow-engine.ts:209`) | PR #345 の最近接クランプ仕様は維持。activation gate で誤反応を実質的に抑止。 |

## テスト戦略

### 追加するテストケース（`FlowEditor.test.tsx`）

| # | シナリオ | 期待値 |
|---|---|---|
| 1 | mousedown → 0px move → mouseUp | swap が発火しない |
| 2 | mousedown → 5px move → mouseUp（しきい値未達） | swap が発火しない |
| 3 | mousedown → 6px move → mouseUp（しきい値ちょうど超え）／隣接セル方向 | swap が発火する |
| 4 | mousedown → 3px move → さらに 4px move（累積で超え）→ mouseUp | swap が発火する（activated は不可逆） |
| 5 | マルチドラッグ: 複数選択 → 5px move → mouseUp | 位置変更が発火しない |
| 6 | マルチドラッグ: 複数選択 → 6px 超え move → mouseUp | 位置変更が発火する |
| 7 | 対角方向 (`dx=5, dy=5`, 距離≈7.07) → mouseUp | swap が発火する（ユークリッド距離での円形ゲート確認） |

- 既存の `FlowEditor.test.tsx` の fireEvent ベースのパターンに合わせる。
- スクリーン座標は `clientX/clientY` で渡す。

### 既存テストへの影響

`FlowEditor.test.tsx` で 6px 未満の move で swap を期待しているテストは fail する。該当箇所を grep で抽出し、`mouseMove` の引数で 6px 以上動かすよう調整する。

### 実装ルーチン上の判定（`FlowEditor` 以外）

ロジックがシンプル（`Math.hypot(dx, dy) >= 6`）であり、`cellFromPos` のような独立して再利用される関数ではないため、pure function 化はしない。FlowEditor 内部に閉じてコンポーネントテストでカバーする。

## 受け入れ条件

| # | 条件 |
|---|---|
| 1 | ノードのクリック直後 1〜5px の微小ブレで `dragOver` が立たず、mouseUp しても順序が変わらない |
| 2 | 明確にドラッグ操作と分かる 6px 以上の移動で従来通り `dragOver` が立ち、mouseUp で swap が発火する |
| 3 | しきい値はスクリーン座標で評価され、zoom 変更時も挙動が一定 |
| 4 | マルチドラッグでも同じしきい値が適用される |
| 5 | 既存のクリック選択（`taskClick`）には影響しない |
| 6 | `npm test` 全 pass |
| 7 | Playwright で実画面検証：縦並びノードでクリック → わずかな移動 → mouseUp で順序が維持される |

## 関連

- PR [#345](https://github.com/tomohirof/flowline/pull/345)（`cellFromPos` の最近接クランプ化）
- Issue [#344](https://github.com/tomohirof/flowline/issues/344)（`cellFromPos` pure function 化）
