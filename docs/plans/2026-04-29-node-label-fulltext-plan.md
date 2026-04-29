# Node Label Fulltext + Multiline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ノードラベルの末尾省略（`…`）を撤廃して全文を描画し、ラベルに改行（`\n`）の入力・表示を可能にする。

**Architecture:** SVG `<text>` 内を `<tspan>` 配列で描画し `dy` で改行送り。中央揃えはノード中心と一致するよう1行目 `dy` をオフセット。右パネル入力は `PanelInput` のままレーン名等で使い続けたいので新規 `PanelTextarea` を追加。インライン編集 (`foreignObject` 内) は `<textarea>` 化し、`Enter`単独で確定 / `Shift+Enter`で改行 / `Esc`でキャンセル / IME中はスルー。

**Tech Stack:** React + TypeScript, Vitest + jsdom + @testing-library/react, SVG (no external libs)

**Spec:** `docs/plans/2026-04-29-node-label-fulltext-design.md`

---

## File Structure

| Path                                            | 役割                          | 変更種別                                           |
| ----------------------------------------------- | ----------------------------- | -------------------------------------------------- |
| `src/features/shared/SharedFlowViewer.tsx`      | 共有ビュー描画                | Modify (label tspan化)                             |
| `src/features/shared/SharedFlowViewer.test.tsx` | 共有ビューテスト              | Modify (truncate削除 + 新テスト2件)                |
| `src/features/editor/FlowEditor.tsx`            | エディタ描画 + インライン編集 | Modify (label tspan化 + textarea化 + キーバインド) |
| `src/features/editor/FlowEditor.test.tsx`       | エディタテスト                | Modify (新テスト追加)                              |
| `src/features/editor/components/PanelParts.tsx` | パネル共通部品                | Modify (PanelTextarea 追加)                        |
| `src/features/editor/components/RightPanel.tsx` | 右パネル                      | Modify (ノードラベル入力差し替え)                  |
| `src/features/editor/FlowEditor.module.css`     | CSS Modules                   | Modify (panelTextarea, nodeEditTextarea 追加)      |

---

## Task 1: SharedFlowViewer 既存テスト差し替え（Red）

**Files:**

- Test: `src/features/shared/SharedFlowViewer.test.tsx:233-255`

- [ ] **Step 1.1: 既存 truncate テストを削除し、新テスト2件を追加**

`SharedFlowViewer.test.tsx` の `it('should truncate diamond node label at 8 characters', ...)` ブロックを丸ごと以下に置き換える:

```tsx
it('should not truncate diamond node label', () => {
  const diamondFlow = {
    ...mockFlow,
    nodes: [
      {
        id: 'node-1',
        laneId: 'lane-1',
        rowIndex: 0,
        label: '1234567890',
        note: null,
        orderIndex: 0,
        shape: 'diamond' as const,
      },
    ],
  }
  render(<SharedFlowViewer flow={diamondFlow} />)
  const canvas = screen.getByTestId('shared-flow-canvas')
  const svg = canvas.querySelector('svg')!
  const texts = Array.from(svg.querySelectorAll('text'))
  const labelText = texts.find((t) => t.textContent === '1234567890')
  expect(labelText).not.toBeUndefined()
  expect(labelText!.textContent).not.toContain('…')
})

it('should render newline label as multiple tspans', () => {
  const multilineFlow = {
    ...mockFlow,
    nodes: [
      {
        id: 'node-1',
        laneId: 'lane-1',
        rowIndex: 0,
        label: 'line1\nline2\nline3',
        note: null,
        orderIndex: 0,
      },
    ],
  }
  render(<SharedFlowViewer flow={multilineFlow} />)
  const canvas = screen.getByTestId('shared-flow-canvas')
  const svg = canvas.querySelector('svg')!
  const texts = Array.from(svg.querySelectorAll('text'))
  const labelText = texts.find((t) => t.textContent === 'line1line2line3')
  expect(labelText).not.toBeUndefined()
  const tspans = labelText!.querySelectorAll('tspan')
  expect(tspans).toHaveLength(3)
  expect(tspans[0].textContent).toBe('line1')
  expect(tspans[1].textContent).toBe('line2')
  expect(tspans[2].textContent).toBe('line3')
})
```

