# Shift+クリックによるノード複数選択 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** エディタで Shift+クリックによるノードの複数選択を可能にし、一括スタイル変更・一括削除を実現する

**Architecture:** FlowEditor.tsx 内に `multiSel` ステート（Set<string>）を追加。taskClick に Shift 分岐を追加し、Delete/Backspace で一括削除、右パネルに一括スタイル変更 UI を追加。ノード描画でチェックマーク表示。

**Tech Stack:** React + TypeScript + CSS Modules + Vitest + Testing Library

---

## Task 1: multiSel ステート追加 + taskClick の Shift 分岐 + キーボードハンドラ変更

**Files:**

- Modify: `src/features/editor/FlowEditor.tsx`

**Step 1: multiSel ステートを追加**

`FlowEditor.tsx` の useState ブロック（line 436 の `selTask` 宣言付近）に追加:

```typescript
const [multiSel, setMultiSel] = useState<Set<string>>(new Set())
```

**Step 2: taskClick を変更**

`taskClick` 関数（line 870-882）を以下に置き換え:

```typescript
const taskClick = (k: string, e: React.MouseEvent): void => {
  e.stopPropagation()
  if (connectFrom) {
    if (k !== connectFrom)
      setArrows((p) => [...p, { id: uid(), from: connectFrom, to: k, comment: '' }])
    setConnectFrom(null)
    setActiveTool('select')
    return
  }
  if (e.shiftKey) {
    setMultiSel((prev) => {
      const next = new Set(prev)
      if (selTask && prev.size === 0) next.add(selTask)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
    setSelTask(null)
    setSelArrow(null)
    setSelLane(null)
  } else {
    setMultiSel(new Set())
    setSelTask(selTask === k ? null : k)
    setSelArrow(null)
    setSelLane(null)
  }
}
```

**Step 3: Delete/Backspace ハンドラに multiSel 分岐を追加**

keyboard handler（line 674-691）を以下に変更。`multiSel.size > 0` を最優先で判定:

```typescript
if (e.key === 'Delete' || e.key === 'Backspace') {
  if (
    editing ||
    editLane ||
    editTitle ||
    editNote ||
    (document.activeElement as HTMLElement)?.tagName === 'INPUT'
  )
    return
  if (multiSel.size > 0) {
    setTasks((p) => {
      const n = { ...p }
      multiSel.forEach((k) => delete n[k])
      return n
    })
    setNotes((p) => {
      const n = { ...p }
      multiSel.forEach((k) => delete n[k])
      return n
    })
    setOrder((p) => p.filter((x) => !multiSel.has(x)))
    setArrows((p) => p.filter((a) => !multiSel.has(a.from) && !multiSel.has(a.to)))
    setMultiSel(new Set())
    e.preventDefault()
  } else if (selArrow) {
    setArrows((p) => p.filter((a) => a.id !== selArrow))
    setSelArrow(null)
    e.preventDefault()
  } else if (selTask) {
    delTask(selTask)
    e.preventDefault()
  }
}
```

**Step 4: Escape ハンドラに multiSel クリアを追加**

keyboard handler の Escape 部分（line 692-704）に `setMultiSel(new Set())` を追加:

```typescript
if (e.key === 'Escape') {
  setConnectFrom(null)
  setConnectDragPt(null)
  setConnectFromPt(null)
  setSelTask(null)
  setSelArrow(null)
  setEditArrowComment(null)
  setSelLane(null)
  setMultiSel(new Set())
  setDragging(null)
  setDragOver(null)
  setActiveTool('select')
  setShowThemePicker(false)
}
```

**Step 5: useEffect 依存配列に multiSel を追加**

keyboard handler の useEffect 依存配列（line 708）に `multiSel` を追加:

```typescript
}, [selArrow, selTask, editing, editLane, editTitle, editNote, undo, redo, multiSel])
```

**Step 6: レーンクリック・cellClick（既存タスクがない空セルクリック）でも multiSel をクリア**

レーンヘッダークリック（line 1816-1821 付近の `setSelTask(null)` のブロック）に `setMultiSel(new Set())` を追加。

cellClick 関数（line 838 付近）の新規ノード作成部分の直前に `setMultiSel(new Set())` を追加。

**Step 7: コミット**

```bash
git add src/features/editor/FlowEditor.tsx
git commit -m "feat: multiSel ステート + Shift+クリック + キーボード操作 #76"
```

---

## Task 2: ノード描画の変更（選択ストローク + チェックマーク + ハンドル/ドット非表示）

**Files:**

- Modify: `src/features/editor/FlowEditor.tsx`

**Step 1: ノード描画に multiSel を反映**

ノード描画部分（line 2120 付近）で `isSel` の定義を変更:

```typescript
const isSel = selTask === k,
  isMulti = multiSel.has(k),
  isLast = order.length > 0 && order[order.length - 1] === k
```

ノードの rect（line 2144-2176 付近）の stroke と strokeWidth を変更:

```typescript
stroke={
  isConnSrc
    ? T.accent
    : isSel || isMulti
      ? T.nodeSelStroke
      : isConnTgt && isHov
        ? T.accent
        : task.strokeColor || T.nodeStroke
}
strokeWidth={isConnSrc || isSel || isMulti ? 2 : 1.2}
```

