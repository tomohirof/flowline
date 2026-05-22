# Issue #358: L字パス矢印ラベル位置バグ修正 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `buildArrowPath` の L字パス分岐において、ラベル座標 (`mx, my`) が経路セグメント上の点を返すよう修正する。

**Architecture:** 関数末尾の単一 return（対角線中点）を、各パス分岐ごとの `mx, my` 変数代入に置き換える。L字パスは長辺の中点をラベル座標とする。Z字・直線パスは現状と同じ座標を維持する（既存テストに影響なし）。

**Tech Stack:** TypeScript, Vitest

**Working directory:** `/Volumes/SSD4TB/DevCode/flowline/.worktrees/fix/issue-358-l-shape-label`
**Branch:** `fix/issue-358-l-shape-label`

---

## File Structure

- **Modify:** `src/lib/arrow-routing.ts` — `buildArrowPath` 関数の末尾 (line 438-465 付近) のみ
- **Modify:** `src/lib/arrow-routing.test.ts` — 新規 describe ブロック追加 (ファイル末尾の `describe('exitPt')` の前後どちらでも可)

---

## Task 1: L字パスラベル座標テストを追加（Red）

**Files:**

- Modify: `src/lib/arrow-routing.test.ts` (末尾に describe ブロック追加)

- [ ] **Step 1: 失敗するテスト群を追加**

`src/lib/arrow-routing.test.ts` の末尾に以下の describe ブロックを追加する（最後の `describe(...)` ブロックの閉じ括弧の後）:

```ts
describe('buildArrowPath - L字パスのラベル座標 (#358)', () => {
  describe('L字 縦→横 (sV && !eV)', () => {
    it('縦辺が長い場合、縦辺の中点を返す', () => {
      // s から fc は縦方向 (sV=true), e から tc は横方向 (eV=false)
      const s = { x: 100, y: 100 }
      const e = { x: 200, y: 400 }
      const fc = { x: 100, y: 80 } // |s.y-fc.y|=20 > |s.x-fc.x|=0
      const tc = { x: 180, y: 400 } // |e.y-tc.y|=0 < |e.x-tc.x|=20
      const r = buildArrowPath(s, e, fc, tc)
      expect(r.d).toBe('M100,100 L100,400 L200,400')
      // 縦辺長 300 >= 横辺長 100 → 縦辺の中点
      expect(r.mx).toBe(100) // s.x
      expect(r.my).toBe(250) // (s.y+e.y)/2
    })

    it('横辺が長い場合、横辺の中点を返す', () => {
      const s = { x: 100, y: 100 }
      const e = { x: 500, y: 200 }
      const fc = { x: 100, y: 80 }
      const tc = { x: 480, y: 200 }
      const r = buildArrowPath(s, e, fc, tc)
      expect(r.d).toBe('M100,100 L100,200 L500,200')
      // 縦辺長 100 < 横辺長 400 → 横辺の中点
      expect(r.mx).toBe(300) // (s.x+e.x)/2
      expect(r.my).toBe(200) // e.y
    })

    it('等長の場合、縦辺優先（>=）', () => {
      const s = { x: 100, y: 100 }
      const e = { x: 300, y: 300 }
      const fc = { x: 100, y: 80 }
      const tc = { x: 280, y: 300 }
      const r = buildArrowPath(s, e, fc, tc)
      expect(r.d).toBe('M100,100 L100,300 L300,300')
      // 縦辺長 200 == 横辺長 200 → 縦辺優先
      expect(r.mx).toBe(100)
      expect(r.my).toBe(200)
    })
  })

  describe('L字 横→縦 (!sV && eV)', () => {
    it('横辺が長い場合、横辺の中点を返す', () => {
      const s = { x: 100, y: 100 }
      const e = { x: 500, y: 300 }
      const fc = { x: 80, y: 100 } // |s.y-fc.y|=0 < |s.x-fc.x|=20
      const tc = { x: 500, y: 280 } // |e.y-tc.y|=20 > |e.x-tc.x|=0
      const r = buildArrowPath(s, e, fc, tc)
      expect(r.d).toBe('M100,100 L500,100 L500,300')
      // 横辺長 400 >= 縦辺長 200 → 横辺の中点
      expect(r.mx).toBe(300) // (s.x+e.x)/2
      expect(r.my).toBe(100) // s.y
    })

    it('縦辺が長い場合、縦辺の中点を返す', () => {
      const s = { x: 100, y: 100 }
      const e = { x: 200, y: 500 }
      const fc = { x: 80, y: 100 }
      const tc = { x: 200, y: 480 }
      const r = buildArrowPath(s, e, fc, tc)
      expect(r.d).toBe('M100,100 L200,100 L200,500')
      // 横辺長 100 < 縦辺長 400 → 縦辺の中点
      expect(r.mx).toBe(200) // e.x
      expect(r.my).toBe(300) // (s.y+e.y)/2
    })

    it('等長の場合、横辺優先（>=）', () => {
      const s = { x: 100, y: 100 }
      const e = { x: 300, y: 300 }
      const fc = { x: 80, y: 100 }
      const tc = { x: 300, y: 280 }
      const r = buildArrowPath(s, e, fc, tc)
      expect(r.d).toBe('M100,100 L300,100 L300,300')
      // 横辺長 200 == 縦辺長 200 → 横辺優先
      expect(r.mx).toBe(200)
      expect(r.my).toBe(100)
    })
  })

  describe('リグレッションガード', () => {
    it('Z字 縦→縦: mx, my は既存の対角線中点を維持', () => {
      const s = { x: 100, y: 100 }
      const e = { x: 300, y: 400 }
      const fc = { x: 100, y: 80 } // 縦出口
      const tc = { x: 300, y: 380 } // 縦入口（eV=true）
      const r = buildArrowPath(s, e, fc, tc)
      expect(r.mx).toBe(200) // (s.x+e.x)/2
      expect(r.my).toBe(250) // (s.y+e.y)/2
    })

    it('Z字 横→横: mx, my は既存の対角線中点を維持', () => {
      const s = { x: 100, y: 100 }
      const e = { x: 400, y: 300 }
      const fc = { x: 80, y: 100 } // 横出口
      const tc = { x: 420, y: 300 } // 横入口（eV=false かつ sV=false）
      const r = buildArrowPath(s, e, fc, tc)
      expect(r.mx).toBe(250) // (s.x+e.x)/2
      expect(r.my).toBe(200) // (s.y+e.y)/2
    })

    it('直線パス: mx, my は線分中点', () => {
      const s = { x: 100, y: 200 }
      const e = { x: 400, y: 200 }
      const fc = { x: 80, y: 200 }
      const tc = { x: 420, y: 200 }
      const r = buildArrowPath(s, e, fc, tc)
      expect(r.d).toBe('M100,200 L400,200')
      expect(r.mx).toBe(250)
      expect(r.my).toBe(200)
    })
  })
})
```

