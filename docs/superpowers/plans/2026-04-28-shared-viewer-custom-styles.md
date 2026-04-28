# SharedFlowViewer Custom Styles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 共有ビュー (`SharedFlowViewer`) でノード/矢印のカスタムスタイル（`bg`/`dash`/`strokeColor`/`color`）が反映されるよう、エディタ側と同じ fallback パターン (`カスタム値 || テーマデフォルト値`) を描画コードに適用する。

**Architecture:** API は既に値を返しており、`Node`/`Arrow` 型 (`src/features/editor/types.ts`) にもプロパティが定義済み。修正は `SharedFlowViewer.tsx` の3つの SVG 描画箇所（diamond node / rect node / arrow path+marker）のみ。新規ロジック・新規型・新規ヘルパーは不要。

**Tech Stack:** React, TypeScript, SVG, Vitest, React Testing Library

**Spec:** `docs/superpowers/specs/2026-04-28-shared-viewer-custom-styles-design.md`

**Issue:** [#312](https://github.com/tomohirof/flowline/issues/312)

---

## File Structure

| ファイル | 役割 | 変更種別 |
|---|---|---|
| `src/features/shared/SharedFlowViewer.tsx` | 共有ビューの SVG 描画 | 3箇所修正 |
| `src/features/shared/SharedFlowViewer.test.tsx` | 単体テスト | テスト追加 |

型定義 (`src/features/editor/types.ts`) は既に `bg?`/`dash?`/`strokeColor?`/`color?` を持っているため変更不要。

---

## Task 0: Setup（worktree 作成・main 最新化）

**Files:** なし（環境準備）

- [ ] **Step 1: main を最新化**

```bash
git checkout main
git fetch origin
git merge --ff-only origin/main
```

ff-only が通らない場合は中断して人間に報告。

- [ ] **Step 2: worktree 作成**

```bash
git worktree add .worktrees/fix-shared-styles-312 -b fix/shared-viewer-custom-styles-312
cd .worktrees/fix-shared-styles-312
MAIN=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')
for f in "$MAIN"/.env*; do [ -f "$f" ] && ln -sf "$f" .; done
```

- [ ] **Step 3: テストルール読込**

```bash
cat ~/.claude/rules/testing.md
```

---

## Task 1: 矢印スタイルのテスト追加（Red）

**Files:**
- Modify: `src/features/shared/SharedFlowViewer.test.tsx`

- [ ] **Step 1: テストを追加**

`SharedFlowViewer.test.tsx` の `describe('SharedFlowViewer', ...)` 末尾に以下を追加：

```typescript
  describe('arrow custom styles', () => {
    const flowWithArrow = (arrowOverrides: Partial<{ color: string; dash: string }>) => ({
      ...mockFlow,
      nodes: [
        { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
        { id: 'n2', laneId: 'lane-1', rowIndex: 1, label: 'B', note: null, orderIndex: 1 },
      ],
      arrows: [
        {
          id: 'a1',
          fromNodeId: 'n1',
          toNodeId: 'n2',
          comment: null,
          ...arrowOverrides,
        },
      ],
    })

    it('should apply arrow.dash to <path> stroke-dasharray', () => {
      render(<SharedFlowViewer flow={flowWithArrow({ dash: '8,4' })} />)
      const path = document.querySelector('path[stroke-dasharray="8,4"]')
      expect(path).not.toBeNull()
    })

    it('should apply arrow.color to <path> stroke', () => {
      render(<SharedFlowViewer flow={flowWithArrow({ color: '#ff0000' })} />)
      const path = document.querySelector('path[stroke="#ff0000"]')
      expect(path).not.toBeNull()
    })

    it('should apply arrow.color to <marker> polygon fill', () => {
      render(<SharedFlowViewer flow={flowWithArrow({ color: '#ff0000' })} />)
      const polygon = document.querySelector('marker polygon[fill="#ff0000"]')
      expect(polygon).not.toBeNull()
    })
  })
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npx vitest run src/features/shared/SharedFlowViewer.test.tsx
```

Expected: 3件 FAIL（`null` が返る／属性が存在しない）

- [ ] **Step 3: コミット**

```bash
git add src/features/shared/SharedFlowViewer.test.tsx
git commit -m "test(#312): add failing tests for arrow custom styles in shared viewer"
```

---

## Task 2: 矢印描画にカスタムスタイル適用（Green）

**Files:**
- Modify: `src/features/shared/SharedFlowViewer.tsx`（現 L451-469 周辺、`{/* Arrows */}` ブロック）

- [ ] **Step 1: 矢印 marker と path を修正**

`SharedFlowViewer.tsx` の `{/* Arrows */}` ブロックを以下のように修正：

```tsx
          {/* Arrows */}
          {arrowPaths.map(({ arrow, path }) => {
            const { d, mx, my } = path
            const ac = arrow.color || T.arrowColor
            const dashArr = arrow.dash || 'none'
            return (
              <g key={`arrow-${arrow.id}`}>
                <defs>
                  <marker
                    id={`sm-${arrow.id}`}
                    markerWidth="9"
                    markerHeight="8"
                    refX="8"
                    refY="4"
                    orient="auto"
                  >
                    <polygon points="0 0.5, 9 4, 0 7.5" fill={ac} />
                  </marker>
                </defs>
                <path
                  d={d}
                  stroke={ac}
                  strokeWidth={2}
                  strokeDasharray={dashArr}
                  fill="none"
                  markerEnd={`url(#sm-${arrow.id})`}
                />
                {arrow.comment && (
                  /* 既存のコメント描画はそのまま */
                  ...
                )}
              </g>
            )
          })}
