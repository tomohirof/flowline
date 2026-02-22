# Shift+クリックによるノード複数選択 設計ドキュメント

> Issue #76

## 概要

エディタで Shift+クリックによるノードの複数選択を可能にし、一括でスタイル変更・削除ができるようにする。FlowEditor.tsx 内にインライン実装する（既存の selTask/selArrow パターンと一貫性を保つ）。

## アーキテクチャ

### 方針: FlowEditor 内にインライン実装

`selTask`（単一選択）と同じレイヤーに `multiSel`（Set<string>）ステートを追加。右パネルの表示優先度は `multiSel > selTask > selArrow > selLane > デフォルト`。

### 新規ステート

```typescript
const [multiSel, setMultiSel] = useState<Set<string>>(new Set())
```

## 選択操作

| 操作                             | 動作                                         |
| -------------------------------- | -------------------------------------------- |
| 通常クリック                     | 単一選択（multiSel クリア）                  |
| Shift+クリック                   | multiSel にトグル（追加/解除）               |
| Shift+クリック（selTask 存在時） | selTask を seed として含めて multiSel に移行 |
| 背景クリック                     | 全解除（selTask, multiSel 両方）             |
| Escape                           | 全解除                                       |

### taskClick 変更

```typescript
const taskClick = (k: string, e: React.MouseEvent) => {
  e.stopPropagation()
  if (connectFrom) {
    /* 既存の接続ロジック */ return
  }

  if (e.shiftKey) {
    setMultiSel((prev) => {
      const next = new Set(prev)
      // selTask が存在し multiSel が空 → seed
      if (selTask && prev.size === 0) next.add(selTask)
      // トグル
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
    setSelTask(null)
    setSelArrow(null)
    setSelLane(null)
  } else {
    // 通常クリック
    setMultiSel(new Set())
    setSelTask(selTask === k ? null : k)
    setSelArrow(null)
    setSelLane(null)
  }
}
```

## キーボード操作

### Delete / Backspace

`multiSel.size > 0` 時を最優先で判定:

```typescript
if (multiSel.size > 0) {
  // tasks からマルチ選択ノードを削除
  // memos からも削除
  // order からも削除
  // arrows から from/to がマルチ選択に含まれるものを削除
  // multiSel クリア
}
```

### Escape

既存のクリア処理に `setMultiSel(new Set())` を追加。

## ノード描画（複数選択中）

`multiSel.has(k)` が true のノード:

- ストローク: `T.nodeSelStroke`（選択時と同じ色）、太さ 2px
- 右上にアクセントカラーの丸（r=8）+ 白チェックマーク SVG
- 接続ハンドル（○）: 非表示
- 最終ノード緑ドット: 非表示

## 右パネル（複数選択時）

`multiSel.size > 0` を最優先で判定:

| セクション | 内容                                                                |
| ---------- | ------------------------------------------------------------------- |
| ヘッダー   | 件数バッジ（アクセントカラー）+「ノード選択中」+ ヒント文           |
| 背景色     | NODE_COLORS / NODE_COLORS_DARK パレット流用、全選択ノードに一括適用 |
| 枠の色     | LINE_COLORS 流用、全選択ノードに一括適用                            |
| 枠の種類   | STROKE_STYLES 流用、全選択ノードに一括適用                          |
| 操作       | 「N件を削除」ボタン +「選択解除」ボタン                             |

### パネルヘッダー

```typescript
multiSel.size > 0 ? `${multiSel.size}件選択` : selTask ? 'ノード' : ...
```

## ステータスバー

| 状態       | 表示テキスト                                                       |
| ---------- | ------------------------------------------------------------------ |
| 通常時     | `クリック:追加 · ドラッグ:移動 · ○:接続 · Shift+クリック:複数選択` |
| 複数選択中 | `N件選択中 · Shift+クリックで追加 · Delete削除`                    |

## テスト方針

- Shift+クリックで multiSel にノード追加
- 再度 Shift+クリックで解除（トグル）
- selTask 存在時の Shift+クリックで seed 動作
- 通常クリックで multiSel クリア
- Delete キーで一括削除
- Escape で全解除
- 右パネルに件数表示
- 背景クリックで全解除
