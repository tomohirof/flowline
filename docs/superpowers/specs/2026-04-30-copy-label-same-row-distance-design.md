# 同行ラベルコピーをレーン距離ベースに修正

- **Issue**: [#337](https://github.com/tomohirof/flowline/issues/337)
- **対象ファイル**: `src/features/editor/FlowEditor.tsx`
- **影響範囲**: `copyLabelOnSameRow` 設定（デフォルトOFF）

## 背景・問題

`copyLabelOnSameRow` 設定がONの時、同行に新ノードを作成すると、同行に存在する別ノードのラベルがコピーされる。同行にノードが複数存在する場合、最も近いレーンのノードからコピーされるべきだが、現在の実装では `Array.find` を用いているため、`Object.entries` の反復順（≒ 挿入順）で最初に一致したノードが選ばれてしまう。

`src/features/editor/FlowEditor.tsx:1226`

```ts
const sameRowNode = Object.entries(tasks).find(([key, t]) => t.rid === rid && key !== k)
```

### 再現条件

1. 同行 A に `案件取得` ノードが存在（入力担当レーン）
2. 受注担当レーンに新ノード追加 → `案件取得` がコピー（妥当）
3. ラベルを `確定連絡` に書き換え
4. 営業対応レーン（受注担当の隣）に新ノード追加
5. **期待**: 距離2の `確定連絡` がコピーされる
6. **実際**: 距離4の `案件取得` がコピーされる

## 修正方針

`auto-connect.ts` の `findClosestUpstream` Step 1 と類似の最小距離選択ロジックを `FlowEditor.tsx` 内にインラインで実装する。タイブレークは「左優先」とし、同点時の選択を決定論的にする。

`auto-connect.ts` のロジックは tail/non-tail 優先のタイブレーカーを持つため、ラベルコピー用途とはセマンティクスが異なる。両者を共通ヘルパー化するとセマンティクスが混ざるため、**インライン実装を選択**する。

### 修正後のコード

```ts
let label = t('defaultNodeLabel')
if (editorSettings.copyLabelOnSameRow) {
  let bestKey: string | null = null
  let bestDist = Infinity
  let bestLi = Infinity
  for (const [key, task] of Object.entries(tasks)) {
    if (task.rid !== rid || key === k) continue
    const tLi = lanes.findIndex((l) => l.id === task.lid)
    if (tLi < 0 || tLi === li) continue
    const dist = Math.abs(tLi - li)
    if (dist < bestDist || (dist === bestDist && tLi < bestLi)) {
      bestKey = key
      bestDist = dist
      bestLi = tLi
    }
  }
  if (bestKey) label = tasks[bestKey].label
}
```

### 選択仕様

| 条件                                   | 挙動                                     |
| -------------------------------------- | ---------------------------------------- |
| 同行に該当ノードなし                   | デフォルトラベル `t('defaultNodeLabel')` |
| 同行・別レーンに1ノード                | そのノードのラベル（既存と同等）         |
| 同行・別レーンに複数ノード（異距離）   | 最小距離 `\|tLi - li\|` のノード         |
| 同行・別レーンに複数ノード（等距離）   | より小さい `tLi`（左）のノード           |
| 同行・同レーン（`tLi === li`）のノード | 除外（対象外）                           |
| 自ノード（`key === k`）                | 除外                                     |

## テスト

`src/features/editor/FlowEditor.test.tsx` に以下のテストケースを追加する。

1. **異距離**: 同行に距離2と距離4のノード → 距離2のラベルがコピーされる
2. **等距離・左優先**: 同行・等距離の左右ノード（li=2, tLi=0 と tLi=4）→ tLi=0（左）のラベル
3. **同レーン除外**: 同行・同レーン（newLi == tLi）のノードは除外される（コピー対象外）

既存の単発ケース（同行に1ノードのみ）テストは挙動不変。

## 影響範囲・リスク

- `copyLabelOnSameRow` はデフォルト OFF。既存ユーザーへのリグレッション影響なし
- 同行に1ノードのみのケースでは挙動不変
- `auto-connect.ts` のロジックには変更なし（独立して動作）

## スコープ外

- `copyLabelOnSameRow` 設定UI、デフォルト値、API保存ロジックは変更なし
- `auto-connect.ts` のヘルパー化・共通化はしない
