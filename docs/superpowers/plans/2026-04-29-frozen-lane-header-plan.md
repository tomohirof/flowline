# レーンヘッダー固定表示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 縦スクロール時にレーンヘッダーが画面上部に残るようにする（CSS `position: sticky` 方式）。横スクロール時はヘッダーも一緒に追従。エディタと共有ビュー両方に適用。

**Architecture:** 単一 `<svg>` を **ヘッダーSVG**（`position: sticky; top: 0`）と **本体SVG** の 2 段構成に分割。`.canvas` の overflow: auto はそのまま、ブラウザの sticky 挙動で縦スクロール時のみヘッダーが固定される。

**Tech Stack:** React 19, TypeScript, CSS Modules, Vitest + @testing-library/react

**Spec:** `docs/superpowers/specs/2026-04-29-frozen-lane-header-design.md`

**Issue:** https://github.com/tomohirof/flowline/issues/322

---

## File Structure

| ファイル | 変更内容 |
|---|---|
| `src/features/editor/FlowEditor.module.css` | `.canvas` に `position: relative` 追加。`.headerSvg` / `.bodySvg` 新規 |
| `src/features/editor/FlowEditor.tsx` | キャンバス内を 2 SVG 構成に分割。レーンヘッダー描画を headerSvg へ移植 |
| `src/features/editor/FlowEditor.test.tsx` | ヘッダー分離・選択ハイライト 2 分割・編集 input・移動ボタン位置のテスト追加 |
| `src/features/shared/SharedFlowViewer.tsx` | エディタと同じ 2 SVG 構成を適用（編集系なしのシンプル版） |
| `src/features/shared/SharedFlowViewer.test.tsx` | ヘッダー分離テスト追加 |

ブラウザ目視確認は CLAUDE.md Workflow Step 6（MCP playwright 利用）で実施。自動 E2E は未導入のため計画外。

---

## Pre-flight: ワークツリー作成

CLAUDE.md Workflow Step 1 に従い、main 最新化 → ワークツリー作成 → `.env*` シンボリックリンク。実装はワークツリー内で実施する。

```bash
cd /Volumes/SSD4TB/DevCode/flowline
git checkout main
git fetch origin
git merge --ff-only origin/main
git worktree add .worktrees/feat-322-sticky-lane-header -b feat/322-sticky-lane-header
cd .worktrees/feat-322-sticky-lane-header
MAIN=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')
for f in "$MAIN"/.env*; do [ -f "$f" ] && ln -sf "$f" .; done
gh issue edit 322 --add-label "作業開始"
```

以後のすべてのタスクはワークツリー内で実行する。

---

## Task 1: CSS scaffolding（`.canvas` を sticky の親に、`.headerSvg`/`.bodySvg` 追加）

**Files:**
- Modify: `src/features/editor/FlowEditor.module.css:315-324`

- [ ] **Step 1: 既存の `.canvas` / `.svg` を確認して上書き**

`FlowEditor.module.css` の Canvas Area セクション（行 311-324）を以下に置き換える:

