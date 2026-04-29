---
issue: 317
date: 2026-04-29
status: design
---

# 設計: ノードラベルの省略撤廃 + 改行入力対応

関連issue: https://github.com/tomohirof/flowline/issues/317

## ゴール

1. ノード内ラベルの末尾省略 (`…`) を撤廃し全文を描画する
2. ラベルに改行 (`\n`) を入力できるようにする
3. ノード矩形のサイズは現状維持。テキストははみ出してOK
4. 複数行ラベルはノード中心を基準に上下へ展開する

## 影響範囲

- `src/features/editor/FlowEditor.tsx` (描画 / インライン編集)
- `src/features/shared/SharedFlowViewer.tsx` (描画)
- `src/features/editor/components/PanelParts.tsx` (新コンポーネント追加)
- `src/features/editor/components/RightPanel.tsx` (ノードラベル入力差し替え)
- `src/features/shared/SharedFlowViewer.test.tsx` (既存truncateテスト差し替え)

**影響範囲外:**

- メモ・矢印コメント・レーン名の入力欄（今回はノードラベルのみ）
- OGP Worker (事前生成PNGを返すだけ)
- 矢印ルーティング・自動接続 (ノード bbox 不変)

## 設計

### 1. ラベル描画 (SVG `<text>` + `<tspan>`)

ノードラベルを `\n` で分割し、各行を `<tspan>` として並べる。

```tsx
const lines = task.label.split('\n')
const lineHeight = 1.2 // em
// 中央揃え用に1行目の dy を計算: テキストブロック中心 = ノード中心
const firstDy = -((lines.length - 1) * lineHeight) / 2

<text
  x={c.x}
  y={isDiamond ? c.y + 2 : c.y + 6}
  textAnchor="middle"
  dominantBaseline="central"
  fontSize={isDiamond ? 12 : 13.5}
  fontWeight={isDiamond ? 600 : 500}
  fill={...}
  style={{ pointerEvents: 'none', fontFamily: 'inherit' }}
>
  {lines.map((line, i) => (
    <tspan key={i} x={c.x} dy={i === 0 ? `${firstDy}em` : `${lineHeight}em`}>
      {line}
    </tspan>
  ))}
</text>
```

**ポイント:**

- 各 `<tspan>` で `x={c.x}` を再指定することで、改行後も水平方向に中央揃えが保たれる
- `dy` は em 単位で指定。1行目は `-((n-1) * 1.2 / 2)em`、2行目以降は `1.2em`
- 単行ラベルなら `firstDy = 0em` となり既存挙動と等価
- 省略 (`…`) は完全撤廃

### 2. 右パネル: 新規 `PanelTextarea` 追加

既存 `PanelInput` はレーン名（684行目）等で単行入力として使われ続けるため、改変せず新規コンポーネントを追加する。

```tsx
// src/features/editor/components/PanelParts.tsx
export const PanelTextarea = ({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) => (
  <textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    rows={1}
    className={styles.panelTextarea}
  />
)
```

**スタイル方針:**

- `panelTextarea` クラスを `FlowEditor.module.css` に追加
- `panelInput` のスタイルをベースに `resize: vertical`, `rows={2}` (デフォルト2行)
- 自動拡張はせず、行が増えたら textarea 内のスクロールで対応（auto-grow は将来必要なら追加）

`RightPanel.tsx:282` のノードラベル入力のみ `PanelTextarea` に差し替える。

### 3. インライン編集 (foreignObject 内)

`FlowEditor.tsx:2647` の `<input>` を `<textarea>` に変更。改行入力した瞬間に下方向に拡張されるよう、`foreignObject` と内部 `<textarea>` の高さをラベル行数に応じて算出する。

