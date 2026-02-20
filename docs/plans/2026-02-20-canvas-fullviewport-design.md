# フローエディタ キャンバスのフルビューポート拡張

Issue: #17

## 概要

フローエディタのSVGキャンバスをコンテナの利用可能領域全体に拡張する。コンテンツは左上寄せで配置し、余白は右と下に広がる。

## 現状の問題

- SVGが `width={totalW * zoom}` / `height={(totalH + 30) * zoom}` でコンテンツサイズ依存の固定ピクセルサイズ
- コンテンツが少ない場合、SVGが小さく表示され、ドットグリッド背景がSVG外にしか見えない
- Figmaのような「キャンバスが画面全体を占める」体験になっていない

## 設計

### 変更対象

`src/features/editor/FlowEditor.tsx` のみ

### 変更内容

#### 1. コンテナサイズの取得

キャンバスコンテナDivに `ref` を追加し、`ResizeObserver` で `containerWidth` / `containerHeight` を state に保持する。

#### 2. SVGサイズの変更

```typescript
// 現状
width={totalW * zoom}
height={(totalH + 30) * zoom}

// 変更後
const svgW = Math.max(containerWidth, (totalW + LM) * zoom)
const svgH = Math.max(containerHeight, (totalH + 30 + TM) * zoom)

width={svgW}
height={svgH}
```

コンテナより大きい場合はコンテンツサイズ、小さい場合はコンテナサイズに合わせる。

#### 3. viewBoxの拡張

```typescript
// 現状
viewBox={`0 -30 ${totalW} ${totalH + 30}`}

// 変更後
viewBox={`0 -30 ${svgW / zoom} ${svgH / zoom}`}
```

#### 4. コンテナスタイルの変更

- `padding: 40` → `padding: 0`（余白はviewBox内のLM/TMで確保済み）
- `overflow: auto` → `overflow: hidden`（SVGが常にコンテナを埋めるため）

#### 5. ドットグリッド背景

コンテナの `backgroundImage`（CSS radial-gradient ドットグリッド）はそのまま維持。SVG背景は透明のため、コンテナ背景が透けて見える。

### レイアウト（変更後）

```
┌─ Header (40px) ──────────────────────────────┐
├────────┬─────────────────────────┬───────────┤
│Sidebar │  Canvas Container      │ Right     │
│ (44px) │  ┌─ SVG (100%) ──────┐│ Panel     │
│        │  │[レーン][レーン]    ││ (220px)   │
│        │  │[ノード][ノード]    ││           │
│        │  │                    ││           │
│        │  │   (ドットグリッド)  ││           │
│        │  └────────────────────┘│           │
├────────┴─────────────────────────┴───────────┤
│ Status Bar (24px)                            │
└──────────────────────────────────────────────┘
```
