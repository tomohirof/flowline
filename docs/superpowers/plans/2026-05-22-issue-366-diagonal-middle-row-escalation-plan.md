# Diagonal Middle-Row Escalation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `detectDiagonalDetour` で source-detour / target-detour / both-detour 選択時に middleRowHits を評価して `my` をシフトし、issue #366 の複合障害貫通を解消する。

**Architecture:** `detectDiagonalDetour` 内で middleRowHits の計算を 1 箇所に集約し、source/target/both detour すべての分岐で適用する `shiftedMy` を計算するヘルパー関数 `computeShiftedMy` を導入。各 kind のブランチで `my` を `shiftedMy` に差し替え、`departY` / `approachY` も `shiftedMy` ベースで再計算する。

**Tech Stack:** TypeScript, Vitest, React (visual verification)

**Spec:** `docs/superpowers/specs/2026-05-22-issue-366-diagonal-middle-row-escalation-design.md`

**Project workflow:** 実装は `.worktrees/fix-issue-366-diagonal-middle-row/` で実施し、最終的に `git pull origin main --rebase` → `git push` → `gh pr create` → CI watch → review loop → merge の流れを取る (CLAUDE.md 準拠)。

---

## File Structure

**Modified files:**
- `src/lib/arrow-routing.ts` — `detectDiagonalDetour` 内に `computeShiftedMy` ヘルパー追加、各 kind ブランチに適用
- `src/lib/arrow-routing.test.ts` — 5 件の新規テスト追加

**No new files. No removed files.**

---

## Task 0: Worktree 作成と環境準備

**Files:** (no edits — environment only)

- [ ] **Step 1: main を最新化**

```bash
git checkout main
git fetch origin
git merge --ff-only origin/main
```

Expected: `Already up to date.` または fast-forward 成功。失敗時は中断。

- [ ] **Step 2: worktree 作成 + ブランチ作成**

```bash
git worktree add .worktrees/fix-issue-366-diagonal-middle-row -b fix-issue-366-diagonal-middle-row
cd .worktrees/fix-issue-366-diagonal-middle-row
```

- [ ] **Step 3: .env 系シンボリックリンク**

```bash
MAIN=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')
for f in "$MAIN"/.env*; do [ -f "$f" ] && ln -sf "$f" .; done
```

- [ ] **Step 4: issue にラベル付与**

```bash
gh issue edit 366 --add-label "作業開始"
```

ラベルが無い場合は `gh label create "作業開始" --color "#E11D48"` で先に作成。

- [ ] **Step 5: ベースラインのテスト確認**

```bash
npm test -- arrow-routing 2>&1 | tail -20
```

Expected: 既存テスト全 pass。

---

## Task 1: Test (Red) — source-detour + middle-row

**Files:**
- Modify: `src/lib/arrow-routing.test.ts` (`describe('detectDiagonalDetour', ...)` ブロック内に追加)

- [ ] **Step 1: 既存 `describe('detectDiagonalDetour'` ブロック末尾の位置を確認**

```bash
grep -n "describe('detectDiagonalDetour'" src/lib/arrow-routing.test.ts
```

末尾 `})` の直前に新規テストを追加する。

- [ ] **Step 2: source-detour + middle-row のテストを追加**

`describe('detectDiagonalDetour', ...)` ブロックの末尾（最後の `})` の直前）に以下を挿入:

```ts
  it('should shift my when source-detour selected AND middle-row obstacle exists', () => {
    // s=(100, 100), e=(300, 300), my=200
    // source col hit at (100, 200) → source-detour 確定
    // middle row hit at (200, 200) → my を shiftedMy にシフトすべき
    const obstacles: Bbox[] = [
      { x: 100, y: 200, w: 80, h: 50 }, // source col & middle row
      { x: 200, y: 200, w: 80, h: 50 }, // middle row のみ (target col=300 ではない)
    ]
    const r = detectDiagonalDetour({ x: 100, y: 100 }, { x: 300, y: 300 }, obstacles)
    expect(r?.kind).toBe('source-detour')
    // 障害下端 (200 + 25) + DETOUR_MARGIN (14) = 239
    if (r?.kind === 'source-detour') {
      expect(r.my).toBeGreaterThan(225) // shifted below middle-row obstacles
      expect(r.my).toBeLessThan(300) // 範囲内
    }
  })
```

