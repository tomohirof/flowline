# LP全幅レイアウト修正 設計ドキュメント

## 問題

LPの全セクションが左寄せ＆コンテンツが小さく表示される。ビューポート1440pxで `#root` が1248pxに縮小し、右側に192pxの空白が生じる。

## 根本原因

`src/index.css` に Vite のデフォルトスタイルが残っている:

```css
body {
  display: flex;
  place-items: center; /* = align-items: center + justify-items: center */
}
```

`display: flex` + `place-items: center` により:
- `#root` が `flex: 0 1 auto`（デフォルト）で全幅に伸びない
- `#root` の幅がコンテンツ幅（~1248px）に収縮
- 全セクションが左寄せに見える

加えて、`:root` にダークテーマのデフォルト色、`button` にダークテーマ背景色が残っており、LPのライトモードと競合。

## 修正方針

1. `index.css` のbody CSSを修正: `display: flex; place-items: center` を削除、代わりに `#root { width: 100% }` を追加
2. Viteデフォルトのダークテーマ色・ボタンスタイルをリセット
3. 空の `App.css` ファイルとそのインポートを削除
