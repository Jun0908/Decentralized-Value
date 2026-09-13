# Rescue Room — Design QA

## 下段3Arena First Mission — 2026-09-13

対象は `arena-intro-story` に続く新しい `first-mission`。Calldataは2回の実測、Microgridは1パラメータの変更、Secret Gateは4つの実操作へ直接つなぐ。画像は先行生成素材を保持し、この変更では新規生成なし。

- 初回検証でMicrogridの既存ボタンCSSが新コンポーネントに干渉して白背景になったため、`.mission .steps .action`へScopeを限定してdark＋lightに固定。共通globals.cssは変更しない。
- default / hover / disabled、focus outline、activeのlime＋darkを同一Scopeで明示。
- 1440×1000 / 390×1000で実操作完走、横Overflowなし、Console errorなし。意図した重複拒否409は別計数。
- 未測定・編集中・同じArtifact・別Context・不正入力を区別し、Learning progressをScoreやRewardへ接続しない。
- 画像: `.frontier/first-mission-qa/{calldata-compression,microgrid-dispatch,secret-gate}-{1440,390}-{initial,complete}.png`。最終Microgrid mobileもdark buttonで再確認。
- 自動確認: `scripts/verify-first-missions.ts`。ボタン／リンクの背景色の継承干渉を検出する検査を追加。

公開HTTPS上の先行3Arenaと提出リンクは別途検証済み。このFirst Missionはまだローカル実装。final result: passed（ローカルの初回ミッション範囲）。

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

## Strategy Game UX Pass A — 2026-09-10

### 対象とSource Visual Truth

- 選択されたデザイン: `artifacts/ux-audit-rescue-room/34-strategy-game-selected.png`（1536 × 1088 px）
- 実装Route: `http://localhost:3000/arenas/rescue-room`
- 実装箇所: `apps/web/src/components/rescue-room-workbench.tsx`、`apps/web/src/app/globals.css`
- Desktop: CSS viewport 1440 × 1000、deviceScaleFactor 1
- Mobile: CSS viewport 390 × 844、deviceScaleFactor 1
- 検証State: Hero、Doctrine選択前、Reference Doctrine実行中、実行完了、Previous Revision表示、AI Commander実行完了

### 比較Evidence

- Desktop Hero: `artifacts/ux-audit-rescue-room/35-strategy-game-desktop-hero.png`
- Desktop Doctrine Builder: `artifacts/ux-audit-rescue-room/36-strategy-game-desktop-builder.png`
- Desktop Live Decision: `artifacts/ux-audit-rescue-room/37-strategy-game-desktop-live.png`
- Desktop Debrief: `artifacts/ux-audit-rescue-room/38-strategy-game-desktop-result.png`
- Mobile Doctrine Builder: `artifacts/ux-audit-rescue-room/39-strategy-game-mobile-builder.png`
- Mobile Debrief: `artifacts/ux-audit-rescue-room/40-strategy-game-mobile-result.png`
- Real AI Commander Debrief: `artifacts/ux-audit-rescue-room/41-strategy-game-ai-result.png`

### Comparison history

#### Iteration 1 — blocked

- Sourceと初回Desktop実装を同じ比較入力で確認した。暗いgrid、lime / cyan / orange、巨大見出し、横長Doctrine Row、選択中Rule、Service Toolkitという視覚階層は一致した。
- [P1 / Mobile layout] Lock CTAが2-column gridのまま残り、説明文へ重なった。
- [P1 / Mobile comparison] 4-column Baseline tableが画面外へ切れ、3 Outcomeを同時に比較できなかった。
- [P2 / Content hierarchy] HeroとBuilderで`Unknown incident. One doctrine.`を繰り返し、Sourceの「BriefingからDoctrine選択へ進む」階層が弱かった。
- Fix: Mobile deploy barを1-column化し、BaselineをStrategyごとの3 Outcome cardへ変換した。Builder見出しを`Choose your strategic doctrine.`へ変更した。

#### Iteration 2 — passed

