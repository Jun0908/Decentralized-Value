# Rescue Room — 提出素材・無人作業の引継ぎ

初回作成: 2026-09-12。以下の動画・独立起動検証はその時点の記録。

最新追記（2026-09-13）: コードのPushと公開Web確認は完了。SponsorのENSv2取引・公式CRE秘密Pack Simulation・外部AIによるBazantic MCP評価も実行済み。[最新提出文](SUBMISSION_COPY_EN.md)と[公開確認記録](PUBLIC_VERIFICATION_2026-09-13.md)を優先する。完成した音声入り動画の公開確認と応募送信は、この作業では実施していない。後日のMain／Sponsor録画は `D:/Codex/Engllish Presentation/assets/video/` へ引き渡し済みで、以下の初回Rescue動画だけが最新素材という意味ではない。

## まず使うもの

- [動画＋英語台本のZIP](../.frontier/handoff/rescue-en/rescue-room-en-handoff.zip) — MP4、読み上げTXT、秒数付き台本を同梱。

- 英語デモ: `http://localhost:3000/rescue-room/submission/en`
- [無音動画 MP4](../.frontier/handoff/rescue-en/rescue-room-en-silent.mp4) — 2分6.08秒、1440×900、25fps、H.264、約4.9 MB。音声なし。ブラウザ再生・全編デコード・代表フレームを確認済み。
- [英語台本](RESCUE_NARRATION_EN.md) — 225語。Intro → Hire → Decide → Compare → Allocate → Verifyの順。秒数別の目安付き。
- [読み上げ本文だけのTXT](../.frontier/handoff/rescue-en/narration.txt) — 編集ツールへのコピー用。
- [応募説明の英語草案](SUBMISSION_COPY_EN.md) — 実装範囲と限界を明記。本人確認欄は未確定のまま。
- [編集用WebM](../.frontier/handoff/rescue-en/rescue-room-en-silent.webm)
- [PC / Mobile QA](../.frontier/handoff/rescue-en/ui-qa.json)、[隔離環境の実HTTP検証](../.frontier/handoff/rescue-en/loopback-http-qa.json)

動画のSHA-256: `d2951929787030d60d554cdccca359c6ca65e69974995de4893434ef095b6410`

`.frontier/`はGit除外のローカル保存先なので、GitHubには動画が上がらない。動画を声の収録・編集ツールへ取り込んで使用する。実録の本人音声を載せ、完成後の尺・音声・720p以上を確認する。声のクローンやTTSを公式条件に適合すると自動判断しない。

## 映像が示す範囲

実AI実行とSepolia支払いの**保存済みEvidence**を読む画面の操作録画。録画中に新しいAI実行や送金はしていない。購入後3判断、架空ProtocolのOutcome、独立Pool Previewを示す。AIが何もしない戦略に負けた結果を変えていない。実プロトコル復旧・未知Final・実大会報酬・スポンサー連携成功は示していない。

## Plan12：独立起動と実HTTPで確認したこと

基準Commit `83d3225`の`git archive`を空の一時ディレクトリへ展開し、秘密ファイルをコピーせずに確認した。今回追加の`verify-rescue-submission-http.ts`だけを検証用にコピーした。これは最新SDK検証機能の配布テストとは別の、既存公開Practiceの独立起動検証である。

1. `pnpm install --frozen-lockfile --ignore-scripts` — 成功。依存はローカルpackage cacheから再利用。CLI dist未生成の警告は次のtooling build前のもの。
2. `pnpm verify:rescue:submission-replay` — 成功。元の記録と同じOutcome / Transcript / Pool比較Hash。
3. `pnpm build:tooling` — 成功。
4. `pnpm --filter @frontier/web exec next dev --hostname 127.0.0.1 --port 3012` — 隔離コピーのWebを起動。
5. `pnpm exec tsx scripts/verify-rescue-submission-http.ts http://127.0.0.1:3012` — Browserで日本語提出画面を確認し、SDKで6回の実HTTPを実行。すべて200。Starter digest、反復Result Hash、ローカルEvaluatorとの全応答一致を確認。
6. 検証用3012 serverは停止済み。普段のlocalhost:3000は停止していない。

`.env` / `.env.local` / `apps/web/.env.local` / `secrets/` / private Operator記録は隔離コピーに存在しない。これは公開Deploymentや第三者本人の利用確認ではない。OS・Node・package cacheは同じWindows端末を利用した。Linux検証とは呼ばない。

## 再実行

```powershell
# APIキーなし。公開記録の再計算
pnpm verify:rescue:submission-replay

# 既存ローカルWebに対する非課金HTTP検証
pnpm exec tsx scripts/verify-rescue-submission-http.ts http://localhost:3000

# 英語画面のPC / Mobile検証。モデル・送金なし
pnpm exec tsx scripts/record-rescue-submission-en.ts

# 無音WebMを収録し直す場合のみ（約2分）
pnpm exec tsx scripts/record-rescue-submission-en.ts --record

# 秘密Packのcommit / reveal / replay。ローカルのみ
pnpm exec tsx scripts/verify-cre-secret-pack.ts

# Bazantic比較のローカル準備。通常は要約、--fullで全履歴
pnpm exec tsx scripts/verify-bazantic-readiness.ts
```