```

実際の編集ポイント：
- L460 `<polygon points="0 0.5, 9 4, 0 7.5" fill={T.arrowColor} />` → `fill={ac}`
- L465 `stroke={T.arrowColor}` → `stroke={ac}`
- L466-467 の間に `strokeDasharray={dashArr}` を追加
- map コールバック先頭で `const ac = arrow.color || T.arrowColor` と `const dashArr = arrow.dash || 'none'` を追加

- [ ] **Step 2: テストを実行して通過を確認**

```bash
npx vitest run src/features/shared/SharedFlowViewer.test.tsx
```

Expected: 矢印関連3件が PASS、既存テストも PASS

- [ ] **Step 3: 全体テスト**

```bash
npm test
```

Expected: 全件 PASS

- [ ] **Step 4: コミット**

```bash
git add src/features/shared/SharedFlowViewer.tsx
git commit -m "fix(#312): apply arrow.color/dash to shared viewer arrow rendering"
```

---

## Task 3: rect ノードスタイルのテスト追加（Red）

**Files:**
- Modify: `src/features/shared/SharedFlowViewer.test.tsx`

- [ ] **Step 1: テストを追加**

Task 1 で追加した `describe('arrow custom styles', ...)` の後ろに以下を追加：

```typescript
  describe('rect node custom styles', () => {
    const flowWithNode = (nodeOverrides: Partial<{ bg: string; strokeColor: string; dash: string }>) => ({
      ...mockFlow,
      nodes: [
        {
          id: 'n1',
          laneId: 'lane-1',
          rowIndex: 0,
          label: 'A',
          note: null,
          orderIndex: 0,
          ...nodeOverrides,
        },
      ],
    })

    it('should apply node.dash to <rect> stroke-dasharray', () => {
      render(<SharedFlowViewer flow={flowWithNode({ dash: '8,4' })} />)
      const rect = document.querySelector('rect[stroke-dasharray="8,4"]')
      expect(rect).not.toBeNull()
    })

    it('should apply node.bg to <rect> fill', () => {
      render(<SharedFlowViewer flow={flowWithNode({ bg: '#abcdef' })} />)
      const rect = document.querySelector('rect[fill="#abcdef"]')
      expect(rect).not.toBeNull()
    })

    it('should apply node.strokeColor to <rect> stroke', () => {
      render(<SharedFlowViewer flow={flowWithNode({ strokeColor: '#ff00ff' })} />)
      const rect = document.querySelector('rect[stroke="#ff00ff"]')
      expect(rect).not.toBeNull()
    })
  })