- [ ] **Step 2: テストを実行して失敗することを確認**

Run: `npm test -- src/lib/arrow-routing.test.ts -t "L字パスのラベル座標"`

Expected: L字 縦→横 と L字 横→縦 のケースで 5 件失敗。リグレッションガードの 3 件はパス。

具体的には、L字 縦→横「縦辺が長い」では `r.my` が `(s.y+e.y)/2 = 250` を期待するが、実際は同じ 250 だが `r.mx` が `(s.x+e.x)/2 = 150` を返してしまい `100` ではなく `150` となり失敗する。

- [ ] **Step 3: コミットしない**

Red 状態のままで Task 2 に進む。

---

## Task 2: buildArrowPath を修正（Green）

**Files:**

- Modify: `src/lib/arrow-routing.ts:438-465`

- [ ] **Step 1: buildArrowPath の末尾 (line 438-465) を書き換える**

現在のコード:

```ts
  let d: string

  // 直線パス: ほぼ垂直またはほぼ水平
  if (Math.abs(dx) < 2 || Math.abs(dy) < 2) {
    d = `M${s.x},${s.y} L${e.x},${e.y}`
  } else {
    // 出口が縦方向かどうかを判定（ノード中心との差で判別）
    const sV = Math.abs(s.y - fc.y) > Math.abs(s.x - fc.x)
    const eV = Math.abs(e.y - tc.y) > Math.abs(e.x - tc.x)

    if (sV && eV) {
      // 両方縦出口: Z字パス（横方向に折り返す）
      const my = (s.y + e.y) / 2
      d = `M${s.x},${s.y} L${s.x},${my} L${e.x},${my} L${e.x},${e.y}`
    } else if (!sV && !eV) {
      // 両方横出口: Z字パス（縦方向に折り返す）
      const mx = (s.x + e.x) / 2
      d = `M${s.x},${s.y} L${mx},${s.y} L${mx},${e.y} L${e.x},${e.y}`
    } else if (sV) {
      // 縦出口→横入口: L字パス
      d = `M${s.x},${s.y} L${s.x},${e.y} L${e.x},${e.y}`
    } else {
      // 横出口→縦入口: L字パス
      d = `M${s.x},${s.y} L${e.x},${s.y} L${e.x},${e.y}`
    }
  }

  return { d, mx: (s.x + e.x) / 2, my: (s.y + e.y) / 2 }
}
```

