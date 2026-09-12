# Current implementation status

- **Last verified:** 2026-09-12（下段3ArenaのPractice統合・実ブラウザー検証。スポンサー等の過去の検証記録は各項目の日付と範囲）
- **Public application:** <https://web-rho-seven-d6te7t3f0y.vercel.app>
- **Active plans:** [`Plan9.md`](Plan9.md) (Rescue Room), [`Plan11.md`](Plan11.md) (Sponsor integration), [`Plan12.md`](Plan12.md) (API / SDK / CLI). Parallel ownership and current batch: [`PARALLEL_IMPLEMENTATION.md`](PARALLEL_IMPLEMENTATION.md).
- **Arena improvement plans:** [`Plan-Calldata.md`](Plan-Calldata.md), [`Plan-Microgrid.md`](Plan-Microgrid.md), [`Plan-SecretGate.md`](Plan-SecretGate.md)。各Arenaの今回完成範囲・画面検証・未完成の大会機能を別々に記録。

This document records the current capability boundary. Product rules live in [`PRODUCT.md`](PRODUCT.md), the active Rescue Room work is scoped in [`Plan9.md`](Plan9.md), and completed or superseded plans live under [`archive/`](archive/).

## Working now

### Three Arena introduction illustrations — 2026-09-13

Calldata（梱包と復元）、Microgrid（再エネ・蓄電池・停電時の街）、Secret Gate（秘密を保持したMembership Proofと一度限りの入場）に、既存Arenaの絵柄に合わせた専用画像を追加。各ページ冒頭で画像＋短い3段階説明を表示し、Concept illustrationを実測Evidenceと区別する。Secret Gateの競技PIVOT・全Evaluatorは不変。[画像保存先と最終Prompt](ARENA_ILLUSTRATIONS.md)。

Web build、Arena登録テスト3件、変更範囲ESLint、1440 / 390pxの全3ページの画像読み込み・縦横比・説明・Console error 0・横Overflowなしを確認。画像は切り抜かず、文字は暗い背景上のHTMLとして配置。検証: `pnpm exec tsx scripts/verify-arena-stories.ts http://127.0.0.1:3014`。既存の確認用3013だけ再起動し、3014へ反映。3000番・PC再起動・公開Deployment・Pushは対象外。

### Three local Arena workbenches — 2026-09-12

3担当でCalldata / Microgrid / Secret Gateを並行改善し、統合担当が最終画面と各日本語Planを照合した。共通CSS・既存Scratchpad・上段Arenaの評価処理は変更していない。OceanとCalldataの表示位置入替は先行依頼として保持。

- **Calldata:** 最大4件のCodec選択RuleとFallbackを編集し、Batch別の梱包・Bytes・復元Digestを可視化。内部`POST /api/calldata-lab`で実Cancun EVM測定、独立2ガス軸、同ContextのReference／直前Revision比較、Evidence Download。Host側Rule選択は非計上、任意コード実行ではない。旧Public API・3Codec Result Hashは保持。
- **Microgrid:** 別Versionの6ターンDay simulator、4つの蓄電Policy設定、天候・停電・SOC・電力フロー、Replay、費用／未供給／運用炭素の独立比較、再計算可能なJSON。旧100 MWh ClassicとAPI／Hashは保持。モバイル比較表の横切れを発見し、参照ごとの縦型カードへ修正した。
- **Secret Gate:** 実Proofの4段階図解、設定説明、待ち行列、4Proof進捗、同一Proof再送拒否、秘密を含まないEvidence。競技は引き続き**PIVOT**。合成指標でGOを作っていない。

最終検証: TypeScript **818成功／11skip**、全Workspace型検査、Web Production build、変更範囲ESLint／Prettier、SDK／CLI契約差分チェック。1440／390pxの3Arenaで設定変更・実行・比較・Download・Replay・Context切替を確認。Console error 0、横Overflow・禁止配色0。Secret Gateの意図したHTTP409は別に記録する。Proof受理・同一Proof拒否・4Proof生成は最終的に実HTTPで確認し、応答Mockは使用していない。

