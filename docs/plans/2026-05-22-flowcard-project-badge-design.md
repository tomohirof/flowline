# FlowCard プロジェクト名バッジ表示 — Design

- **Issue**: [#354](https://github.com/tomohirof/flowline/issues/354)
- **Date**: 2026-05-22

## 目的

ダッシュボードの「最近」「すべてのファイル」ビューにおいて、各フローカード／リスト行にプロジェクト名バッジを表示し、フローの所属を一目で識別できるようにする。

## スコープ

### 対象

- 「最近」「すべてのファイル」のグリッドビュー / リストビュー
- 共有プロジェクト所属のフロー

### 非対象

- プロジェクトビュー絞り込み中（バッジ非表示）
- 共有タブ、ゴミ箱
- バッジクリックでの絞り込みナビゲート（別 issue 起票）

## アーキテクチャ

### コンポーネント構成

```
Dashboard.tsx
├─ projectsById: Map<string, string>  (useMemo, projects + sharedProjects のマージ)
├─ resolveProjectName(projectId, selectedNav): string | undefined
│   - selectedNav.startsWith('project:') → undefined
│   - projectId == null → undefined
│   - Map にない → undefined
│   - 該当あり → name
├─ <FlowCard projectName={resolved} />            (グリッド)
└─ <ProjectBadge name={resolved} />               (リスト、インラインで配置)

FlowCard.tsx
├─ props: { ..., projectName?: string }
└─ .meta 行内に <ProjectBadge name={projectName} /> をレンダー（shareBadge の前）

ProjectBadge.tsx   (新規)
├─ props: { name: string | undefined }
└─ name が undefined / 空文字 なら null を返す
```

### 責務分離

- **`ProjectBadge`**: 純粋表示コンポーネント。受け取った `name` を中性色バッジとしてレンダー。長すぎる名前は `ellipsis` で省略し、`title` 属性でフル名をホバー表示。
- **`FlowCard`**: `projectName` を受け取り `ProjectBadge` を配置するだけ。プロジェクト解決ロジックは持たない。
- **`Dashboard`**: プロジェクト解決と表示判定の責務を集約。`useMemo` で `projectsById` Map を構築し、各カードに事前解決した文字列を渡す。

## データフロー

```
projects(自分所有) ─┐
                    ├─ useMemo → projectsById: Map<id, name>
sharedProjects ─────┘
                                ↓
                    resolveProjectName(flow.projectId, selectedNav)
                                ↓
                    string | undefined
                                ↓
                    <FlowCard projectName={...} /> or <ProjectBadge name={...} />
```

## デザイン仕様

### `ProjectBadge` スタイル

- 背景: `#f1f3f5`（ライトグレー）
- 文字色: `#525860`（ミッドグレー）
- フォントサイズ: `10px`（既存 shareBadge と統一）
- パディング: `1px 6px`
- border-radius: `4px`
- `max-width: 120px`
- `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap`
- `display: inline-flex`, `align-items: center`

### バッジ配置

`.meta` 行内に左から順に:

```
[laneDots] [updatedAt] [ProjectBadge?] [ShareBadge?]
```

リストビューでも同様に、タイトル横の既存 `shareBadge` の **前** に配置。

## エラーハンドリング / エッジケース

| ケース                                                       | 挙動                               |
| ------------------------------------------------------------ | ---------------------------------- |
| `flow.projectId === null`                                    | バッジ非表示                       |
| `flow.projectId` が `projects` / `sharedProjects` 両方にない | バッジ非表示                       |
| `flow.projectId` が `sharedProjects` のみに存在              | 共有プロジェクト名を表示           |
| `selectedNav.startsWith('project:')`                         | バッジ非表示（冗長のため）         |
| プロジェクト名が極端に長い                                   | `ellipsis` + `title` 属性でフル名  |
| `selectedNav === 'trash'`                                    | バッジ非表示（trash は別ロジック） |

## テスト戦略

### `ProjectBadge.test.tsx`（新規）

- `name` 指定時にテキスト表示される
- `name` が `undefined` の時に `null` を返す
- `title` 属性に `name` がセットされる
- `data-testid="project-badge"` が付与される

### `FlowCard.test.tsx`

- `projectName` 指定時にバッジが表示される
- `projectName` が未指定の場合バッジが表示されない
- バッジは shareBadge の前に配置される（DOM 順序）

### `Dashboard.test.tsx`

- `projectId` が `projects` に存在 → バッジ表示
- `projectId === null` → バッジ非表示
- `projectId` が `sharedProjects` のみに存在 → バッジ表示
- `projectId` がどこにも存在しない → バッジ非表示
- `selectedNav === 'project:xxx'` → バッジ非表示
- リストビュー (`viewMode === 'list'`) でもバッジ表示

## パフォーマンス考慮

- `projectsById` は `useMemo` で構築（`projects` または `sharedProjects` が変わった時のみ再計算）
- 各カードでのプロジェクト名解決は O(1)
- LCP 1秒以内維持

## 受け入れ条件

- [ ] 「最近」「すべてのファイル」のグリッド・リスト両ビューで、プロジェクトに紐付くフローにプロジェクト名バッジが表示される
- [ ] 共有プロジェクト所属のフローも対応
- [ ] 未分類フロー（`projectId === null`）にはバッジが出ない
- [ ] プロジェクトビュー絞り込み中はバッジが出ない
- [ ] 長いプロジェクト名で見切れず ellipsis 表示
- [ ] テストが追加されすべて pass
- [ ] LCP 1秒以内を維持
