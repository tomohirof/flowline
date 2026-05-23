# pickDetourX に middle-row 障害認識を追加 Implementation Plan (issue #374)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `pickDetourX` に `opts { targetDirection, middleHitsToClear }` を追加し、source-detour / both-detour.sourceDetourX で中央水平セグメントが他ノードを貫通するバグを解消する。

**Architecture:** 既存呼び出しは `opts` 省略で完全な後方互換。`opts` 指定時のみ「sourceColHits ∪ middleRowHits」の union を「迂回すべき extent」として一括で最遠端 + DETOUR_MARGIN を取る新ロジックを使う。`detectDiagonalDetour` 内の 2 箇所 (source-detour, both-detour.sourceDetourX) で `opts` を渡し、target-detour / both-detour.tgtDetourX は本 PR スコープ外 (#375)。

**Tech Stack:** TypeScript, Vitest, Vite, React (本 PR は純粋関数のみ変更)

**Spec:** `docs/superpowers/specs/2026-05-23-arrow-routing-pickDetourX-middle-hits-design.md`

---

## File Structure

**Modify:**

- `src/lib/arrow-routing.ts` — `pickDetourX` シグネチャ拡張 + L386 / L370 の呼び出し更新 + L379 / L371 / L425 に follow-up コメント
- `src/lib/arrow-routing.test.ts` — 既存 `describe('detectDiagonalDetour')` と `describe('buildArrowPath - 斜め迂回（異行×異レーン）')` ブロックに新規テストを追加

**No new files.**

---

## Task 0: Setup — worktree + ラベル

**Files:** （ファイル変更なし。環境準備のみ）

- [ ] **Step 0.1: main を最新化**

```bash
git checkout main
git fetch origin
git merge --ff-only origin/main
```

Expected: `Already up to date.` または fast-forward 成功。失敗した場合は人間に報告して中断。

- [ ] **Step 0.2: 「作業開始」ラベルを issue に付与**

```bash
gh issue edit 374 --add-label "作業開始"
```

Expected: ラベル付与成功。

- [ ] **Step 0.3: worktree 作成**

```bash
git worktree add .worktrees/fix-arrow-routing-pickDetourX-middle-hits -b fix/arrow-routing-pickDetourX-middle-hits
cd .worktrees/fix-arrow-routing-pickDetourX-middle-hits

MAIN=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')
for f in "$MAIN"/.env*; do [ -f "$f" ] && ln -sf "$f" .; done
```

Expected: worktree 作成成功、.env 系シンボリックリンク作成。

- [ ] **Step 0.4: テストルール確認**

```bash
cat ~/.claude/rules/testing.md
```

Expected: testing.md の内容を確認。以降のテスト作成で参照する。

- [ ] **Step 0.5: 依存インストール (worktree 内)**

```bash
npm install
```

Expected: 既存と同じパッケージ構成でインストール完了。

---

## Task 1: TDD Red — 失敗するテストを追加

**Files:**

- Test: `src/lib/arrow-routing.test.ts`

**設計意図:** 5 テストを 1 commit で投入 → 全部 fail することを確認 → 後続タスクで実装で順次 green にする。

- [ ] **Step 1.1: `describe('detectDiagonalDetour')` ブロックの末尾に 4 ユニットテスト追加**

`src/lib/arrow-routing.test.ts` の `describe('detectDiagonalDetour')` ブロック内 (L1000 付近の `should shift my when both-detour selected AND middle-row obstacle exists` テストの直後) に以下を追加:

```typescript
// --- issue #374: pickDetourX に middle-row 障害認識を追加 ---

it('should pick detourX past middle-row hit when source-detour selected and middle-row hit is on target side', () => {
  // issue #374 再現: source-col blocker (片側)、中央 H が他ノードを貫通するケース。
  // s=(100, 100), e=(300, 300), my=200。target は右にある (e.x > s.x)。
  // sourceColHits: (100, 200) → 旧来は左迂回 (左に blocker なし、右に middleRow があるため右 blocked と判定)
  // middleRowHits: (200, 200) → これも detourX の extent に含めるべき
  // 期待: 新ロジックで detourX = max(140, 240) + 14 = 254 (sourceCol + middleRow の union 最遠端 + DETOUR_MARGIN)
  const obstacles: Bbox[] = [
    { x: 100, y: 200, w: 80, h: 40 }, // sourceColHit (source col=100, row y=200)
    { x: 200, y: 200, w: 80, h: 40 }, // middleRowHit (row y=200, source/target col 以外)
  ]
  const r = detectDiagonalDetour({ x: 100, y: 100 }, { x: 300, y: 300 }, obstacles)
  expect(r?.kind).toBe('source-detour')
  if (r?.kind === 'source-detour') {
    // detourX = max(sourceColHit.right=140, middleRowHit.right=240) + 14 = 254
    expect(r.detourX).toBe(254)
    // my は middle-row 障害があるが、shift-my で escape できない場合は元の 200 のまま。
    // ここでは my の精密値より「detourX が正しく union 計算されている」点を検証。
    // h=40, yLow=100, yHigh=300, bboxHMax=40, lo=121, hi=279 → shift-my OK
    // shift-my で goDown=true → 200 + 20 + 14 = 234 (range 内)
    expect(r.my).toBe(234)
  }
})

it('should pick detourX past middle-row hit even when source-col blocker is closer than middle-row hit', () => {
  // sourceColHits.right < middleRowHits.right となるケース。
  // 旧ロジックは sourceColHits だけ見て detourX=140 (sourceCol 右迂回) を選ぶが、
  // それでは中央 H (140 → 300) が middleRowHit (160-240) を貫通する。
  // 新ロジックは union extent の最遠端を取って detourX=254 を選ぶ (リグレッション防止)。
  const obstacles: Bbox[] = [
    { x: 100, y: 200, w: 80, h: 40 }, // sourceColHit, right=140
    { x: 200, y: 200, w: 80, h: 40 }, // middleRowHit, right=240
  ]
  const r = detectDiagonalDetour({ x: 100, y: 100 }, { x: 300, y: 300 }, obstacles)
  expect(r?.kind).toBe('source-detour')
  if (r?.kind === 'source-detour') {
    expect(r.detourX).toBe(254)
  }
})

it('should mirror correctly for right-to-left diagonal source-detour with middle-row hit on left', () => {
  // source.x > target.x: target は左にある (targetDirection=-1)。
  // s=(300, 100), e=(100, 300), my=200。
  // sourceColHits: (300, 200) → source col=300
  // middleRowHits: (200, 200) → middle col
  // 期待: detourX = min(sourceCol.left=260, middleRow.left=160) - 14 = 146 (左迂回 + middleRow を回避)
  const obstacles: Bbox[] = [
    { x: 300, y: 200, w: 80, h: 40 }, // sourceColHit, left=260
    { x: 200, y: 200, w: 80, h: 40 }, // middleRowHit, left=160
  ]
  const r = detectDiagonalDetour({ x: 300, y: 100 }, { x: 100, y: 300 }, obstacles)
  expect(r?.kind).toBe('source-detour')
  if (r?.kind === 'source-detour') {
    // detourX = min(260, 160) - 14 = 146
    expect(r.detourX).toBe(146)
  }
})

it('should pick sourceDetourX past middle-row hit in both-detour when middle-row hit exists on target side', () => {
  // both-detour: source col と target col 両方に障害あり、加えて middle 行にも障害あり。
  // s=(100, 100), e=(300, 300), my=200。
  // sourceColHit: (100, 200), targetColHit: (300, 200), middleRowHit: (200, 200)
  // 期待: sourceDetourX = max(sourceCol.right=140, middleRow.right=240) + 14 = 254
  //       targetDetourX = 既存ロジック (本 PR 対象外) = 300 + 40 + 14 = 354
  const obstacles: Bbox[] = [
    { x: 100, y: 200, w: 80, h: 40 }, // sourceColHit
    { x: 300, y: 200, w: 80, h: 40 }, // targetColHit
    { x: 200, y: 200, w: 80, h: 40 }, // middleRowHit
  ]
  const r = detectDiagonalDetour({ x: 100, y: 100 }, { x: 300, y: 300 }, obstacles)
  expect(r?.kind).toBe('both-detour')
  if (r?.kind === 'both-detour') {
    expect(r.sourceDetourX).toBe(254) // 新ロジック適用
    expect(r.targetDetourX).toBe(354) // 旧ロジック維持 (issue #375 で対応)
  }
})
```

- [ ] **Step 1.2: `describe('buildArrowPath - 斜め迂回（異行×異レーン）')` ブロックの末尾に統合テスト追加**

`src/lib/arrow-routing.test.ts` の `describe('buildArrowPath - 斜め迂回（異行×異レーン）')` ブロック内 (L662 の `'should handle diagonal detour when source/target points come from diamond shape'` テストの直後) に以下を追加:

```typescript
it('should not cross row obstacles when source has single-side blocker and target is on opposite side (issue #374)', () => {
  // issue #374 再現: source-col blocker と middle-row blocker が同じ行にあり、
  // 旧ロジックは左迂回して中央 H が両 blocker を貫通していた。
  // 新ロジックは sourceCol + middleRow の union 最遠端まで detourX を張り出して
  // 中央 H が他ノードを跨がない source-detour パスを生成する。
  const sBug = { x: 100, y: 100 }
  const eBug = { x: 300, y: 300 }
  const fcBug = { x: 100, y: 50 }
  const tcBug = { x: 300, y: 350 }
  const obstacles: Bbox[] = [
    { x: 100, y: 200, w: 80, h: 40 }, // sourceColHit (row y=200, source col=100)
    { x: 200, y: 200, w: 80, h: 40 }, // middleRowHit (row y=200, middle col)
  ]
  const r = buildArrowPath(sBug, eBug, fcBug, tcBug, obstacles)
  // 中央水平 H は y=234 (shift-my) で detourX=254 → e.x=300 を辿るので
  // middleRowHit (x=160-240, y=200, h=40 → y=180-220) には触れない。
  // departY = clampOffset(100, 234, 14) = 114
  expect(r.d).toBe('M100,100 L100,114 L254,114 L254,234 L300,234 L300,300')
})
```

- [ ] **Step 1.3: テストが全部 fail することを確認**

```bash
npm test -- src/lib/arrow-routing.test.ts 2>&1 | tail -40
```

Expected: 上記 5 テストが FAIL (期待値と実際値の差分が表示される)。既存テストは PASS。
理由: pickDetourX 旧ロジックは binary blocker 判定で動作し、middle-row 障害を考慮せず detourX を計算するため。

- [ ] **Step 1.4: TDD red commit**

```bash
git add src/lib/arrow-routing.test.ts
git commit -m "$(cat <<'EOF'
test(#374): pickDetourX に middle-row 障害認識を追加するテスト (red)

source-detour / both-detour.sourceDetourX で sourceColHits と middleRowHits の
union として detourX を決定すべきケースをカバーする 5 テストを追加。
本 commit 時点では全 5 テスト FAIL する (実装は後続 commit)。

- 4 unit (detectDiagonalDetour): source-detour 単一/逆方向/both-detour
- 1 integration (buildArrowPath): grupura-phone-like 再現パス

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: テスト品質チェック

**Files:** （ファイル変更なし）

- [ ] **Step 2.1: testing.md チェックリストと照合**

`~/.claude/rules/testing.md` の以下を満たしているか確認:

- [x] 振る舞いテスト (期待 SVG path / detourX 値) で実装詳細に依存しない
- [x] 各テスト独立 (グローバル state なし)
- [x] 決定論的 (ネットワーク / 時刻なし)
- [x] エッジケース: 左/右両方向 (LTR + RTL), single-side blocker, union 最遠端が sourceCol/middleRow 双方
- [x] 命名規則: `should [behavior] when [condition]`
- [x] モック不要 (純粋関数)

特に「union の最遠端を見ているか」を verify する Step 1.1 の 2 番目のテストは、リグレッション検出に必須なので削除しないこと。

Expected: チェックリスト全項目クリア。不足あれば修正。

---

## Task 3: 実装 — `pickDetourX` に opts API を追加

**Files:**

- Modify: `src/lib/arrow-routing.ts` L230-L250

- [ ] **Step 3.1: pickDetourX のシグネチャと本体を書き換え**

`src/lib/arrow-routing.ts` の L223-L250 を以下に置き換え (関数全体 replace):

```typescript
/**
 * 右優先で迂回 X を決定する。hits 中のいずれかが Y 重なりするブロッカーを直右に持てば右塞がり、
 * 直左に持てば左塞がり。両塞がりなら右優先 (#333 と整合)。
 *
 * blockers は方向判定対象のブロッカー候補。target/source 列同士の相互ブロッキングを防ぐ
 * ため、both-detour では呼び出し側が反対側列の hits を除外した blockers を渡す。
 *
 * opts (issue #374):
 *   指定時は binary blocker 判定をスキップし、targetDirection 方向に hits ∪ middleHitsToClear の
 *   union 最遠端 + DETOUR_MARGIN を取る新ロジックを使う。これにより source-detour で中央水平
 *   セグメントが middle-row 障害を貫通するバグを解消する。両フィールド必須。
 */
function pickDetourX(
  hits: Bbox[],
  blockers: Bbox[],
  crossRange: [number, number],
  obstacles: Bbox[],
  opts?: {
    targetDirection: 1 | -1
    middleHitsToClear: Bbox[]
  },
): number {
  if (opts) {
    // 新ロジック (issue #374): hits ∪ middleHitsToClear の最遠端を取る。
    // sourceColHits だけ見ていた旧ロジックでは middleRowHits を貫通する detourX を選んでしまう。
    const extent = [...hits, ...opts.middleHitsToClear]
    const initialDetourX =
      opts.targetDirection === 1
        ? Math.max(...extent.map((o) => o.x + o.w / 2)) + DETOUR_MARGIN
        : Math.min(...extent.map((o) => o.x - o.w / 2)) - DETOUR_MARGIN
    return escalateDetourTrack(initialDetourX, crossRange, 'v', obstacles, opts.targetDirection)
  }

  // 既存ロジック (opts 未指定時): binary blocker 判定による方向決定。
  // 薄い線分 (エッジセグメント由来 Bbox) は方向判定から除外。
  // detectDetour / detectVerticalDetour と同じ理由 (yOverlap 誤判定を防ぐ)。
  const rightBlocked = hits.some((obs) =>
    blockers.some((b) => !isThinSegment(b) && b.x > obs.x + 1 && yOverlap(obs, b)),
  )
  const leftBlocked = hits.some((obs) =>
    blockers.some((b) => !isThinSegment(b) && b.x < obs.x - 1 && yOverlap(obs, b)),
  )
  const goRight = !rightBlocked || leftBlocked
  const initialDetourX = goRight
    ? Math.max(...hits.map((o) => o.x + o.w / 2)) + DETOUR_MARGIN
    : Math.min(...hits.map((o) => o.x - o.w / 2)) - DETOUR_MARGIN
  const direction: 1 | -1 = goRight ? 1 : -1
  return escalateDetourTrack(initialDetourX, crossRange, 'v', obstacles, direction)
}
```

- [ ] **Step 3.2: lint + typecheck**

```bash
npm run lint -- src/lib/arrow-routing.ts
npx tsc --noEmit
```

Expected: エラーなし。

- [ ] **Step 3.3: 既存テスト無変化を確認 (新規テストは引き続き FAIL)**

```bash
npm test -- src/lib/arrow-routing.test.ts 2>&1 | tail -40
```

Expected: 既存テスト (issue #374 追加分以外) 全部 PASS。新規 5 テストは引き続き FAIL (呼び出し側で opts を渡していないため)。

- [ ] **Step 3.4: 中間 commit**

```bash
git add src/lib/arrow-routing.ts
git commit -m "$(cat <<'EOF'
feat(#374): pickDetourX に opts API を追加 (後方互換)

opts { targetDirection, middleHitsToClear } を指定すると binary blocker 判定を
スキップし、hits ∪ middleHitsToClear の union 最遠端 + DETOUR_MARGIN を取る新
ロジックで detourX を決定する。opts 未指定時は既存ロジックそのままで完全な
後方互換 (既存テスト無変化を確認済み)。

呼び出し側の更新は後続 commit にて。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: source-detour 呼び出しを opts ベースに更新

**Files:**

- Modify: `src/lib/arrow-routing.ts` L385-L390 (source-detour 分岐)

- [ ] **Step 4.1: source-detour 分岐の pickDetourX 呼び出しを opts 付きに**

`src/lib/arrow-routing.ts` L385-L390 の `if (sourceColHits.length > 0 && targetColHits.length === 0)` ブロックを以下に変更:

```typescript
if (sourceColHits.length > 0 && targetColHits.length === 0) {
  const detourX = pickDetourX(sourceColHits, obstacles, [s.y, my], obstacles, {
    targetDirection: e.x > s.x ? 1 : -1,
    middleHitsToClear: middleRowHits,
  })
  const shiftedMy = computeShiftedMy(s, e, my, middleRowHits, obstacles)
  const departY = clampOffset(s.y, shiftedMy, DEPART_GAP)
  return { kind: 'source-detour', departY, detourX, my: shiftedMy }
}
```

- [ ] **Step 4.2: テスト実行 — source-detour 関連が green になる**

```bash
npm test -- src/lib/arrow-routing.test.ts 2>&1 | tail -40
```

Expected:

- Step 1.1 の 1, 2, 3 番目のテスト (source-detour 3 ケース) PASS
- Step 1.1 の 4 番目 (both-detour) は引き続き FAIL
- Step 1.2 の統合テスト PASS
- 既存テスト全部 PASS

- [ ] **Step 4.3: 中間 commit**

```bash
git add src/lib/arrow-routing.ts
git commit -m "$(cat <<'EOF'
fix(#374): source-detour で sourceColHits ∪ middleRowHits を union 評価

detectDiagonalDetour の source-detour 分岐で pickDetourX に opts を渡し、
detourX を中央水平 H の通過範囲も含めて決定する。これにより密集レイアウトで
中央 H が他ノードを貫通する症状を解消。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: both-detour.sourceDetourX を opts ベースに更新 + follow-up コメント追加

**Files:**

- Modify: `src/lib/arrow-routing.ts` L364-L376 (both-detour 分岐) + L378-L383 (target-detour 分岐) + L425 付近 (middle-only 分岐)

- [ ] **Step 5.1: both-detour 分岐を更新**

`src/lib/arrow-routing.ts` L364-L376 の `if (sourceColHits.length > 0 && targetColHits.length > 0)` ブロックを以下に変更:

```typescript
if (sourceColHits.length > 0 && targetColHits.length > 0) {
  // 相互ブロッキング回避: 反対側列の hits は方向判定から除外。対応する迂回パスで既に回避済み。
  const targetIds = new Set(targetColHits)
  const sourceIds = new Set(sourceColHits)
  const srcBlockers = obstacles.filter((b) => !targetIds.has(b))
  const tgtBlockers = obstacles.filter((b) => !sourceIds.has(b))
  // sourceDetourX: 新ロジック (issue #374) で middleRowHits も extent に含める。
  const sourceDetourX = pickDetourX(sourceColHits, srcBlockers, [s.y, my], obstacles, {
    targetDirection: e.x > s.x ? 1 : -1,
    middleHitsToClear: middleRowHits,
  })
  // targetDetourX: 旧ロジック維持。target-detour 系の対称対応は issue #375 で別途。
  const targetDetourX = pickDetourX(targetColHits, tgtBlockers, [my, e.y], obstacles)
  const shiftedMy = computeShiftedMy(s, e, my, middleRowHits, obstacles)
  const departY = clampOffset(s.y, shiftedMy, DEPART_GAP)
  const approachY = clampOffset(e.y, shiftedMy, APPROACH_GAP)
  return { kind: 'both-detour', departY, sourceDetourX, my: shiftedMy, targetDetourX, approachY }
}
```

- [ ] **Step 5.2: target-detour / middle-only 分岐に follow-up コメント追加**

`src/lib/arrow-routing.ts` L378 の `if (targetColHits.length > 0 && sourceColHits.length === 0)` の直前に以下のコメントを追加:

```typescript
  // 注: target-detour の detourX 計算は対称的に opts { targetDirection, middleHitsToClear } を
  // 渡せる API を持つが、本 PR (issue #374) では source-detour のみに適用してリグレッションリスクを
  // 抑える。target-detour / both-detour.tgtDetourX の対称対応は issue #375 でフォローアップ予定。
  if (targetColHits.length > 0 && sourceColHits.length === 0) {
```

L425 付近の `const detourX = pickDetourX(middleRowHits, obstacles, [s.y, e.y], obstacles)` (middle-only 分岐の kind escalation 用) は本 PR スコープ外。既存ロジック維持。

- [ ] **Step 5.3: テスト全部 green を確認**

```bash
npm test -- src/lib/arrow-routing.test.ts 2>&1 | tail -40
```

Expected: 新規 5 テスト + 既存テスト全部 PASS。

- [ ] **Step 5.4: 中間 commit**

```bash
git add src/lib/arrow-routing.ts
git commit -m "$(cat <<'EOF'
fix(#374): both-detour.sourceDetourX も union 評価に更新 + #375 コメント

both-detour の sourceDetourX 計算にも opts を伝搬。tgtDetourX は本 PR 対象外
として既存ロジック維持、対称対応は issue #375 で。target-detour / middle-only
分岐に follow-up を示すコメントを追加。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: フルテスト + lint + typecheck

**Files:** （変更なし）

- [ ] **Step 6.1: フルテスト実行**

```bash
npm test
```

Expected: 全 suite PASS。FAIL が 1 件でもあれば修正 (今回の修正対象外でも)。

- [ ] **Step 6.2: lint**

```bash
npm run lint
```

Expected: エラーなし。

- [ ] **Step 6.3: typecheck**

```bash
npx tsc --noEmit
```

Expected: エラーなし。

---

## Task 7: ブラウザ目視検証 — grupura-phone 再現

**Files:** （アプリ起動のみ）

- [ ] **Step 7.1: dev サーバー起動**

```bash
npm run dev &
```

Expected: Vite dev サーバーが localhost (通常 5173) で起動。

- [ ] **Step 7.2: `/dev/render?fixture=grupura-phone` を開いてスクリーンショット**

Playwright MCP または chrome-devtools で `http://localhost:5173/dev/render?fixture=grupura-phone` を開く。

確認ポイント:

- 「ステータス変更 (店舗 row 15) → 請求 グルプラ(2) (グルプラ(2) row 17)」の矢印が **右迂回** している
- 中央水平セグメントが row 16 の「確認連絡 店舗」「確認連絡 グルプラ」のいずれにも触れていない
- 他の矢印に視覚的リグレッションがない (他の fixture も軽く目視確認)

スクリーンショットを `.screenshots/` に保存:

```bash
# Playwright MCP の screenshot 機能を使用
```

Expected: 修正後の SVG path が中央 H で 916.5 → 1055.5 (LTR) になり、row 16 を跨がない。

- [ ] **Step 7.3: 表示速度チェック**

`/dev/render?fixture=grupura-phone` の LCP が **1 秒以内** であることを確認 (DevTools Performance または Lighthouse)。

Expected: LCP ≤ 1000ms。超過した場合は原因調査 → Task 3-5 に戻る。

- [ ] **Step 7.4: dev サーバー停止**

```bash
# 起動した dev サーバーを停止
```

---

## Task 8: 最新 main 同期

**Files:** （変更なし）

- [ ] **Step 8.1: main を最新化して rebase**

```bash
git fetch origin main
git rebase origin/main
```

Expected: conflict なし。conflict があれば解決。

- [ ] **Step 8.2: 全テスト再実行**

```bash
npm test
```

Expected: 全部 PASS。

---

## Task 9: PR 作成 + CI 監視

**Files:** （変更なし）

- [ ] **Step 9.1: push**

```bash
git push -u origin fix/arrow-routing-pickDetourX-middle-hits
```

Expected: リモートにブランチ作成成功。

- [ ] **Step 9.2: PR 作成**

```bash
gh pr create --title "fix(#374): pickDetourX に middle-row 障害認識を追加" --body "$(cat <<'EOF'
## Summary

issue #374 の修正。密集レイアウトで斜め配置の矢印が source 列 blocker により target と反対方向へ迂回し、中央水平セグメントが他ノードを貫通する問題を解消する。

設計案 A' (`pickDetourX` に `opts { targetDirection, middleHitsToClear }` を追加する後方互換 API) で対応:

- `sourceColHits` と `middleRowHits` の union を「迂回すべき extent」として一括で最遠端 + DETOUR_MARGIN を取る
- `opts` 省略時は既存ロジック (binary blocker 判定) そのまま → 既存テスト無変化
- source-detour と both-detour.sourceDetourX に適用
- target-detour / both-detour.tgtDetourX への対称対応は issue #375 でフォローアップ

詳細設計: `docs/superpowers/specs/2026-05-23-arrow-routing-pickDetourX-middle-hits-design.md`

## Test plan

- [x] 新規ユニットテスト 4 ケース (detectDiagonalDetour)
- [x] 新規統合テスト 1 ケース (buildArrowPath, issue #374 再現パターン)
- [x] 既存テスト全部 PASS (後方互換)
- [x] `/dev/render?fixture=grupura-phone` で目視確認: 中央 H が row 16 を跨がない
- [x] lint + typecheck エラーなし
- [x] LCP ≤ 1s

Closes #374
Related: #375

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL が表示される。

- [ ] **Step 9.3: CI 完了待機**

```bash
gh pr checks --watch
```

Expected: 全 check pass。fail があれば修正 → push → 再 watch を繰り返す。

- [ ] **Step 9.4: レビュー依頼コメント**

```bash
gh pr comment --body '@claude PRをレビューして。
以下の観点で確認すること：
- バグ・ロジックの問題
- コードの重複・共通化できる処理
- 不要な複雑さ
結果は最終行に [A:要修正] [B:条件つき承認] [C:承認OK] のいずれかで明記。'
```

Expected: コメント投稿成功。

---

## Task 10: 本番ビルド確認

**Files:** （変更なし）

- [ ] **Step 10.1: ~/.claude/skills/preview/SKILL.md を参照して本番ビルド確認**

```bash
cat ~/.claude/skills/preview/SKILL.md
```

その手順に従って本番ビルドをローカルで起動し、`/dev/render?fixture=grupura-phone` で再度目視確認。

Expected: 本番ビルドでも同じ結果。

---

## Task 11: レビュー修正ループ (最大 10 回)

**Files:** （レビュー指摘に応じて変更）

- [ ] **Step 11.1: 1 分待機**

```bash
sleep 60
```

- [ ] **Step 11.2: レビュー結果取得**

```bash
gh pr view --json comments
```

`claude[bot]` の最新コメントを確認。jq パースエラー時は `--jq` を使わず生の JSON を読む。

判定方法:

- 再レビュー後の判定は、**再レビュー依頼コメントの `created_at` より後** の `claude[bot]` コメントだけを対象。古いレビュー判定文字列で誤って終了しないこと。
- 自分自身のコメントで判定しない。

- [ ] **Step 11.3: 判定に応じて分岐**

- **[A:要修正] / [B:条件つき承認]**:
  - 指摘内容を修正
  - `git push`
  - `gh pr checks --watch`
  - 再レビュー依頼コメント (Step 9.4 と同じテンプレート)
  - Step 11.1 に戻る (ループ加算)
- **[C:承認OK]**: Task 12 へ進む
- **10 回超過**: Task 12 進まず、人間へ報告

---

## Task 12: Merge + Deploy 確認

**Files:** （変更なし）

- [ ] **Step 12.1: Merge**

```bash
gh pr merge --merge
```

Expected: merge 成功。

- [ ] **Step 12.2: main 最新化**

```bash
sleep 30
MAIN=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')
git -C "$MAIN" fetch origin main
git -C "$MAIN" merge --ff-only origin/main
```

Expected: main が PR commit を含む状態に。

- [ ] **Step 12.3: deploy 確認**

`~/.claude/skills/deploy/SKILL.md` の手順に従って deploy を確認。

Expected: 本番デプロイ成功。状態不明なら人間へ報告。

---

## Task 13: Worktree Cleanup

**Files:** （ファイル削除）

- [ ] **Step 13.1: worktree 削除**

```bash
cd "$MAIN"
git worktree remove .worktrees/fix-arrow-routing-pickDetourX-middle-hits
git branch -d fix/arrow-routing-pickDetourX-middle-hits
git worktree list
```

Expected: worktree 削除成功、残骸なし。

- [ ] **Step 13.2: 「作業開始」ラベル外し**

```bash
gh issue edit 374 --remove-label "作業開始"
```

Expected: ラベル削除成功 (issue は close 済みのはずだがラベルだけクリーンアップ)。

---

## Summary

- 新規テスト 5 (ユニット 4 + 統合 1)、既存テスト 7 全部 PASS (後方互換)
- 実装変更箇所: `src/lib/arrow-routing.ts` の `pickDetourX` 本体 + 呼び出し側 2 箇所 + コメント 1 箇所
- スコープ外 (follow-up #375): target-detour / both-detour.tgtDetourX / middle-only 分岐の対称対応
- 関連: PR #372 (段階3・4 ジャンパー), PR #373 (薄いエッジセグメント除外)