確認用の <http://127.0.0.1:3014/arenas> はloopback限定の開発プレビュー。Web buildを背後の3013番で提供し、Gateの2POSTだけを既存の実Handler＋独立MemoryStoreへ接続する。本番Redis必須条件は維持し、AI／支払い等のPOSTは拒否。再起動で一度限り使用の履歴は失われる。[再起動手順](Plan-SecretGate.md#ローカルプレビューの再起動手順)。検証は`pnpm exec tsx scripts/verify-arena-labs.ts http://127.0.0.1:3014`、結果と画面は`.frontier/arena-labs-qa/`。

これらは新しいローカルPracticeであり、Hidden Final、大会用永続Entry、報酬、実設備、公開Deploymentの完成ではない。今回のPush・送金・有料AI呼出しは0。既存3000番サーバーやPC再起動・ネットワーク設定には触れていない。

### Sponsor minimum working demonstrations — 2026-09-12 09:45 UTC以降

撮影用の英語ページはローカル`/sponsors/demo`。[撮影手順・英語台本・代表コード](sponsors/SPONSOR_DEMO_RECORDING.md)。ページは実行済みEvidenceを表示し、閲覧で追加推論・送金は発生しない。今回のページの公開Deploymentは未確認（GitHubへのコードPushとは別）。

- **ENSv2:** `frontierdemo.eth`の専用Text keyからRescue APIを発見し、実HTTP評価を検証。単一Keyのgrant→delegateによる更新／pause／restore→revokeの**7取引**がSepoliaで確認済み。paused discovery拒否とrevoke後の`eth_call`拒否も確認。現在Serviceはactive、delegate権限はrevoked。他のRecordは変更していない。[Evidence](deployments/ensv2-rescue-demo.json)。撮影時は`pnpm exec tsx scripts/verify-ens-rescue.ts`で追加送金なしに再確認できる。
- **Chainlink CRE:** 公式CLI 1.33.0 / SDK 1.20.1で通常・Confidential両方の公開Fixtureを実行し、Nodeと全Envelope・既存Hashが一致。さらに新規秘密Scenario Packを`handlerInTee`のsecret inputで評価し、Receipt一致→明示Reveal→Replay成功。[Evidence](deployments/chainlink-cre-private-pack.json)。**local simulationであり、live TEE attestation・onchain commitment・本番Final完了ではない。**
- **Bazantic:** 外部OpenAI Agent（gpt-5-nano）がBazantic MCPからManifest取得→Baseline評価→候補評価を実行。3 Toolの内部HTTPすべて200、SDK Integrityとローカル再評価が一致。[Evidence](deployments/bazantic-rescue-agent-demo.json)。予算90→60 Creditsの候補は、この公開Episodeで3軸とも同値。AI改善・Recipe有無A/Bを主張しない。**Bazantic-hosted Recipe実行／公開・Gateway課金は未実施。**

CRE対応ではPractice概要の重い初期計算を遅延化し、Protocol JSONのASCIIキー順をV8とQuickJSで一致させた。既存Node Hashは保持。無制限Unicodeキーの全Runtime一致を保証する変更ではない。

遠隔操作中のためPC再起動・スリープ・ネットワーク変更・既存dev server停止は禁止。今回これらは行っていない。下記の「認証停止」「実AI未実行」は先行バッチの履歴であり、上記の最新結果を優先する。

検証: `vitest run --maxWorkers=2 --testTimeout=15000`で**766成功／11スキップ**、全Workspace型検査、Web production build、変更範囲ESLint／Prettier、CLI／SDK生成契約チェックが成功。SDK provenanceはRescueのsource変更に合わせ再生成し、API型・Fixtureは不変。初回の高並列検査では時間切れと既存Durable JobのWindows `EPERM`競合が出たため、これは通常並列CIの安定性改善が不要という主張ではない。

Browser: Desktop 1440／Mobile 390、章移動、keyboard details、3 JSON Download／不正ID 404、Home、console error 0／horizontal overflowなし。追加証跡のoffline Replayと改ざん拒否も成功。今回変更47ファイルに設定済み秘密値の一致なし。既存`security:scan`は未変更の`scripts/settle-ocean-match.sh:23`（.envを読むsed式）を検出して非zeroのため、全体Secret scan成功とは記録しない。Contract変更・Contractテスト・Deploy・Pushは今回の検証に含めない。

### Bazantic Rescue Gateway repaired — 2026-09-12