**Step 2: 緑ドットの条件に isMulti を追加**

line 2197 付近:

```typescript
{isLast && !isSel && !isMulti && !connectFrom && (
  <circle cx={c.x - TW / 2 + 10} cy={c.y - TH / 2 + 10} r={3} fill="#66BB6A" />
)}
```

**Step 3: multiSel 時にチェックマークバッジを右上に追加**

緑ドットの直後（line 2199 の後）に追加:

```tsx
{
  isMulti && (
    <g>
      <circle cx={c.x + TW / 2 - 6} cy={c.y - TH / 2 + 6} r={8} fill={T.accent} />
      <polyline
        points={`${c.x + TW / 2 - 10},${c.y - TH / 2 + 6} ${c.x + TW / 2 - 7},${c.y - TH / 2 + 9} ${c.x + TW / 2 - 2},${c.y - TH / 2 + 3}`}
        fill="none"
        stroke="#fff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  )
}
```

**Step 4: 接続ハンドルの表示条件に multiSel チェックを追加**

connection handles 描画部分（line 2543-2592 付近）で、`multiSel.size > 0` の時はハンドルを非表示:

```typescript
// 接続ハンドル部分の先頭で条件追加
{
  multiSel.size === 0 &&
    (() => {
      // 既存のハンドル描画コード
    })()
}
```

**Step 5: コミット**

```bash
git add src/features/editor/FlowEditor.tsx
git commit -m "feat: ノード描画に multiSel 反映（ストローク・チェックマーク・ハンドル制御） #76"
```

---

## Task 3: 右パネルに複数選択時の一括操作 UI を追加

**Files:**

- Modify: `src/features/editor/FlowEditor.tsx`
- Modify: `src/features/editor/FlowEditor.module.css`

**Step 1: renderRightPanel に multiSel 分岐を最優先で追加**

`renderRightPanel` 関数（line 1022）の先頭（line 1023、`if (selTask && selTaskData)` の前）に追加:

```tsx
if (multiSel.size > 0) {
  return (
    <>
      <PanelSection label="">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span className={styles.multiSelBadge}>{multiSel.size}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.panelText }}>ノード選択中</span>
        </div>
        <span style={{ fontSize: 10, color: T.panelLabel }}>
          Shift+クリックで追加/解除 · Delete で一括削除
        </span>
      </PanelSection>
      <PanelSection label="背景色">
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {(isDark ? NODE_COLORS_DARK : NODE_COLORS).map((nc) => (
            <div
              key={nc.id}
              onClick={() =>
                setTasks((p) => {
                  const n = { ...p }
                  multiSel.forEach((k) => {
                    if (n[k]) n[k] = { ...n[k], bg: nc.fill || undefined }
                  })
                  return n
                })
              }
              title={nc.label}
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                cursor: 'pointer',
                background: nc.fill || T.nodeFill,
                border: `1.5px solid ${nc.dot}`,
                transition: 'all 0.1s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {nc.fill === null && <span style={{ fontSize: 10, color: T.panelLabel }}>⊘</span>}
            </div>
          ))}
        </div>
      </PanelSection>
      <PanelSection label="枠の色">
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {LINE_COLORS.map((lc) => (
            <div
              key={lc.id}
              onClick={() =>
                setTasks((p) => {
                  const n = { ...p }
                  multiSel.forEach((k) => {
                    if (n[k]) n[k] = { ...n[k], strokeColor: lc.color || undefined }
                  })
                  return n
                })
              }
              title={lc.label}
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                cursor: 'pointer',
                background: T.nodeFill,
                border: `2px solid ${lc.color || T.nodeStroke}`,
                transition: 'all 0.1s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {lc.color === null && <span style={{ fontSize: 10, color: T.panelLabel }}>⊘</span>}
            </div>
          ))}
        </div>
      </PanelSection>
      <PanelSection label="枠の種類">
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {STROKE_STYLES.map((ss) => (
            <div
              key={ss.id}
              onClick={() =>
                setTasks((p) => {
                  const n = { ...p }
                  multiSel.forEach((k) => {
                    if (n[k]) n[k] = { ...n[k], dash: ss.dash === 'none' ? undefined : ss.dash }
                  })
                  return n
                })
              }
              title={ss.label}
              style={{
                flex: 1,
                minWidth: 42,
                height: 30,
                borderRadius: 6,
                cursor: 'pointer',
                background: 'transparent',
                border: `1px solid ${T.inputBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.1s',
              }}
            >
              <svg width="32" height="2" viewBox="0 0 32 2">
                <line
                  x1="0"
                  y1="1"
                  x2="32"
                  y2="1"
                  stroke={T.panelText}
                  strokeWidth="2"
                  strokeDasharray={ss.dash}
                />
              </svg>
            </div>
          ))}
        </div>
      </PanelSection>
      <PanelSection label="操作">
        <button
          className={styles.dangerBtn}
          onClick={() => {
            setTasks((p) => {
              const n = { ...p }
              multiSel.forEach((k) => delete n[k])
              return n
            })
            setNotes((p) => {
              const n = { ...p }
              multiSel.forEach((k) => delete n[k])
              return n
            })
            setOrder((p) => p.filter((x) => !multiSel.has(x)))
            setArrows((p) => p.filter((a) => !multiSel.has(a.from) && !multiSel.has(a.to)))
            setMultiSel(new Set())
          }}
          data-testid="multi-delete-btn"
        >
          {multiSel.size}件を削除
        </button>
        <button
          className={styles.panelBtn}
          onClick={() => setMultiSel(new Set())}
          style={{ marginTop: 6 }}
          data-testid="multi-deselect-btn"
        >
          選択解除
        </button>
      </PanelSection>
    </>
  )
}
```

**Step 2: CSS に multiSelBadge スタイルを追加**

`FlowEditor.module.css` に追加:

```css
.multiSelBadge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--theme-accent, #7c5cfc);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}
```

**Step 3: パネルヘッダーを変更**

パネルヘッダー（line 2652-2655 付近）を変更:

```tsx
<span className={styles.rightPanelTitle}>
  {multiSel.size > 0
    ? `${multiSel.size}件選択`
    : selTask
      ? 'ノード'
      : selArrow
        ? '接続線'
        : selLane
          ? 'レーン'
          : 'プロパティ'}