動画のMP4化は端末のFFmpegでWebMをH.264へ変換した。録画の再実行はMP4を自動更新しない。画面・台本を変更した場合、古い動画を最新画面の証拠として使わない。

## Plan12：SDKの独立Hash照合

`verifyRescueDoctrinePracticeIntegrity({ request, run })`をSDKに追加。保持しておいた元の要求と結果を照合し、Artifact、Evaluation、Outcome、Transcript、Payment EvidenceのHashと提供済みOrder / Receiptの相互参照を検査する。利用例も更新した。

11新規テスト内で35公開Episodes × 3 Presetsの105ケースを確認。SDK build後、実tarballを別の空consumerへoffline / lifecycle script無効で導入し、新exportの実行・改ざん拒否・NodeNext strict型検査を確認した。依存追加なし。

成功はHash整合性のみ。Evaluator再実行・診断・署名・実支払い・与えられていないHash元データの正しさを証明しない。すべてのHashを整合的に作り直した捏造を、真正な測定として認証する機能でもない。[SDK詳細](../packages/sdk/README.md)

## Plan11：秘密Packのローカル準備

`pnpm exec tsx scripts/verify-cre-secret-pack.ts`で、暗号学的乱数による3 Episodeと256-bit saltを作り、commit → 評価 → メモリ内で明示Reveal → 再評価を確認した。Pack、順序、Artifact、Context、Metricなどの改ざん検査を追加。実際にHashしたbrowser-target bundleをNode V8で実行して一致を確認した。

これは非本番・ローカル準備。秘密をWeb・ログ・ファイルへ出さず、公開receiptはsalt付きcommitmentと境界フラグのみ。CREログイン・公式Simulation・TEE・永続Freeze・公開commitmentの時刻証明・実報酬は未達のまま。[詳細](sponsors/chainlink-cre.md)

## Plan11：Bazantic比較のローカル準備

非課金のRescue PracticeにRecipeを合わせ、同じTask・Prompt・Model設定・API・Context・Episode・Seed・Tool上限でRecipe有無だけを変えるA/B基盤を追加した。全組を保存し、失敗・同等・悪化を除外しない。評価結果は既存Evaluatorで再計算し、3軸を独立に比較する。401 / 402 / 403では停止し、認証回避や自動支払いをしない。

標準確認は事前固定の4組を使い、`--full`で完全な要求・応答・Tool履歴を出せる。Fixtureは意図的に異なるPresetを返す決定論的なテストであり、実AIにRecipeを与えた改善実績ではない。注入するRunnerは信頼済みコードを前提とし、任意コードの時間・ネットワークSandboxではない。実Gateway・実Model・Recipe登録は未実行。[比較基盤の詳細](../bazantic/experiments/README.md)

## 最終検証

- 全体TypeScriptテスト: **718成功 / 11スキップ**。スキップを成功件数へ含めない。
- Workspace型検査、Web production build、変更範囲ESLint / Prettier、CLI / SDK生成契約の差分検査が成功。
- 英語・既存日本語画面のPC / Mobile確認、英語画面のConsole / Overflow / Contrast / Download検査が成功。
- 公開Replay、秘密Pack verifier、Bazanticローカル4組、SDK配布consumer、隔離Webの実HTTP検証が成功。
- 今回はContractを変更しておらず、Contractテスト・公式CRE・実Gateway・公開環境検証をこの成功一覧へ含めない。
- 追加モデル呼出し0、追加チェーン取引0。動画・ZIPはGit除外、Push・Web公開・応募送信なし。

## 人間側に残ること

外出中の追加準備: [外部AI開発者向けの接続チェック](RESCUE_AGENT_QUICKSTART.md)、[情報購入の比較実験設計](RESCUE_INFORMATION_STUDY.md)、[提出用の変更一覧](SUBMISSION_CHANGE_INVENTORY.md)。比較実験は設計のみで、新しいAI呼出し・支払い・公開はしていない。

1. 本人Dashboardの参加Track・締切・応募賞、審査対象の開始Commitを確認する。
2. 動画へ本人の実録音声を載せ、完成動画を視聴する。
3. ENS / Chainlink / Bazanticの選択賞に、実行済みEvidenceと未完成範囲を正確に記載する。最低Demoのための再認証・ENS再取得・再送金は不要。
4. 公開済みWebとGitHubのリンクを提出欄へ使う。公開確認後の新しいローカル変更は、別途反映を確認してから説明する。
5. AI利用と実際の人間の貢献を確認し、応募フォームを送信する。

スポンサー実証が増えない場合は、完成済みとしてスポンサー名を動画や提出文へ追加しない。[提出条件の確認事項](sponsors/MANUAL_ACTION_REQUIRED.md)を参照。
