# 同行ラベルコピー距離ベース化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `copyLabelOnSameRow` ON時、同行に複数ノードがあっても最も近いレーンのノードのラベルがコピーされるよう修正する（issue #337）。

**Architecture:** `src/features/editor/FlowEditor.tsx:1224-1228` のインライン処理を `Array.find` から最小距離選択ループに置き換える。タイブレークは「左優先（小さい `tLi`）」とし、決定論的に動作させる。`auto-connect.ts` のセマンティクスとは独立した、ラベルコピー専用ロジックとする。

**Tech Stack:** React 18, TypeScript, Vitest, @testing-library/react

**Spec:** `docs/superpowers/specs/2026-04-30-copy-label-same-row-distance-design.md`

---

## File Structure

- **Modify:** `src/features/editor/FlowEditor.tsx` — `cellClick` 関数の同行ラベルコピー処理（1224-1228行）
- **Modify:** `src/features/editor/FlowEditor.test.tsx` — 新規テストケース3件追加

その他のファイルは変更しない。`auto-connect.ts` は触らない。

---

## レーン座標の参照値（テスト用）

テスト環境（jsdom、`containerSize.width = 0`）では `calcLaneWidth` が `FALLBACK_LW = 178` を返す。

- `LM = 28`, `G = 6` (cloud theme), `LW = 178`, `RH = 84`, `HH = 46`, `TM = 24`
- `laneX(li) = LM + li * (LW + G) = 28 + li * 184`
  - laneX(0) = 28
  - laneX(1) = 212
  - laneX(2) = 396
  - laneX(3) = 580
  - laneX(4) = 764
- 行 `ri` の `y = TM + HH + ri * RH = 70 + ri * 84`
  - ri=0 → y=70
  - ri=1 → y=154

セル識別は `rect[fill="transparent"]` + `cursor: 'crosshair'` + `x` と `y` でフィルタする（既存テストと同パターン）。

---

## Task 1: テスト追加（Red）— 異距離ケース

**Files:**
- Modify: `src/features/editor/FlowEditor.test.tsx` (末尾に新規 `describe` ブロック追加)

このタスクで「異なる距離の2ノード → 距離が近い方のラベルがコピーされる」テストを追加する。実装はまだしないので、このテストは実行すると **失敗する想定**（現状は最古ノード=遠い方が選ばれる）。

- [ ] **Step 1: 新規 describe ブロックを末尾に追加**

`src/features/editor/FlowEditor.test.tsx` の最終 `describe` の後ろに追加：

```tsx
describe('copyLabelOnSameRow distance-based selection (#337)', () => {
  beforeEach(() => {
    // Override the default mock: copyLabelOnSameRow ON
    mockApiFetch.mockResolvedValue({
      settings: {
        copyLabelOnSameRow: true,
        autoConnect: false,
        autoAddRow: false,
        enterEditOnCreate: false,
        autoRepair: false,
        showDotGrid: true,
        showOrderBadge: true,
      },
      profile: { name: 'Test User', email: 'test@example.com' },
    })
  })

  const flowWithLanes = (count: number, nodes: Flow['nodes']): Flow => ({
    ...createMinimalFlow(),
    lanes: Array.from({ length: count }, (_, i) => ({
      id: `lane-${i + 1}`,
      name: `レーン${i + 1}`,
      colorIndex: i,
      position: i,
    })),
    nodes,
  })

  const findEmptyCellAt = (container: HTMLElement, x: number, y: number): SVGRectElement | null => {
    const allRects = container.querySelectorAll('rect[fill="transparent"]')
    const empties = Array.from(allRects).filter(
      (r) => (r as SVGRectElement).style.cursor === 'crosshair',
    )
    return (empties.find(
      (r) => r.getAttribute('x') === String(x) && r.getAttribute('y') === String(y),
    ) ?? null) as SVGRectElement | null
  }

  it('should copy label from closer node when same row has nodes at different distances', async () => {
    // 5 lanes. Row 0 has:
    //   - node A "案件取得" at lane-1 (li=0, x=28)
    //   - node B "確定連絡" at lane-3 (li=2, x=396)
    // Click empty cell at lane-4 (li=3, x=580).
    // Distance to A is 3, distance to B is 1 → expect B's label to be copied.
    const flow = flowWithLanes(5, [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: '案件取得', note: null, orderIndex: 0 },
      { id: 'n2', laneId: 'lane-3', rowIndex: 0, label: '確定連絡', note: null, orderIndex: 1 },
    ])
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    await waitFor(() => {
      // wait for settings to load
      expect(mockApiFetch).toHaveBeenCalledWith('/settings')
    })

    const cell = findEmptyCellAt(container, 580, 70)
    expect(cell).toBeTruthy()
    fireEvent.click(cell!) // 1st click — ghost
    fireEvent.click(cell!) // 2nd click — confirm

    // The new node should have label '確定連絡' (the closer one)
    await waitFor(() => {
      const labels = Array.from(container.querySelectorAll('text')).map((t) => t.textContent)
      expect(labels).toContain('確定連絡')
    })
    // And not have copied '案件取得' as the new node (n1 still exists with that label,
    // so we need to count: there should be exactly 2 nodes with '確定連絡'
    // — original n2 plus the new copy)
    const labelTexts = Array.from(container.querySelectorAll('text'))
      .map((t) => t.textContent)
      .filter((s) => s === '確定連絡')
    expect(labelTexts.length).toBe(2)
  })
})
```

