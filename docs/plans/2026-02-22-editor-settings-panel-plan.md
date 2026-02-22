# エディタ挙動・表示設定パネル 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** エディタ右パネルに挙動・表示設定 UI を追加し、cellClick と Canvas 描画に設定を反映する

**Architecture:** FlowEditor.tsx 内に editorSettings ステートを追加し、右パネルのデフォルトビューにチェックボックス UI を追加。cellClick の新規ノード作成ロジックに 4 つの条件分岐を追加し、Canvas 描画で 2 つの表示制御を追加。

**Tech Stack:** React + TypeScript + CSS Modules + Vitest + Testing Library

---

## Task 1: editorSettings ステート追加 + チェックボックス CSS

**Files:**

- Modify: `src/features/editor/FlowEditor.tsx` (ステート追加)
- Modify: `src/features/editor/FlowEditor.module.css` (チェックボックススタイル)

**Step 1: editorSettings ステートを追加**

`FlowEditor.tsx` の useState ブロック（~line 460 付近）に追加:

```typescript
const [editorSettings, setEditorSettings] = useState({
  copyLabelOnSameRow: false,
  autoConnect: true,
  autoAddRow: true,
  enterEditOnCreate: true,
  showDotGrid: true,
  showOrderBadge: true,
})
```

**Step 2: チェックボックス CSS を追加**

`FlowEditor.module.css` に追加:

```css
.settingCheckbox {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
  cursor: pointer;
}

.checkboxBox {
  width: 15px;
  height: 15px;
  border-radius: 3px;
  border: 1.5px solid var(--theme-input-border);
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
}

.checkboxBoxChecked {
  border-color: var(--theme-accent, #7c5cfc);
  background: var(--theme-accent, #7c5cfc);
}

.checkboxLabel {
  font-size: 10.5px;
  color: var(--theme-panel-text);
  font-weight: 500;
}
```

**Step 3: コミット**

```bash
git add src/features/editor/FlowEditor.tsx src/features/editor/FlowEditor.module.css
git commit -m "feat: editorSettings ステート + チェックボックス CSS 追加 #72"
```

---

## Task 2: 右パネルに挙動・表示セクション UI を追加

**Files:**

- Modify: `src/features/editor/FlowEditor.tsx` (右パネルデフォルトビューに 2 セクション追加)

**Step 1: 挙動・表示セクションを右パネルに追加**

右パネルのデフォルトビュー（~line 1341-1402 の `return (<>...</>)` 内）のエクスポートセクション後に追加:

```tsx
<PanelSection label="挙動">
  {[
    { key: 'copyLabelOnSameRow', label: '同行テキストコピー' },
    { key: 'autoConnect', label: '自動接続' },
    { key: 'autoAddRow', label: '自動行追加' },
    { key: 'enterEditOnCreate', label: '作成後すぐ編集' },
  ].map((s) => (
    <div
      key={s.key}
      className={styles.settingCheckbox}
      onClick={() =>
        setEditorSettings((p) => ({
          ...p,
          [s.key]: !p[s.key as keyof typeof p],
        }))
      }
      data-testid={`setting-${s.key}`}
    >
      <div
        className={`${styles.checkboxBox} ${
          editorSettings[s.key as keyof typeof editorSettings]
            ? styles.checkboxBoxChecked
            : ''
        }`}
      >
        {editorSettings[s.key as keyof typeof editorSettings] && (
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <span className={styles.checkboxLabel}>{s.label}</span>
    </div>
  ))}
</PanelSection>
<PanelSection label="表示">
  {[
    { key: 'showDotGrid', label: 'ドットグリッド' },
    { key: 'showOrderBadge', label: '順番バッジ' },
  ].map((s) => (
    <div
      key={s.key}
      className={styles.settingCheckbox}
      onClick={() =>
        setEditorSettings((p) => ({
          ...p,
          [s.key]: !p[s.key as keyof typeof p],
        }))
      }
      data-testid={`setting-${s.key}`}
    >
      <div
        className={`${styles.checkboxBox} ${
          editorSettings[s.key as keyof typeof editorSettings]
            ? styles.checkboxBoxChecked
            : ''
        }`}
      >
        {editorSettings[s.key as keyof typeof editorSettings] && (
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <span className={styles.checkboxLabel}>{s.label}</span>
    </div>
  ))}
</PanelSection>
```

**Step 2: コミット**

```bash
git add src/features/editor/FlowEditor.tsx
git commit -m "feat: 右パネルに挙動・表示設定チェックボックス UI 追加 #72"
```

---

## Task 3: cellClick に editorSettings を反映