```css
/* =============================================
   Canvas Area
   ============================================= */

.canvas {
  flex: 1;
  overflow: auto;
  position: relative;
  background: var(--theme-canvas-bg);
  background-image: radial-gradient(circle, var(--theme-dot-grid) 0.5px, transparent 0.5px);
}

.headerSvg {
  position: sticky;
  top: 0;
  z-index: 10;
  display: block;
  background: var(--theme-canvas-bg);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  overflow: visible;
}

.bodySvg {
  display: block;
  overflow: visible;
}

/* 既存 .svg は SharedFlowViewer がまだ参照しているため残す */
.svg {
  overflow: visible;
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: 既存の参照はそのままなので pass

- [ ] **Step 3: コミット**

```bash
git add src/features/editor/FlowEditor.module.css
git commit -m "feat(#322): add headerSvg/bodySvg styles for sticky lane header"
```

---

## Task 2: FlowEditor — ヘッダーSVG足場を追加（RED → GREEN）

**Files:**
- Test: `src/features/editor/FlowEditor.test.tsx`
- Modify: `src/features/editor/FlowEditor.tsx:1862-1900`

- [ ] **Step 1: 失敗テストを書く（RED）**

`FlowEditor.test.tsx` の末尾（`describe('FlowEditor', ...)` ブロック内、最後の `it`の後）に追加:

```tsx
  it('should render canvas as two stacked SVGs (header + body)', () => {
    render(<FlowEditor />)
    expect(screen.getByTestId('canvas-header-svg')).toBeInTheDocument()
    expect(screen.getByTestId('canvas-svg')).toBeInTheDocument()
  })
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npx vitest run src/features/editor/FlowEditor.test.tsx -t "two stacked SVGs"`
Expected: FAIL（`canvas-header-svg` not found）

- [ ] **Step 3: ヘッダーSVG を追加**

`FlowEditor.tsx:1862-1900` 付近の `.canvas` div の中、本体 `<svg ref={svgRef} ... data-testid="canvas-svg" ...>` の **直前** に空のヘッダーSVG を追加:

```tsx
        <div
          ref={canvasContainerRef}
          className={`${styles.canvas} ${editorSettings.showDotGrid ? '' : styles.canvasNoDots}`}
          style={{
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            cursor: connectFrom ? 'crosshair' : dragging ? 'grabbing' : 'default',
          }}
        >
          <svg
            data-testid="canvas-header-svg"
            width={svgW}
            height={(TM + HH + 30) * zoom}
            viewBox={`0 -30 ${svgW / zoom} ${TM + HH + 30}`}
            className={styles.headerSvg}
          />
          <svg
            ref={svgRef}
            data-testid="canvas-svg"
            width={svgW}
            height={svgH}
            viewBox={`0 -30 ${svgW / zoom} ${svgH / zoom}`}
            className={styles.bodySvg}
            style={{
              minWidth: '100%',
              cursor: draggingMemo ? 'grabbing' : undefined,
            }}
            onMouseMove={onSvgMouseMove}
            onMouseUp={onSvgMouseUp}
            onMouseLeave={() => {
              if (dragging) {
                setDragging(null)
                setDragOver(null)
                setDragOverMulti(null)
                setMultiDragAnchorCell(null)
              }
              if (connectFrom) {
                setConnectFrom(null)
                setConnectDragPt(null)
                setConnectFromPt(null)
                setActiveTool('select')
              }
              if (draggingMemo) setDraggingMemo(null)
            }}
          >
            ...既存 lanes.map / Lane move controls / Gap "+" / rows.map / nodes / arrows / memos すべてそのまま...
          </svg>
        </div>
