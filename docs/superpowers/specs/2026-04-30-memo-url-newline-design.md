# メモのURLクリッカブル化と改行表示・入力の対応

- Issue: https://github.com/tomohirof/flowline/issues/331
- Date: 2026-04-30

## 概要

ノードに付随するメモ（黄色い吹き出し）について、以下3点を改善する。

1. メモ内の URL（`https?://...`）を自動でリンク化し、クリックで新しいタブで開けるようにする
2. メモ内の改行をそのまま表示に反映する（現状は改行が無視され詰めて表示される）
3. 右パネルの「メモ」入力欄を複数行入力に変更する（現状は `<input>` のため改行不可）

## 現状

### 表示（3 か所すべて改行・URL 未対応）

- `src/features/editor/FlowEditor.tsx:3487-3503` — エディタ通常表示
- `src/features/editor/FlowEditor.tsx:3519-3570` — インライン編集 textarea（入力時は改行可）
- `src/features/shared/SharedFlowViewer.tsx:471-486` — 共有ビュー

すべて `<div>{memo.text}</div>` で出力しており、`whiteSpace` 指定なし＋URL はプレーンテキスト。表示要素は `pointerEvents: 'none'` / `userSelect: 'none'` で全体無効化されている。

### 入力経路

- ノードクリック → inline `<textarea>` → 改行入力 **可能**
- 右パネル → `PanelInput`（`<input>`, `RightPanel.tsx:369`）→ 改行入力 **不可**

### 高さ計算

`measureMemoHeight()` は既に `\n` をカウント済み（`memo-utils.ts:48-51`）。表示側に `whiteSpace: 'pre-wrap'` を入れても高さは崩れない。

## アーキテクチャ概要

- 表示用ロジックは新設の純粋プレゼンテーショナルコンポーネント `MemoText` に集約。3 か所（FlowEditor 通常表示・FlowEditor インライン編集の **保存後表示**・SharedFlowViewer）はすべて `MemoText` 経由で描画する。
- URL 検出は表示時のみ実施。永続化フォーマット（`MemoData.text` の文字列）は変更しない。`parseNote` / `serializeMemo` への変更ナシ。
- 右パネルの単行 `<input>` は、既存 `PanelTextarea` に **`submitOnEnter?: boolean`（default `true`）** オプションを追加し、メモ欄では `submitOnEnter={false}` で利用する（インライン textarea と挙動を揃える）。

### スコープ外（YAGNI）

- マークダウンサポート（`**bold**` 等）
- 自動 `mailto:` リンク化
- URL 以外のリンク種別（`ftp://`, `tel:` など）

## コンポーネント設計

### 新設: `MemoText`

配置: `src/features/editor/components/MemoText.tsx`

```ts
type Props = {
  text: string
  color: string          // T.memoText
  linkColor?: string     // 既存テーマがあれば流用、なければ color の派生
}
```

責務: プレーンテキストを受け取り、改行を保持しつつ URL を `<a>` 化した React ノード列を返す。コンテナの style（`fontSize/lineHeight/padding/wordBreak/pointerEvents/userSelect`）は呼び出し側ではなく `MemoText` 内部に集約し、3 か所で同じ見た目を強制する。

実装の要点:

- ルートは `<div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', pointerEvents: 'none', userSelect: 'none', ... }}>`。
  - 既存コードは `wordBreak: 'break-all'` だが、URL が意図せず途中改行されるのを避けるため `break-word` に変更。URL は `<a>` 側で `overflowWrap: 'anywhere'` を別途指定する。
- 文字列は `splitTextWithUrls(text)` で `{ type: 'text' | 'url'; value: string }` の配列に分割。
- `url` セグメントのみ `<a target="_blank" rel="noopener noreferrer nofollow"` ＋ `style={{ pointerEvents: 'auto', userSelect: 'auto', overflowWrap: 'anywhere' }}` ＋ `onMouseDown` / `onClick` で `e.stopPropagation()`。
- 改行は `whiteSpace: 'pre-wrap'` で表現（明示的な `<br>` 挿入はしない）。

### 新設: `splitTextWithUrls`

配置: `src/features/editor/memo-utils.ts`（`measureMemoHeight` の隣）

```ts
export type MemoTextSegment = { type: 'text' | 'url'; value: string }
export function splitTextWithUrls(text: string): MemoTextSegment[]
```

URL 検出正規表現の要点:

- `https?://` で始まるもののみ対象（`javascript:` `data:` `file:` `vbscript:` 等は対象外）
- 末尾の句読点・閉じ括弧 `.,;:!?)\]'"` は URL から除外（よくある「文末の `.` まで含めてしまう」問題対策）
- 検出パターン: `/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/g`
- 同一文字列内に複数 URL が含まれるケースに対応

### 改修: `PanelTextarea`

配置: `src/features/editor/components/PanelParts.tsx`

```ts
{ submitOnEnter?: boolean = true }   // 追加
```

