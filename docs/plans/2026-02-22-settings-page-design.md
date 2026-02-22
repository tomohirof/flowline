# アカウント設定画面 設計ドキュメント

> Issue #71

## 概要

ユーザーのプロフィール・エディタ設定・表示設定等を管理する設定画面を新規作成する。左サイドバーにカテゴリナビゲーション、右側にコンテンツを配置するレイアウト。

## アーキテクチャ

### ルーティング
- `/settings` を App.tsx に追加（ProtectedRoute）
- App.tsx の Header 非表示リストに `/settings` を追加
- UserMenuPanel の「プロフィール設定」「アカウント設定」クリックで `/settings` に遷移

### データ保存
- users テーブルに `settings TEXT` 列を追加（JSON文字列）
- デフォルト値はフロントエンドで定義し、DB未設定時はデフォルトを使用
- 設定変更は「保存する」ボタンで一括保存

### API
- `GET /api/settings` — 現在の設定を取得（auth必須）
- `PUT /api/settings` — 設定を一括更新（auth必須）
- `PUT /api/settings/profile` — プロフィール（名前）更新
- `PUT /api/settings/password` — パスワード変更
- `DELETE /api/settings/account` — アカウント削除

## 画面構成

### レイアウト
```
┌──────────────────────────────────────────────────┐
│ [←] F 設定                         [保存する]     │
├──────────┬───────────────────────────────────────┤
│ プロフィール │                                      │
│ エディタ   │    コンテンツエリア                      │
│ 操作      │    （選択カテゴリに応じて切替）             │
│ 表示      │                                      │
│ 通知      │                                      │
│ セキュリティ │                                      │
└──────────┴───────────────────────────────────────┘
```

### 6カテゴリ
1. **プロフィール** — アバター、名前、メールアドレス
2. **エディタ** — ノード作成挙動（4トグル）、接続線デフォルト（Tag選択）、デフォルトテーマ（Tag選択）
3. **操作** — ダブルクリック編集、undo/redo、Delete削除（3トグル）
4. **表示** — ドットグリッド、順番バッジ、レーンカラーバー（3トグル）
5. **通知** — メール通知、ブラウザ通知（2トグル）
6. **セキュリティ** — パスワード変更フォーム、アカウント削除（危険ゾーン）

## コンポーネント設計

### 新規ファイル
```
src/features/settings/
├── SettingsPage.tsx          # メインページ（ルーティング・レイアウト）
├── SettingsPage.module.css   # スタイル
├── SettingsPage.test.tsx     # テスト
├── components/
│   ├── Toggle.tsx            # カスタムスイッチ
│   ├── Toggle.module.css
│   ├── Tag.tsx               # 排他選択ボタン
│   ├── Tag.module.css
│   ├── SettingRow.tsx         # 設定行（ラベル + 説明 + コントロール）
│   ├── SettingRow.module.css
│   ├── Section.tsx            # セクション（タイトル + 説明 + 子要素）
│   └── Section.module.css
├── sections/
│   ├── ProfileSection.tsx     # プロフィールカテゴリ
│   ├── EditorSection.tsx      # エディタカテゴリ
│   ├── InteractionSection.tsx # 操作カテゴリ
│   ├── DisplaySection.tsx     # 表示カテゴリ
│   ├── NotificationSection.tsx# 通知カテゴリ
│   └── SecuritySection.tsx    # セキュリティカテゴリ
api/routes/
│   └── settings.ts            # 設定API
migrations/
│   └── 0003_user_settings.sql # settings列追加
```

### UIコンポーネント仕様

**Toggle** — 40×22px、紫アクセント（#7C5CFC）、白つまみ、0.2sトランジション
**Tag** — 30px高、排他選択、アクティブ時紫枠＋薄紫背景
**SettingRow** — flex行、左にラベル+説明、右にコントロール、hover時薄背景
**Section** — タイトル（15px, bold）+ 説明テキスト + 子要素群

### 状態管理
- `useSettings` カスタムフック（設定の取得・更新・保存）
- ページローカルの `useState` で設定オブジェクトを管理
- 保存ボタンクリックで PUT /api/settings を呼び出し
- 保存成功時「✓ 保存済み」ポップアニメーション（2秒後自動消去）

## デフォルト設定値

```typescript
const DEFAULT_SETTINGS = {
  copyLabelOnSameRow: false,
  autoConnect: true,
  autoAddRow: true,
  enterEditOnCreate: true,
  doubleClickToEdit: true,
  defaultArrowStyle: 'solid',
  defaultArrowColor: 'default',
  showDotGrid: true,
  showOrderBadge: true,
  showLaneColorBar: true,
  defaultTheme: 'cloud',
  language: 'ja',
  notifications: true,
}
```

## DB マイグレーション

```sql
ALTER TABLE users ADD COLUMN settings TEXT DEFAULT '{}';
```

## テスト方針

- Toggle/Tag/SettingRow/Section: 各コンポーネントの単体テスト
- SettingsPage: カテゴリ切替、設定変更、保存API呼び出し
- API: GET/PUT settings, パスワード変更, アカウント削除
- エッジケース: 未ログイン時のリダイレクト、空設定でのデフォルト適用
