# Microgrid Practice 実装計画

## 初回ミッションと公開確認 — 2026-09-13

測定→Grid import capだけを12から2へ変更→再実行の初回ミッション。StarterのStorm dayでは費用−660 USD／未供給+7 MWh／炭素−3,200 kg。価格・供給・炭素を独立に示す。

- [x] 画面上のクリック回数ではなく実Runから学習進捗を判定。学習バッジをScore・報酬に使用しない。
- [x] 1440 / 390pxで新ミッションを完走。実Run前・編集後・不正入力・別Contextを区別。既存ArenaからのCSS干渉を避け、操作色も検査。
- [x] Web build、変更範囲Lint、全体TypeScriptテスト821成功／11skip。進捗判定の新規テスト3件を含む。
- [x] 先行Commit `033a73c` の既存Practiceは公開HTTPSで検証済み。[公開確認の詳細](../../../evidence/verification/PUBLIC_VERIFICATION_2026-09-13.md)。

新ミッションは今回のローカル実装で、まだPush／Deployしていない。確認: <http://127.0.0.1:3014/arenas>。検証コマンド: `pnpm exec tsx scripts/verify-first-missions.ts http://127.0.0.1:3014`。画像・結果は `.frontier/first-mission-qa/`。

## 一目で分かるイラスト — 2026-09-13

- [x] 冒頭に専用イラスト `apps/web/public/images/microgrid-community-story.png` を追加。
- [x] 太陽光・風力→蓄電池→街、外部系統の停電を一枚で示す。蓄電Policyで費用・未供給・炭素が変わることを3段階の短文で説明。実設備ではなくSimulationと明示。
- [x] PCは絵＋説明の2列、Mobileは画像を切らず縦積み。文字を絵に重ねずHTMLとして表示。
- [x] 1440 / 390pxで読込み、3段階説明、Console error 0、横Overflowなしを確認。Web build・既存Arena登録テスト3件・変更範囲ESLint成功。

表示は共通 `arena-intro-story.tsx` から対象3Arenaのみ。イラストは概念説明でありEvidenceではない。画像生成の方式・保存先・最終Promptは[素材記録](../../../product/arenas/ILLUSTRATIONS.md)。確認手順: `pnpm exec tsx scripts/verify-arena-stories.ts http://127.0.0.1:3014`。画面: `.frontier/arena-story-qa/`。評価処理・API・公開Deploymentは変更していない。Push未実施。

更新日: 2026-09-12。今回の対象はブラウザー内で再現可能な学習用 Practice。既存の静的 100 MWh 配分、公開 API、Manifest、旧 Hash は変更しない。

## 今回の受け入れ条件

- [x] 同一ページで「Day strategy」と「Classic mix」を切り替えられる。
- [x] 4 時間 × 6 区間の公開シナリオを固定し、天候・太陽光・風力・需要・価格・夕方の停電を表示する。
- [x] Battery の初期残量、容量、充放電上限、各方向の効率を適用する。負の電力量を作らず、区間ごとの収支を検証できる。
- [x] 予備残量、放電開始価格、安価な時間の充電、系統購入上限を編集し、意味とトレードオフを画面で説明する。
- [x] 1 日実行、前後の区間移動、自動 Replay、エネルギーの流れと Battery SOC を提供する。
- [x] 費用 USD、未供給電力量 MWh、運用炭素 kgCO₂ の 3 軸を独立に比較する。合計点を作らない。
- [x] 同じ Context の固定 Baseline と前回の実行結果を比較する。優劣・同値・トレードオフをシミュレーター算出値に基づき表示する。
- [x] 新しい Simulator / Policy Version、Context / Policy / Result Hash、全区間を含む JSON Download と Replay 検証を提供する。
- [x] 保持されるのは画面内の現在・直前 Revision のみと明示する。実際の電力網最適化、実 AI、報酬、Hidden Final の完成を主張しない。
- [x] 収支、SOC、停電、非負、決定性、Replay 改ざん、不正 Policy、キー順序と比較順序の不変性をテストする。
- [x] 専用 CSS Module を使用し、白背景のライム文字を使わない。
- [x] Desktop / Mobile / Console QA を統合担当で確認した。

## 実装境界

公開データの単純な集約エネルギーモデル。潮流、電圧、周波数、系統安定性、蓄電池劣化、電力市場、実測気象予測は扱わない。新 Practice の Context と旧 `microgrid-dispatch-v1` は比較しない。公開 API・登録・保存・Final・報酬・外部サービスへの接続は今回の対象外。

## 実装した UI と確認記録

画面は「Public day 選択 → 01 Policy → 02 Energy Replay → 03 独立 3 軸比較 → 04 JSON 証拠」で構成した。初期状態は公開 Baseline のプレビューと明示し、`Run this day` で初めて自分の Revision を作る。編集だけでは表示中の旧 Revision を上書きせず、再実行が必要と表示する。日の変更時は比較履歴をリセットする。

