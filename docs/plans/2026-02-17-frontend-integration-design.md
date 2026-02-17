# モックアップフロントエンド統合 設計

## 概要

2096行のモックアップJSX (`docs/swimlane-editor (1).jsx`) をTypeScript化し、Flow CRUD APIと連携した実用エディタにする。

## アプローチ

段階的変換: 単一TSXとして型付き変換 → API連携追加 → 必要なコンポーネント分割のみ

## コンポーネント構成

```
src/features/editor/
├── types.ts              # Flow, Lane, Node, Arrow, Theme型定義
├── FlowEditor.tsx        # メインエディタ（モックアップ変換）
├── hooks/
│   └── useFlow.ts        # API連携・自動保存・状態管理
```

## ルーティング

- `/flows/:id` → ProtectedRoute → FlowEditor
- `/` → フロー一覧（簡易版、Issue #6で本格実装）

## API連携

- useFlowフック: APIからロード、debounce付き自動保存（2秒）、Ctrl+S即時保存
- 保存状態表示: saved | saving | unsaved | error

## テスト戦略

- useFlowフックの単体テスト
- FlowEditorの基本レンダリングテスト
- ブラウザ目視検証重視