```

注意:
- 既存の `className={styles.svg}` を `className={styles.bodySvg}` に変更
- 既存 `style={{ minWidth: '100%', minHeight: '100%', ... }}` から `minHeight` を削除（ヘッダー分離後はキャンバスを埋める必要なし）
- 本体 SVG の viewBox / width / height はこの段階では既存のまま（次タスク以降で本体専用に絞る）

- [ ] **Step 4: テスト pass を確認**

Run: `npx vitest run src/features/editor/FlowEditor.test.tsx -t "two stacked SVGs"`
Expected: PASS

- [ ] **Step 5: 全 unit テスト実行**

Run: `npm test`
Expected: 全 pass（既存テストへの影響なし）

- [ ] **Step 6: コミット**

```bash
git add src/features/editor/FlowEditor.tsx src/features/editor/FlowEditor.test.tsx
git commit -m "feat(#322): add empty header svg scaffold above body svg"
```

---

## Task 3: ヘッダーSVG にレーンヘッダー要素を移植（背景 / アクセント / ドット / ラベル）

**Files:**
- Test: `src/features/editor/FlowEditor.test.tsx`
- Modify: `src/features/editor/FlowEditor.tsx:1901-2048`

- [ ] **Step 1: 失敗テストを書く（RED）**

`FlowEditor.test.tsx` に追加:

```tsx
  it('should render lane name labels inside header svg, not body svg', () => {
    render(<FlowEditor />)
    const headerSvg = screen.getByTestId('canvas-header-svg')
    const bodySvg = screen.getByTestId('canvas-svg')
    // デフォルトレーンの 1 つ目の名前を取得
    const allTexts = headerSvg.querySelectorAll('text')
    const headerLabels = Array.from(allTexts).map((t) => t.textContent)
    // 本体 SVG にはレーン名ラベル（ヘッダー部分の text）が含まれないこと
    const bodyTexts = bodySvg.querySelectorAll('text')
    const bodyLabels = Array.from(bodyTexts).map((t) => t.textContent)
    // ヘッダー側に少なくとも 1 つレーン名がある
    expect(headerLabels.length).toBeGreaterThan(0)
    // 本体側にレーン名（ヘッダー部分のもの）が重複していない
    headerLabels.forEach((label) => {
      if (label && label.length > 0) {
        // 本体 text には行番号などが含まれるが、レーン名が body にあってはいけない
        expect(bodyLabels).not.toContain(label)
      }
    })
  })

  it('should render lane color accent dot inside header svg', () => {
    render(<FlowEditor />)
    const headerSvg = screen.getByTestId('canvas-header-svg')
    const circles = headerSvg.querySelectorAll('circle')
    // レーン数と同じだけドット circle が描画されている
    expect(circles.length).toBeGreaterThan(0)
  })
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npx vitest run src/features/editor/FlowEditor.test.tsx -t "lane name labels inside header"`
Expected: FAIL（headerSvg に text がない）

- [ ] **Step 3: ヘッダーSVG にレーンヘッダー描画を移植**

`FlowEditor.tsx` の `<svg data-testid="canvas-header-svg" ...>` を以下のように更新（中身に lanes.map を追加）:

```tsx
          <svg
            data-testid="canvas-header-svg"
            width={svgW}
            height={(TM + HH + 30) * zoom}
            viewBox={`0 -30 ${svgW / zoom} ${TM + HH + 30}`}
            className={styles.headerSvg}
          >
            {/* Lane headers (sticky) */}
            {lanes.map((lane, li) => {
              const p = PALETTES[lane.ci]
              const x = laneX(li)
              const isSub = isGroupSub(lane)
              const isParent = isGroupParent(lane)
              const headerW = isParent ? getGroupWidth(lane, lanes, LW, G) : LW
              if (isSub) return null
              return (
                <g
                  key={`lane-header-${lane.id}`}
                  className={lane.id === slidingLaneId ? styles.laneSlideInAnim : undefined}
                >
                  <rect
                    x={x}
                    y={TM}
                    width={headerW}
                    height={HH}
                    rx={10}
                    fill={T.laneHeaderBg}
                  />
                  <rect
                    x={x}
                    y={TM + HH - 10}
                    width={headerW}
                    height={10}
                    fill={T.laneHeaderBg}
                  />
                  <rect
                    x={x + 16}
                    y={TM + HH - 2.5}
                    width={headerW - 32}
                    height={2}
                    rx={1}
                    fill={p.dot}
                    opacity={T.laneAccentOpacity}
                  />
                  <circle cx={x + 20} cy={TM + HH / 2} r={4.5} fill={p.dot} />
                  <rect
                    x={x}
                    y={TM}
                    width={headerW}
                    height={HH}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation()
                      setSelLane(selLane === lane.id ? null : lane.id)
                      setSelTask(null)
                      setSelArrow(null)
                      setMultiSel(new Set())
                    }}
                    onDoubleClick={(e: React.MouseEvent) => {
                      e.stopPropagation()
                      setEditLane(lane.id)
                      setSelLane(lane.id)
                      setTimeout(() => laneInputRef.current?.focus(), 40)
                    }}
                  />
                  {editLane === lane.id ? (
                    <foreignObject x={x + 32} y={TM + 9} width={headerW - 44} height={28}>
                      <input
                        ref={laneInputRef}
                        value={lane.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const v = e.target.value
                          setLanes((p2) =>
                            p2.map((l) => (l.id === lane.id ? { ...l, name: v } : l)),
                          )
                        }}
                        onBlur={() => setEditLane(null)}
                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
                          e.key === 'Enter' && !e.nativeEvent.isComposing && setEditLane(null)
                        }
                        className={styles.laneNameInput}
                      />
                    </foreignObject>
                  ) : (
                    <text
                      x={x + 32}
                      y={TM + HH / 2 + 1}
                      dominantBaseline="central"
                      fill={T.titleColor}
                      fontSize={12.5}
                      fontWeight={600}
                      style={{ pointerEvents: 'none', fontFamily: 'inherit' }}
                    >
                      {lane.name}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
```

- [ ] **Step 4: 本体SVG からヘッダー要素を削除**

`FlowEditor.tsx:1939-2020` の `!isSub && (<>...ヘッダー要素...</>)` ブロックと、その下の `!isSub && (editLane === lane.id ? <foreignObject>...</foreignObject> : <text>...</text>)` を本体SVG 側から削除する。本体SVG の `lanes.map` には以下だけが残るようにする:

- レーン背景 rect（`y={isSub ? TM + HH : TM}, height={isSub ? fullH - HH : fullH}`） — そのまま
- 選択ハイライト rect（次タスクで分割するので一旦そのまま）
- サブレーン縦点線
- 行ライン（rows.map ループ）

- [ ] **Step 5: テスト pass を確認**

Run: `npx vitest run src/features/editor/FlowEditor.test.tsx -t "lane name labels inside header"`
Expected: PASS

Run: `npx vitest run src/features/editor/FlowEditor.test.tsx -t "color accent dot"`
Expected: PASS

- [ ] **Step 6: 全 unit テスト実行**

Run: `npm test`
Expected: 全 pass。レーン名/編集に依存する既存テストが失敗したら修正（`getByText` 等は両方の SVG にまたがって検索される）。

- [ ] **Step 7: コミット**

```bash
git add src/features/editor/FlowEditor.tsx src/features/editor/FlowEditor.test.tsx
git commit -m "feat(#322): move lane headers (label/dot/accent/edit) into header svg"
```

---

## Task 4: 選択ハイライト rect を 2 分割

**Files:**
- Test: `src/features/editor/FlowEditor.test.tsx`
- Modify: `src/features/editor/FlowEditor.tsx`（ヘッダーSVG 内の `<g>` と本体SVG 内の `<g>`）

- [ ] **Step 1: 失敗テストを書く（RED）**

```tsx
  it('should render selection highlight in both header and body svgs when a lane is selected', async () => {
    const user = userEvent.setup()
    render(<FlowEditor />)
    // 1 番目のレーンヘッダーをクリックして選択
    const headerSvg = screen.getByTestId('canvas-header-svg')
    const bodySvg = screen.getByTestId('canvas-svg')
    // クリック対象のヘッダー hit rect（fill=transparent, cursor:pointer）
    const headerClickTargets = headerSvg.querySelectorAll('rect[style*="cursor: pointer"]')
    expect(headerClickTargets.length).toBeGreaterThan(0)
    await user.click(headerClickTargets[0] as Element)
    // 選択時の点線 rect（stroke-dasharray="5,3"）が両方の SVG に 1 つずつある
    const headerHl = headerSvg.querySelectorAll('rect[stroke-dasharray="5,3"]')
    const bodyHl = bodySvg.querySelectorAll('rect[stroke-dasharray="5,3"]')
    expect(headerHl.length).toBe(1)
    expect(bodyHl.length).toBe(1)
  })
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npx vitest run src/features/editor/FlowEditor.test.tsx -t "selection highlight in both"`
Expected: FAIL（ヘッダー側にハイライトがない）

- [ ] **Step 3: ヘッダーSVG 側にハイライト rect を追加**

ヘッダーSVG の `lanes.map` 内、`<rect ... rx={10} fill={T.laneHeaderBg} />` の **直後** に追加:

```tsx
                  {selLane === lane.id && !isSub && (
                    <rect
                      x={x + 1}
                      y={TM + 1}
                      width={headerW - 2}
                      height={HH - 2}
                      rx={9}
                      fill="none"
                      stroke={T.accent}
                      strokeWidth={1.5}
                      strokeDasharray="5,3"
                      opacity={0.5}
                    />
                  )}
```

- [ ] **Step 4: 本体SVG 側のハイライト rect を本体高さに変更**

本体SVG の `FlowEditor.tsx:1925-1938` の選択ハイライト rect を以下に変更（高さからヘッダー分を除外）:

```tsx
                  {isSel && (
                    <rect
                      x={x + 1}
                      y={TM + HH + 1}
                      width={LW - 2}
                      height={fullH - HH - 2}
                      rx={0}
                      fill="none"
                      stroke={T.accent}
                      strokeWidth={1.5}
                      strokeDasharray="5,3"
                      opacity={0.5}
                    />
                  )}
```

`isSub` のときは元々 `y={TM + HH + 1}` だったので変更なし。`isSub === false` の場合のみ y/height を上記に統一。

- [ ] **Step 5: テスト pass を確認**

Run: `npx vitest run src/features/editor/FlowEditor.test.tsx -t "selection highlight in both"`
Expected: PASS

- [ ] **Step 6: 全 unit テスト実行**

Run: `npm test`
Expected: 全 pass

- [ ] **Step 7: コミット**

```bash
git add src/features/editor/FlowEditor.tsx src/features/editor/FlowEditor.test.tsx
git commit -m "feat(#322): split lane selection highlight into header+body parts"
```

---

## Task 5: レーン移動ボタン（←/→）をヘッダーSVG に移植

**Files:**
- Test: `src/features/editor/FlowEditor.test.tsx`
- Modify: `src/features/editor/FlowEditor.tsx:2050-2125`

- [ ] **Step 1: 失敗テストを書く（RED）**

```tsx
  it('should render lane move buttons (←/→) inside header svg when a lane is selected', async () => {
    const user = userEvent.setup()
    render(<FlowEditor />)
    const headerSvg = screen.getByTestId('canvas-header-svg')
    const bodySvg = screen.getByTestId('canvas-svg')
    // 真ん中のレーン（index >= 1）を選択して両方のボタンが出るようにする
    const headerClickTargets = headerSvg.querySelectorAll('rect[style*="cursor: pointer"]')
    if (headerClickTargets.length >= 2) {
      await user.click(headerClickTargets[1] as Element)
    }
    // ヘッダー側に "←" or "→" の text が出る
    const headerArrows = Array.from(headerSvg.querySelectorAll('text'))
      .map((t) => t.textContent)
      .filter((c) => c === '←' || c === '→')
    expect(headerArrows.length).toBeGreaterThan(0)
    // 本体側には ←/→ がない
    const bodyArrows = Array.from(bodySvg.querySelectorAll('text'))
      .map((t) => t.textContent)
      .filter((c) => c === '←' || c === '→')
    expect(bodyArrows.length).toBe(0)
  })
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npx vitest run src/features/editor/FlowEditor.test.tsx -t "lane move buttons"`
Expected: FAIL（移動ボタンが本体側にある）

- [ ] **Step 3: 本体SVG から移動ボタンブロックを削除しヘッダーSVG に移動**

本体SVG の `FlowEditor.tsx:2050-2125` `{selLane && (() => {...})()}` ブロック（Lane move controls）を切り取り、ヘッダーSVG の `</svg>` の直前（`lanes.map` の後）に貼り付ける。コードは完全にそのまま。

ヘッダーSVG の構造（最終形）:

```tsx
          <svg data-testid="canvas-header-svg" ...>
            {/* Lane headers */}
            {lanes.map(...)}
            {/* Lane move controls */}
            {selLane && (() => { ...既存コードそのまま... })()}
          </svg>
```

- [ ] **Step 4: テスト pass を確認**

Run: `npx vitest run src/features/editor/FlowEditor.test.tsx -t "lane move buttons"`
Expected: PASS

- [ ] **Step 5: 全 unit テスト実行**

Run: `npm test`
Expected: 全 pass

- [ ] **Step 6: コミット**

```bash
git add src/features/editor/FlowEditor.tsx src/features/editor/FlowEditor.test.tsx
git commit -m "feat(#322): move lane move buttons into header svg"
```

---

## Task 6: Gap "+" を分割（hit + ボタン → ヘッダー、ホバー縦線 → 本体）

**Files:**
- Test: `src/features/editor/FlowEditor.test.tsx`
- Modify: `src/features/editor/FlowEditor.tsx:2126-2192`

- [ ] **Step 1: 失敗テストを書く（RED）**

```tsx
  it('should place lane gap hit area and + button in header svg', () => {
    render(<FlowEditor />)
    const headerSvg = screen.getByTestId('canvas-header-svg')
    const bodySvg = screen.getByTestId('canvas-svg')
    // hit rect は data-testid="lanegap-hit-0" など
    expect(headerSvg.querySelector('[data-testid="lanegap-hit-0"]')).not.toBeNull()
    expect(bodySvg.querySelector('[data-testid="lanegap-hit-0"]')).toBeNull()
  })
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npx vitest run src/features/editor/FlowEditor.test.tsx -t "lane gap hit area"`
Expected: FAIL

- [ ] **Step 3: Gap "+" を分割**

本体SVG の `FlowEditor.tsx:2126-2192` の `{Array.from({ length: lanes.length + 1 }, (_, gi) => {...})}` ブロックを以下のように分割する:

**ヘッダーSVG 側（`lanes.map` の後、移動ボタンの前に挿入）:**

```tsx
            {/* Gap "+" hit & button */}
            {Array.from({ length: lanes.length + 1 }, (_, gi) => {
              const gx =
                gi === 0
                  ? LM - G / 2
                  : gi === lanes.length
                    ? laneX(gi - 1) + LW + G / 2
                    : laneX(gi) - G / 2
              const gy = TM + HH / 2
              const isHov = hoveredLaneGap === gi
              const hitX =
                gi === 0 ? LM - 14 : gi === lanes.length ? laneX(gi - 1) + LW : laneX(gi) - G
              return (
                <g key={`gap-h-${gi}`}>
                  <rect
                    data-testid={`lanegap-hit-${gi}`}
                    x={hitX}
                    y={0}
                    width={gi === 0 || gi === lanes.length ? 14 : G}
                    height={TM + HH}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredLaneGap(gi)}
                    onMouseLeave={() => setHoveredLaneGap(null)}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation()
                      if (lanes.length === 0) {
                        insertLaneAt(gi)
                      } else {
                        setLaneDropdown({ gapIndex: gi, x: gx, y: gy + 16 })
                      }
                    }}
                  />
                  {isHov && (
                    <g style={{ pointerEvents: 'none' }}>
                      <circle cx={gx} cy={gy} r={10} fill={T.accent} />
                      <line x1={gx - 4} y1={gy} x2={gx + 4} y2={gy} stroke="#fff" strokeWidth={1.5} />
                      <line x1={gx} y1={gy - 4} x2={gx} y2={gy + 4} stroke="#fff" strokeWidth={1.5} />
                    </g>
                  )}
                </g>
              )
            })}
