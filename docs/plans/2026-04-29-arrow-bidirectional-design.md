# 双方向矢印（両端矢じり）対応 — 設計書

- Issue: [#316](https://github.com/tomohirof/flowline/issues/316)
- 日付: 2026-04-29

## 背景

現在、矢印は片方向（SVG `markerEnd` のみ）でしか描画できない。業務フローでは「相互やりとり」「往復」を表現したいケースがあり、双方向矢印が必要。

## ゴール

- 選択中の矢印に対し、RightPanel から「双方向」を切替えられる。
- 双方向の矢印は SVG `path` の両端（`markerStart` + `markerEnd`）に矢じりが付く。
- 編集画面（FlowEditor）と共有ビュー（SharedFlowViewer）で同じ表示。
- コメント・線色・線種は片方向と同じ仕様で動作。
- 既存の片方向矢印・既存データに影響なし（後方互換）。

## 非ゴール（別 issue で対応）

- AI 生成プロンプトで双方向矢印を出力できるようにする。
- OGP Worker（`workers/ogp/src/index.ts`）の双方向対応。

## 設計

### 1. データモデル

`InternalArrow`（UI 内部表現）と `Arrow`（DB 境界）の両方に `bidirectional` を追加する。`from`/`to` は双方向時も保持する（片方向に戻したときに元の向きが復元できる + Mermaid 出力で順序を維持）。

**`src/lib/types.ts`**

```ts
export interface InternalArrow {
  id: string
  from: string
  to: string
  comment: string
  color?: string
  dash?: string
  bidirectional?: boolean
}
```

**`src/features/editor/types.ts`**

```ts
export interface Arrow {
  id: string
  fromNodeId: string
  toNodeId: string
  comment: string | null
  color?: string | null
  dash?: string | null
  bidirectional?: boolean | null
}
```

省略時・null 時は片方向扱い。

### 2. DB マイグレーション

**`migrations/0011_arrow_bidirectional.sql`**:

```sql
ALTER TABLE arrows ADD COLUMN bidirectional INTEGER DEFAULT 0;
```

- D1（SQLite）なので INTEGER 0/1 で表現。
- DEFAULT 0 で既存行は全て片方向扱い → 後方互換。
- `tests/db/migration.test.ts` にスキーマ検証テストを追加。

### 3. API バリデータと永続化

**`api/lib/validators.ts`** — `arrowSchema` に `bidirectional` を追加:

```ts
const arrowSchema = z.object({
  id: z.string().min(1),
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  comment: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  dash: z.string().nullable().optional(),
  bidirectional: z.boolean().optional(),
})
```

**`api/routes/flows.ts` 系**:

- INSERT 時: `arrow.bidirectional ? 1 : 0` でバインド。
- SELECT 時: `Boolean(row.bidirectional)` に変換して `Arrow` として返却。
- 既存行は DEFAULT 0 で `false` として返るので後方互換維持。

**FlowEditor 側の変換**（`FlowEditor.tsx:124-134` 付近）:

- DB 形式 `Arrow.bidirectional` → 内部形式 `InternalArrow.bidirectional` を引き継ぐ。
- 保存時の逆変換も同様。

### 4. UI（RightPanel）

**`src/features/editor/components/RightPanel.tsx`** の操作セクション（`l.653-673`）を 3 ボタン構成に変更:

```
[⇄ 双方向]  [⇄ 方向を逆転]  [削除]
```

仕様:

- 「⇄ 双方向」ボタン: クリックで `selArrowData.bidirectional` を toggle。active 時は背景色 `T.accent` で強調（既存の選択中スタイル流用）、`aria-pressed` で状態を伝達。
- 「⇄ 方向を逆転」ボタン: `bidirectional === true` のとき `disabled`（双方向では意味がないため）。
- i18n 追加:
  - `src/locales/ja/editor.json` → `"arrowBidirectional": "⇄ 双方向"`
  - `src/locales/en/editor.json` → `"arrowBidirectional": "⇄ Bidirectional"`

### 5. 描画（SVG）

両ファイルの矢印描画 `<g>` セクションで以下の変更を行う:

1. **`<defs>` に `markerStart` 用の `<marker>` を追加** — id を `m-start-${arrow.id}`（FlowEditor）/ `sm-start-${arrow.id}`（SharedFlowViewer）形式にし、`orient="auto-start-reverse"` で始点側に向きを反転。`polygon` の `fill` は既存の `markerEnd` と同色。

2. **`<path>` 属性を条件分岐**:

```tsx
<path
  d={d}
  ...
  markerStart={arrow.bidirectional ? `url(#m-start-${arrow.id})` : undefined}
  markerEnd={`url(#m-${arrow.id})`}
/>
```

矢印の `path` 計算ロジック（`src/lib/arrow-routing.ts`）はそのまま。両端に矢じりが付くだけで経路は変えない。

### 6. Mermaid 出力

**`FlowEditor.tsx:1488-1492`** 付近の Mermaid 生成ロジックを双方向対応に分岐:

```ts
const arrowOp = a.bidirectional ? '<-->' : '-->'
if (a.comment) {
  m += `    ${fromId} ${arrowOp}|${esc(a.comment)}| ${toId}\n`
} else {
  m += `    ${fromId} ${arrowOp} ${toId}\n`
}
```

Mermaid 標準の双方向構文 `<-->` を使用。

## テスト戦略

### ユニット

- `useArrows.test.ts`: `bidirectional` フィールドが `setArrows` で保持されることを確認。
- `flow-engine.test.ts`: 双方向矢印を含むフロー変換が両方向プロパティを保持。

### コンポーネント

- `FlowEditor.test.tsx`: 双方向矢印 `path` に `marker-start` と `marker-end` が両方付くこと、片方向は `marker-end` のみ。
- `SharedFlowViewer.test.tsx`: 同上（共有ビュー側、id プレフィックス `sm-`）。
- RightPanel テスト: 双方向ボタンクリックで toggle、ON 時に「方向を逆転」ボタンが `disabled`。

### API / DB

- `tests/db/migration.test.ts`: マイグレーション 0011 適用後、`arrows.bidirectional` カラムが存在し DEFAULT 0。
- `tests/api/routes/flows.test.ts`: `bidirectional: true` で POST → GET で復元、未指定時は false で返却。

### E2E（実画面検証）

- 矢印選択 → 双方向 ON → 保存 → リロードで状態維持。
- PNG エクスポートに両端の矢じりが反映されること。

### 回帰

- 既存の `marker-end` 前提のテスト群（例: `FlowEditor.test.tsx:1812-1813`, `SharedFlowViewer.test.tsx:398` 等）が引き続きパス。

## 受け入れ条件

- [ ] エディタで矢印を双方向にできる。
- [ ] 共有ビューでも双方向で表示される。
- [ ] DB 保存・復元が正しく動く（後方互換含む）。
- [ ] PNG エクスポートに両端の矢じりが反映される。
- [ ] 既存の片方向矢印・既存データに影響がない。
- [ ] LCP 1 秒以内（CLAUDE.md ルール準拠）。

## 関連ファイル

- `src/lib/types.ts`
- `src/features/editor/types.ts`
- `src/features/editor/FlowEditor.tsx`
- `src/features/shared/SharedFlowViewer.tsx`
- `src/features/editor/components/RightPanel.tsx`
- `src/locales/ja/editor.json`, `src/locales/en/editor.json`
- `api/lib/validators.ts`
- `api/routes/flows.ts`（および関連ルート）
- `migrations/0011_arrow_bidirectional.sql`（新規）