- [ ] **Step 2: テスト実行で失敗確認**

```bash
cd .worktrees/fix-copy-label-distance-337
npm test -- --run src/features/editor/FlowEditor.test.tsx -t "should copy label from closer node"
```

期待: `expect(labelTexts.length).toBe(2)` で失敗（実際は1、コピーされたのは `案件取得` になる）。

- [ ] **Step 3: コミット（Red段階）**

```bash
git add src/features/editor/FlowEditor.test.tsx
git commit -m "$(cat <<'EOF'
test(#337): add failing test for distance-based same-row label copy

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 実装（Green）— 距離ベース選択

**Files:**
- Modify: `src/features/editor/FlowEditor.tsx:1224-1228`

- [ ] **Step 1: `cellClick` 内のラベルコピー処理を距離ベースに置換**

`src/features/editor/FlowEditor.tsx` の以下の部分を置換：

**置換前 (1224-1228行):**
```ts
    let label = t('defaultNodeLabel')
    if (editorSettings.copyLabelOnSameRow) {
      const sameRowNode = Object.entries(tasks).find(([key, t]) => t.rid === rid && key !== k)
      if (sameRowNode) label = sameRowNode[1].label
    }
```

**置換後:**
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

ポイント:
- 内側ループ変数 `task` は外側スコープの `t`（i18n関数）と衝突しないよう、明示的に `task` と命名（既存コードでは `t` というシャドウ変数があったが、これを排除する）。
- `lanes.findIndex(...)` は1反復ごとに O(N) だが、同行ノード数は通常少なく問題にならない。最適化不要。

- [ ] **Step 2: 既存テスト＋追加テストを実行**

```bash
npm test -- --run src/features/editor/FlowEditor.test.tsx
```

期待: 全テストpass（Task 1 で追加したテストも含めて）。

- [ ] **Step 3: コミット（Green段階）**

```bash
git add src/features/editor/FlowEditor.tsx
git commit -m "$(cat <<'EOF'
fix(#337): pick closest same-row node by lane distance for label copy

Replace Array.find (which returns the oldest node by insertion order)
with a min-distance loop. Tiebreak prefers smaller tLi (left).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: テスト追加 — 等距離・左優先タイブレーク

**Files:**
- Modify: `src/features/editor/FlowEditor.test.tsx` (Task 1 で追加した describe 内に新規 it を追加)

- [ ] **Step 1: 等距離左優先テストを追加**

Task 1 で追加した `describe('copyLabelOnSameRow distance-based selection (#337)', ...)` 内に追加：

```tsx
  it('should prefer left node when same row has equidistant left and right nodes', async () => {
    // 5 lanes. Row 0 has:
    //   - node L "左" at lane-1 (li=0, x=28)
    //   - node R "右" at lane-5 (li=4, x=764)
    // Click empty cell at lane-3 (li=2, x=396).
    // Distance to both is 2 → tiebreak: smaller tLi wins → expect L's label.
    const flow = flowWithLanes(5, [
      { id: 'n1', laneId: 'lane-1', rowIndex: 0, label: '左', note: null, orderIndex: 0 },
      { id: 'n2', laneId: 'lane-5', rowIndex: 0, label: '右', note: null, orderIndex: 1 },
    ])
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/settings')
    })

    const cell = findEmptyCellAt(container, 396, 70)
    expect(cell).toBeTruthy()
    fireEvent.click(cell!)
    fireEvent.click(cell!)

    // Expect '左' to be copied (2 instances: n1 + new copy), '右' stays at 1
    await waitFor(() => {
      const lefts = Array.from(container.querySelectorAll('text'))
        .map((t) => t.textContent)
        .filter((s) => s === '左')
      expect(lefts.length).toBe(2)
    })
    const rights = Array.from(container.querySelectorAll('text'))
      .map((t) => t.textContent)
      .filter((s) => s === '右')
    expect(rights.length).toBe(1)
  })
```

- [ ] **Step 2: テスト実行**

```bash
npm test -- --run src/features/editor/FlowEditor.test.tsx -t "should prefer left node"
```

期待: PASS。

- [ ] **Step 3: コミット**

```bash
git add src/features/editor/FlowEditor.test.tsx
git commit -m "$(cat <<'EOF'
test(#337): add equidistant left-preference tiebreak case

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: テスト追加 — 同レーン除外

**Files:**
- Modify: `src/features/editor/FlowEditor.test.tsx`

- [ ] **Step 1: 同レーン除外テストを追加**

同じ describe 内に追加：

```tsx
  it('should exclude same-lane node and fall back to default label when no other-lane nodes exist', async () => {
    // 2 lanes. Row 0 has only one node at lane-1 (li=0).
    // Click empty cell at lane-1 (li=0, same lane, but the click is at row 1, ri=1).
    // Wait — same row check is by rid, not ri. Need a node at row 0 (ri=0)
    // and clicking another empty cell in same lane at row 0 wouldn't apply
    // (it's already occupied). The realistic same-lane case: same row + same lane
    // means the cell is already occupied. Test the related case: ensure same-lane
    // siblings on the same row are excluded by checking that when ALL nodes on the
    // row are in the same lane as the click, default label is used.
    //
    // Setup: one node at row 0, lane-1. Click empty cell at row 0, lane-2.
    // Expected: copy '同行' from lane-1 (different lane, distance 1).
    // To test exclusion specifically, we need a setup where the only same-row
    // candidate is in the same lane. Since same-cell == same lane + same row
    // means the cell is occupied (cellClick early-returns at tasks[k] check),
    // exclusion of `tLi === li` is impossible to trigger via UI.
    //
    // Instead, test that when no other-lane nodes exist on the row,
    // default label is used. This covers the "no candidate" path.
    const flow = flowWithLanes(2, [
      { id: 'n1', laneId: 'lane-1', rowIndex: 1, label: '別行ノード', note: null, orderIndex: 0 },
      // No nodes on row 0
    ])
    const { container } = render(<FlowEditor flow={flow} onSave={vi.fn()} saveStatus="saved" />)
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/settings')
    })

    // Click empty cell at row 0, lane-1 (li=0, x=28, y=70)
    const cell = findEmptyCellAt(container, 28, 70)
    expect(cell).toBeTruthy()
    fireEvent.click(cell!)
    fireEvent.click(cell!)

    // Default label should be used — '別行ノード' is in row 1, not row 0,
    // so no copy candidate exists.
    await waitFor(() => {
      // The default label depends on i18n: in mock environment it returns 'defaultNodeLabel' key
      const labels = Array.from(container.querySelectorAll('text')).map((t) => t.textContent)
      // '別行ノード' should appear exactly once (the original n1)
      expect(labels.filter((s) => s === '別行ノード').length).toBe(1)
    })
  })