```

**本体SVG 側（既存 Gap ブロックを以下に置き換え — ホバー縦線のみ残す）:**

```tsx
            {/* Gap "+" hover dashed line (body side) */}
            {Array.from({ length: lanes.length + 1 }, (_, gi) => {
              if (hoveredLaneGap !== gi) return null
              const gx =
                gi === 0
                  ? LM - G / 2
                  : gi === lanes.length
                    ? laneX(gi - 1) + LW + G / 2
                    : laneX(gi) - G / 2
              return (
                <line
                  key={`gap-b-${gi}`}
                  x1={gx}
                  y1={TM + HH}
                  x2={gx}
                  y2={TM + HH + rows.length * RH}
                  stroke={T.accent}
                  strokeWidth={1.5}
                  strokeDasharray="4,3"
                  opacity={0.3}
                  style={{ pointerEvents: 'none' }}
                />
              )
            })}
```

- [ ] **Step 4: テスト pass を確認**

Run: `npx vitest run src/features/editor/FlowEditor.test.tsx -t "lane gap hit area"`
Expected: PASS

- [ ] **Step 5: 全 unit テスト実行**

Run: `npm test`
Expected: 全 pass

- [ ] **Step 6: コミット**

```bash
git add src/features/editor/FlowEditor.tsx src/features/editor/FlowEditor.test.tsx
git commit -m "feat(#322): split lane gap into header (hit/button) and body (hover line)"
```

---

## Task 7: 本体SVG の高さ計算を調整（ヘッダー分を引く）

**Files:**
- Modify: `src/features/editor/FlowEditor.tsx:679-680`

- [ ] **Step 1: 本体SVG の `height` 属性を調整**

`FlowEditor.tsx` の本体 `<svg ... height={svgH} ...>` を以下に変更:

```tsx
          <svg
            ref={svgRef}
            data-testid="canvas-svg"
            width={svgW}
            height={Math.max(
              containerSize.height - (TM + HH + 30) * zoom,
              (rows.length * RH + 60) * zoom,
            )}
            viewBox={`0 -30 ${svgW / zoom} ${svgH / zoom}`}
            ...