**Files:**

- Modify: `src/features/editor/FlowEditor.tsx` (cellClick 関数変更)

**Step 1: cellClick の新規ノード作成部分を変更**

cellClick 関数（~line 808-832）の新規ノード作成部分を以下に変更:

```typescript
// 現在の行 823: 新規タスク作成
let label = '作業'
if (editorSettings.copyLabelOnSameRow) {
  const sameRowNode = Object.entries(tasks).find(([key, t]) => t.rid === rid && key !== k)
  if (sameRowNode) label = sameRowNode[1].label
}
setTasks((p) => ({ ...p, [k]: { label, lid, rid, nodeId: uid() } }))
const no = [...order, k]
setOrder(no)

// 現在の行 826-827: 自動接続 → autoConnect で制御
if (editorSettings.autoConnect && no.length >= 2 && tasks[no[no.length - 2]])
  setArrows((p) => [...p, { id: uid(), from: no[no.length - 2], to: k, comment: '' }])

// 現在の行 828-830: 編集モード → enterEditOnCreate で制御
if (editorSettings.enterEditOnCreate) {
  setEditing(k)
  setSelArrow(null)
  setTimeout(() => inputRef.current?.focus(), 40)
}

// 現在の行 831: 行追加 → autoAddRow で制御
if (editorSettings.autoAddRow && ri === rows.length - 1) setRows((p) => [...p, { id: uid() }])
```

**Step 2: コミット**

```bash
git add src/features/editor/FlowEditor.tsx
git commit -m "feat: cellClick に editorSettings 4 設定を反映 #72"
```

---

## Task 4: Canvas 描画に showDotGrid / showOrderBadge を反映

**Files:**

- Modify: `src/features/editor/FlowEditor.tsx` (Canvas 描画変更)
- Modify: `src/features/editor/FlowEditor.module.css` (ドットグリッド制御)

**Step 1: ドットグリッドの表示制御**

Canvas の className にドットグリッド制御を追加:

```tsx
// canvas 要素に条件クラスを追加
className={`${styles.canvas} ${editorSettings.showDotGrid ? '' : styles.canvasNoDots}`}
```

CSS:

```css
.canvasNoDots {
  background-image: none !important;
}
```

**Step 2: 順番バッジの表示制御**

順番バッジ描画部分（~line 2073）の条件に `editorSettings.showOrderBadge` を追加:

```tsx
{oi !== -1 && !connectFrom && !dragging && editorSettings.showOrderBadge && (
```

**Step 3: コミット**

```bash
git add src/features/editor/FlowEditor.tsx src/features/editor/FlowEditor.module.css
git commit -m "feat: Canvas 描画に showDotGrid/showOrderBadge 設定を反映 #72"
```

---

## Task 5: テスト作成

**Files:**

- Modify: `src/features/editor/FlowEditor.test.tsx` (テスト追加)

**テスト項目:**

1. デフォルトビューに「挙動」「表示」セクションが表示される
2. 各チェックボックスが初期状態で正しい（autoConnect=ON 等）
3. チェックボックスクリックでトグルする
4. setting-showDotGrid, setting-showOrderBadge の data-testid が存在する

**Step 1: テスト追加**

```typescript
describe('EditorSettings panel', () => {
  it('should show behavior and display sections when nothing selected', async () => {
    // デフォルトビューに挙動・表示セクションが表示される
  })

  it('should toggle autoConnect setting on click', async () => {
    // autoConnect チェックボックスをクリックしてトグル確認
  })

  it('should have all 6 setting checkboxes with correct data-testid', async () => {
    // 6 つの setting-* data-testid が存在する
  })
})
```

**Step 2: テスト実行確認**

```bash
npx vitest run src/features/editor/FlowEditor.test.tsx
```

**Step 3: コミット**

```bash
git add src/features/editor/FlowEditor.test.tsx
git commit -m "test: editorSettings パネルのテスト追加 #72"
```

---

## Task 6: ブラウザ目視確認

**確認項目:**

1. 右パネルに「挙動」「表示」セクションが表示される
2. チェックボックスのトグルが動作する
3. autoConnect OFF で自動接続がスキップされる
4. showDotGrid OFF でドットグリッドが非表示になる
5. showOrderBadge OFF で順番バッジが非表示になる

---

## Task 7: PR 作成・CI 確認・レビューループ

- `git pull origin main --rebase`
- `npx vitest run` + `npm run lint`
- `git push -u origin feat-editor-settings`
- `gh pr create`
- `gh pr checks --watch`
- レビュー依頼 → 修正ループ