- [ ] **Step 3: テスト実行で fail を確認**

```bash
npm test -- arrow-routing.test --run 2>&1 | grep -A 3 "should shift my when source-detour"
```

Expected: FAIL with `r.my` が現在 `200` (=未シフト) のため `expected > 225` で失敗。

- [ ] **Step 4: コミット**

```bash
git add src/lib/arrow-routing.test.ts
git commit -m "$(cat <<'EOF'
test(#366): add failing test for source-detour + middle-row escalation

source-detour 選択時に middle-row hit が無視され my が
シフトされない現状挙動を再現する Red テストを追加。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Test (Red) — target-detour + middle-row (鏡像)

**Files:**
- Modify: `src/lib/arrow-routing.test.ts`

- [ ] **Step 1: テスト追加**

Task 1 で追加したテストの直後に挿入:

```ts
  it('should shift my when target-detour selected AND middle-row obstacle exists', () => {
    // s=(100, 100), e=(300, 300), my=200
    // target col hit at (300, 200) → target-detour 確定
    // middle row hit at (200, 200)
    const obstacles: Bbox[] = [
      { x: 300, y: 200, w: 80, h: 50 }, // target col & middle row
      { x: 200, y: 200, w: 80, h: 50 }, // middle row のみ
    ]
    const r = detectDiagonalDetour({ x: 100, y: 100 }, { x: 300, y: 300 }, obstacles)
    expect(r?.kind).toBe('target-detour')
    if (r?.kind === 'target-detour') {
      expect(r.my).toBeGreaterThan(225)
      expect(r.my).toBeLessThan(300)
    }
  })
