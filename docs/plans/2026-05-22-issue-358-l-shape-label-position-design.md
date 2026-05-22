# Issue #358: L字パス矢印のラベル位置バグ修正 設計書

## 背景

`buildArrowPath` (`src/lib/arrow-routing.ts:465`) は、4 種類のパス分岐すべてで `mx, my` を「始点と終点の対角線中点」として返している。

```ts
return { d, mx: (s.x + e.x) / 2, my: (s.y + e.y) / 2 }
```

Z字パスでは偶然この点が中央セグメント上に乗るため正常に見えていたが、L字パスでは経路から外れた空中位置にラベルが表示される。

### 再現条件

- フロー: `R_ALLFIT-電話`
- 矢印: 接続可否（菱形・店舗レーン）→ 具体的なやり取り #30（グルプラレーン）
- `fromSide: "right"`、コメント `"繋がらず"`

矢印データ:

```json
{
  "id": "e2c7d47b-558e-4ca3-8b1a-930f6bdb88a0",
  "from": "9f83083b-80a4-4052-9219-81f363976661_e537bf07-cf6b-4786-bb61-881f6d332a4b",
  "to": "f258fe85-5d7b-4271-a12f-66062c8e4576_f67da590-d46c-4f07-be7a-d18c0dd0a4de",
  "comment": "繋がらず",
  "fromSide": "right"
}
```

## 原因分析

`buildArrowPath` の各分岐とラベル座標の整合性:

| 分岐                            | パス形状                                | 現状の `mx, my`              | 経路上か       |
| ------------------------------- | --------------------------------------- | ---------------------------- | -------------- |
| 直線 (`\|dx\|<2 \|\| \|dy\|<2`) | `M s L e`                               | `((s.x+e.x)/2, (s.y+e.y)/2)` | ✓ 線分中点     |
| Z字 縦→縦 (`sV && eV`)          | `M→(s.x,my)→(e.x,my)→e` ※my=(s.y+e.y)/2 | `((s.x+e.x)/2, (s.y+e.y)/2)` | ✓ 中央水平線上 |
| Z字 横→横 (`!sV && !eV`)        | `M→(mx,s.y)→(mx,e.y)→e` ※mx=(s.x+e.x)/2 | `((s.x+e.x)/2, (s.y+e.y)/2)` | ✓ 中央垂直線上 |
| L字 縦→横 (`sV`)                | `M→(s.x,e.y)→e`                         | `((s.x+e.x)/2, (s.y+e.y)/2)` | ✗ 経路外       |
| L字 横→縦 (else)                | `M→(e.x,s.y)→e`                         | `((s.x+e.x)/2, (s.y+e.y)/2)` | ✗ 経路外       |

迂回パス（`detectDetour` / `detectVerticalDetour` / `detectDiagonalDetour` の各 case）は既に分岐内で個別に `mx, my` を設定済みのため、影響を受けない。

## 修正方針

4 つのパス分岐ごとに `mx, my` を計算する。L字パスについては **長辺の中点** をラベル座標とする。

### L字長辺中点の決定ルール

- **L字 縦→横** (`s → (s.x, e.y) → e`):
  - 縦辺長 `|e.y - s.y|` ≥ 横辺長 `|e.x - s.x|`: `(s.x, (s.y + e.y) / 2)`
  - そうでない: `((s.x + e.x) / 2, e.y)`
- **L字 横→縦** (`s → (e.x, s.y) → e`):
  - 横辺長 `|e.x - s.x|` ≥ 縦辺長 `|e.y - s.y|`: `((s.x + e.x) / 2, s.y)`
  - そうでない: `(e.x, (s.y + e.y) / 2)`

等長の場合はどちらの辺の中点も経路上だが、決定論的にするため `>=` で前者を優先する。

### Z字パス・直線パスの座標

`buildArrowPath` の末尾の `return` を、各分岐ごとの `mx, my` 設定に置き換える。Z字・直線パスは現状と同じ座標を維持する（既存テストに影響なし）。

## 実装方針

関数末尾の単一 return を廃止し、各分岐内で `mx, my` を変数代入する方式に変更する。

