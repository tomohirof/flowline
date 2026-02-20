# キャンバスフルビューポート拡張 実装計画

**Goal:** フローエディタのSVGキャンバスをコンテナ全体に拡張し、Figmaのような全画面キャンバス体験を実現する

**Architecture:** キャンバスコンテナDiv に ref + ResizeObserver を追加してコンテナサイズを取得。SVGの width/height をコンテナサイズとコンテンツサイズの大きい方に設定。viewBox も同様に拡張。コンテンツは左上寄せで配置。

**Tech Stack:** React (useState, useRef, useEffect, ResizeObserver)

**Design doc:** `docs/plans/2026-02-20-canvas-fullviewport-design.md`

---

### Task 1: コンテナサイズ取得の追加

**Files:**

- Modify: `src/features/editor/FlowEditor.tsx:387` (ref追加)
- Modify: `src/features/editor/FlowEditor.tsx:443-450` (useEffect追加)

**Step 1: canvasContainerRef と containerSize state を追加**

`svgRef` の直後（L387付近）に以下を追加:

```typescript
const canvasContainerRef = useRef<HTMLDivElement>(null)
const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
```

**Step 2: ResizeObserver の useEffect を追加**

L450（undoPrevSnap の useEffect）の直後に追加:

```typescript
useEffect(() => {
  const el = canvasContainerRef.current
  if (!el) return
  const ro = new ResizeObserver((entries) => {
    const { width, height } = entries[0].contentRect
    setContainerSize({ width, height })
  })
  ro.observe(el)
  return () => ro.disconnect()
}, [])
```

**Step 3: キャンバスコンテナ div に ref を付与**

L1289 のキャンバスコンテナ div を修正:

```tsx
{/* Canvas */}
<div
  ref={canvasContainerRef}
  style={{
```

**Step 4: npm test で既存テストが壊れていないことを確認**

Run: `npm test`
Expected: 全テスト PASS

**Step 5: コミット**

```bash
git add src/features/editor/FlowEditor.tsx
git commit -m "feat(editor): キャンバスコンテナのサイズ取得を追加 (#17)"
```

---

### Task 2: SVGサイズとviewBoxの拡張

**Files:**

- Modify: `src/features/editor/FlowEditor.tsx:486-487` (svgW/svgH計算追加)
- Modify: `src/features/editor/FlowEditor.tsx:1300-1304` (SVG属性変更)

**Step 1: svgW / svgH の計算を追加**

L487（`totalH` の計算）の直後に以下を追加:

```typescript
const svgW = Math.max(containerSize.width, (totalW + LM) * zoom)
const svgH = Math.max(containerSize.height, (totalH + 30 + TM) * zoom)
```

**Step 2: SVG要素の width / height / viewBox を変更**

L1300-1304 を以下に変更:

```tsx
<svg
  ref={svgRef}
  width={svgW}
  height={svgH}
  viewBox={`0 -30 ${svgW / zoom} ${svgH / zoom}`}
  style={{ overflow: 'visible' }}
```

**Step 3: npm test で既存テストが壊れていないことを確認**

Run: `npm test`
Expected: 全テスト PASS

**Step 4: コミット**

```bash
git add src/features/editor/FlowEditor.tsx
git commit -m "feat(editor): SVGをコンテナ全体に拡張 (#17)"
```

---

### Task 3: コンテナスタイルの調整

**Files:**

- Modify: `src/features/editor/FlowEditor.tsx:1289-1298` (コンテナスタイル変更)

**Step 1: コンテナの padding と overflow を変更**

L1290-1298 のスタイルを以下に変更:

```tsx
style={{
  flex: 1,
  overflow: 'hidden',
  background: T.canvasBg,
  backgroundImage: `radial-gradient(circle,${T.dotGrid} 0.5px,transparent 0.5px)`,
  backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
  cursor: connectFrom ? 'crosshair' : dragging ? 'grabbing' : 'default',
}}
```

変更点:

- `overflow: 'auto'` → `overflow: 'hidden'`（SVGがコンテナを埋めるためスクロール不要）
- `padding: 40` を削除（余白はviewBox内のLM/TMで確保済み）

**Step 2: npm test で既存テストが壊れていないことを確認**

Run: `npm test`
Expected: 全テスト PASS

**Step 3: コミット**

```bash
git add src/features/editor/FlowEditor.tsx
git commit -m "feat(editor): キャンバスコンテナのスタイル調整 (#17)"
```

---

### Task 4: ブラウザ目視確認

**Step 1: 開発サーバーを起動**

Run: `npm run dev`

**Step 2: ブラウザでフローエディタを開く**

`http://localhost:5173` でログインし、フローを開く（または新規作成）

**Step 3: 以下を目視確認**

- [ ] SVGキャンバスがコンテナ全体を埋めている
- [ ] ドットグリッド背景が全面に表示されている
- [ ] レーン・ノードが左上寄せで配置されている
- [ ] ノードのクリック・ドラッグ・接続が正常に動作する
- [ ] ズーム変更時にキャンバスが正しくリサイズされる
- [ ] ウィンドウリサイズ時にキャンバスが追従する

**Step 4: 問題があれば修正してコミット**

---

### Task 5: PR作成

**Step 1: mainをrebaseして全テスト通過を確認**

```bash
git pull origin main --rebase
npm test
```

**Step 2: pushしてPR作成**

```bash
git push origin <branch-name>
gh pr create --title "feat: フローエディタのキャンバスをウィンドウ全体に拡張 (#17)"
```
