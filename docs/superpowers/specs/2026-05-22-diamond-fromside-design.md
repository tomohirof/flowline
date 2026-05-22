# Diamond ノードの fromSide 対応 設計

- Issue: #349
- Date: 2026-05-22
- Scope: ひし形ノードの接続元側 (`fromSide`) のみ。四角形ノード / 接続先側 (`toSide`) は別 issue。

## 背景

ひし形（分岐）ノードから複数の矢印を引くとき、ユーザがどのハンドル（上 / 右 / 下 / 左）からドラッグを開始しても、保存後の表示で常にターゲット方向で自動決定された頂点から線が出てしまう。

原因は 2 つ:

1. `src/lib/arrow-routing.ts:121-149` の `exitPt(shape='diamond')` がターゲット中心との `dx/dy` だけで出口頂点を決める。
2. `InternalArrow` (`src/lib/types.ts`) と DB `Arrow` (`src/features/editor/types.ts`) に接続元サイドを示すフィールドが無く、`FlowEditor.tsx:1044` で `{ id, from, to, comment }` だけが保存される（ドラッグ開始ハンドル位置 `connectFromPt` が捨てられている）。

ユーザの意図したハンドルから線が出るよう、矢印データに `fromSide` を持たせ、描画パスがそれを尊重するように変更する。

## 目標

- ユーザがひし形ノードのどのハンドルからドラッグを開始したかを記録し、再描画時にその頂点から線を出す。
- 既存矢印（`fromSide` 未指定）は現状の自動ロジックを維持（後方互換）。
- エディタ・共有ビュー・PNG エクスポートで描画が一致する。

## 非目標

- 四角形ノードの side 指定（別 issue）
- `toSide`（接続先側の頂点指定。別 issue）
- 既存矢印の `fromSide` 自動バックフィル（ユーザが必要に応じてプロパティパネルから手動修正する）
- 矢印の始点エンドポイントをドラッグで掴み直す UX（別 issue）
- 自動接続 (`auto-connect.ts`) からの `fromSide` 推論（別 issue）

## データモデル

### 型

新しいリテラル型を `src/lib/types.ts` に追加:

```ts
export type ArrowSide = 'top' | 'right' | 'bottom' | 'left'

export interface InternalArrow {
  id: string
  from: string
  to: string
  comment: string
  color?: string
  dash?: string
  bidirectional?: boolean
  /** 接続元ノードのどの頂点/辺から線を出すか。
   *  diamond ノードのみ意味を持つ。未指定なら自動（既存ロジック）。 */
  fromSide?: ArrowSide
}
```

`src/features/editor/types.ts` の `Arrow` にも同様に追加:

```ts
export interface Arrow {
  ...
  fromSide?: ArrowSide | null
}
```

### DB スキーマ

`migrations/0013_arrow_from_side.sql`:

```sql
ALTER TABLE arrows ADD COLUMN from_side TEXT;
-- 値は 'top' | 'right' | 'bottom' | 'left' のいずれか、または NULL（自動）。
```

NULL 許容なので既存行は影響なし。

### API シリアライズ

`api/routes/flows.ts`:

- INSERT 文 (現状の 2 箇所、`flows.ts:291` と `flows.ts:446`) に `from_side` カラムを追加
- `getFlowDetail` の SELECT を `from_side` を含むよう更新し、Arrow オブジェクトの `fromSide` プロパティへマップ
- DB から `null` で来たら型上は `undefined` 相当に正規化（UI 側で `fromSide ? ... : undefined` を扱いやすくするため、JSON 出力では `null` のまま渡しても OK）

## 振る舞い

### 新規矢印作成時の `fromSide` 導出

`FlowEditor.tsx:1043-1044` 付近、ドラッグ完了時に矢印を組み立てるところで以下を行う:

1. ソースタスク `tasks[connectFrom]` を引き、`shape === 'diamond'` でなければ `fromSide` は付けない。
2. diamond の場合、ソースノード中心 `sc = ct(srcLi, srcRi)` と `connectFromPt` の差分から side を導出:
   ```
   ddx = connectFromPt.x - sc.x
   ddy = connectFromPt.y - sc.y
   |ddx| > |ddy|  → ddx > 0 ? 'right' : 'left'
   |ddx| <= |ddy| → ddy > 0 ? 'bottom' : 'top'
   ```