- [ ] **Step 1.2: テストを実行して FAIL を確認**

Run: `npx vitest run src/features/shared/SharedFlowViewer.test.tsx -t "should not truncate diamond node label"`
Expected: 2件目の新テスト `should render newline label as multiple tspans` が FAIL（tspan が0件）

Run: `npx vitest run src/features/shared/SharedFlowViewer.test.tsx -t "should not truncate"`
Expected: 1件目の新テストも FAIL（10字超のテキストが `…` 付きでしか見つからない）

- [ ] **Step 1.3: コミット**

```bash
git add src/features/shared/SharedFlowViewer.test.tsx
git commit -m "test(#317): replace truncation test with fulltext + multiline tests"
```

---

## Task 2: SharedFlowViewer 描画修正（Green）

**Files:**

- Modify: `src/features/shared/SharedFlowViewer.tsx:403-416`

- [ ] **Step 2.1: 既存の単一 text を `<tspan>` 配列に置換**

`SharedFlowViewer.tsx` の以下のブロック:

```tsx
<text
  x={c.x}
  y={isDiamond ? c.y + 2 : c.y + 6}
  textAnchor="middle"
  dominantBaseline="central"
  fontSize={isDiamond ? 12 : 13.5}
  fontWeight={isDiamond ? 600 : 500}
  fill={node.label === '作業' ? T.statusText : T.titleColor}
  style={{ pointerEvents: 'none', fontFamily: 'inherit' }}
>
  {node.label.length > (isDiamond ? 8 : 10)
    ? node.label.slice(0, isDiamond ? 8 : 10) + '…'
    : node.label}
</text>
```

を以下に置き換える:

```tsx
{
  ;(() => {
    const lines = node.label.split('\n')
    const lineHeight = 1.2
    const firstDy = -((lines.length - 1) * lineHeight) / 2
    return (
      <text
        x={c.x}
        y={isDiamond ? c.y + 2 : c.y + 6}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={isDiamond ? 12 : 13.5}
        fontWeight={isDiamond ? 600 : 500}
        fill={node.label === '作業' ? T.statusText : T.titleColor}
        style={{ pointerEvents: 'none', fontFamily: 'inherit' }}
      >
        {lines.map((line, i) => (
          <tspan key={i} x={c.x} dy={`${i === 0 ? firstDy : lineHeight}em`}>
            {line}
          </tspan>
        ))}
      </text>
    )
  })()
}
```

- [ ] **Step 2.2: テストを実行して PASS 確認**

Run: `npx vitest run src/features/shared/SharedFlowViewer.test.tsx`
Expected: 全件 PASS

- [ ] **Step 2.3: コミット**

```bash
git add src/features/shared/SharedFlowViewer.tsx
git commit -m "feat(#317): render label as multiline tspans in SharedFlowViewer"
```

---

## Task 3: FlowEditor 描画テスト追加（Red）

**Files:**

- Modify: `src/features/editor/FlowEditor.test.tsx`

- [ ] **Step 3.1: ラベル全文表示と改行のテストを追加**

`FlowEditor.test.tsx` の末尾に近い `describe` 内に以下2件を追加（既存 `should render node label with fontSize 13.5` の直後など、どこでも `describe` の中であれば良い）:

```tsx
it('should not truncate node label longer than 10 characters', () => {
  const flow = makeFlow({
    lanes: [{ id: 'lane-1', name: 'L1', colorIndex: 0, position: 0 }],
    nodes: [
      {
        id: 'n1',
        laneId: 'lane-1',
        rowIndex: 0,
        label: '12345678901234',
        note: null,
        orderIndex: 0,
      },
    ],
  })
  renderEditor(flow)
  const labels = Array.from(document.querySelectorAll('text')).map((t) => t.textContent)
  expect(labels).toContain('12345678901234')
  expect(labels.every((l) => !l?.endsWith('…'))).toBe(true)
})

it('should render newline label as multiple tspans in editor', () => {
  const flow = makeFlow({
    lanes: [{ id: 'lane-1', name: 'L1', colorIndex: 0, position: 0 }],
    nodes: [{ id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'a\nb', note: null, orderIndex: 0 }],
  })
  renderEditor(flow)
  const labelText = Array.from(document.querySelectorAll('text')).find(
    (t) => t.textContent === 'ab',
  )
  expect(labelText).not.toBeUndefined()
  const tspans = labelText!.querySelectorAll('tspan')
  expect(tspans).toHaveLength(2)
  expect(tspans[0].textContent).toBe('a')
  expect(tspans[1].textContent).toBe('b')
})
```