```

注意: viewBox はそのまま（既存座標系維持で本体内部のロジック変更を避ける）。本体SVG の表示領域だけがヘッダー分小さくなる。

- [ ] **Step 2: 動作確認（手動）**

開発サーバー起動して縦スクロールでヘッダー残留を確認（自動テスト不要、見た目のみ）。本タスクの目視は最終 Step 9 で実施するため、ここでは型チェックのみ。

Run: `npx tsc --noEmit`
Expected: pass

- [ ] **Step 3: 全 unit テスト実行**

Run: `npm test`
Expected: 全 pass

- [ ] **Step 4: コミット**

```bash
git add src/features/editor/FlowEditor.tsx
git commit -m "feat(#322): adjust body svg height to exclude header area"
```

---

## Task 8: SharedFlowViewer に同じ 2 SVG 構成を適用

**Files:**
- Test: `src/features/shared/SharedFlowViewer.test.tsx`
- Modify: `src/features/shared/SharedFlowViewer.tsx:240-322`

- [ ] **Step 1: 失敗テストを書く（RED）**

`SharedFlowViewer.test.tsx` に追加:

```tsx
  it('should render canvas as two stacked SVGs (header + body)', async () => {
    // 既存のテストと同じセットアップで render
    // ... 既存パターンに合わせて render(<SharedFlowViewer ... />) を実行
    expect(await screen.findByTestId('shared-canvas-header-svg')).toBeInTheDocument()
    expect(await screen.findByTestId('shared-canvas-svg')).toBeInTheDocument()
  })

  it('should render lane name labels inside shared header svg', async () => {
    // 既存のテストと同じセットアップで render
    const headerSvg = await screen.findByTestId('shared-canvas-header-svg')
    const texts = headerSvg.querySelectorAll('text')
    expect(texts.length).toBeGreaterThan(0)
  })