既存Gatewayの404はSpecとルート表の不一致だった。旧15ルート・料金を保存して、公開Manifest・Starter・Doctrine評価の3ルートのみ無料追加。Gateway HTTPの6要求すべて200、Starter SHA・SDK Hash・反復一致が成功。MCPのManifest取得と2回のDoctrine評価も成功し、返却JSON全体が反復・ローカルEvaluatorと一致した。[実接続Evidenceと再現手順](sponsors/BAZANTIC_RESCUE_LIVE.md)。

既存Recipe一覧0件を確認後、`rescue-room-strategy-comparison`を下書き作成し、定義全フィールドの読戻し一致を確認。無料で動いた2 Toolのみを束ね、総合点を作らずBaselineと変更案を比較する。**Recipe公開・実AI試行・A/B比較は未実施**。今回の追加送金・推論0、Web公開・Pushなし。旧ログイン／404記録は以前の状態として残す。

関連3ファイル・67テスト成功。Evidence JSON・ルート保持・料金0・Recipe定義Hashも検査した。今回の変更は外部Gateway設定・Recipe draft・文書／定義JSONで、Web / Evaluator / Contract実装や全体Buildは対象外。

直前の別確認ではCREの停止理由がOrganization取得から`local-simulation`のRPC未設定へ変化。ENSv2 ETHRegistryのBlock 11687758で、`frontierdemo.eth`の所有者が本人提示の`0x5A6A8964B044fdf18920ac4af64c18e88792261D`と一致した。両方とも本体連携の完了ではないが、再ログイン・名前の作り直しを依頼する必要はない。

### Existing sponsor connection check — 2026-09-12

既存アカウントの読取再確認で、CRE / BazanticのCLIログインは成功。CRE通常SimulationはOrganization情報取得で停止し、未ログインとは区別する。Bazanticは既存active Gateway・64個のMCP Toolを確認したが、Rescue ManifestのTool呼出しは404（公開APIへの直接GETは200）。ENSはSepoliaの`frontierdemo.eth`でResolverを取得したが、アプリが使うRunner一覧は取得できていない。以前の未認証／未設定記載を、この再確認の成功範囲へ読み替える。実接続全体の完成ではない。

詳細・Snapshot・次の対応は[既存接続確認](sponsors/EXISTING_CONNECTION_CHECK.md)。登録・設定変更・推論・支払い・デプロイは行っていない。

### External developer preflight and study preparation — 2026-09-12

`pnpm exec tsx scripts/verify-rescue-practice-onboarding.ts http://localhost:3000`で、非課金RescueのManifest・Starter SHA・Practice・独立Hash・反復一致を一度に確認できる。失敗段階と安全なError Code / 次の対応を返し、認証要求・402・redirect・Context変更では停止する。API / SDK公開契約・評価ルールは変更していない。[初回利用手順](RESCUE_AGENT_QUICKSTART.md)。

実API handlerへの注入21テストと、localhostへの6実HTTPを確認した。全体TypeScriptテスト742成功 / 11スキップ、追加コードのstrict型検査・ESLint / Prettier成功。公開環境・実参加者・Linux確認ではない。今回はUI / Contractを変更しておらず、その再ビルドやContractテストはこの確認に含めない。

情報購入あり／分析非表示／購入なしの[対照実験設計](RESCUE_INFORMATION_STUDY.md)を全35公開Episodeで固定し、設計Hash生成と3テストを追加した。**設計のみ・実AI比較なし**。Masked input / Arm Runner、実行コード・Prompt固定、費用承認は未完了。[提出用変更一覧](SUBMISSION_CHANGE_INVENTORY.md)は直近区間と既存実装を分けるが、応募期間や資格を認定しない。追加モデル呼出し0、送金0、Push / 公開なし。

### English submission handoff — 2026-09-12

`/rescue-room/submission/en`を追加し、日本語版との切替を用意した。225語の英語台本と、既存Evidenceを読む126.08秒・1440×900の無音MP4 / WebMを作成。PC / Mobile、章リンク、keyboard details、JSON Download、Console / Overflow / Contrastを確認し、動画は全編デコードとブラウザ再生を検査した。提出素材は[RESCUE_HANDOFF.md](RESCUE_HANDOFF.md)。映像作成による追加推論・送金はない。