```

- [ ] **Step 2: テスト実行で fail を確認**

```bash
npm test -- arrow-routing.test --run 2>&1 | grep -A 3 "should shift my when target-detour"
```

Expected: FAIL.

- [ ] **Step 3: コミット**

```bash
git add src/lib/arrow-routing.test.ts
git commit -m "$(cat <<'EOF'
test(#366): add failing test for target-detour + middle-row escalation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Test (Red) — both-detour + middle-row

**Files:**
- Modify: `src/lib/arrow-routing.test.ts`

- [ ] **Step 1: テスト追加**

Task 2 のテスト直後に挿入:

```ts
  it('should shift my when both-detour selected AND middle-row obstacle exists', () => {
    // s=(100, 100), e=(300, 300), my=200
    // 両列 hit + 中央行 hit
    const obstacles: Bbox[] = [
      { x: 100, y: 200, w: 80, h: 50 }, // source col & middle row
      { x: 300, y: 200, w: 80, h: 50 }, // target col & middle row
      { x: 200, y: 200, w: 80, h: 50 }, // 中央のみ
    ]
    const r = detectDiagonalDetour({ x: 100, y: 100 }, { x: 300, y: 300 }, obstacles)
    expect(r?.kind).toBe('both-detour')
    if (r?.kind === 'both-detour') {
      expect(r.my).toBeGreaterThan(225)
      expect(r.my).toBeLessThan(300)
    }
  })
```

- [ ] **Step 2: テスト実行で fail を確認**

```bash
npm test -- arrow-routing.test --run 2>&1 | grep -A 3 "should shift my when both-detour"
```

Expected: FAIL.

- [ ] **Step 3: コミット**

```bash
git add src/lib/arrow-routing.test.ts
git commit -m "$(cat <<'EOF'
test(#366): add failing test for both-detour + middle-row escalation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Test (Red) — issue #366 再現ケース

**Files:**
- Modify: `src/lib/arrow-routing.test.ts`

- [ ] **Step 1: テスト追加**

Task 3 のテスト直後に挿入:

```ts
  it('should avoid middle-row obstacle in issue #366 reproduction case', () => {
    // issue #366: 菱形 (fromSide:"bottom") + 3点同時障害
    // source 店舗/ステータス変更 (col0=100, row0=100)
    // target グルプラ(2)/請求 (col2=300, row2=300)
    // 障害①: 店舗/確認連絡(9) (col0=100, row1=200) — source 列・中央行
    // 障害②: グルプラ/確認連絡(8) (col1=200, row1=200) — 中央行
    // 障害③: グルプラ/請求 (col1=200, row2=300) — target 隣接列・target 行
    const obstacles: Bbox[] = [
      { x: 100, y: 200, w: 80, h: 50 },
      { x: 200, y: 200, w: 80, h: 50 },
      { x: 200, y: 300, w: 80, h: 50 },
    ]
    const r = detectDiagonalDetour({ x: 100, y: 100 }, { x: 300, y: 300 }, obstacles)
    // source col に障害①、target col に障害無し、中央行に障害② → source-detour + shifted my
    expect(r?.kind).toBe('source-detour')
    if (r?.kind === 'source-detour') {
      // middle horizontal が y=200 (row1) を回避するため my > 225 になるべき
      expect(r.my).toBeGreaterThan(225)
    }
  })
```

- [ ] **Step 2: テスト実行で fail を確認**

```bash
npm test -- arrow-routing.test --run 2>&1 | grep -A 3 "issue #366 reproduction"
```

Expected: FAIL.

- [ ] **Step 3: コミット**

```bash
git add src/lib/arrow-routing.test.ts
git commit -m "$(cat <<'EOF'
test(#366): add failing test for issue reproduction case

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Test (Red) — range-check 失敗フォールバック

**Files:**
- Modify: `src/lib/arrow-routing.test.ts`

- [ ] **Step 1: テスト追加**

Task 4 のテスト直後に挿入:

```ts
  it('should fall back to original my when shiftedMy exceeds row bounds', () => {
    // 行間隔が狭く shiftedMy が source 行 / target 行を侵食するケース
    // s=(100, 100), e=(300, 160), my=130 — 行差 60 で狭い
    // 中央行に大きな障害があると shiftedMy が範囲外になる
    const obstacles: Bbox[] = [
      { x: 100, y: 130, w: 80, h: 50 }, // source col & middle row
      { x: 200, y: 130, w: 80, h: 50 }, // 中央のみ — 下端 155, +14 = 169 > yHigh-25-1 = 134
    ]
    const r = detectDiagonalDetour({ x: 100, y: 100 }, { x: 300, y: 160 }, obstacles)
    // range-check 失敗 → 従来の my (=130) で source-detour
    expect(r?.kind).toBe('source-detour')
    if (r?.kind === 'source-detour') {
      expect(r.my).toBe(130) // unshifted
    }
  })
```

- [ ] **Step 2: テスト実行で fail を確認**

```bash
npm test -- arrow-routing.test --run 2>&1 | grep -A 3 "fall back to original my"
```

Expected: PASS (現状でも `my = 130` のため)。これは Green テスト相当だが、Task 6 の実装で挙動を壊さないことを保証する **regression guard** として残す。

- [ ] **Step 3: コミット**

```bash
git add src/lib/arrow-routing.test.ts
git commit -m "$(cat <<'EOF'
test(#366): add regression guard for shiftedMy range-check fallback

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Implementation (Green) — `computeShiftedMy` ヘルパー追加

**Files:**
- Modify: `src/lib/arrow-routing.ts:160-266` (`detectDiagonalDetour`)

- [ ] **Step 1: `computeShiftedMy` ヘルパー関数を `pickDetourX` の直後に追加**

`src/lib/arrow-routing.ts` の `clampOffset` 関数 (L143-147) と `detectDiagonalDetour` (L160) の間に以下を挿入:

```ts
/**
 * 中央水平セグメント (y=my) に重なる middleRowHits があれば my をシフトした値を返す。
 * シフトは「下塞がりかどうか」で方向を決め、障害の下/上 + DETOUR_MARGIN に配置する。
 * シフト後の値が [s.y, e.y] 範囲を逸脱する場合は原 my を返す (range-check 失敗時のフォールバック)。
 *
 * source-detour / target-detour / both-detour の各 kind で共通利用する。
 */
function computeShiftedMy(
  s: Point,
  e: Point,
  my: number,
  middleRowHits: Bbox[],
  obstacles: Bbox[],
): number {
  if (middleRowHits.length === 0) return my

  const downBlocked = middleRowHits.some((obs) =>
    obstacles.some((b) => b.y > obs.y + 1 && xOverlap(obs, b)),
  )
  const upBlocked = middleRowHits.some((obs) =>
    obstacles.some((b) => b.y < obs.y - 1 && xOverlap(obs, b)),
  )
  const goDown = !downBlocked || upBlocked
  const shiftedMy = goDown
    ? Math.max(...middleRowHits.map((o) => o.y + o.h / 2)) + DETOUR_MARGIN
    : Math.min(...middleRowHits.map((o) => o.y - o.h / 2)) - DETOUR_MARGIN

  // range-check: source 行 / target 行を侵食しないこと
  const yLow = Math.min(s.y, e.y)
  const yHigh = Math.max(s.y, e.y)
  const bboxHEst = middleRowHits[0].h
  const lo = yLow + bboxHEst / 2 + 1
  const hi = yHigh - bboxHEst / 2 - 1
  if (shiftedMy >= lo && shiftedMy <= hi) return shiftedMy
  return my
}
```

- [ ] **Step 2: middleRowHits 計算を `detectDiagonalDetour` の早期に移動**

`detectDiagonalDetour` (L160-266) の `sourceColHits` / `targetColHits` 計算の **直後** に middleRowHits の計算を追加。L186 の `})` の直後 (= L187 の空行) に以下を挿入:

```ts
  // 中央水平セグメント衝突: Y ≈ my で X が source-target 間 (早期計算で全 kind 分岐に提供)
  const middleRowHits = obstacles.filter((b) => {
    const xLow = Math.min(s.x, e.x)
    const xHigh = Math.max(s.x, e.x)
    return Math.abs(b.y - my) < b.h / 2 + 2 && b.x - b.w / 2 < xHigh - 1 && b.x + b.w / 2 > xLow + 1
  })
