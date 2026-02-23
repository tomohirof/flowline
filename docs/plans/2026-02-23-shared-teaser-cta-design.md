# 共有ビュー ティーザーモーダル + ボトムCTAバー 設計

## 概要

共有URL（`/shared/:token`）を開いた閲覧者に対し、ティーザーモーダルとボトムCTAバーでFlowlineの認知・新規登録への導線を提供する。

## コンポーネント構成

```
SharedFlowViewer.tsx (既存・修正)
├── showModal時: canvas にblur(6px)適用
├── <TeaserModal />          ← 新規
├── <BottomCTABar />         ← 新規
└── 状態管理: showModal, showBottomBar
```

### 新規ファイル

| ファイル                  | 役割                             |
| ------------------------- | -------------------------------- |
| `TeaserModal.tsx`         | ティーザーモーダル               |
| `TeaserModal.module.css`  | モーダルスタイル・アニメーション |
| `TeaserModal.test.tsx`    | モーダルテスト                   |
| `BottomCTABar.tsx`        | ボトムCTAバー                    |
| `BottomCTABar.module.css` | バースタイル・アニメーション     |
| `BottomCTABar.test.tsx`   | バーテスト                       |

### 修正ファイル

| ファイル                      | 変更内容                                      |
| ----------------------------- | --------------------------------------------- |
| `SharedFlowViewer.tsx`        | 状態管理追加、blur制御、モーダル/バー組み込み |
| `SharedFlowViewer.module.css` | `.canvasBlurred` クラス追加                   |
| `SharedFlowPage.test.tsx`     | 統合テスト追加                                |

## 状態遷移

```
初期: showModal=true, blurCanvas=true, showBottomBar=false
  ↓ CTAクリック
モーダル閉じ: showModal=false, blurCanvas=false (0.4s transition)
  ↓ 3秒後
バー表示: showBottomBar=true (slideUpアニメーション)
  ↓ ✕クリック
バー非表示: showBottomBar=false
```

## TeaserModal

### Props

```typescript
interface TeaserModalProps {
  flowTitle: string
  laneCount: number
  nodeCount: number
  laneColors: number[]
  onClose: () => void
}
```

### 構成要素

- radial-gradientオーバーレイ（中央白→外側透明）
- Flowlineロゴ（40px）
- フロー名（18px, bold）
- 「Flowline で作成されたフロー」テキスト
- レーンカラードット + メタ情報（レーン数・ノード数）
- 「フロー図を表示する」CTAボタン（紫グラデーション）
- 「閲覧は無料 · ログイン不要」テキスト

### アニメーション

- modalIn: scale(0.96) + translateY(12px) → scale(1) + translateY(0), 0.4s
- overlayIn: opacity 0→1, 0.3s

## BottomCTABar

### Props

```typescript
interface BottomCTABarProps {
  visible: boolean
  onClose: () => void
}
```

### 構成要素

- ダークバー（rgba(26,26,46,0.95) + backdrop-filter: blur(12px)）
- Flowlineロゴ（32px）
- 「Flowline でフロー図を作成」+ サブテキスト
- 「無料で試す →」CTAボタン（`<a href="/?auth=register">`）
- ✕ 閉じるボタン

### アニメーション

- slideUp: translateY(100%) → translateY(0), 0.35s cubic-bezier

## Canvas blur制御

- `.canvasBlurred`: `filter: blur(6px); opacity: 0.4; transform: scale(1.05)`
- `.canvas`: `transition: filter 0.4s, opacity 0.4s, transform 0.4s`