> **Note:** `makeFlow` / `renderEditor` は既存 FlowEditor.test.tsx に定義済みのヘルパ。同ファイルの先頭〜冒頭テストと同じ書き方で揃えること。テスト追加位置の近くにある既存テストの構造に合わせて props を埋める。`makeFlow` の正確なシグネチャは既存テストから確認すること。

- [ ] **Step 3.2: テストを実行して FAIL 確認**

Run: `npx vitest run src/features/editor/FlowEditor.test.tsx -t "should not truncate node label"`
Expected: FAIL（`…` 付きでしか出てこない）

- [ ] **Step 3.3: コミット**

```bash
git add src/features/editor/FlowEditor.test.tsx
git commit -m "test(#317): add fulltext + multiline label tests for FlowEditor"
```

---

## Task 4: FlowEditor 描画修正（Green）

**Files:**

- Modify: `src/features/editor/FlowEditor.tsx:2667-2680`

- [ ] **Step 4.1: 描画ブロックを `<tspan>` 配列に置換**

`FlowEditor.tsx` の以下のブロック（`{editing === k ? (...foreignObject...) : (...text...)}` の `text` 側）:

```tsx
<text
  x={c.x}
  y={isDiamond ? c.y + 2 : c.y + 6}
  textAnchor="middle"
  dominantBaseline="central"
  fontSize={isDiamond ? 12 : 13.5}
  fontWeight={isDiamond ? 600 : 500}
  fill={task.label === t('defaultNodeLabel') ? T.statusText : T.titleColor}
  style={{ pointerEvents: 'none', fontFamily: 'inherit' }}
>
  {task.label.length > (isDiamond ? 8 : 10)
    ? task.label.slice(0, isDiamond ? 8 : 10) + '…'
    : task.label}
</text>
```

を以下に置き換える:

```tsx
{
  ;(() => {
    const lines = task.label.split('\n')
    const lineHeight = 1.2
    const firstDy = -((lines.length - 1) * lineHeight) / 2
    return (
      <text
        x={c.x}
        y={isDiamond ? c.y + 2 : c.y + 6}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={isDiamond ? 12 : 13.5}
        fontWeight={isDiamond ? 600 : 500}
        fill={task.label === t('defaultNodeLabel') ? T.statusText : T.titleColor}
        style={{ pointerEvents: 'none', fontFamily: 'inherit' }}
      >
        {lines.map((line, i) => (
          <tspan key={i} x={c.x} dy={`${i === 0 ? firstDy : lineHeight}em`}>
            {line}
          </tspan>
        ))}
      </text>
    )
  })()
}
```

- [ ] **Step 4.2: テストを実行して PASS 確認**

Run: `npx vitest run src/features/editor/FlowEditor.test.tsx`
Expected: 全件 PASS（既存テスト含めデグレ無し）

- [ ] **Step 4.3: コミット**

```bash
git add src/features/editor/FlowEditor.tsx
git commit -m "feat(#317): render label as multiline tspans in FlowEditor"
```

---

## Task 5: PanelTextarea 共通コンポーネント + CSS

**Files:**

- Modify: `src/features/editor/components/PanelParts.tsx`
- Modify: `src/features/editor/FlowEditor.module.css`

- [ ] **Step 5.1: panelTextarea CSS を追加**

`FlowEditor.module.css` の `.panelInput { ... }` 直後に追加:

```css
.panelTextarea {
  width: 100%;
  min-height: 30px;
  font-size: 12px;
  padding: 6px 8px;
  border: 1px solid var(--theme-input-border);
  border-radius: 6px;
  outline: none;
  background: var(--theme-input-bg);
  color: var(--theme-panel-text);
  font-family: inherit;
  resize: vertical;
  line-height: 1.4;
}
```