`83d3225`の秘密ファイルなし隔離コピーで、公開Replay・tooling build・Web起動・SDKによる6実HTTPを確認した。すべて200で、2回のPracticeとローカルEvaluatorが一致。既存配布物テストとは別の最新Rescue提出経路の確認であり、公開Deployment・実参加者・Linux検証ではない。英語ページのWeb buildも成功。本人の実録音声、スポンサー認証、Push / Web公開、応募送信は未実施。

### SDK integrity and sponsor local preparation — 2026-09-12

SDKへ`verifyRescueDoctrinePracticeIntegrity`を追加した。元の要求・Artifact・Context・Episodeと結果の5層のHash、提供済みOrder / Receiptの相互参照を明示呼出しで検査する。11新規テスト内の105ケース、実HTTP結果、SDK build、offline tarball consumerの実行・改ざん拒否・NodeNext strict型検査を確認。Hash整合性の検証であり、Evaluator再実行・実モデル由来・診断・署名・実支払いの証明ではない。

Plan11は認証不要のローカル前段を追加。秘密Packのcommit / reveal / replayは31新規テストと、実際にHashしたbundleのNode実行一致を確認した。公開receiptはsalt付きcommitmentのみで秘密・未Reveal Outcomeを出さない。Bazanticは非課金Recipeと同条件A/B基盤を追加し、35テスト、事前固定4組、失敗・同等・悪化の保持、返却後のReport不変性を確認。Fixtureを実AIの性能改善と呼ばない。公式CRE / TEE、実Gateway、ENS実認可、本番Hidden Finalは未完了。

今回の統合確認: TypeScript **718成功 / 11スキップ**、全Workspace型検査、Web production build、変更範囲ESLint / Prettier、CLI / SDK生成契約差分検査が成功。追加モデル呼出し0、追加チェーン取引0。Contractテストや本番スポンサー実行はこの確認に含めない。

### Hackathon submission demo — 2026-09-12

以下は英語素材バッチより前の実行記録。最新の提出素材は上記の引継ぎを参照する。

`/rescue-room/submission`に、前回購入した実AI分析→実Commanderの3判断（WAIT / WAIT / PAUSE_MODULE）→Simulation Outcome→独立3 Pool Previewを接続した。ゲーム内の需要提供率71.1274%、損失0、費用5 Credits。今回の公開Episodeでは何もしない戦略が支配しており、AI優位をclaimしない。追加送金0、追加AI呼出し3回。3手番上限後にT+60まで進める限定実証で、追加購入・Patch・完全復旧Workflowではない。

公開Replay Fixtureと検証commandを用意し、秘密ファイル・APIキーなしで記録行動のOutcome／Poolを再計算する。既存API/SDKの非課金Practice入口は新設せず、入力・Context・Hash・Replayを検証した。公式CRE CLI v1.33.0とSDK対応Workflowは準備したが、Simulationは未ログインで停止し成功ではない。提出準備と残る人間作業は[提出用スコープ](HACKATHON_SUBMISSION.md)、[認証・応募条件](sponsors/MANUAL_ACTION_REQUIRED.md)を参照。公開デプロイ・Push・フォーム提出は未実施。

以下のOperator Pilotは先行した単発購入の記録。上記の継続判断は、その購入結果を使う別の実行Contextである。

今回の検証：TypeScript 637件成功／11件skip、全Workspace型検査、Web production build、変更範囲ESLint、公開Replay／内部記録Replay、API注入12リクエスト、Desktop 1440／Mobile 390の画面・2種類のJSON Download・導線・console／overflow／contrast検査が成功。今回Contract変更・追加送金なし。CRE公式Simulationは認証で停止しており、この成功一覧に含めない。

### Rescue Operator Pilot — 実AI・Sepolia支払い／返金を確認

2026-09-12（日本時間）、実AI Commanderが公開観測から`pulse-monitor`を選び、別のモデル呼び出しによるPulse Monitorの成果物を受け取り、Sepoliaで**5 rUSD-DEMOを支払った**。別の未納品注文では**5 rUSD-DEMOの期限切れ返金**も確認した。[公開Evidence JSON](deployments/sepolia-rescue-service-demo.json)にTx、納品Hash、Provider残高5、返金後Commander残高95を記録している。rUSD-DEMOは価値を主張しないテストTokenで、Rescue Creditsとは別物。