- Source、Desktop Hero、Desktop Builderを同じ比較入力で再確認した。
- 3 Doctrineは選択可能で、選択中だけRulesと許可Serviceが展開される。Primary CTAはStrategyをLockしてから実行する。
- Live画面はProtocol / Commander / Service Agents / Evidenceの4 Laneと、Trigger / Rule / Cost-Time / State Change / AlternativesのDecision Lensを表示する。Raw TranscriptはSecondaryの`details`へ移した。
- DebriefはYour Commander / Always Pause / Never Pause / Previous RevisionをUser Loss、Demand Served、Spendの独立列で比較し、Weighted Scoreを作らない。
- MobileではDoctrine、Service、Lock CTA、Baseline comparisonが1-columnへ収まり、横Overflowはない。
- 選択デザインのicon tileは既存プロダクトに同系統のicon setがないため、偽SVGやCSS artへ置き換えず、既存の番号・色・境界線による識別へ統一した。

### Required fidelity surfaces

- Fonts / typography: 既存display sansとmonoを維持。巨大見出し、Doctrine名、Rule、Evidenceの階層はSourceに合わせた。Desktop / Mobileでclippingなし。
- Spacing / layout: Sourceの横長Doctrine Row、選択展開、Toolkit / Value Focus分割、下部Lock CTAを再現。Mobileは縦stackへ変換。
- Colors / tokens: 既存のdark surface、lime、cyan、orangeだけを使用。visible interactive elementの禁止配色は0件。
- Image quality: 既存の高解像度Incident StoryboardをNext Imageで使用し、Desktop / Mobileともstretch、halo、placeholderなし。
- Copy / content: Strategyの保護対象と犠牲、True State非公開、Information cost、simulated Game Creditsを実行前に明示。
- States / interactions: 3 Doctrine、Reference / AI runtime切替、Alert選択、Advanced AI設定、Lock、Play / Pause / Step / Skip、Raw Log、Baseline比較、Previous Revision、Retry、Evidence Downloadを操作確認。
- Accessibility: semantic button、`aria-pressed`、form label、table role、live region、keyboard focus、reduced-motion処理を維持。Desktop / Mobileでconsole error 0件。

### Automated verification

- `pnpm verify:rescue-room-ui`でDesktop / MobileともHTTP 200。
- Doctrine 3、Decision Lane 4、Baseline comparison、Previous Revision、Service 6、Value Pool 4を確認。
- Reference Replayと実AI CommanderのAction Replayを完了。
- Desktop / Mobileともhorizontal overflowなし、runtime overlayなし、console errorなし、禁止Contrast Pairなし。

final result: passed

## Rescue Room Incident Theatre Pass C — 2026-09-11

### 変更とEvidence

- Strategy Builder: `artifacts/ux-audit-rescue-room/42-incident-theatre-desktop-builder.png`
- Desktop Incident Theatre: `artifacts/ux-audit-rescue-room/43-incident-theatre-desktop-live.png`
- Mobile Incident Theatre: `artifacts/ux-audit-rescue-room/44-incident-theatre-mobile-live.png`
- Desktop Debrief: `artifacts/ux-audit-rescue-room/45-incident-theatre-desktop-result.png`
- Real AI Commander Debrief: `artifacts/ux-audit-rescue-room/46-incident-theatre-ai-result.png`
- 実装箇所: `apps/web/src/components/rescue-incident-theatre.tsx`、`apps/web/src/components/rescue-room-workbench.tsx`、`apps/web/src/app/globals.css`

Live表示を縦に増え続けるEvent Logから、5 Chapter、3 Actor、Service Payment、Evidence Return、Protocol Action、3 Outcomeを同時に示す一枚のIncident Theatreへ変更した。Canonical Transcriptは監査用Evidenceとして初期状態で閉じ、再生単位だけを同一Game MinuteのStory Beatへ束ねた。

Strategy Builderには全10個の決定論的設定について意味とTradeoffを常時表示し、設定全体を`Spend / Certainty / Containment`で要約した。この3項目は読みやすさのための説明であり、評価用Weighted Scoreではない。AI PlaybookにはModel tuningとCommander Strategyの境界を明示した。

### Automated verification

- Desktop / MobileともHTTP 200、3 Actor、5 Chapter、10 Parameter説明、3 Strategy Summaryを確認。
- Raw Transcriptが初期状態で閉じていること、Replay reset、Previous Revision、同一Episode Baseline比較を確認。
- Mobileは`prefers-reduced-motion: reduce`で最終Evidenceへ直接到達。
- Desktop / Mobileともhorizontal overflowなし、runtime overlayなし、console errorなし、禁止Contrast Pairなし。
- Rescue RoomとAPIの決定論テスト40件、全Workspace typecheck、Next.js production buildが成功。
- 実OpenAI Commanderは固定RuntimeでService購入を含むRunとAction Replay検証に成功。

final result: passed