新コード:

```ts
  let d: string
  let mx: number
  let my: number

  // 直線パス: ほぼ垂直またはほぼ水平
  if (Math.abs(dx) < 2 || Math.abs(dy) < 2) {
    d = `M${s.x},${s.y} L${e.x},${e.y}`
    mx = (s.x + e.x) / 2
    my = (s.y + e.y) / 2
  } else {
    // 出口が縦方向かどうかを判定（ノード中心との差で判別）
    const sV = Math.abs(s.y - fc.y) > Math.abs(s.x - fc.x)
    const eV = Math.abs(e.y - tc.y) > Math.abs(e.x - tc.x)

    if (sV && eV) {
      // 両方縦出口: Z字パス（横方向に折り返す）→ ラベルは中央水平セグメント上
      const cmy = (s.y + e.y) / 2
      d = `M${s.x},${s.y} L${s.x},${cmy} L${e.x},${cmy} L${e.x},${e.y}`
      mx = (s.x + e.x) / 2
      my = cmy
    } else if (!sV && !eV) {
      // 両方横出口: Z字パス（縦方向に折り返す）→ ラベルは中央垂直セグメント上
      const cmx = (s.x + e.x) / 2
      d = `M${s.x},${s.y} L${cmx},${s.y} L${cmx},${e.y} L${e.x},${e.y}`
      mx = cmx
      my = (s.y + e.y) / 2
    } else if (sV) {
      // 縦出口→横入口: L字パス → ラベルは長辺の中点
      d = `M${s.x},${s.y} L${s.x},${e.y} L${e.x},${e.y}`
      if (Math.abs(e.y - s.y) >= Math.abs(e.x - s.x)) {
        // 縦辺が長い（または等長）: 縦辺の中点
        mx = s.x
        my = (s.y + e.y) / 2
      } else {
        // 横辺が長い: 横辺の中点
        mx = (s.x + e.x) / 2
        my = e.y
      }
    } else {
      // 横出口→縦入口: L字パス → ラベルは長辺の中点
      d = `M${s.x},${s.y} L${e.x},${s.y} L${e.x},${e.y}`
      if (Math.abs(e.x - s.x) >= Math.abs(e.y - s.y)) {
        // 横辺が長い（または等長）: 横辺の中点
        mx = (s.x + e.x) / 2
        my = s.y
      } else {
        // 縦辺が長い: 縦辺の中点
        mx = e.x
        my = (s.y + e.y) / 2
      }
    }
  }

  return { d, mx, my }
}
```

- [ ] **Step 2: テストを実行して全件パスを確認**

Run: `npm test -- src/lib/arrow-routing.test.ts -t "L字パスのラベル座標"`

Expected: 全 9 件パス（L字 縦→横 3件、L字 横→縦 3件、リグレッション 3件）。

- [ ] **Step 3: arrow-routing.test.ts 全体を実行して既存テストへの影響を確認**

Run: `npm test -- src/lib/arrow-routing.test.ts`

Expected: 全件パス（既存テストへの影響なし。Z字パス・直線パス・迂回パスの座標式は変更なし）。

- [ ] **Step 4: プロジェクト全体のテストを実行**

Run: `npm test`

Expected: 全件パス。

- [ ] **Step 5: コミット**