公開日は `storm-day` と `clear-day`。同じ需要・料金に対する夕方の系統有無を切り替える。それぞれ別 Context Hash であり、日の違う結果は比較関数でも拒否する。Baseline は Hold a reserve / Shift cheap energy / Limit grid imports の 3 本で、前回 Revision は 2 回目の実行から加わる。すべての比較を再実行検証済みの結果に限定し、同値も悪化もそのまま表示する。

Battery は 20 MWh、初期 6 MWh、各 4 時間の充電入力・放電出力は各 8 MWh。各方向 90% 効率で、整数 kWh の切り捨て／切り上げを Context に記録する。初期蓄電に $300・2,100 kgCO₂ を共通計上し、終端残量に返金・売却価値は付けない。風力・太陽光の発電費用は Curtailment 分も含む。

実装ファイル:

- `packages/microgrid-dispatch/src/practice.ts` — 別 Version の純粋 Simulator、Context、Policy 検証、Replay 検証、独立軸比較。
- `packages/microgrid-dispatch/src/practice.test.ts` — 22 新規テスト。既存 2 テストと合わせて 24 件成功。
- `packages/microgrid-dispatch/package.json` — `./practice` のブラウザー安全な Export のみ追加。依存変更なし。
- `apps/web/src/components/microgrid-day-practice.tsx` / `.module.css` — 編集・図解・Replay・比較・JSON Download。
- `apps/web/src/components/microgrid-dispatch-demo.tsx` — Day / Classic 切り替え。Classic 評価処理は保持。

確認済み: 対象 Package 型検査、上記 24 テスト、対象 ESLint、Prettier。変更した入力の検証失敗は画面にエラーとして出し、無効な結果を作らない。

## 完成画面と統合 QA

統合担当の初回ブラウザー検証では Policy 編集、Replay、Context 変更時の履歴初期化が成功した。一方、390px の結果比較表で炭素軸と関係が横スクロールの外に隠れる問題を確認した（`.frontier/arena-labs-qa/microgrid-dispatch-390-result.png`）。800px 以下では各 Reference を縦型カードに変更し、Cost / Unserved / Carbon / Relationship を明示ラベル付きで同じ幅に表示、Caption も折り返すよう修正した。Desktop の表は保持する。

修正後の1440px / 390pxで再確認し、比較欄の内部Overflowも0となった。`.frontier/arena-labs-qa/microgrid-comparison-390.png`に4つの参照カード、`microgrid-flow-1440.png` / `microgrid-flow-390.png`に停電時の電力フローを保存した。最終Production build、全Workspace型検査が成功。

確認用: <http://127.0.0.1:3014/arenas/microgrid-dispatch>（ローカル専用。Push・公開未実施）。

実操作でPolicy変更→2回目のRun→Previous Revision→Downloadを検証し、JSONを別のNodeプロセスのSimulatorで再計算して一致した。系統上限2 MWh・予備0%・放電価格30へ変更すると、既定Policyより未供給が増え、費用・炭素が減るというトレードオフを確認。Classic切替、公開日の変更、Context Hash変更と履歴クリアも確認した。Console error 0、禁止配色0。

統合コマンド: `pnpm exec tsx scripts/verify-arena-labs.ts http://127.0.0.1:3014`。全体TypeScriptテスト818成功・11skip。SDK / CLI公開契約も変更なし。

安定した操作対象は `data-testid="microgrid-run"`、`microgrid-replay`、`microgrid-step-next`、`microgrid-step-previous`、`microgrid-result`、`microgrid-artifact-download`、`microgrid-replay-verify`、`microgrid-mode-classic`、`microgrid-mode-day`。入力 ID は `microgrid-reservePercent` / `microgrid-dischargePrice` / `microgrid-chargeBelowPrice` / `microgrid-maxGridMwh`。`microgrid-scenario` で日を変更できる。

受け入れ操作: 初期 Policy を実行すると Hold a reserve と同値。Limit grid imports を読み込んで再実行すると供給不足と費用・炭素のトレードオフ、前 Revision との比較を表示。16:00 の停電は系統 0 MWh、Baseline の電池供給 8 MWh、未供給 5 MWh。Download は Policy 単体ではなく全 `MicrogridDayResult` JSON で、`verifyMicrogridReplay(json)` にそのまま渡せる。

## 後続の境界

公開 API、永続 Revision、サーバー受付、Final Entry、Hidden Final、報酬、AI、実設備への接続は未実装。新しい利用者テストや、実際の電力設備に妥当なモデルとしての検証も今回の完了条件には含めない。

次は初見で4設定の意味と電力フローを理解できるか確認する。2種類の公開日は学習用であり、未知Finalや大量Practiceに耐えるAI戦略競技の成立を証明したものではない。