```

注意: SharedFlowViewer.test.tsx の既存パターン（mock データ、render 方法）を踏襲する。既存テストの 1 つを参照してセットアップをコピー。

- [ ] **Step 2: テスト失敗を確認**

Run: `npx vitest run src/features/shared/SharedFlowViewer.test.tsx -t "two stacked SVGs"`
Expected: FAIL

- [ ] **Step 3: SharedFlowViewer.tsx を分割**

`SharedFlowViewer.tsx:235-245` の `<svg viewBox=... >` を以下のように 2 SVG 構成に書き換える。`.canvas` 相当の wrapper div が必要なら追加し、CSS は SharedFlowViewer 専用の module css か FlowEditor のものを共用するかは既存パターンに合わせる。

```tsx
        <div className={sharedStyles.canvas}>
          <svg
            data-testid="shared-canvas-header-svg"
            width={totalW}
            height={TM + HH + 30}
            viewBox={`0 -30 ${totalW} ${TM + HH + 30}`}
            className={sharedStyles.headerSvg}
          >
            {/* Lane headers */}
            {sortedLanes.map((lane, li) => {
              const p = PALETTES[lane.colorIndex % PALETTES.length]
              const x = laneX(li)
              const isSub = isGroupSub(lane)
              const isParent = isGroupParent(lane)
              const headerW = isParent ? getGroupWidth(lane, sortedLanes, LW, G) : LW
              if (isSub) return null
              return (
                <g key={`lane-header-${lane.id}`}>
                  <rect x={x} y={TM} width={headerW} height={HH} rx={10} fill={T.laneHeaderBg} />
                  <rect
                    x={x}
                    y={TM + HH - 10}
                    width={headerW}
                    height={10}
                    fill={T.laneHeaderBg}
                  />
                  <rect
                    x={x + 16}
                    y={TM + HH - 2.5}
                    width={headerW - 32}
                    height={2}
                    rx={1}
                    fill={p.dot}
                    opacity={T.laneAccentOpacity}
                  />
                  <circle cx={x + 20} cy={TM + HH / 2} r={4.5} fill={p.dot} />
                  <text
                    x={x + 32}
                    y={TM + HH / 2 + 1}
                    dominantBaseline="central"
                    fill={T.titleColor}
                    fontSize={12.5}
                    fontWeight={600}
                    style={{ pointerEvents: 'none', fontFamily: 'inherit' }}
                  >
                    {lane.name}
                  </text>
                </g>
              )
            })}
          </svg>
          <svg
            data-testid="shared-canvas-svg"
            width={totalW}
            height={totalH}
            viewBox={`0 -30 ${totalW} ${totalH + 30}`}
            className={sharedStyles.bodySvg}
          >
            {/* Lane bodies (背景・サブレーン縦線・行ライン) */}
            {sortedLanes.map((lane, li) => {
              const x = laneX(li)
              const fullH = HH + rowCount * RH
              const isSub = isGroupSub(lane)
              return (
                <g key={`lane-body-${lane.id}`}>
                  <rect
                    x={x}
                    y={isSub ? TM + HH : TM}
                    width={LW}
                    height={isSub ? fullH - HH : fullH}
                    rx={isSub ? 0 : 10}
                    fill={T.laneBg}
                    stroke={T.laneBorder}
                    strokeWidth={0.5}
                  />
                  {isSub && (
                    <line
                      x1={x}
                      y1={TM + 6}
                      x2={x}
                      y2={TM + HH + rowCount * RH}
                      stroke={T.laneBorder}
                      strokeWidth={1.5}
                      strokeDasharray="4,3"
                      opacity={0.4}
                    />
                  )}
                  {Array.from({ length: rowCount }, (_, ri) =>
                    ri === 0 ? null : (
                      <line
                        key={ri}
                        x1={x + 8}
                        y1={TM + HH + ri * RH}
                        x2={x + LW - 8}
                        y2={TM + HH + ri * RH}
                        stroke={T.laneBorder}
                        strokeWidth={0.3}
                      />
                    ),
                  )}
                </g>
              )
            })}
            {/* Row numbers, Nodes, Arrows ... 既存コードそのまま */}
            ...
          </svg>
        </div>