```

- [ ] **Step 3: `both-detour` ブランチに `shiftedMy` 適用**

L188-199 の `both-detour` ブロックを以下に置き換える:

```ts
  if (sourceColHits.length > 0 && targetColHits.length > 0) {
    // 相互ブロッキング回避: 反対側列の hits は方向判定から除外。対応する迂回パスで既に回避済み。
    const targetIds = new Set(targetColHits)
    const sourceIds = new Set(sourceColHits)
    const srcBlockers = obstacles.filter((b) => !targetIds.has(b))
    const tgtBlockers = obstacles.filter((b) => !sourceIds.has(b))
    const sourceDetourX = pickDetourX(sourceColHits, srcBlockers)
    const targetDetourX = pickDetourX(targetColHits, tgtBlockers)
    const shiftedMy = computeShiftedMy(s, e, my, middleRowHits, obstacles)
    const departY = clampOffset(s.y, shiftedMy, DEPART_GAP)
    const approachY = clampOffset(e.y, shiftedMy, APPROACH_GAP)
    return { kind: 'both-detour', departY, sourceDetourX, my: shiftedMy, targetDetourX, approachY }
  }
```

- [ ] **Step 4: `target-detour` ブランチに `shiftedMy` 適用**

L201-205 の `target-detour` ブロックを以下に置き換える:

```ts
  if (targetColHits.length > 0 && sourceColHits.length === 0) {
    const detourX = pickDetourX(targetColHits, obstacles)
    const shiftedMy = computeShiftedMy(s, e, my, middleRowHits, obstacles)
    const approachY = clampOffset(e.y, shiftedMy, APPROACH_GAP)
    return { kind: 'target-detour', my: shiftedMy, detourX, approachY }
  }
```

- [ ] **Step 5: `source-detour` ブランチに `shiftedMy` 適用**

L207-211 の `source-detour` ブロックを以下に置き換える:

```ts
  if (sourceColHits.length > 0 && targetColHits.length === 0) {
    const detourX = pickDetourX(sourceColHits, obstacles)
    const shiftedMy = computeShiftedMy(s, e, my, middleRowHits, obstacles)
    const departY = clampOffset(s.y, shiftedMy, DEPART_GAP)
    return { kind: 'source-detour', departY, detourX, my: shiftedMy }
  }