- [ ] **Step 5.2: PanelTextarea コンポーネントを追加**

`PanelParts.tsx` の `PanelInput` 直後に追加。`onConfirm` を受け取り Enter単独で発火させる:

```tsx
export const PanelTextarea = ({
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) => (
  <textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    className={styles.panelTextarea}
    onKeyDown={(e) => {
      if (e.nativeEvent.isComposing) return
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        ;(e.currentTarget as HTMLTextAreaElement).blur()
      }
    }}
  />
)
```

- [ ] **Step 5.3: 型エラー / lint チェック**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5.4: コミット**

```bash
git add src/features/editor/components/PanelParts.tsx src/features/editor/FlowEditor.module.css
git commit -m "feat(#317): add PanelTextarea component for multiline label input"
```

---

## Task 6: RightPanel ノードラベル入力差し替え

**Files:**

- Modify: `src/features/editor/components/RightPanel.tsx:5,282-291`

- [ ] **Step 6.1: import 追加**

`RightPanel.tsx:5` を以下に変更:

```tsx
import { PanelSection, PanelRow, PanelInput, PanelTextarea, PanelBtn } from './PanelParts'
```

- [ ] **Step 6.2: ノードラベル入力を `PanelTextarea` に差し替え**

`RightPanel.tsx:282` の以下のブロック:

```tsx
<PanelInput
  value={selTaskData.label === t('defaultNodeLabel') ? '' : selTaskData.label}
  placeholder={t('rightPanel.defaultLabel')}
  onChange={(v: string) =>
    setTasks((p2) => ({
      ...p2,
      [selTask]: { ...p2[selTask], label: v || t('defaultNodeLabel') },
    }))
  }
/>
```

を以下に置き換え（`PanelInput` → `PanelTextarea`、`rows={2}` を明示）:

```tsx
<PanelTextarea
  value={selTaskData.label === t('defaultNodeLabel') ? '' : selTaskData.label}
  placeholder={t('rightPanel.defaultLabel')}
  rows={2}
  onChange={(v: string) =>
    setTasks((p2) => ({
      ...p2,
      [selTask]: { ...p2[selTask], label: v || t('defaultNodeLabel') },
    }))
  }
/>
```

> **重要:** RightPanel.tsx には他に3箇所の `PanelInput` 使用（メモ・矢印コメント・レーン名）が残るが、**触らない**。

- [ ] **Step 6.3: 既存 RightPanel 関連テスト（FlowEditor.test.tsx 内）を流して回帰確認**

Run: `npx vitest run src/features/editor/FlowEditor.test.tsx`
Expected: 全件 PASS

- [ ] **Step 6.4: コミット**

```bash
git add src/features/editor/components/RightPanel.tsx
git commit -m "feat(#317): switch node label input in RightPanel to PanelTextarea"
```

---

## Task 7: インライン編集の textarea 化 + キーバインド（Red）

**Files:**

- Modify: `src/features/editor/FlowEditor.test.tsx`

- [ ] **Step 7.1: Shift+Enter 改行 / Enter 確定 / 表示反映のテストを追加**

`FlowEditor.test.tsx` の既存「should keep node label input open when Enter is pressed during IME composition」テスト（line 936 周辺）の近くに以下を追加:

```tsx
it('should insert newline on Shift+Enter during inline edit', async () => {
  const flow = makeFlow({
    lanes: [{ id: 'lane-1', name: 'L1', colorIndex: 0, position: 0 }],
    nodes: [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'テスト', note: null, orderIndex: 0 },
    ],
  })
  const { container } = renderEditor(flow)
  // ノードをダブルクリックしてインライン編集モードに入る
  const nodeRect = container.querySelector('rect[data-task-id="n1"]')!
  await userEvent.dblClick(nodeRect)
  const textarea = container.querySelector('textarea') as HTMLTextAreaElement
  expect(textarea).not.toBeNull()
  await userEvent.clear(textarea)
  await userEvent.type(textarea, 'a{Shift>}{Enter}{/Shift}b')
  expect(textarea.value).toBe('a\nb')
  // textarea がまだフォーカスされている（Enter単独ではない）
  expect(document.activeElement).toBe(textarea)
})

it('should confirm and exit inline edit on Enter alone', async () => {
  const flow = makeFlow({
    lanes: [{ id: 'lane-1', name: 'L1', colorIndex: 0, position: 0 }],
    nodes: [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'テスト', note: null, orderIndex: 0 },
    ],
  })
  const { container } = renderEditor(flow)
  const nodeRect = container.querySelector('rect[data-task-id="n1"]')!
  await userEvent.dblClick(nodeRect)
  const textarea = container.querySelector('textarea') as HTMLTextAreaElement
  expect(textarea).not.toBeNull()
  await userEvent.clear(textarea)
  await userEvent.type(textarea, 'foo{Enter}')
  // Enterで編集終了（textarea が DOM から消える）
  expect(container.querySelector('textarea')).toBeNull()
  // labelが反映されている（tspan に "foo"）
  const labelText = Array.from(document.querySelectorAll('text')).find(
    (t) => t.textContent === 'foo',
  )
  expect(labelText).not.toBeUndefined()
})
```

> **Note:** 既存テスト `should keep node label input open when Enter is pressed during IME composition` は `<input>` 前提なので、**Task 8 で textarea 用に修正する**。Task 7 ではまだ動いている（既存 input が残っているうち）か、実装変更後に修正が必要になる。Task 7 の Step 7.1 では新テストの追加のみ。

- [ ] **Step 7.2: 新テストを実行して FAIL 確認**

Run: `npx vitest run src/features/editor/FlowEditor.test.tsx -t "should insert newline on Shift\\+Enter"`
Expected: FAIL（`<textarea>` が無い、もしくは Shift+Enter で改行されない）

- [ ] **Step 7.3: コミット**

```bash
git add src/features/editor/FlowEditor.test.tsx
git commit -m "test(#317): add inline-edit Shift+Enter / Enter behavior tests"
```

---

## Task 8: インライン編集 textarea 実装（Green）

**Files:**

- Modify: `src/features/editor/FlowEditor.tsx:2640-2665`
- Modify: `src/features/editor/FlowEditor.module.css`
- Modify: `src/features/editor/FlowEditor.test.tsx`（既存IMEテストの input → textarea セレクタ変更）

- [ ] **Step 8.1: nodeEditTextarea CSS を追加**

`FlowEditor.module.css` の `.nodeEditInput { ... }` 直後に追加:

```css
.nodeEditTextarea {
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  text-align: center;
  font-size: 13.5px;
  background: transparent;
  color: var(--theme-title-color);
  font-weight: 500;
  font-family: inherit;
  resize: none;
  overflow: hidden;
  padding: 0;
  line-height: 18px;
}
```

- [ ] **Step 8.2: foreignObject + input を textarea に置換**

`FlowEditor.tsx:2640-2665`（既存 `editing === k ? (<foreignObject>...<input>...</foreignObject>) : ...` ブロック）の編集側を以下に置き換える:

```tsx
                    {editing === k ? (() => {
                      const editingValue =
                        task.label === t('defaultNodeLabel') ? '' : task.label
                      const editingLines = Math.max(1, editingValue.split('\n').length)
                      const lineHeightPx = 18
                      const baseH = isDiamond ? 24 : TH - 22
                      const expandedH = baseH + (editingLines - 1) * lineHeightPx
                      return (
                        <foreignObject
                          x={isDiamond ? c.x - DS + 4 : c.x - TW / 2 + 8}
                          y={isDiamond ? c.y - 10 : c.y - TH / 2 + 18}
                          width={isDiamond ? DS * 2 - 8 : TW - 16}
                          height={expandedH}
                        >
                          <textarea
                            ref={inputRef as unknown as React.RefObject<HTMLTextAreaElement>}
                            value={editingValue}
                            placeholder={t('defaultNodeLabel')}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                              const v = e.target.value
                              setTasks((p2) => ({
                                ...p2,
                                [k]: { ...p2[k], label: v || t('defaultNodeLabel') },
                              }))
                            }}
                            onBlur={() => setEditing(null)}
                            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                              if (e.nativeEvent.isComposing) return
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                setEditing(null)
                              } else if (e.key === 'Escape') {
                                e.preventDefault()
                                setEditing(null)
                              }
                            }}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            className={styles.nodeEditTextarea}
                          />
                        </foreignObject>
                      )
                    })() : (
                      // ...既存の <text> + <tspan> ブロック（Task 4 で実装済み）
                    )}
```