</span>
```

**Step 4: ステータスバーを変更**

ステータスバー（line 2668-2673 付近）のヒントテキストを変更:

```tsx
<span className={styles.statusTextHint}>
  {multiSel.size > 0
    ? `${multiSel.size}件選択中 · Shift+クリックで追加 · Delete削除`
    : connectFrom
      ? '接続先クリック · Esc解除'
      : dragging
        ? '空きセルにドロップ'
        : 'クリック:追加 · ドラッグ:移動 · ○:接続 · Shift+クリック:複数選択'}
</span>
```

**Step 5: コミット**

```bash
git add src/features/editor/FlowEditor.tsx src/features/editor/FlowEditor.module.css
git commit -m "feat: 右パネルに複数選択一括操作UI + ステータスバー変更 #76"
```

---

## Task 4: テスト作成

**Files:**

- Modify: `src/features/editor/FlowEditor.test.tsx`

**テスト項目:**

```typescript
describe('Multi-select (#76)', () => {
  const createFlowWith2Nodes = (): Flow => {
    const flow = createMinimalFlow()
    flow.lanes = [
      { id: 'lane-1', name: 'レーン1', colorIndex: 0, position: 0 },
      { id: 'lane-2', name: 'レーン2', colorIndex: 1, position: 1 },
    ]
    flow.nodes = [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'タスクA', note: null, orderIndex: 0 },
      { id: 'n2', laneId: 'lane-2', rowIndex: 0, label: 'タスクB', note: null, orderIndex: 1 },
    ]
    return flow
  }

  const findNodeRects = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('rect[rx="10"]')).filter(
      (r) => r.getAttribute('width') === '152',
    )

  it('should enter multi-select mode on Shift+click', async () => {
    // ノードを2つ Shift+クリックし、パネルヘッダーが「2件選択」になることを確認
  })

  it('should clear multiSel on normal click', async () => {
    // Shift+クリック後に通常クリックで multiSel クリア確認
  })

  it('should seed selTask into multiSel on first Shift+click', async () => {
    // 通常クリック→Shift+クリックで2件選択確認
  })

  it('should toggle node out of multiSel on second Shift+click', async () => {
    // Shift+クリック2回で解除確認
  })

  it('should show multi-select panel with count badge', async () => {
    // multiSel 時に右パネルに件数バッジ表示確認
  })

  it('should show delete and deselect buttons in multi-select panel', async () => {
    // multi-delete-btn, multi-deselect-btn の存在確認
  })

  it('should clear multiSel on deselect button click', async () => {
    // 選択解除ボタンクリックで multiSel クリア確認
  })

  it('should show multi-select hint in status bar', async () => {
    // ステータスバーに「N件選択中」表示確認
  })

  it('should show Shift+click hint in default status bar', async () => {
    // デフォルトステータスバーに「Shift+クリック:複数選択」表示確認
  })
})
```

**コミット:**

```bash
git add src/features/editor/FlowEditor.test.tsx
git commit -m "test: multi-select テスト追加 #76"
```

---

## Task 5: ブラウザ目視確認

**確認項目:**

1. Shift+クリックで複数ノードが選択される（青ストローク + チェックマーク）
2. 通常クリックで multiSel クリア
3. 右パネルに件数バッジ + 一括スタイルセクション表示
4. 背景色一括変更が全選択ノードに適用
5. 枠の色一括変更が全選択ノードに適用
6. 「N件を削除」ボタンで一括削除
7. 「選択解除」ボタンで選択クリア
8. Delete キーで一括削除
9. Escape で選択解除
10. ステータスバーの表示切替

---

## Task 6: PR 作成・CI 確認・レビューループ

- `git pull origin main --rebase`
- `npx vitest run` + `npm run lint`
- `git push -u origin feat-multi-select`
- `gh pr create`
- `gh pr checks --watch`
- レビュー依頼 → 修正ループ