```

CSS: 既存の SharedFlowViewer module css に `.canvas` `.headerSvg` `.bodySvg` を追加する（または FlowEditor.module.css と同じ定義）。`.canvas` は `overflow: auto; position: relative;`、`.headerSvg` は `position: sticky; top: 0; z-index: 10; background: var(--theme-canvas-bg); box-shadow: 0 2px 4px rgba(0,0,0,0.05);`、`.bodySvg` は `display: block;`。

- [ ] **Step 4: テスト pass を確認**

Run: `npx vitest run src/features/shared/SharedFlowViewer.test.tsx -t "two stacked SVGs"`
Expected: PASS

Run: `npx vitest run src/features/shared/SharedFlowViewer.test.tsx -t "lane name labels inside shared header"`
Expected: PASS

- [ ] **Step 5: 全 unit テスト実行**

Run: `npm test`
Expected: 全 pass

- [ ] **Step 6: コミット**

```bash
git add src/features/shared/SharedFlowViewer.tsx src/features/shared/SharedFlowViewer.test.tsx src/features/shared/SharedFlowViewer.module.css
git commit -m "feat(#322): apply sticky lane header to shared viewer"
```

---

## Task 9: ブラウザ目視確認（CLAUDE.md Workflow Step 6）

MCP playwright を使用して以下を確認する。確認後、問題があれば対応タスクに戻る。

- [ ] **Step 1: 開発サーバー起動**

Run: `npm run dev`（バックグラウンド）

- [ ] **Step 2: エディタで縦スクロール確認**

`.env.local` の `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` でログイン → 既存フロー（できれば行数の多いもの。なければ行を 20 行追加）を開く → 本体エリアを縦に 600px スクロール。

検証項目:
- レーンヘッダー（背景・色アクセント・ドット・レーン名）が画面上部に残る
- ヘッダー下に薄い影が見える（box-shadow 効果）
- 横スクロールでヘッダーがコンテンツと一緒に動く

スクリーンショットを `.screenshots/issue-322-editor-scroll.png` として保存。

- [ ] **Step 3: エディタでヘッダー編集確認**

レーン名をダブルクリック → input 表示 → 文字編集 → blur → 保存される。

- [ ] **Step 4: エディタでレーン選択 / 移動ボタン確認**

レーンヘッダーをクリック → 選択ハイライト（ヘッダー側 + 本体側両方）。`←` / `→` ボタンが表示される。クリックで移動。

- [ ] **Step 5: 共有ビュー確認**

エディタから共有 URL を取得 → シークレット窓で開く → 縦スクロールでヘッダー残留確認。スクリーンショット `.screenshots/issue-322-shared-scroll.png`。

- [ ] **Step 6: ズーム時の挙動確認**

ズーム +/- ボタン（または該当 UI）で zoom を変えてヘッダー固定が維持されるか確認。

- [ ] **Step 7: LCP 確認**

エディタページの LCP < 1秒 を確認。chrome-devtools の Performance または `console` で `PerformanceObserver` 経由で計測。1 秒超過なら原因を特定し改善タスクを追加。

- [ ] **Step 8: 開発サーバー停止 / プロセス掃除**

Run: `/cleanup` または該当プロセス kill。

---

## Task 10: 最新 main 同期 → push → PR → CI

CLAUDE.md Workflow Step 7-9 に従う。

- [ ] **Step 1: 最新 main 同期**

```bash
git pull origin main --rebase
npm test
```

全 pass を確認。

- [ ] **Step 2: 本番ビルド確認**

`~/.claude/skills/preview/SKILL.md` を参照して本番ビルドをローカルで起動 → 同じ目視確認を再実行。

- [ ] **Step 3: push & PR 作成**

```bash
git push -u origin feat/322-sticky-lane-header
gh pr create --title "feat(#322): freeze lane headers on vertical scroll" --body "$(cat <<'EOF'
## Summary
- Issue #322 対応
- レーンヘッダーを CSS `position: sticky` で固定し、縦スクロール時も画面上部に残るようにした
- エディタと共有ビュー両方に適用