> **Note:** `inputRef` の型は `React.RefObject<HTMLInputElement>` のままだとビルドエラーになる可能性が高い。既存の `inputRef` 宣言部（`useRef<HTMLInputElement>(null)` 周辺）を `useRef<HTMLTextAreaElement>(null)` に変更する。`inputRef.current?.focus()` 等の参照箇所は textarea にも `.focus()` メソッドがあるためそのまま動く。型変更で他の参照箇所が壊れないか確認すること（grep `inputRef` で全使用箇所を洗う）。

- [ ] **Step 8.3: inputRef の型変更**

`FlowEditor.tsx` 内の `useRef<HTMLInputElement>(null)`（`inputRef` の宣言）を以下に置き換え:

```tsx
const inputRef = useRef<HTMLTextAreaElement | null>(null)
```

> 注: 同ファイル内に複数の useRef がある可能性があるため、ノード編集用の inputRef のみを変更する（他に `note` 編集用 ref などがあれば触らない）。grep `useRef<HTMLInputElement` で確認してから対象を絞る。

- [ ] **Step 8.4: 既存IMEテストを textarea セレクタに更新**

`FlowEditor.test.tsx` の `should keep node label input open when Enter is pressed during IME composition` テスト内で `'input'` セレクタや `HTMLInputElement` 型を `'textarea'` / `HTMLTextAreaElement` に置き換える。テスト名はそのまま（IME挙動の確認なので意味は変わらない）。

- [ ] **Step 8.5: テストを実行して PASS 確認**

Run: `npx vitest run src/features/editor/FlowEditor.test.tsx`
Expected: 全件 PASS（新テスト2件 + 既存IMEテスト含む）

- [ ] **Step 8.6: 型チェック**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 8.7: コミット**

```bash
git add src/features/editor/FlowEditor.tsx src/features/editor/FlowEditor.module.css src/features/editor/FlowEditor.test.tsx
git commit -m "feat(#317): convert inline label input to textarea with Shift+Enter newline"
```

---

## Task 9: 全体回帰 + フォーマッタ + 受け入れ確認

**Files:** なし（実行のみ）

- [ ] **Step 9.1: 全テスト実行**

Run: `npm test`
Expected: 全件 PASS（FAIL があれば前タスクに戻る）

- [ ] **Step 9.2: 型チェックと lint**

Run: `npx tsc --noEmit && npx prettier --check . && npx eslint .`
（プロジェクトに含まれているスクリプトがあれば `npm run lint` 等を優先）
Expected: PASS（フォーマット崩れがあれば `npx prettier --write .` で整形してからコミット）

- [ ] **Step 9.3: 受け入れ基準の手元チェックリスト**

以下を確認（実画面検証は Task 10 で実施）:

- 文字数を超えてもラベル末尾に `…` が出ない（テストで担保）
- 改行入力 → tspan が複数生成（テストで担保）
- インライン編集中に `Shift+Enter` で改行が入る（テストで担保）
- `Enter` 単独で確定して編集終了（テストで担保）
- IME 変換中の `Enter` で編集が終わらない（既存テストで担保）
- SharedFlowViewer でも同様に表示（テストで担保）
- 既存 truncate テスト差し替え済み（Task 1 で実施）

> **PNG エクスポート / Playwright 目視確認 / LCP** は Task 10（plan外、CLAUDE.md ワークフロー Step 6）で実施。

- [ ] **Step 9.4: フォーマッタ修正があればコミット**

```bash
git add -A
git diff --cached --quiet || git commit -m "style(#317): apply prettier formatting"
```

---

## 完了条件

- 上記 9 タスク全ての step が check 済み
- `npm test` 全件 PASS
- 受け入れ基準（issue記載）のうち、テストで担保できる項目は全て確認済み
- 残作業: 実画面検証（Playwright）+ PNGエクスポート確認 + LCP 確認 + PR作成 → CLAUDE.md ワークフローに従って継続
