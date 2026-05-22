# ArrowSide 型の二重定義解消（shared/ 新設）

- 関連 issue: #357
- 関連 PR: #352 (#349 で ArrowSide 導入)
- 後続: #356, #355

## 背景

#349 (PR #352) で `ArrowSide = 'top' | 'right' | 'bottom' | 'left'` 型を導入したが、現在 2 箇所で同じリテラル定義が存在する。

- `src/lib/types.ts:2` — フロントエンド・テスト・shared コードで使用
- `api/lib/flow-transform.ts:6` — Cloudflare Workers API 側で使用

api 層を src から完全独立させる設計（Cloudflare Workers バンドル分離）に起因する意図的な分割だが、将来値が変わった場合に片方の追従漏れが起こりやすい。#355 で `toSide` を追加する際にも同じ二重管理が発生する見込みのため、その PR より前に決着させる。

## 目標

- `ArrowSide` を単一の場所で定義し、src/ と api/ の双方から参照する
- api 層の論理的独立性（ランタイムコードを src から取り込まない）を維持する
- 描画・API ふるまいに変更なし（型のみの移動）

## 非目標

- `ArrowSide` 以外の型の集約。今 PR では 1 型のみ。
- ESLint ルールの追加。コメントによる規律で当面運用。
- vite/wrangler バンドル設定の変更。相対 import で動くため不要。

## 方針

`shared/types.ts` を新設し、純粋な型定義（リテラル union や interface のみ。ランタイムコード禁止）を集約するレイヤとする。

検討した代替案:

- **案 A: コメント注記のみ** — 手動レビュー頼みで grep でしか検出不能。`toSide` 追加で破綻リスク増。
- **案 B: 同期テストで強制** — テストが「ファイル内容を grep する」奇妙な形になり、型ごとに書く必要があってスケールしない。
- **案 C: 採用案（shared/ 新設）** — 物理的に DRY。API contract 型が今後増えても自然に拡張できる。

ランタイム影響ゼロ（型は erase される）であり、api/ への src/ 配下コード混入リスクはファイル先頭コメントで抑える。

## アーキテクチャ

### ディレクトリ構成

```
flowline/
├── shared/
│   └── types.ts                  ← 新規。ArrowSide を定義
├── src/
│   └── lib/types.ts              ← ArrowSide 定義を削除し shared から re-export
├── api/
│   └── lib/flow-transform.ts     ← ArrowSide 定義を削除し shared から import
├── tsconfig.app.json             ← include に "shared" 追加
└── tsconfig.workers.json         ← include に "shared/**/*.ts" 追加
```

### shared/types.ts

```ts
// ⚠️ Only pure type definitions allowed in this directory.
//    - No runtime code (no const, no function, no class).
//    - No DOM-specific or Workers-specific types.
//    - Imported by both src/ (Vite/React) and api/ (Cloudflare Workers).

/** ひし形ノードの接続元/接続先として使う頂点/辺。未指定なら自動。 */
export type ArrowSide = 'top' | 'right' | 'bottom' | 'left'
```

### src/lib/types.ts

`ArrowSide` の local 定義を削除し、shared から re-export することで既存 import path を壊さない。

```ts
export type { ArrowSide } from '../../shared/types'

export interface InternalArrow {
  /* ... 既存 ... */
}
export interface ArrowPathResult {
  /* ... 既存 ... */
}
```

### api/lib/flow-transform.ts

`ArrowSide` の local 定義を削除し、shared から直接 import。

```ts
import type { ArrowSide } from '../../shared/types'
```

### tsconfig

`tsconfig.app.json`:

```json
"include": ["src", "shared"]
```

`tsconfig.workers.json`:

```json
"include": ["api/**/*.ts", "functions/**/*.ts", "workers/**/*.ts", "shared/**/*.ts"]
```

## import 方針

- **src/ 配下**: 既存通り `src/lib/types` から取得する。`src/lib/types` 内で re-export することで `src/features/editor/types.ts`, `src/lib/flow-engine.ts`, `src/lib/arrow-routing.ts` などの既存 import を一切変更しない。
- **api/ 配下**: `api/lib/flow-transform.ts` 内で `shared/types` から直接 import。api ファイルから src/ への参照を避ける原則を維持。

## 検証

- `npm test` 全 pass（ロジック変更ゼロのため挙動変化なし）
- `npm run build` で vite/wrangler 両方のバンドルが pass
- `tsc -b` 両プロジェクト型チェック pass
- 実画面で矢印描画に変化がないことを目視確認（既存矢印・新規矢印・ひし形 fromSide すべて）

## テスト戦略

ロジック変更を伴わないため新規テストは追加しない。型の整合性は tsc が静的検証する。`ArrowSide` リテラル値が DB / Zod 検証で参照される値と整合していることは、既存の API ラウンドトリップテストが間接的にカバーする。

## リスク

- **api → src 依存スコープクリープ**: `shared/types.ts` 先頭コメントで「型定義のみ・ランタイムコード禁止」を明示。レビュー時に違反を検出できる。
- **build 設定の見落とし**: vite/wrangler は相対 import を解決できるため追加設定不要。typecheck は include を tsconfig 両方に追加することで担保。

## 工数

30-40 分（実装 20 分 + 検証 10-20 分）

## 関連 issue

- #349 (PR #352): ArrowSide 導入
- #356: SharedFlowViewer の calcArrowPath 統一（本 issue とは独立）
- #355: toSide 追加（本 issue 完了後に着手すると、両側に追加せずに済む）