```

- [ ] **Step 6: 既存の middleRowHits 専用ブロック (L213-263) から重複定義を削除**

L213-218 (middleRowHits 再定義) を削除し、後続の `if (middleRowHits.length > 0)` ブロックが Step 2 で前置宣言した `middleRowHits` を参照するようにする。L213-218 を削除した結果として残るコード:

```ts
  // 到達条件: sourceColHits / targetColHits は共に空 (上方の if ブロックが早期 return している)
  if (middleRowHits.length > 0) {
    const downBlocked = ...
```

(以降 L221 から続く既存ロジックはそのまま)

- [ ] **Step 7: テスト全 pass を確認**

```bash
npm test -- arrow-routing.test --run 2>&1 | tail -20
```

Expected: 新規 5 テスト含む全テスト pass。

- [ ] **Step 8: TypeScript 型チェック**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: エラーなし。

- [ ] **Step 9: コミット**

```bash
git add src/lib/arrow-routing.ts
git commit -m "$(cat <<'EOF'
fix(#366): escalate my-shift for source/target/both-detour kinds

source-detour / target-detour / both-detour 選択時にも
middleRowHits を評価し、衝突する場合は my を shiftedMy に
シフトする computeShiftedMy ヘルパーを導入。departY / approachY
も shiftedMy ベースで再計算することで幾何の一貫性を保つ。

issue #366 の複合障害 (source列+中央行+target隣接列) ケースで
source-detour の中央水平セグメントが障害② を貫通する不具合を解消。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 全テスト確認 + Lint

**Files:** (no edits)

- [ ] **Step 1: 全テスト実行**

```bash
npm test 2>&1 | tail -10
```

Expected: 全 pass (failing 0)。1 件でも失敗があれば該当を修正してから次へ進む。

- [ ] **Step 2: Lint / Format チェック**

```bash
npm run lint 2>&1 | tail -10
```

Expected: エラーなし。エラーがあれば修正。

---

## Task 8: 実画面検証 (Playwright)

**Files:** (no edits — manual verification)

- [ ] **Step 1: dev server 起動**

```bash
npm run dev > /tmp/dev-server.log 2>&1 &
sleep 3
```

- [ ] **Step 2: issue 記載の URL にアクセス**

URL: https://flowline.six1.jp/flows/ee90cded-221c-40f9-bea6-fea19f66931f

ローカル検証する場合は `flowline-R_ALLFIT-電話-20260522093804.json` をローカル dev server にインポート (`/dashboard` から JSON import)。

- [ ] **Step 3: 該当矢印を Playwright で目視確認**

`mcp__playwright__browser_navigate` で対象フローを開き、`browser_take_screenshot` でスクショ取得。`.screenshots/issue-366-after.png` に保存。

該当矢印 ID: `5e634294-8d72-4a82-bd24-591af9878944`

確認観点:
- 矢印が 店舗/確認連絡(9) を貫通していないこと
- 矢印が グルプラ/確認連絡(8) を貫通していないこと
- 矢印が グルプラ(2)/請求 に正しく接続していること

- [ ] **Step 4: LCP 計測**

該当ページの LCP が 1 秒以内であることを確認 (Lighthouse もしくは Performance API)。

```bash
npx lighthouse https://flowline.six1.jp/flows/ee90cded-221c-40f9-bea6-fea19f66931f --only-categories=performance --quiet 2>&1 | grep -i lcp
```

Expected: LCP ≤ 1000ms。超過時は原因を調査して Task 6 に戻る。

- [ ] **Step 5: dev server 停止**

```bash
pkill -f "vite|npm run dev"
```

---

## Task 9: main 同期 + PR 作成

**Files:** (no edits)

- [ ] **Step 1: 最新 main を rebase**

```bash
git pull origin main --rebase
```

Conflict 発生時は解消してから次へ。

- [ ] **Step 2: rebase 後の全テスト確認**

```bash
npm test 2>&1 | tail -10
```

Expected: 全 pass。

- [ ] **Step 3: push**

```bash
git push -u origin fix-issue-366-diagonal-middle-row
```

- [ ] **Step 4: PR 作成**

```bash
gh pr create --title "fix(#366): handle source/target detour + middle-row obstacle combo" --body "$(cat <<'EOF'
## Summary
- `detectDiagonalDetour` で source-detour/target-detour/both-detour 選択時に middleRowHits を評価せず early return する欠落を解消
- `computeShiftedMy` ヘルパーを導入し、各 kind の `my` / `departY` / `approachY` を shiftedMy ベースで再計算
- issue #366 の複合障害 (source列+中央行+target隣接列) ケースで中央水平セグメントが障害ノードを貫通する不具合を修正

Closes #366

## Test plan
- [ ] `npm test -- arrow-routing` — 5 件の新規テスト含む全 pass
- [ ] `npm test` — リポジトリ全体で failing 0
- [ ] `npm run lint` — エラーなし
- [ ] Playwright で issue 記載の矢印 `5e634294-...` が障害を貫通しないことを目視確認
- [ ] LCP ≤ 1s

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: CI watch**

```bash
gh pr checks --watch
```

Fail があれば修正 → push → 再 watch を繰り返す。

- [ ] **Step 6: 本番ビルド確認**

`~/.claude/skills/preview/SKILL.md` の手順を実行。

- [ ] **Step 7: レビュー依頼**

```bash
gh pr comment --body '@claude PRをレビューして。
以下の観点で確認すること：
- バグ・ロジックの問題
- コードの重複・共通化できる処理
- 不要な複雑さ
結果は最終行に [A:要修正] [B:条件つき承認] [C:承認OK] のいずれかで明記。'
```

---

## Task 10: レビュー修正ループ (最大10回)

**Files:** (review-driven edits)

- [ ] **Step 1: 60 秒待機後、レビュー取得**

```bash
sleep 60
gh pr view --json comments
```

判定は **`claude[bot]` のコメントのみ** を対象。自分のコメントで判定しないこと。

- [ ] **Step 2: 判定に応じて分岐**

- `[A:要修正]` / `[B:条件つき承認]` → 修正 → `git push` → CI pass → 再レビュー依頼 → Step 1 へ戻る
- `[C:承認OK]` → Task 11 へ進む

10 回超過した場合は人間にエスカレーション。

---

## Task 11: Merge + Deploy 確認 + worktree cleanup

**Files:** (no edits)

- [ ] **Step 1: Merge**

```bash
gh pr merge --merge
sleep 30
```

- [ ] **Step 2: メインリポジトリの main 更新**

```bash
MAIN=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')
git -C "$MAIN" fetch origin main
git -C "$MAIN" merge --ff-only origin/main
```

- [ ] **Step 3: デプロイ確認**

`~/.claude/skills/deploy/SKILL.md` の手順を実行。GitHub Actions / Cloudflare Pages / Vercel すべて green であること。

- [ ] **Step 4: worktree 削除**

```bash
cd "$MAIN"
git worktree remove .worktrees/fix-issue-366-diagonal-middle-row
git branch -d fix-issue-366-diagonal-middle-row
git worktree list
```

Expected: `.worktrees/fix-issue-366-diagonal-middle-row` が一覧から消えている。

- [ ] **Step 5: 完了ラベル切り替え (任意)**

```bash
gh issue edit 366 --remove-label "作業開始"
```

---

## Self-Review チェックリスト

実装着手前にプラン全体を再確認するためのもの。

- **Spec coverage**: 設計書 §3.1 アルゴリズム → Task 6 の `computeShiftedMy` で実装。§3.2 departY/approachY 連動 → Task 6 Step 3/5 で再計算。§3.3 range-check fallback → Task 5 (regression test) + Task 6 Step 1 (関数内 fallback)。§5.1 テスト 5 件 → Task 1-5 で網羅。§5.3 実画面検証 → Task 8。
- **Placeholders**: 全 step に具体的コード/コマンド/期待結果あり。
- **Type consistency**: `Bbox` / `Point` / `computeShiftedMy` シグネチャは `detectDiagonalDetour` の既存型と整合。
- **Branch naming**: `fix-issue-366-diagonal-middle-row` で統一。