- `false` のとき `onKeyDown` の Enter blur 処理をスキップ（IME 中は従来どおり処理しない）。
- 既存呼び出し（説明欄ほか）はデフォルト `true` で挙動不変。

### 改修: 3 か所の表示

- `FlowEditor.tsx:3487-3503` → `<MemoText text={m.text} color={T.memoText} />` に置換
- `SharedFlowViewer.tsx:471-486` → 同上
- `FlowEditor.tsx:3519-3570`（インライン編集中） → textarea のまま改修なし（編集中はリンク化しない）

### 改修: 右パネル

- `RightPanel.tsx:368-` の `<PanelInput>` を `<PanelTextarea ... submitOnEnter={false} rows={3}>` に置換。

## データフロー

### 読み出し（DB → 画面）

```
notes(json text) → parseNote → MemoData{ text, dx, dy } → setMemos
                                                        ↓
                                           (a) FlowEditor 通常表示    → MemoText
                                           (b) FlowEditor インライン編集 → <textarea>（無改修）
                                           (c) SharedFlowViewer       → MemoText
```

`MemoText` は `text: string` のみを入力に取り、`splitTextWithUrls(text)` でセグメント分割→React ノード列に写像する純粋関数的なレンダリング。永続化される文字列は **生のままのプレーンテキスト**（URL は `https://...` の文字列のまま）。

### 書き込み（画面 → DB）

```
(a) ノードクリック inline <textarea>  ─┐
                                       ├→ setMemos({ text }) → serializeMemo → notes(json)
(b) 右パネル <PanelTextarea>          ─┘
```

両入力経路ともに `MemoData.text` に **改行を含む素のユーザ入力文字列** を書き込むだけ。`serializeMemo` は `JSON.stringify` するため、改行（`\n`）は JSON 仕様で `\\n` として安全にエスケープされ、ラウンドトリップで失われない（既存挙動）。

### 高さ計算（読み出し時の派生）

```
m.text → measureMemoHeight(text, MEMO_W) → mh (foreignObject の height)
```

`measureMemoHeight` は既に `\n` を split して行数加算しているため、改行が増えても表示が切れない。今回 `whiteSpace: 'pre-wrap'` を導入しても改行は `\n` の数だけ既に勘定済み、URL リンク化は文字列長を変えない（`<a>` でラップするだけ）→ **既存高さ計算は無改修で正しく動く**。

### 入力時の Enter 挙動

- `PanelTextarea(submitOnEnter={false})` は Enter で何もせず、textarea のデフォルトの「改行挿入」が走る。
- 確定タイミング: textarea の `onBlur`（外側クリック・別フィールドへの移動）。
- IME 変換中の Enter は、A 案では submit を行わないため特別ハンドリング不要（`isComposing` 判定は `submitOnEnter=true` 経路のみ意味を持つ）。

## エラーハンドリング・セキュリティ

### URL 検出の XSS 耐性

React は子要素の文字列を自動エスケープするため、`<MemoText>` の中で文字列をそのまま渡しても DOM injection は発生しない。今回追加されるリスクは `<a href={...}>` の `href` を URL に組み立てる箇所のみ。

| 攻撃ベクタ | 防御 |
|---|---|
| `javascript:alert(1)` を埋め込んでクリックさせる | 正規表現が `https?://` で始まる文字列のみマッチ。`javascript:` `data:` `file:` `vbscript:` は検出器を通らないため `<a>` にならず、ただのテキストになる。 |
| 攻撃サイトへの誘導 | `target="_blank"` ＋ `rel="noopener noreferrer nofollow"` を必ず付ける。`opener` 経由のタブハイジャックを防ぐ。 |
| URL 内に `"` `<` を埋めて属性を破る | React が属性値を自動エスケープするため `dangerouslySetInnerHTML` を使わない限り発生しない。本実装は `<a href={url}>` の JSX のみ。 |
| 異常に長い URL ／壊れた URL | 正規表現でマッチしなければただのテキスト。マッチしても `<a>` として表示されるだけ。 |
| 末尾句読点問題 | 正規表現の末尾クラスで `.,;:!?)\]'"` を除外。 |

### イベント伝播の防御

`MemoText` の `<a>` は次のハンドラを持つ:

```ts
onMouseDown: (e) => e.stopPropagation()
onClick: (e) => e.stopPropagation()
```

これにより、メモ用 `<g>` の親に登録されたドラッグ開始・編集モード起動・選択解除等の SVG イベントがバブルアップしない。`pointerEvents: 'none'` を親に持つ表示でも、`<a>` だけ `pointerEvents: 'auto'` を上書きしているのでクリック自体は `<a>` で受ける。

### 失敗系の挙動

| ケース | 挙動 |
|---|---|
| `text` が空文字 | `MemoText` は安全に空フラグメントを返す。呼び出し側は元から空時に `<text>memoClickToEdit</text>` 経路へ分岐済みで `MemoText` は呼ばれない。 |
| `text` が極端に長い／URL だらけ | 既存の `wordBreak`/`overflowWrap` で折り返し、高さは `measureMemoHeight` がカバー（無改修で動く）。 |
| `parseNote` が JSON parse 失敗 | 既存の try/catch がプレーンテキスト扱いに fall through（無改修）。 |
| 右パネル textarea で巨大入力 | 既存 `setMemos` の更新を通るのみ。サイズ上限は今回スコープ外。 |