```tsx
const editingValue = task.label === t('defaultNodeLabel') ? '' : task.label
const editingLines = Math.max(1, editingValue.split('\n').length)
const lineHeightPx = 18 // CSS で textarea に同じ line-height を設定
const editingBaseHeight = isDiamond ? 24 : TH - 22
const editingHeight = editingBaseHeight + (editingLines - 1) * lineHeightPx

<foreignObject x={...} y={...} width={...} height={editingHeight}>
  <textarea
    ref={textareaRef}
    value={editingValue}
    placeholder={t('defaultNodeLabel')}
    onChange={...}
    onBlur={() => setEditing(null)}
    onKeyDown={handleNodeEditKeyDown}
    onClick={(e) => e.stopPropagation()}
    className={styles.nodeEditTextarea}
  />
</foreignObject>
```

`nodeEditInput` のCSSをベースに `nodeEditTextarea` を追加（`resize: none`, `overflow: hidden`, `line-height: 18px`）。行数算出は state として保持せず、毎レンダリング時に value から計算する（state の二重管理を避けるため）。

### 4. キーバインド共通仕様

`onKeyDown` ハンドラを共通ロジックとして次のように設計する。textarea のデフォルト挙動 (`Enter=改行`) を反転させる。

```ts
function handleLabelKeyDown(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  onConfirm: () => void,
  onCancel?: () => void
) {
  if (e.nativeEvent.isComposing) return // IME変換中は素通し
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    onConfirm()
  } else if (e.key === 'Escape' && onCancel) {
    e.preventDefault()
    onCancel()
  }
  // Shift+Enter は default のまま → textarea が改行を挿入
}
```

- `Enter`（単独・非IME）: 確定（編集終了 / blur）
- `Shift+Enter`: 改行
- `Esc`: キャンセル（既存挙動を維持。インライン編集側のみ。右パネル側は通常入力欄なのでEsc特別扱いなし）
- IME変換中の `Enter` は確定しない（`isComposing` チェック）

右パネル側は永続的な入力欄のため `onConfirm` は `blur()` 相当で十分。インライン編集側は `setEditing(null)` を呼ぶ。

### 5. テスト差し替え

`src/features/shared/SharedFlowViewer.test.tsx:233` の既存テスト
`'should truncate diamond node label at 8 characters'`
を以下2件に差し替える。

1. `'should not truncate diamond node label'` — 10字以上ラベルが末尾 `…` なしで現れる
2. `'should render newline label as multiple tspans'` — `\n` を含むラベルで `<tspan>` が複数生成される

加えて FlowEditor 側にも同等の振る舞いテストを追加する（既存 FlowEditor テストの構造に合わせる）。

## エッジケース

- **空ラベル**: 既存と同じく defaultNodeLabel フォールバック。`split('\n')` は `['']` を返すので tspan が1つ生成される
- **末尾の `\n`**: `split('\n')` で末尾に空文字が混入する → 視覚的に空行として描画される（ユーザー意図と思われるので許容）
- **連続 `\n\n`**: 空行として `<tspan>` が描画される（同上）
- **IME変換中の Enter**: `isComposing` で確定しないため意図せず編集終了しない
- **PNG エクスポート**: `<text>+<tspan>` は SVG 標準でラスタライズ可能（既存 `foreignObject` 利用箇所と異なる）。挙動は自動追従

## 受け入れ基準（issue再掲）

- [ ] 文字数を超えてもラベル末尾に `…` が出ない
- [ ] 右パネルからラベルに改行を入力でき、ノード描画にも反映される
- [ ] ノードのダブルクリック編集中も `Shift+Enter` で改行できる
- [ ] `Enter` 単独でフォーカスを抜けて確定できる
- [ ] PNG エクスポート結果でも全文 / 改行が反映される
- [ ] 共有ビュー (`SharedFlowViewer`) でも同様に表示される
- [ ] 既存テスト `should truncate diamond node label at 8 characters` を「省略しない」「改行が反映される」テストへ差し替える

## トレードオフ / 既知挙動

- 長文・多行のラベルは隣接ノード・矢印・レーンと視覚的に重なりうる
  → ユーザー側で改行/短縮することで回避してもらう
- ひし形は形状上、左右端付近で見切れやすい → 突き抜けで対応