```

- [ ] **Step 2: 失敗を確認**

```bash
npx vitest run src/features/shared/SharedFlowViewer.test.tsx
```

Expected: 3件 FAIL

- [ ] **Step 3: コミット**

```bash
git add src/features/shared/SharedFlowViewer.test.tsx
git commit -m "test(#312): add failing tests for rect node custom styles in shared viewer"
```

---

## Task 4: rect ノード描画にカスタムスタイル適用（Green）

**Files:**
- Modify: `src/features/shared/SharedFlowViewer.tsx`（現 L324-336）

- [ ] **Step 1: rect ノード描画を修正**

`SharedFlowViewer.tsx` の rect 描画ブロックを以下のように修正：

```tsx
                ) : (
                  <rect
                    x={c.x - TW / 2}
                    y={c.y - TH / 2}
                    width={TW}
                    height={TH}
                    fill={node.bg || T.nodeFill}
                    stroke={node.strokeColor || T.nodeStroke}
                    strokeWidth={1.2}
                    strokeDasharray={node.dash || 'none'}
                    rx={10}
                    style={{
                      filter: `drop-shadow(${T.nodeShadow.split('),')[0]})) drop-shadow(${T.nodeShadow.split('), ')[1] || '0 0 0 transparent'})`,
                    }}
                  />
                )}
```

変更点：
- L329 `fill={T.nodeFill}` → `fill={node.bg || T.nodeFill}`
- L330 `stroke={T.nodeStroke}` → `stroke={node.strokeColor || T.nodeStroke}`
- L331 と L332 の間に `strokeDasharray={node.dash || 'none'}` を追加

- [ ] **Step 2: テストを実行して通過を確認**

```bash
npx vitest run src/features/shared/SharedFlowViewer.test.tsx
```

Expected: rect 関連3件が PASS、既存・矢印テストも PASS

- [ ] **Step 3: 全体テスト**

```bash
npm test
```

Expected: 全件 PASS

- [ ] **Step 4: コミット**

```bash
git add src/features/shared/SharedFlowViewer.tsx
git commit -m "fix(#312): apply node.bg/strokeColor/dash to shared viewer rect rendering"
```

---

## Task 5: diamond ノードスタイルのテスト追加（Red）

**Files:**
- Modify: `src/features/shared/SharedFlowViewer.test.tsx`

- [ ] **Step 1: テストを追加**

Task 3 の後ろに以下を追加：

```typescript
  describe('diamond node custom styles', () => {
    const diamondFlow = (nodeOverrides: Partial<{ bg: string; strokeColor: string; dash: string }>) => ({
      ...mockFlow,
      nodes: [
        {
          id: 'n1',
          laneId: 'lane-1',
          rowIndex: 0,
          label: 'D',
          note: null,
          orderIndex: 0,
          shape: 'diamond' as const,
          ...nodeOverrides,
        },
      ],
    })

    it('should apply node.dash to <polygon> stroke-dasharray', () => {
      render(<SharedFlowViewer flow={diamondFlow({ dash: '3,3' })} />)
      const polygon = document.querySelector('polygon[stroke-dasharray="3,3"]')
      expect(polygon).not.toBeNull()
    })

    it('should apply node.bg to <polygon> fill', () => {
      render(<SharedFlowViewer flow={diamondFlow({ bg: '#123456' })} />)
      const polygon = document.querySelector('polygon[fill="#123456"]')
      expect(polygon).not.toBeNull()
    })

    it('should apply node.strokeColor to <polygon> stroke', () => {
      render(<SharedFlowViewer flow={diamondFlow({ strokeColor: '#654321' })} />)
      const polygon = document.querySelector('polygon[stroke="#654321"]')
      expect(polygon).not.toBeNull()
    })
  })