- `RescueUSDDemo` / `RescueServiceEscrow`、運営管理の役割Wallet、永続Payment予約・署名済みTx照合・Receipt確認を限定的なOperator経路へ接続した。公開WebのPractice操作が自動的に実送金する変更ではない。
- 単一ホスト用Durable Job StoreはOwner、入力Hash付きIdempotency、排他的Claim、Worker fencing、有限Event履歴を保存する。再起動後の不明な推論／送金を自動再実行せず、必要なら`needs-reconciliation`で止める。
- `127.0.0.1:4318`のBearer認証付きHTTP、別クライアント`RescueOperatorClient`、`pnpm rescue:jobs`で作成・一覧・取得・明示的Runを扱う。作成だけでは実行しない。公開`/v1/*`・OpenAPI・既存`FrontierClient`契約は変更していない。
- ローカルWebの`/rescue-room/operations`に、観測→依頼→納品→支払い／返金の公開証跡UIを追加した。Web本番へのデプロイ完了を意味しない。

**未達の境界:** 今回のServiceは公開観測を解釈する追加の実行経路（sidecar）であり、既存SimulatorのService Evidence・Outcomeを置き換えない。検証対象は依頼との対応・形式・参照元・送金で、診断の正しさやゲーム上の有効性は未評価。Walletはすべて運営管理であり、第三者Service Market、Hidden Final、Pool報酬、Rescue本番DB／複数ホスト運用は未完成。詳細は[実行バッチ](RESCUE_EXECUTION_BATCH.md)、[Plan9](Plan9.md)の§31、[Plan12](Plan12.md)の§11を参照。

### Parallel foundations — 2026-09-11の初回バッチ記録

以下はOperator Pilot以前の検証範囲。Rescueの接続・実支払い・ローカルJobの最新状態は上記を優先する。

- Rescue payment preparation now validates an operator-owned Sepolia policy, curated Service/provider bindings, accepted Game Order hashes, per-order/cumulative limits, policy nonce and explicit wall-clock deadlines. It returns an unsigned `fundOrder` reservation intent with `paymentState: not-requested`. The immutable in-process snapshots are not durable atomic reservations; signing, RPC, approvals, receipts and actual payment remain unconnected.
- New versioned Evaluation Request / Result / Execution Evidence schemas preserve independent metrics and bind artifact, evaluator, context, aggregation and optional round/snapshot references. The new hash format uses locale-independent key ordering without changing legacy hashes. Execution records remain `unverified`; schema/hash checks are not signature, ENS, CRE or payment verification.
- A local public single-Episode Rescue adapter evaluates actual Doctrine inputs, checks replay, and wraps the result. `pnpm verify:rescue-envelope` compares native Node, a browser-target bundle in V8, and Bun when installed. This is not an official CRE/QuickJS run, a hidden Final, or an API endpoint.
- `contracts:cli:check` and `contracts:sdk:check` now detect generated-contract drift without modifying files. SDK generation preserves canonical Zod refinements and refreshes Practice fixtures. `verify:packages` installs freshly packed shared/SDK/CLI tarballs into an isolated consumer for ESM, NodeNext and CLI checks. The SDK's direct `viem` runtime dependency is declared.
- Existing Web/API response shapes, game outcomes and legacy hashes are unchanged by these foundations. Ocean API coverage, persistent AI Jobs, saved Rescue entries, real Sponsor execution and live Service payments are still pending.

Integrated Windows verification: tooling build, full workspace typecheck, 453 passing TypeScript tests (11 opt-in Redis cases skipped), both non-mutating contract checks, five CLI workflows, isolated package consumer verification, the production Web build, scoped ESLint/Prettier and diff checks. After concurrent heavy checks caused two existing CLI HTTP cases to exceed their 5-second limit, the unchanged suite passed when rerun alone. Foundry, real Redis, official CRE and live payments were not run. Details and remaining gates are recorded in the parallel implementation document. No package publication, deployment or payment was performed.

### Local SDK and CLI integration (not deployed)

The SDK and CLI implementation is integrated into this monorepo under `packages/sdk` and `packages/cli`; shared evaluator schemas remain canonical in `packages/shared`. The local packages are versioned as `@frontier/sdk` and `@frontier/cli` 0.3.0 with `@frontier/shared` 0.2.0. They are private workspace packages and have not been published to npm. The former `DV-ver2` and `SDK-Decentralized-Value` repositories remain provenance snapshots, not separate active implementations.