```ts
let d: string
let mx: number
let my: number

if (Math.abs(dx) < 2 || Math.abs(dy) < 2) {
  // 直線パス
  d = `M${s.x},${s.y} L${e.x},${e.y}`
  mx = (s.x + e.x) / 2
  my = (s.y + e.y) / 2
} else {
  const sV = Math.abs(s.y - fc.y) > Math.abs(s.x - fc.x)
  const eV = Math.abs(e.y - tc.y) > Math.abs(e.x - tc.x)

  if (sV && eV) {
    // Z字 縦→縦
    const cmy = (s.y + e.y) / 2
    d = `M${s.x},${s.y} L${s.x},${cmy} L${e.x},${cmy} L${e.x},${e.y}`
    mx = (s.x + e.x) / 2
    my = cmy
  } else if (!sV && !eV) {
    // Z字 横→横
    const cmx = (s.x + e.x) / 2
    d = `M${s.x},${s.y} L${cmx},${s.y} L${cmx},${e.y} L${e.x},${e.y}`
    mx = cmx
    my = (s.y + e.y) / 2
  } else if (sV) {
    // L字 縦→横: 長辺の中点
    d = `M${s.x},${s.y} L${s.x},${e.y} L${e.x},${e.y}`
    if (Math.abs(e.y - s.y) >= Math.abs(e.x - s.x)) {
      mx = s.x
      my = (s.y + e.y) / 2
    } else {
      mx = (s.x + e.x) / 2
      my = e.y
    }
  } else {
    // L字 横→縦: 長辺の中点
    d = `M${s.x},${s.y} L${e.x},${s.y} L${e.x},${e.y}`
    if (Math.abs(e.x - s.x) >= Math.abs(e.y - s.y)) {
      mx = (s.x + e.x) / 2
      my = s.y
    } else {
      mx = e.x
      my = (s.y + e.y) / 2
    }
  }
}

return { d, mx, my }
```

## テスト方針 (TDD)

### 新規テスト (`src/lib/arrow-routing.test.ts`)

`describe('buildArrowPath - L字パスのラベル座標')` ブロックを追加:

1. **L字 縦→横、縦辺が長い**: `s=(100,100), e=(200,400)`, `fc=(100,80)` → `mx=100, my=250`
2. **L字 縦→横、横辺が長い**: `s=(100,100), e=(400,200)`, `fc=(100,80)` → `mx=250, my=200`
3. **L字 縦→横、等長**: 縦辺優先で `mx=s.x, my=(s.y+e.y)/2`
4. **L字 横→縦、横辺が長い**: `s=(100,100), e=(400,300)`, `fc=(80,100)` → `mx=250, my=100`
5. **L字 横→縦、縦辺が長い**: `s=(100,100), e=(200,400)`, `fc=(80,100)` → `mx=200, my=250`
6. **issue 添付ケース**: `fromSide: right` の菱形矢印で `s.x < e.x, s.y < e.y` のときラベルが経路上であることを検証

### リグレッションガード

既存テスト（Z字、直線、迂回パス）の `mx, my` 値が変化しないことを `npm test` で確認。座標式は同値なので影響なし。

### 受入れ確認 (Playwright)

`R_ALLFIT-電話` フロー（issue 添付 JSON を import）を開き、「繋がらず」ラベルが L字経路上に表示されることを目視確認。

## 影響範囲

- `src/lib/arrow-routing.ts` 内 `buildArrowPath` 関数のみ
- `src/lib/arrow-routing.test.ts` に新規テスト追加
- ラベル描画コンシューマ（`FlowEditor.tsx`、`SharedFlowViewer.tsx`）の API 変更なし

## 受け入れ条件

- [ ] L字パスのラベルが必ず経路セグメント上に配置される
- [ ] 既存のZ字パス・直線パスのラベル位置に変化がない（既存テスト pass）
- [ ] `arrow-routing.test.ts` に「ラベル座標がパス上にある」テストを追加
- [ ] issue 添付 JSON を import して、「繋がらず」ラベルが L字経路上に表示されることを目視確認

## 関連

- #356 SharedFlowViewer の矢印描画統一（本修正の波及先）
