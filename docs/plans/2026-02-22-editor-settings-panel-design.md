# エディタ挙動・表示設定パネル 設計ドキュメント

> Issue #72

## 概要

エディタ右パネルのデフォルトビュー（何も選択していない時）に、挙動設定（4 チェックボックス）と表示設定（2 チェックボックス）を追加。設定に応じて cellClick ハンドラの動作とキャンバス描画を制御する。

## アーキテクチャ

### 方針: FlowEditor 内にインライン実装

既存の右パネルセクション（ノード・矢印・レーン）はすべて FlowEditor.tsx 内に定義されているため、同じパターンで追加する。

### 新規ステート

```typescript
const [editorSettings, setEditorSettings] = useState({
  copyLabelOnSameRow: false, // 同じ行のノードからテキストコピー
  autoConnect: true, // 自動接続
  autoAddRow: true, // 最終行で自動行追加
  enterEditOnCreate: true, // 作成後すぐ編集
  showDotGrid: true, // ドットグリッド表示
  showOrderBadge: true, // 順番バッジ表示
})
```

## 右パネル デフォルトビュー

何も選択していない時の右パネル構成:

1. テーマ（既存）
2. キャンバス情報（既存）
3. エクスポート（既存）
4. **挙動**（新規）— 4 チェックボックス
5. **表示**（新規）— 2 チェックボックス

### チェックボックス UI

- 15×15px、border-radius: 3px
- OFF: 透明背景 + inputBorder 色の枠
- ON: アクセントカラー背景 + 白チェックマーク SVG
- 0.15s トランジション
- 行全体がクリッカブル

### 挙動セクション

| 設定キー           | ラベル             | デフォルト |
| ------------------ | ------------------ | ---------- |
| copyLabelOnSameRow | 同行テキストコピー | OFF        |
| autoConnect        | 自動接続           | ON         |
| autoAddRow         | 自動行追加         | ON         |
| enterEditOnCreate  | 作成後すぐ編集     | ON         |

### 表示セクション

| 設定キー       | ラベル         | デフォルト |
| -------------- | -------------- | ---------- |
| showDotGrid    | ドットグリッド | ON         |
| showOrderBadge | 順番バッジ     | ON         |

## cellClick への影響

1. **copyLabelOnSameRow**: ON 時、同じ行（`rid` 一致）に既存ノードがあればそのラベルをコピーして新規ノードのラベルに設定
2. **autoConnect**: OFF 時、新規ノード作成時の自動矢印接続をスキップ
3. **enterEditOnCreate**: OFF 時、作成後の setEditing / focus をスキップ
4. **autoAddRow**: OFF 時、最終行での自動行追加をスキップ

## Canvas 描画への影響

1. **showDotGrid**: OFF 時、キャンバス背景のドットパターンを描画しない
2. **showOrderBadge**: OFF 時、ノード右下の順番バッジを描画しない

## テスト方針

- editorSettings ステートの初期値確認
- 各チェックボックスの表示・トグル動作
- cellClick: autoConnect OFF 時に矢印が作成されないこと
- cellClick: enterEditOnCreate OFF 時に編集モードに入らないこと
- cellClick: autoAddRow OFF 時に行が追加されないこと
- cellClick: copyLabelOnSameRow ON 時にラベルがコピーされること
- showDotGrid OFF 時のグリッド非表示
- showOrderBadge OFF 時のバッジ非表示