- Disaster Response: capability discovery, verified Starter Kit, offline input checks, context-locked Practice, independent-metric comparison, scoped CLI sessions, atomic idempotent revisions, history, exact artifact download, and Final Entry selection.
- Rescue Room: deterministic single-Episode Doctrine Practice and same-context comparison only. Saved submissions and Final Entry remain unsupported; simulated game credits remain distinct from tokens.
- Local Web routes: `/docs/cli`, `/cli/authorize`, and authenticated `/submissions/[id]?arena=disaster-response`. Results are loaded from the signed-in participant's saved history, not a client-provided score.
- Device authorization uses one-time exchange, expiring scoped sessions, revocation, origin checks, and OS credential storage on the CLI. Missing Privy configuration or required production Redis remains unavailable, not a simulated login success.
- `pnpm verify:cli` exercises the actual CLI against isolated local API/account fixtures, including a lost submission response and immutable resume. It does not register or submit to live accounts.

Integrated verification on Windows with Node.js 22.22.1 covers `build:tooling`, the full workspace typecheck, 375 passing TypeScript tests with 11 opt-in Redis cases skipped, five complete local-only CLI workflows, the production Web build, global ESLint, and six desktop/mobile browser route checks without console errors, framework overlays, blank pages, or horizontal overflow. The generated CLI OpenAPI contract is reproducible. Foundry was unavailable during that earlier SDK/CLI verification; this is not the later Rescue Operator verification record.

The final main TypeScript suite passes 290 tests with 11 opt-in Redis cases skipped. The first actual Redis submission run passed 6/7 and exposed a legacy hexadecimal-ID decoding bug. The decoder and surviving-key TTL upgrade are fixed and covered by regression tests, but the post-fix real-Redis rerun is pending because Docker cannot inspect/execute newly created containers. Do not treat this as completed real-Redis acceptance. Retry with `FRONTIER_VERIFY_REDIS=1 pnpm exec vitest run apps/web/src/lib/plan6-store.redis.test.ts` on a working isolated Docker host; do not point it at production Redis.

Live Privy browser authorization, deployed Upstash behavior, npm publication, and non-Windows runtime validation are not established by these local checks. The existing public deployment described below has not been updated by this work.

### Existing application

| Area | Proven capability |
| --- | --- |
| Public web application | The Top page explains the protocol and routes users to four working arenas. The UI and `/v1/*` API share one Vercel origin. |
| 72-Hour Disaster Response | Strategy v2 builder, seven deterministic scenarios, 15-second replay, revision history, one selected Final Entry, three independent outcomes, Value Pools, practice missions, Agent provenance, and Sepolia demo settlement. |
| Calldata Compression | Compiled Solidity decoder bytecode executes in EthereumJS EVM under Cancun rules. Calldata gas and decoder execution gas remain separate. |
| Community Microgrid Dispatch | Deterministic comparison across energy cost, worst-case delivered energy, and lifecycle carbon. |
| Shared evaluation | Correctness gates, direction-aware Pareto membership, normalized hypervolume, exclusive contribution, and deterministic hashes are covered by TypeScript tests. |
| Accounts and storage | Privy-backed account flows and separate Redis namespaces persist Disaster Response and Classic Emergency Supply participant state when production configuration is present. |
| Human and Agent entry | The Disaster Response Starter Kit publishes the Strategy schema, evaluator contract, scenarios, constraints, limits, baseline Agent, and reproduction command. Only measured outcomes affect allocation. |
| Reward contracts | `FrontierRewardPool` and `FrontierDemoToken` cover commitment, distribution, and claim fallback. A completed Sepolia demonstration records funding, allocation commitment, `RewardPaid`, and recipient balance evidence. |
| Classic fallback | The earlier Emergency Supply competition remains available at `/arenas/emergency-supply-classic` with its independent API and storage namespace. |
| Secret Gate reference application | A real Semaphore V4 proof is generated in a browser Web Worker, verified offchain against a trusted synthetic group snapshot, and protected against same-scope reuse by an atomic nullifier store. The public production route passed desktop and mobile verification. |
| Rescue Room Practice | A deterministic incident-response simulator runs seven Incident families, a curated six-Service market, budget reserve/release/refund, Commander actions, Replay evidence, three independent outcomes, Pareto, and four Practice Value Pools. Players can edit a versioned Doctrine Artifact through explained Basic settings, inspect Prompt and normalized JSON views, lock it to an Incident, follow reason-coded decisions in an illustrated five-chapter Incident Theatre, and compare the same Episode against Always Pause / Never Pause / the previous revision. Every Service purchase now binds its Order, Commander Action, Service Manifest, Deliverable, and Receipt with deterministic hashes and appears in a separate Payment Journey. Rules and AI Playbooks share Service, Action, single-price, and total-investigation-budget gates; the AI path uses a fixed OpenAI Agents SDK runtime. |