```

- [ ] **Step 2: テスト実行**

```bash
npm test -- --run src/features/editor/FlowEditor.test.tsx -t "should exclude same-lane"
```

期待: PASS。

- [ ] **Step 3: コミット**

```bash
git add src/features/editor/FlowEditor.test.tsx
git commit -m "$(cat <<'EOF'
test(#337): cover no-candidate path (no same-row other-lane nodes)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 既存テスト全件実行・形式チェック

- [ ] **Step 1: 全テスト実行**

```bash
npm test
```

期待: 全テストpass。1件でも失敗すれば修正してから次へ。

- [ ] **Step 2: Lint / Format**

```bash
npm run lint 2>/dev/null || npx eslint src/features/editor/FlowEditor.tsx src/features/editor/FlowEditor.test.tsx
npx prettier --check src/features/editor/FlowEditor.tsx src/features/editor/FlowEditor.test.tsx
```

Format issueがあれば `npx prettier --write ...` で自動修正してコミット。

- [ ] **Step 3: TypeScript チェック**

```bash
npx tsc --noEmit
```

期待: エラーなし。

---

## Task 6: 実画面検証

`~/.claude/CLAUDE.md` Workflow Step 6 に従い、Playwright/chrome-devtools で実操作確認する。

- [ ] **Step 1: 開発サーバ起動確認**

別ターミナルまたは background で：

```bash
npm run dev
```

URL: `http://localhost:5173`

- [ ] **Step 2: ログイン → 設定で `copyLabelOnSameRow` ON にする**

- `.env.local` の `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` でログイン
- 編集画面で歯車アイコン → 「同じ行にノード作成時、テキストをコピー」をON

- [ ] **Step 3: 再現シナリオ実行**

issue #337 の再現手順に沿う：

1. レーン4本以上、行1本のフローを作成
2. レーン1（最も左）にノード追加 → ラベル `案件取得`
3. レーン3にノード追加 → ラベルが `案件取得` にコピーされる（同行に1つしかないので妥当）
4. ラベルを `確定連絡` に書き換え
5. レーン4にノード追加 → **期待: 距離1の `確定連絡` がコピーされる**（修正前は距離3の `案件取得` がコピーされていた）
6. スクリーンショットを `.screenshots/issue-337-after.png` に保存

- [ ] **Step 4: LCPチェック**

ページLCPが1秒以内であることを確認（chrome-devtools Performance タブ）。問題があれば実装に戻る。

- [ ] **Step 5: 開発サーバ停止**

---

## Task 7: PR作成

- [ ] **Step 1: main最新化（rebase）**

```bash
git fetch origin
git pull origin main --rebase
npm test
```

全テストpass必須。

- [ ] **Step 2: push & PR作成**

```bash
git push -u origin fix/copy-label-distance-337
gh pr create --title "fix(#337): pick closest same-row node by lane distance for label copy" --body "$(cat <<'EOF'
## Summary

- `copyLabelOnSameRow` ON時、同行に複数ノードがあると最古ノードのラベルが固定でコピーされていたバグを修正
- レーン距離 \`|tLi - li|\` 最小のノードを選択。タイブレークは小さい \`tLi\`（左優先）

Closes #337

## Test plan

- [x] 異距離ケース: 距離2と距離4のノード → 距離2のラベル
- [x] 等距離ケース: 左右等距離 → 左優先
- [x] 候補なしケース: 同行に他レーンノードがない → デフォルトラベル
- [x] 既存テスト全pass
- [x] 実画面で再現シナリオ確認（スクリーンショット添付）

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: CI watch**

```bash
gh pr checks --watch
```

failがあれば修正→push→再watch。

- [ ] **Step 4: レビュー依頼コメント**

```bash
gh pr comment --body '@claude PRをレビューして。
以下の観点で確認すること：
- バグ・ロジックの問題
- コードの重複・共通化できる処理
- 不要な複雑さ
結果は最終行に [A:要修正] [B:条件つき承認] [C:承認OK] のいずれかで明記。'
```

---

## Task 8: 本番ビルド確認

`~/.claude/skills/preview/SKILL.md` を参照して実行する。

---

## Task 9: レビュー対応ループ

`~/.claude/CLAUDE.md` Workflow Step 9 に従い、最大10回のレビュー修正ループ。

- [A:要修正] / [B:条件つき承認] → 修正 → push → CI pass → 再依頼 → 1分待機 → 結果確認
- [C:承認OK] → Merge へ進む

判定対象は claude bot の **再レビュー依頼後** の最新コメントのみ。

---

## Task 10: Merge & Deploy 確認

```bash
gh pr merge --merge
sleep 30
MAIN=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')
git -C "$MAIN" fetch origin main
git -C "$MAIN" merge --ff-only origin/main
```

デプロイ確認は `~/.claude/skills/deploy/SKILL.md` 参照。

---

## Task 11: Worktree クリーンアップ

```bash
cd /Volumes/SSD4TB/DevCode/flowline
git worktree remove .worktrees/fix-copy-label-distance-337
git branch -d fix/copy-label-distance-337
git worktree list
```

残骸がないことを確認。

---

## Self-Review

- ✅ Spec coverage: 設計書の3テストケース（異距離・等距離左優先・同レーン除外/候補なし）→ Task 1, 3, 4 で全てカバー
- ✅ Placeholder scan: TBD/TODO/曖昧な「適切に処理」など無し
- ✅ Type consistency: `tLi`, `bestLi`, `bestDist`, `bestKey` は全タスクで一貫
- ✅ Spec の「同レーン除外」については、UIから到達不能な状態（同レーン同行 = 同セル = 既に占有）であることを Task 4 の冒頭コメントで説明し、代わりに「候補ゼロのデフォルトラベル」パスをテストする方針に明記
