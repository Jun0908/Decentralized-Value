# Rescue Room — Design QA

## 今回の対象

- 指摘元: ユーザー提供スクリーンショット（lime 背景に白文字の「リプレイ証拠のタイムライン」）
- 既存の画面全体の Source Visual Truth: `artifacts/ux-audit-rescue-room/selected-option-2.png`
- 既存の画面全体比較: `artifacts/ux-audit-rescue-room/30-source-implementation-qa.png`
- 同状態の修正前再現: `artifacts/ux-audit-rescue-room/31-replay-contrast-before.png`
- 修正後のフォーカス画像: `artifacts/ux-audit-rescue-room/32-replay-contrast-after.png`
- 修正後のデスクトップ画面: `artifacts/ux-audit-rescue-room/33-rescue-result-contrast-desktop.png`
- 修正後のモバイル画面: `artifacts/ux-audit-rescue-room/33-rescue-result-contrast-mobile.png`
- Route: `http://localhost:3000/arenas/rescue-room`
- State: Controlled Practice 実行完了後、Evidence Timeline と Outcome が表示された状態

## Viewport と画像寸法

- 指摘元画像: 237 × 95 px
- 修正前フォーカス画像: 181 × 33 px
- 修正後フォーカス画像: 218 × 43 px
- Desktop: CSS viewport 1440 × 1000、deviceScaleFactor 1、画像 1440 × 1000 px
- Mobile: CSS viewport 390 × 844、deviceScaleFactor 1、画像 390 × 844 px
- フォーカス画像は同じ操作状態・同じボタンを要素単位で撮影した。日本語自動翻訳による文字幅の差はあるが、比較対象の foreground / background token は同一である。

## 恒久的なコントラスト禁止ルール

以下は、このプロジェクトでは禁止する。

- `var(--lime)`、`#c7ff45`、または同等の明るい黄緑背景と、白・near-white・`var(--ink)` の文字を組み合わせない。
- lime 背景を使う場合、文字色は `#111` 相当の濃色とし、通常文字で WCAG 4.5:1 以上を満たす。
- 白または near-white の文字を使う場合、背景は十分に暗い色とし、通常文字で WCAG 4.5:1 以上を満たす。
- ボタン、pill、tab、badge は、同じ selector / state 内で `background` と `color` の両方を明示する。共通 `button` の背景や、親要素の文字色の継承に依存しない。
- default / hover / focus / active / disabled を別々に確認する。ブラウザ翻訳などでラベルが長くなっても、文字の可読性と padding を維持する。
- Design QA では、デスクトップとモバイルの実画面で visible な interactive element を走査し、明るい背景＋明るい文字が 1 件でもあれば `final result: blocked` とする。

推奨する基本ペアは次の二つだけとする。

- Primary: lime 背景 `#c7ff45` + dark 文字 `#111`
- Secondary: dark 背景 `#0d1013` + light 文字 `#f4f1e8`。hover は dark 背景 `#151a1d` + lime 文字 `#c7ff45`

## Findings

- [P1] Secondary Action が lime 背景＋明るい文字になり読めない
  - Location: `apps/web/src/app/globals.css` の共通 `button` と `.secondary-action`、Rescue Room の `Replay evidence timeline`
  - Evidence: 修正前の computed style は文字 `rgb(213, 215, 216)`、背景 `rgb(199, 255, 69)`。コントラストが著しく不足していた。
  - Impact: リプレイ操作のラベルを判読できず、主要な Evidence Replay 導線が実質的に壊れていた。同じ class を持つ他画面にも波及する共通不具合だった。
  - Fix: `button.secondary-action` に dark background と light foreground を同じ rule で明示し、hover も dark background + lime foreground に固定した。個別画面に残っていた foreground だけの上書きも同じ意味に統一した。

## Comparison history

### Iteration 1 — blocked

- ユーザー提供画像と修正前再現 `31-replay-contrast-before.png` を比較。
- P1: lime 背景に near-white 文字が重なり、ラベルが読めないことを確認。
- 原因は `.secondary-action` が文字色だけを指定し、共通 `button` の lime 背景を継承していたこと。

### Iteration 2 — passed

- 共通 `button.secondary-action` を dark background + light text に修正。
- 修正後 `32-replay-contrast-after.png` の computed style は文字 `rgb(244, 241, 232)`、背景 `rgb(13, 16, 19)`、コントラスト比 `16.89:1`。
- Desktop / Mobile の実行完了状態を `33-rescue-result-contrast-desktop.png` と `33-rescue-result-contrast-mobile.png` で再確認。
- Rescue Room の実行後に見える 5 個の Secondary Action を確認し、禁止組み合わせは 0 件。
- 主要 12 route で visible な Secondary Action 32 個を横断確認し、禁止組み合わせは 0 件。各 route は HTTP 200、console error 0 件。

## Full-view comparison evidence

Desktop と Mobile の Outcome 画面で、Evidence Timeline、Replay、次の戦略を試す 3 ボタン、Evidence Download の階層を確認した。Primary は lime + dark、Secondary は dark + light として視覚的な役割が分離されている。横 overflow、ボタンの欠け、重なりはない。

## Focused region comparison evidence

修正前 `31-replay-contrast-before.png` と修正後 `32-replay-contrast-after.png` で同じ Replay ボタンを比較した。修正前は背景と文字の輝度が近く輪郭も不明瞭だった。修正後は暗い pill 上に明るい文字が表示され、通常状態 `16.89:1`、Mobile で観測した hover 相当状態も暗い背景＋lime 文字で判読可能だった。

## Required fidelity surfaces

- Fonts / typography: 既存 mono font、weight、font size を維持。翻訳後ラベルでも clipping なし。
- Spacing / layout: Secondary Action に border と既存 padding を明示。Desktop / Mobile とも配置崩れなし。
- Colors / tokens: Primary と Secondary の foreground / background ペアを分離し、禁止ペアを明文化。
- Image quality: 今回の修正対象外。既存 Incident Storyboard asset に変化なし。
- Copy / content: ラベル文言と Evidence の意味は変更していない。

## Implementation checklist

- [x] lime 背景＋白文字を共通 Secondary Action から除去
- [x] foreground だけを上書きしていた Strategy Preset / Submit Bar を修正
- [x] Rescue Room の実行完了状態を Desktop / Mobile で確認
- [x] 主要 12 route、visible Secondary Action 32 個を横断確認
- [x] 主要 12 route の HTTP status と console error を確認
- [x] Rescue Room の Desktop / Mobile で horizontal overflow なしを確認
- [x] UI verifier に禁止配色の自動検出を追加
- [x] 恒久禁止ルールを本ファイルへ記載

final result: passed