Sepolia evidence: [deployment record](deployments/sepolia-reward-demo.json), [allocation commitment](https://sepolia.etherscan.io/tx/0x96fd7a9d1f4a3bbd2fa7a9ea28d250a16e8eedbaff05b51a4f33e581c3839f2c), and [RewardPaid](https://sepolia.etherscan.io/tx/0xd976a968aefeb66d7e60fba7a9cf64c8711195fc3652aeccc20c7448069ad708).

## Partial or optional

| Area | Current boundary |
| --- | --- |
| Privy | Email and wallet login are enabled. Google OAuth still requires activation in the Privy project. |
| Generic submission sandbox | The `/v2/sandbox` store is process-local and resets on restart or serverless cold start. |
| Bazantic | A gateway and MCP surface were activated externally, but final service and Recipe identifiers are not committed as evidence. |
| ENS | A fail-closed discovery and authorization adapter exists; no live namespace or delegated permission evidence is configured. |
| Policy Artifact | The declarative contract is documented in the Starter Kit but arbitrary participant policies are not executed. |
| Legacy order-book sample | Retained as historical technical material; its throughput axis is simulated rather than observed chain throughput. |
| Ledger adapter | Retained as historical optional code and unused by the public path. |
| Secret Gate competition | The first controlled Chrome feasibility run verified all 32 proofs but returned `PIVOT`: latency and memory variance exceeded the declared stability gate. Personal-device measurements remain available, but the competition path is closed and no official leaderboard or Value Pool is active. |
| Rescue Room competition | Phase 0 `GO`、Phase 1、Doctrine／AI Controlled Practiceは実装済み。独立したOperator PilotではSepolia Contract・運営管理Wallet・Payment Executor・実支払い／返金・単一ホストDurable Jobまで接続した。既存PracticeのGame Creditsは引き続きsimulated。実AI ServiceのゲームOutcomeへの接続、永続Revision／Final Entry、Incident Shift、Hidden Final、参加者一意性、Full Field再計算、Pool報酬、本番Storeは未完成。 |

## Not yet a production tournament

- Participant uniqueness enforcement
- Isolated execution of arbitrary untrusted source code
- Scheduled hidden-final evaluation, deadline, and automatic entry lock
- Multi-runner threshold attestations, disputes, or slashing
- Scheduled final-day allocation and participant payout
- A mainnet token or any monetary-value claim

## State language

| State | Meaning |
| --- | --- |
| `measured` | A deterministic evaluator produced a result |
| `simulated` | A modeled boundary is clearly labeled |
| `committed` | Corresponding onchain evidence exists |
| `paid` | Transfer/event and recipient evidence exist |
| `Practice` | Measurement is real while the production tournament layer remains incomplete |

## Active next change

Rescue Room Strategy Game UX Pass B0/B1とPass Cはローカル実装済み。`rescue-doctrine-v0`は編集可能なBasic Rule、権限、予算上限をHash付きの決定論的Artifactへ正規化し、InterpreterはPublic View Hashに対する理由付きActionを記録する。Workbenchは各Ruleの意味とTradeoff、`Spend / Certainty / Containment`の読みやすいSummary、Basic / Prompt / Artifact Viewを提供する。Live SimulationはCanonical Transcriptを変更せず、Game Minute単位のStory Beat、3 Actor、Agent間PaymentとEvidence、Protocol Action、5 Chapter、6 Module、3 Outcomeを一つのIncident Theatreで表示する。自動Desktop / Mobile検証はReplay、同一Episode Baseline、AI Control、横Overflow、Contrast、Console Errorまで通過した。次のGateは5人の初見テストであり、Durable Revision Diff、Incident Shift、Final Entry、Committed Hidden Finalは未完成のため、現在もReward対象外のControlled Practiceである。