## Test plan
- [ ] 縦スクロール時にレーンヘッダーが画面上部に残る
- [ ] 横スクロール時にヘッダーも一緒に移動
- [ ] レーン名のダブルクリック編集が動く
- [ ] レーン選択時の ←/→ 移動ボタンも固定される
- [ ] 親+サブ構成でも親ヘッダーが固定
- [ ] ズーム適用中も固定維持
- [ ] 共有ビューでも同じ挙動
- [ ] 全 unit テスト pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: CI watch & 修正ループ**

```bash
gh pr checks --watch
```

Fail があれば修正 → push → 再 watch。

- [ ] **Step 5: レビュー依頼**

```bash
gh pr comment --body '@claude PRをレビューして。
以下の観点で確認すること：
- バグ・ロジックの問題
- コードの重複・共通化できる処理
- 不要な複雑さ
結果は最終行に [A:要修正] [B:条件つき承認] [C:承認OK] のいずれかで明記。'
```

- [ ] **Step 6: レビュー修正ループ（CLAUDE.md Step 9）**

最大 10 回。1 分待機 → `gh pr view --json comments` → 判定 → 修正 or merge。

---

## Task 11: Merge & Deploy & Cleanup

CLAUDE.md Workflow Step 10-11 に従う。

- [ ] **Step 1: Merge**

```bash
gh pr merge --merge
sleep 30
MAIN=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')
git -C "$MAIN" fetch origin main
git -C "$MAIN" merge --ff-only origin/main
```

- [ ] **Step 2: Deploy 確認**

`~/.claude/skills/deploy/SKILL.md` を参照して本番反映を確認。

- [ ] **Step 3: Worktree 削除**

```bash
cd "$MAIN"
git worktree remove .worktrees/feat-322-sticky-lane-header
git branch -d feat/322-sticky-lane-header
git worktree list  # 残骸がないこと
```

- [ ] **Step 4: Issue クローズ確認**

PR マージで自動クローズされていることを確認。されていなければ手動クローズ。

---

## YAGNI（含めないもの）

- 横方向 sticky（Issue スコープ外）
- ヘッダー高さの動的調整
- ヘッダー描画ロジックの別ファイル化
- 自動 Playwright E2E（プロジェクトに未導入。手動目視確認で代替）