```

- [ ] **Step 2: 失敗を確認**

```bash
npx vitest run src/features/shared/SharedFlowViewer.test.tsx
```

Expected: 3件 FAIL

- [ ] **Step 3: コミット**

```bash
git add src/features/shared/SharedFlowViewer.test.tsx
git commit -m "test(#312): add failing tests for diamond node custom styles in shared viewer"
```

---

## Task 6: diamond ノード描画にカスタムスタイル適用（Green）

**Files:**
- Modify: `src/features/shared/SharedFlowViewer.tsx`（現 L313-322）

- [ ] **Step 1: diamond ノード描画を修正**

`SharedFlowViewer.tsx` の diamond 描画ブロックを以下のように修正：

```tsx
                {isDiamond ? (
                  <polygon
                    points={`${c.x},${c.y - DS} ${c.x + DS},${c.y} ${c.x},${c.y + DS} ${c.x - DS},${c.y}`}
                    fill={node.bg || T.nodeFill}
                    stroke={node.strokeColor || T.accent}
                    strokeWidth={1.2}
                    strokeDasharray={node.dash || 'none'}
                    style={{
                      filter: `drop-shadow(${T.nodeShadow.split('),')[0]})) drop-shadow(${T.nodeShadow.split('), ')[1] || '0 0 0 transparent'})`,
                    }}
                  />
                ) : (
```

変更点：
- L316 `fill={T.nodeFill}` → `fill={node.bg || T.nodeFill}`
- L317 `stroke={T.accent}` → `stroke={node.strokeColor || T.accent}`
- L318 と L319 の間に `strokeDasharray={node.dash || 'none'}` を追加

- [ ] **Step 2: テストを実行して通過を確認**

```bash
npx vitest run src/features/shared/SharedFlowViewer.test.tsx
```

Expected: diamond 関連3件が PASS、既存・矢印・rect テストも PASS

- [ ] **Step 3: 全体テスト**

```bash
npm test
```

Expected: 全件 PASS

- [ ] **Step 4: コミット**

```bash
git add src/features/shared/SharedFlowViewer.tsx
git commit -m "fix(#312): apply node.bg/strokeColor/dash to shared viewer diamond rendering"
```

---

## Task 7: デフォルト値 fallback の回帰防止テスト

**Files:**
- Modify: `src/features/shared/SharedFlowViewer.test.tsx`

- [ ] **Step 1: テストを追加**

Task 5 の後ろに以下を追加：

```typescript
  describe('default theme fallback (regression)', () => {
    it('should use theme defaults when node has no custom style', () => {
      render(<SharedFlowViewer flow={mockFlow} />)
      const rect = document.querySelector('rect')
      expect(rect).not.toBeNull()
      // dash 未指定時は 'none' が入る（実線）
      expect(rect!.getAttribute('stroke-dasharray')).toBe('none')
      // fill / stroke は何らかの値が入っているだけ確認（テーマに依存）
      expect(rect!.getAttribute('fill')).not.toBeNull()
      expect(rect!.getAttribute('stroke')).not.toBeNull()
    })

    it('should use theme defaults when arrow has no custom style', () => {
      const flowWithPlainArrow = {
        ...mockFlow,
        nodes: [
          { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: 'A', note: null, orderIndex: 0 },
          { id: 'n2', laneId: 'lane-1', rowIndex: 1, label: 'B', note: null, orderIndex: 1 },
        ],
        arrows: [
          { id: 'a1', fromNodeId: 'n1', toNodeId: 'n2', comment: null },
        ],
      }
      render(<SharedFlowViewer flow={flowWithPlainArrow} />)
      const path = document.querySelector('g[key^="arrow-"] path, path[stroke-dasharray="none"]') ||
                   document.querySelector('path[fill="none"]')
      // 何らかの path が描画されており、dash は 'none'
      const allPaths = Array.from(document.querySelectorAll('path[fill="none"]'))
      const arrowPath = allPaths.find(p => p.getAttribute('marker-end')?.startsWith('url(#sm-'))
      expect(arrowPath).not.toBeUndefined()
      expect(arrowPath!.getAttribute('stroke-dasharray')).toBe('none')
    })
  })
```

- [ ] **Step 2: テストを実行**

```bash
npx vitest run src/features/shared/SharedFlowViewer.test.tsx
```

Expected: 全件 PASS（実装が既にデフォルト fallback しているため Red にはならない／そのまま Green 確認）

- [ ] **Step 3: コミット**

```bash
git add src/features/shared/SharedFlowViewer.test.tsx
git commit -m "test(#312): cover default theme fallback for shared viewer styles"
```

---

## Task 8: 実画面検証

**Files:** なし（手動検証）

- [ ] **Step 1: 開発サーバ起動とログイン**

```bash
npm run dev
```

`.env.local` の `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` でログイン。

- [ ] **Step 2: テスト用フローを準備**

エディタで以下を含むフローを作成し共有 URL を発行：
- 破線（dashed）の矢印
- カスタム色の矢印
- カスタム背景色のノード
- カスタム枠色＋点線（dotted）のノード
- diamond ノード（カスタムスタイル付き）

- [ ] **Step 3: Playwright もしくは chrome-devtools で `/s/:token` を確認**

各スタイルがエディタと同じように表示されることを確認。スクリーンショットを `.screenshots/` に保存。

- [ ] **Step 4: LCP 計測**

LCP が 1秒以内であることを確認。超過した場合は原因調査して Task 4/6 に戻る。

- [ ] **Step 5: スタイル未指定のフローも確認**

既存の通常のフロー（カスタムスタイルなし）も `/s/:token` で表示が崩れていないことを確認。

---

## Task 9: 最新 main 同期＆PR 作成

**Files:** なし

- [ ] **Step 1: 最新 main を取り込み**

```bash
git pull origin main --rebase
npm test
```

全 PASS 必須。

- [ ] **Step 2: push & PR 作成**

```bash
git push -u origin fix/shared-viewer-custom-styles-312
gh pr create --title "fix(#312): 共有ビューでノード/矢印のカスタムスタイルを反映" --body "$(cat <<'EOF'
## Summary
- 共有ビュー (`SharedFlowViewer`) でエディタ設定の `bg`/`dash`/`strokeColor`/`color` が反映されない問題を修正
- diamond / rect ノードと矢印 (path + marker) の3箇所にエディタと同じ fallback パターンを適用
- 矢印先端マーカーの色も本体と揃え、見た目の不整合を解消

Closes #312

## Test plan
- [x] `arrow.dash`/`arrow.color` が `<path>` に反映
- [x] `arrow.color` が `<marker>` polygon にも反映
- [x] `node.bg`/`node.dash`/`node.strokeColor` が rect/diamond に反映
- [x] スタイル未指定時はテーマデフォルトで描画（回帰防止）
- [x] 実画面で破線・カスタム色のノード/矢印を確認
- [x] LCP < 1秒

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: CI 通過確認**

```bash
gh pr checks --watch
```

Fail の場合は修正 → push → 再 watch。

- [ ] **Step 4: 本番ビルド確認**

`~/.claude/skills/preview/SKILL.md` を参照して実行。

- [ ] **Step 5: レビュー依頼**

```bash
gh pr comment --body '@claude PRをレビューして。
以下の観点で確認すること：
- バグ・ロジックの問題
- コードの重複・共通化できる処理
- 不要な複雑さ
結果は最終行に [A:要修正] [B:条件つき承認] [C:承認OK] のいずれかで明記。'
```

---

## Task 10: レビュー対応 → Merge → Worktree Cleanup

**Files:** レビュー指摘に応じる

- [ ] **Step 1: レビューループ（最大10回）**

CLAUDE.md の Step 9 に従う。`claude` のコメントのみで判定。
- `[A:要修正]` / `[B:条件つき承認]`: 修正 → push → CI pass → 再レビュー依頼
- `[C:承認OK]`: Merge へ

- [ ] **Step 2: Merge**

```bash
gh pr merge --merge
sleep 30
MAIN=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')
git -C "$MAIN" fetch origin main
git -C "$MAIN" merge --ff-only origin/main
```

- [ ] **Step 3: デプロイ確認**

`~/.claude/skills/deploy/SKILL.md` を参照。

- [ ] **Step 4: Worktree cleanup**

```bash
cd "$MAIN"
git worktree remove .worktrees/fix-shared-styles-312
git branch -d fix/shared-viewer-custom-styles-312
git worktree list
```

---

## Self-Review Checklist

- ✅ Spec 全要件カバー: 矢印 dash/color/marker、rect bg/dash/strokeColor、diamond 同様、回帰防止
- ✅ Placeholder なし: TBD/TODO/「適切なエラー処理」等を含まない
- ✅ 型整合: `node.bg`/`node.dash`/`node.strokeColor`/`arrow.color`/`arrow.dash` は既存 `Node`/`Arrow` 型 (`src/features/editor/types.ts`) に定義済み
- ✅ 各ステップは bite-sized（2-5分）かつ実行可能なコマンド/コードを含む
- ✅ TDD（Red → Green）を全実装タスクで遵守
- ✅ commit を細かく分割（Red コミット → Green コミット）