3. 矢印オブジェクトに `fromSide` を含めて push。

#### 純関数として切り出す

`src/lib/arrow-routing.ts` に純関数を新設:

```ts
export const deriveFromSide = (origin: Point, center: Point): ArrowSide => {
  const dx = origin.x - center.x
  const dy = origin.y - center.y
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left'
  return dy > 0 ? 'bottom' : 'top'
}
```

これにより FlowEditor 内のロジックが薄くなり、単体テスト可能になる。

注: `FlowEditor.tsx` には arrow を生成する箇所が 3 つ存在する (`:1044`, `:1190`, `:1254`) が、ドラッグ起点 `connectFromPt` を持つのは `:1044` のみ。残り 2 つ（クリック接続経路）は `connectFromPt` を持たないため `fromSide` は付けない（自動になる）。

### `exitPt` の拡張

`src/lib/arrow-routing.ts:121-149`:

```ts
export const exitPt = (
  c: Point,
  o: Point,
  hw: number,
  hh: number,
  rh: number,
  shape?: 'diamond',
  fromSide?: ArrowSide,
): Point => {
  if (shape === 'diamond' && fromSide) {
    switch (fromSide) {
      case 'top':    return { x: c.x,      y: c.y - DS }
      case 'right':  return { x: c.x + DS, y: c.y }
      case 'bottom': return { x: c.x,      y: c.y + DS }
      case 'left':   return { x: c.x - DS, y: c.y }
    }
  }
  // 既存ロジック（自動）はそのまま
  ...
}
```

注: `entryPt` 側は今回触らない（`toSide` は別 issue）。

### 呼び出し側の追従

`exitPt` を呼んでいる箇所:

- `src/features/editor/FlowEditor.tsx` の矢印描画ループ（複数箇所）→ `exitPt(..., shape, arrow.fromSide)` に統一
- `src/features/shared/SharedFlowViewer.tsx:130` → 同上
- `src/lib/flow-engine.test.ts` / `src/lib/arrow-routing.test.ts` の既存テストは変更不要（後方互換のため引数を省略すれば従来挙動）

PNG エクスポート (`src/features/editor/png-export.ts`) は SVG クローン方式なので、エディタ側の SVG が直れば自動的に追随する。

### プロパティパネル UI（案A）

矢印選択時のプロパティパネルに「出口側」セレクタを追加する。

#### 表示条件

- 選択中の矢印が 1 本である
- その矢印のソースノード (`tasks[arrow.from]`) の `shape === 'diamond'`

これらが満たされない場合、セレクタは非表示。

#### UI コンポーネント

```
出口側: ┌──────────┐
        │ 自動  ▼  │
        └──────────┘
        選択肢: 自動 / 上 / 右 / 下 / 左
```

- 内部状態は `'auto' | ArrowSide` の 5 値
- 「自動」選択時は arrow の `fromSide` を `undefined` にセット（DB 上は NULL）
- それ以外を選択した場合は対応する `ArrowSide` をセット
- 既存のオートセーブパイプラインに乗せる（特別な保存ボタンは不要）

#### 配置

矢印プロパティパネル内、既存の「コメント」「色」「線種」「双方向」と同じスタイルで縦に並べる。先頭ではなく既存項目の下に追加（破壊的変更を避ける）。

具体的なファイル/コンポーネントは実装計画フェーズで特定するが、`FlowEditor.tsx` 内に矢印選択時のプロパティパネルがインライン定義されている前提でそこに足す。

## 永続化フロー

```
ドラッグ完了
  └→ deriveFromSide(connectFromPt, sourceCenter) → 'top'|'right'|'bottom'|'left'
       └→ setArrows((p) => [...p, { id, from, to, comment: '', fromSide }])
            └→ autosave → PUT /flows/:id { arrows: [..., { ..., fromSide }] }
                 └→ INSERT INTO arrows (..., from_side) VALUES (..., ?)
```

再読み込み時:

```
GET /flows/:id
  └→ SELECT ..., from_side FROM arrows
       └→ map to Arrow.fromSide (TEXT or NULL → ArrowSide | null)
            └→ FlowEditor が InternalArrow.fromSide にセット
                 └→ exitPt(..., 'diamond', arrow.fromSide) → 該当頂点から線が出る
```

## エラーハンドリング / バリデーション

- DB から `from_side` に予期しない値（`'top'|'right'|'bottom'|'left'` 以外）が入っていた場合 → `exitPt` の switch にマッチしないので自動ロジックにフォールバック（堅牢性確保）。
- ソースノードが diamond ではないのに `fromSide` が DB に入っていた場合 → `exitPt` の `shape === 'diamond'` ガードで自動ロジックになる（無害）。
- API 入力検証: `fromSide` フィールドが文字列なら値ドメイン (`top|right|bottom|left`) をチェックして弾く（任意。最低限 SQL に詰める前に正規化）。

## 後方互換性

- `fromSide` は optional。未指定の矢印は従来ロジック（自動）で描画。
- 旧 JSON インポート（フィールドなし）は問題なく動作。
- DB column も nullable なので既存行は影響なし。
- `exitPt` の引数追加は末尾に optional で足すので既存呼び出しは無変更で動く（型エラーなし）。

## テスト計画

### 単体テスト

`src/lib/arrow-routing.test.ts` に追加:

- `deriveFromSide`:
  - 上ハンドル位置 → `'top'`
  - 右ハンドル位置 → `'right'`
  - 下ハンドル位置 → `'bottom'`
  - 左ハンドル位置 → `'left'`
  - 斜め（45°境界）の振り分け確認
- `exitPt(shape='diamond', fromSide=...)`:
  - 各 side で対応する頂点が返ること
  - `fromSide` 未指定なら従来ロジック（既存テスト維持）

`src/features/editor/png-export.test.ts` または arrow 描画系テスト:

- `fromSide` を持つ矢印が想定パスで描画される（snapshot or 始点座標 assertion）

### API テスト

- POST /flows / PUT /flows: `fromSide` が永続化されること
- GET /flows: `fromSide` が返ってくること

### 実画面検証 (Playwright)

- ひし形 → 右下ノードに **下ハンドル** からドラッグ → 下頂点から出る
- 同じソースから **右ハンドル** でドラッグ → 右頂点から出る
- リロード後も維持されている
- プロパティパネルで「自動」に戻すと自動ロジックに復帰
- 共有ビュー (`/share/:token`) で同じパスになる
- PNG エクスポートで同じパスになる

## 影響範囲

| ファイル | 変更内容 |
|---|---|
| `src/lib/types.ts` | `ArrowSide` 型追加, `InternalArrow.fromSide` |
| `src/features/editor/types.ts` | `Arrow.fromSide` |
| `src/lib/arrow-routing.ts` | `exitPt` 引数追加, `deriveFromSide` 新設 |
| `src/features/editor/FlowEditor.tsx` | ドラッグ完了時の `fromSide` 付与, 描画呼び出し更新, プロパティパネル UI |
| `src/features/shared/SharedFlowViewer.tsx` | `exitPt` 呼び出しに `arrow.fromSide` を渡す |
| `migrations/0013_arrow_from_side.sql` | 新規マイグレーション |
| `api/routes/flows.ts` | INSERT/SELECT に `from_side` 追加 |
| テスト各種 | 上記参照 |

PNG エクスポート (`png-export.ts`) はクローン方式なのでコード変更なし、テストで確認のみ。

## 未解決事項（実装フェーズで詰める）

- プロパティパネルの正確なマークアップ箇所と既存 UI コンポーネント命名規則の確認
- `Arrow.fromSide` の API 上の null/undefined 表現（実装でどちらかに統一）
- `connectFromPt` が中心とほぼ一致するエッジケース（中心からドラッグ開始）の挙動 → `deriveFromSide` は dy ≥ dx かつ dy > 0 を `bottom` にフォールバックするので決定的にはなる

## 参考

- #204 (feat: ひし形ノードの追加)
- #69 (bug: 共有ビューアの矢印描画がエディタと異なる) — 同じ罠を踏まないよう SharedFlowViewer 側も同時に対応する