```bash
git add src/lib/arrow-routing.ts src/lib/arrow-routing.test.ts
git commit -m "$(cat <<'EOF'
fix(#358): L字パス矢印ラベルを経路上に配置

buildArrowPath が全パス分岐で対角線中点を返していたため、L字パスで
ラベルが経路から外れて空中表示されていた。L字パスは長辺の中点を返す
ように修正し、Z字・直線パスは既存座標を維持する。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 型チェック・Lint

**Files:**

- なし（チェックのみ）

- [ ] **Step 1: 型チェック**

Run: `npx tsc --noEmit`

Expected: エラーなし。

- [ ] **Step 2: Lint**

Run: `npm run lint`

Expected: エラーなし。エラーがあれば修正してコミット。

---

## Task 4: 実画面検証（受入れ確認）

**Files:**

- なし（手動確認）

issue の添付 JSON（`R_ALLFIT-電話` フローの矢印データ）を実環境で読み込み、「繋がらず」ラベルが L字経路上に正しく表示されることを目視確認する。

- [ ] **Step 1: 開発サーバー起動**

Run: `npm run dev` (バックグラウンド)

開発サーバーの URL を確認。

- [ ] **Step 2: ブラウザで対象フローを開く**

`.env.local` の `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` でログインし、`R_ALLFIT-電話` フローを開く（または issue 添付 JSON を import）。

該当矢印: 接続可否（菱形・店舗レーン）→ 具体的なやり取り #30（グルプラレーン）、`fromSide: "right"`、コメント `"繋がらず"`。

- [ ] **Step 3: ラベル位置を確認**

「繋がらず」ラベルが L字パスの経路上（長辺の中点付近）に表示されていることを目視確認。`.screenshots/issue-358-after.png` にスクリーンショットを保存。

期待: ラベルがパス上に乗っており、空中表示にならない。

- [ ] **Step 4: 他のフローへのリグレッション確認**

既存のフローを 1〜2 個開き、Z字パス・直線パス・迂回パスのラベル位置に変化がないことを確認。

- [ ] **Step 5: LCP 確認**

DevTools の Performance タブで LCP（Largest Contentful Paint）が 1 秒以内であることを確認。

- [ ] **Step 6: 開発サーバー停止**

バックグラウンドジョブを kill。

---

## Task 5: main 同期 & PR 作成

**Files:**

- なし（git 操作）

- [ ] **Step 1: main を fetch & rebase**

```bash
git fetch origin
git pull origin main --rebase
```

Expected: コンフリクトなし。あれば解決してから次へ。

- [ ] **Step 2: rebase 後のテスト再実行**

Run: `npm test`

Expected: 全件パス。

- [ ] **Step 3: push**

```bash
git push -u origin fix/issue-358-l-shape-label
```

- [ ] **Step 4: PR 作成**

```bash
gh pr create --title "fix(#358): L字パス矢印ラベルを経路上に配置" --body "$(cat <<'EOF'
## Summary
- `buildArrowPath` が全パス分岐で対角線中点を返していたため、L字パスでラベルが経路から外れて空中表示されるバグを修正
- L字パスは長辺の中点をラベル座標として返すよう変更
- Z字パス・直線パス・迂回パスは現状座標を維持（既存テストに影響なし）

## Test plan
- [x] `src/lib/arrow-routing.test.ts` に L字パスラベル座標テストを 9 件追加
- [x] `npm test` 全件パス
- [x] 型チェック・Lint パス
- [x] 実画面で `R_ALLFIT-電話` フローの「繋がらず」ラベルが L字経路上に表示されることを目視確認
- [x] 他フローのラベル位置にリグレッションなし

Fixes #358

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: CI 待機**

```bash
gh pr checks --watch
```

Expected: 全 check パス。Fail があれば修正 → push → 再 watch。

- [ ] **Step 6: レビュー依頼**

```bash
gh pr comment --body '@claude PRをレビューして。
以下の観点で確認すること：
- バグ・ロジックの問題
- コードの重複・共通化できる処理
- 不要な複雑さ
結果は最終行に [A:要修正] [B:条件つき承認] [C:承認OK] のいずれかで明記。'
```

---

## Task 6: 本番ビルド確認

**Files:**

- なし

- [ ] **Step 1: `~/.claude/skills/preview/SKILL.md` の手順に従って本番ビルドをローカル実行・目視確認**

---

## Task 7: レビュー修正ループ（最大10回）

CLAUDE.md `Workflow Step 9` に従う。1 分待機 → `gh pr view --json comments` で `claude[bot]` のレビュー結果取得 → 判定:

- [ ] **[A:要修正] / [B:条件つき承認]:** 修正 → push → CI pass → 再レビュー依頼 → 1 分待機ループ
- [ ] **[C:承認OK]:** Merge へ

---

## Task 8: Merge & Deploy 確認

- [ ] **Step 1: Merge**

```bash
gh pr merge --merge
```

- [ ] **Step 2: main 同期**

```bash
sleep 30
MAIN=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')
git -C "$MAIN" fetch origin main
git -C "$MAIN" merge --ff-only origin/main
```

- [ ] **Step 3: デプロイ確認**

`~/.claude/skills/deploy/SKILL.md` の手順に従う。

---

## Task 9: Worktree クリーンアップ

- [ ] **Step 1: メインリポジトリへ移動**

```bash
cd /Volumes/SSD4TB/DevCode/flowline
```

- [ ] **Step 2: worktree 削除**

```bash
git worktree remove .worktrees/fix/issue-358-l-shape-label
git branch -d fix/issue-358-l-shape-label
git worktree list
```

Expected: 残骸なし。