### 何をしないか

- URL の妥当性チェック（DNS や到達性）
- リンクのプレビュー／OGP 取得
- `mailto:` / `tel:` の自動リンク化
- マークダウンリンク `[text](url)` 構文サポート

## テスト戦略

### 単体テスト（vitest）

#### `src/features/editor/memo-utils.test.ts`（既存ファイルに追記）

`splitTextWithUrls`:

- URL なしの素テキスト → `[{ type: 'text', value: 入力 }]`
- 単一 URL → `text` / `url` セグメントに分割される
- 文中に複数 URL → 順番に正しく交互分割される
- 連続 URL（`https://a.com https://b.com`）も両方検出される
- URL 末尾の `.` `,` `)` などはリンクに含まれない（句読点除外）
- `https://example.com/path?q=1&r=2#frag` のクエリ・フラグメントを保持
- `javascript:alert(1)` / `data:text/html,...` / `file:///etc/passwd` は URL 扱いしない
- スキームのみ（`http://` 単独）はマッチさせない／ホスト 1 文字以上を要求
- 改行を含む文字列でも改行をまたいで URL を誤検出しない（`\s` で停止）
- 全角空白・タブを区切りとして扱う
- 空文字 `""` の挙動を実装に合わせて assert する

#### `src/features/editor/components/MemoText.test.tsx`（新規）

`@testing-library/react` で DOM を検証:

- プレーンテキストのみ → `<a>` が出現せず、テキストがそのまま入る
- URL を含む → `<a href={url}>` が生成される
- `<a>` に `target="_blank"` と `rel` に `noopener noreferrer nofollow` がすべて含まれる
- `<a>` の `style.pointerEvents === 'auto'`、`userSelect === 'auto'`
- `javascript:` 等の危険スキームは `<a>` にならずテキストのまま
- 改行を含む `text` でルートの `style.whiteSpace === 'pre-wrap'`
- `<a>` を `mouseDown` / `click` した際に `stopPropagation` が呼ばれる

#### `PanelTextarea`（既存テスト or 新規 `PanelParts.test.tsx`）

- `submitOnEnter` 未指定（既定 `true`）で Enter キー → blur 発火（既存挙動）
- `submitOnEnter={false}` で Enter キー → blur せず、`onChange` で改行が入る

### 統合テスト

#### `src/features/editor/FlowEditor.test.tsx`（既存に追記）

- 右パネルのメモ欄が `<textarea>` でレンダリングされる（`PanelTextarea` への変更確認）
- 右パネルで複数行入力 → エディタ通常表示にも改行が反映される（`whiteSpace: pre-wrap` のスタイル確認 or 行高さ確認）
- メモテキストに `https://` を含むと `<a>` 要素がエディタ通常表示に出現する

#### `SharedFlowViewer.test.tsx`（存在する場合は追記）

- 共有ビューでも URL が `<a target="_blank">` 化される

### 既存テストの非破壊確認

- `parseNote` / `serializeMemo` テスト全通過（無改修）
- `measureMemoHeight` テスト全通過（無改修）
- 既存 `FlowEditor.test.tsx` の `textarea[placeholder="memoPlaceholder"]` セレクタ（`FlowEditor.test.tsx:3033`）が依然マッチすることを確認

### Playwright（実画面検証 — 実装後 Step6）

- 右パネルメモ欄に複数行＋URL 入力 → メモ吹き出しに改行とリンクが表示
- リンククリック → 新しいタブで開く、ノードの編集モード起動・ドラッグ開始しない
- 共有ビュー（公開リンク）でも同様にリンク・改行表示
- エディタ通常表示・インライン編集後の表示・共有ビューの 3 か所すべてで動作

### TDD 順序

1. `splitTextWithUrls` の test を Red → 実装
2. `MemoText` の test を Red → 実装
3. `PanelTextarea` の `submitOnEnter` 拡張 test を Red → 実装
4. 3 か所差し替え＋右パネル差し替え（既存テスト Green 維持）
5. FlowEditor 統合テスト追加 → 確認

## 受け入れ条件

- [ ] メモ内の `https?://...` がリンク表示になり、別タブで開く
- [ ] メモ内の改行が表示に反映される（エディタ通常表示・共有ビュー）
- [ ] リンククリックでドラッグ・編集モードが起動しない
- [ ] 右パネルの「メモ」欄で改行入力できる
- [ ] エディタ通常表示・インライン編集後の表示・共有ビューの全てで動作
- [ ] `parseNote` / `measureMemoHeight` の既存テストが通る
- [ ] `MemoText` / `splitTextWithUrls` の単体テストを追加（URL 検出、複数 URL、改行、危険スキーム除外）
