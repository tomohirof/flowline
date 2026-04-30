# Issue #336: 自動接続 Step 2.5（経路通過矢印への割り込み）設計書

- **Issue**: https://github.com/tomohirof/flowline/issues/336
- **作成日**: 2026-04-30
- **対象**: `src/features/editor/auto-connect.ts`, `src/features/editor/hooks/useArrows.ts`

## 背景と問題

縦方向に通過する矢印 `A → C`（A は上の行、C は下の行）の経路上のセルに新ノード B を追加したとき、自動接続が `A → B`（または `A → B → C` のスプライス）を作らず、行が遠い別のテールから B に矢印を引く。

実例: `案件情報登録 (sharepoint, 行12) → 正式登録 (入力担当, 行14)` が `入力担当・行13` を縦に通過している状態で同セルに `AAAA` を追加すると、`情報提供依頼 (営業対応, 行10) → AAAA` が引かれる。

### 原因

`findClosestUpstream` の現状の優先順位：

1. 同行（同じ row、左右どちらでも近いレーン）
2. 同レーン上流（同じ lane の上の行で最も近い）
3. 上流テール（outgoing を持たない、上の行のノード）

経路通過のシナリオでは Step 1, 2 にヒットせず、Step 3 のテール選定では「outgoing を持つ `A` は除外」されるため、無関係な別レーンの遠いテールが選ばれてしまう。

`findCrossingArrows` + `detectCrossing` は行ごと挿入時のみ起動するため、既存セルへの追加では救済されない。

## 解決方針

`findClosestUpstream` の Step 2 と Step 3 の間に **Step 2.5: 経路通過矢印の上流を返す** を挿入する。`autoConnectOnCreate` 側ではヒットした矢印 ID を受け取り、**その矢印1本だけを** スプライス対象にする。

既存の broad splice（`bestKey` の outgoing 全部）は Step 1/2/3 経由のときだけ温存し、Step 2.5 経由では関係ない下流まで巻き込まないようにする（α 方針）。

## API 変更

### `findClosestUpstream` の戻り値

`string | null` から以下に変更：

```ts
export type UpstreamResult = {
  key: string
  splitArrowId?: string // Step 2.5 でヒットした矢印 ID（その場合のみセット）
}

export function findClosestUpstream(
  tasks: Record<string, { lid: string; rid: string }>,
  rows: { id: string }[],
  lanes: { id: string }[],
  newRi: number,
  newLi: number,
  arrows: { id: string; from: string; to: string }[],
): UpstreamResult | null
```

呼び出し側で「Step 2.5 ヒットだったか」を判別できるようにするためのもの。`splitArrowId` の有無が discriminator。

`arrows` 引数の型は現状 `{ from, to }` のみ受け取っているが、`id` を必須化する（`autoConnectOnCreate` の呼び出し側はもとから `InternalArrow` を渡しているので破壊変更にはならない）。

### Step 2.5 の判定ロジック

新ヘルパー（`findClosestUpstream` 内のローカル処理として実装してよい）：

候補矢印：

- `arrow.from` / `arrow.to` の task が存在し、その rid/lid が rows/lanes に解決できる（できない矢印はスキップ）
- `fromRi < newRi < toRi`（行跨ぎ）
- かつ次のいずれか
  - **タイプ①**: `toLi === newLi`（矢印が newLi に着地）
  - **タイプ②**: `min(fromLi, toLi) <= newLi <= max(fromLi, toLi)`（newLi が fromLi-toLi の範囲内）

優先順位：

1. タイプ① > タイプ②
2. 同タイプ内では `newRi - fromRi` が小さい方（より近い上流）
3. 同点なら最初に見つかったもの

ヒットしたら `{ key: arrow.from, splitArrowId: arrow.id }` を返す。

### `autoConnectOnCreate` のスプライス処理

```ts
const result = findClosestUpstream(...)
if (!result) return
const { key: bestKey, splitArrowId } = result

const splitArrows = splitArrowId
  ? arrows.filter((a) => a.id === splitArrowId)        // ★ Step 2.5: 対象1本のみ
  : (bestRi >= 0 && bestRi < ri
      ? arrows.filter((a) => {
          if (a.from !== bestKey) return false
          const toTask = tasks[a.to]
          if (!toTask) return false
          const toRi = rows.findIndex((r) => r.id === toTask.rid)
          return toRi > ri
        })                                              // 既存の broad splice（Step 1/2/3 用）
      : [])
```

`autoSplitHandledRef.current = splitIds` の代入はそのまま。Step 2.5 経由でも `splitArrowId` が含まれた `splitIds` セットがトースト抑止に使われる（issue 懸念 B）。

## テスト計画

### `auto-connect.test.ts`

既存テストの戻り値形式を `expect(result).toBe('X')` → `expect(result?.key).toBe('X')` に機械的更新（約16〜18箇所）。挙動は変えない。

新規テスト：

| #   | ケース                                                                      | 期待                                                 |
| --- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | 通過矢印 `A→C` のセルに B 追加 → A を返し splitArrowId をセット             | `result.key === 'A' && result.splitArrowId === 'a1'` |
| 2   | 複数候補で `toLi===newLi` の方を優先（タイプ①優先）                         | タイプ①の矢印                                        |
| 3   | 複数候補で `fromRi` が近い方を優先                                          | より近い fromRi の矢印                               |
| 4   | Step 2（同レーン上流）が Step 2.5 より優先                                  | 同レーン上流のキー、`splitArrowId === undefined`     |
| 5   | Step 1（同行）が Step 2.5 より優先                                          | 同行のキー、`splitArrowId === undefined`             |
| 6   | レーン条件を満たさない（行跨ぎだけ）→ Step 2.5 ヒットせず Step 3 へ         | テール                                               |
| 7   | issue 再現シナリオ（案件情報登録 → 正式登録 を入力担当・行13 のセルで挟む） | 案件情報登録のキー + 矢印 ID                         |

### `useArrows.test.ts`

| #   | ケース                                                                                 | 期待                                              |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1   | 上流 A が `A→C`（通過）と `A→D`（無関係な別レーン下流）を持つ。B を `A→C` 経路上に追加 | `A→C` のみ `A→B→C` にスプライスされ、`A→D` は無傷 |

## スコープ外

- 既存セル追加時に `detectCrossing` トーストを出す対応（Step 2.5 で根治するため不要）
- `findCrossingArrows`（既存関数）の改修。Step 2.5 用ロジックは別ヘルパー or `findClosestUpstream` 内のローカル実装にする
- `arrow-routing.ts` の描画側（#333 とは別問題）
- autoConnect OFF 時の挙動（既存通り `autoConnectOnCreate` 自体がスキップされるため無影響）

## 関連 Issue

- #182 自動接続をフロー位置順に改善＆行挿入時の矢印再整理トーストを追加
- #188 自動接続の候補を Tail に限定（このルールで本件が顕在化）
- #265, #297 同行ノードの優先順位調整
- #333 縦方向の矢印迂回（描画側、本件は接続側で別問題）
