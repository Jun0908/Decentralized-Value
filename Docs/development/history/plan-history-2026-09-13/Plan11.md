# 計画11 — ETHOnline Sponsor Integration 実装準備

作成日: 2026-09-11

最新状態（2026-09-13）: ENSv2単一Text Keyの実認可・取消7取引、公式CRE秘密Pack Simulation・Reveal Replay、外部実AIによるBazantic MCP評価が実証済み。GitHubへPush済みで、公開スポンサー画面も表示確認済み。Hosted Recipe実行／公開・A/B、live TEE・本番Finalは未完成。詳細は末尾「Sponsor最低動作」と[公開確認記録](../../../evidence/verification/PUBLIC_VERIFICATION_2026-09-13.md)。下記の日付付き未実施項目は各バッチ時点の履歴で、再ログインや再送金の指示ではない。

目的: ENSv2を評価ネットワークのIdentity / Permission、BazanticをAI Agentの参加経路、CREをHidden Finalの評価実行境界として接続するために、必要な実装・設定・検証を明確にする。

計画9はRescue Room、計画10はOcean Commonsとして維持する。本計画は両Arenaの開発と区別したProtocol Integration計画である。最初は添付要件の文書化のみを行い、その後ユーザーの承認で計画9 / 12との並行実装を開始した。

## 1. 結論と最初の判断

3つとも既存Architectureへ追加できる。ただし、現在のアダプターを設定するだけでは完成しない。次の4点が主要な追加開発になる。

1. ENSの実権限を確認し、固定されたEvaluator identityに対してRequestと署名付きResultを結び付ける実行経路。
2. Bazanticが実際に公開するGateway / MCP / Recipeと、条件をそろえたAgent比較実験。
3. 既存EvaluatorをCREの実行環境へ持ち込み、Hidden inputからOutcomeを計算して、Reveal後に再現する経路。
4. 同じContext / Artifact / Resultを追えるEvidence、オンチェーンReceiver、Judge向け画面。

最初の技術的検証は「小さな既存EvaluatorがCRE CLIで動き、Node実行と同じHashになるか」にする。ここが成立しないまま、3つのDemo画面や大規模なFinal管理を作り始めない。

また、Sponsor Prizeの応募区分を先に確認する。BazanticのRecipe比較賞はContinuity Track限定である。READMEにはイベント中に開発開始と記載されているため、対象資格を現在のコードやプロジェクト名から推測しない。

## 2. 調査した既存実装と不足

調査基準: `main` の `026cc7a` と調査時の作業ツリー。`AGENTS.md`、README、PRODUCT、ARCHITECTURE、STATUS、INTEGRATIONS、OpenAPIを読み、下記の実装・関連テスト・Webの接続箇所を確認した。全ファイルの行単位レビューや、既存テストの再実行を完了したという意味ではない。

調査時に計画10、API、Ocean Commons、共通CSS、lockfileなどに別作業の未コミット変更がある。本計画の作成では変更しない。実装着手時に改めて差分を確認し、特にAPI入口とlockfileの編集担当を整理する。

| 領域 / 確認箇所 | 既存の資産 | 今回必要な追加・注意 |
| --- | --- | --- |
| `packages/shared/src/multiobjective.ts`、`settlement.ts`、関連テスト | 方向付きMetric、正当性ゲート、Pareto、Hypervolume、寄与、整数Allocation | 既存計算を再利用。新ContextとEvidenceを混ぜない比較集合の固定が必要 |
| `packages/shared/src/manifest.ts`、`schemas.ts` | Canonical JSON、Manifest、Hash、旧Attestation | 旧AttestationはOrderbookの2軸と`issuedAt`に依存する。新しい汎用Result / 署名Envelopeを別Versionで追加 |
| `packages/ens-adapter/src/index.ts`、関連テスト | ENS address/text解決、capability絞り込み、signer一致検査、未設定時の拒否 | EACを読み書きしていない。固定blockのSnapshot、実Grant / Reject / Revokeがない |
| `apps/api/src/dispatcher.ts` | ENSから取得したendpointへのPOST、timeout、retry | 先頭Runnerの選択のみ。応答本文のResult / signatureを検証・保存する処理がない |
| `apps/api/src/store.ts` と `apps/runner/src/index.ts` | Job、Runner handler、正当性確認、署名・提出の抽象境界 | API JobとRunnerJobの必須項目が異なる。Runnerは旧bytecode / 2軸形式であり、Doctrineをそのまま渡せない |
| `apps/web/src/lib/frontier-api.ts`、`apps/api/src/server.ts` | ENS Directoryの設定入口 | Webは`createDemoApi`を使い、汎用Evaluation Jobは既存benchmark由来の`simulated`で終わる。Directoryを設定しても実Runnerへ切り替わらない |
| `bazantic/recipe.md`、`mcp-tools.json` | Recipe原稿とoperation対応 | 旧Orderbook中心で「both axes」と記載。現行の多軸Arena、Candidate生成・改訂まで対応し直す |
| `bazantic/experiments/` | A/B実験の説明と項目別配点のrubric | 実験Runnerと実測結果がない。旧配点rubricから、独立した測定値・判定根拠へ変更する |
| `packages/sdk`、`packages/cli`、CLI API / OpenAPI | Context固定Practice、候補検証、比較、Disasterの保存・Final Entry選択 | ツール契約を再利用。CLIの動作確認だけをBazantic経由の成功Evidenceにしない |
| `packages/rescue-room/src/index.ts` | Episode生成、Doctrine interpreter、決定論的実行 / Replay、3 Outcome | Public Practice wrapperは即時Revealを含む。Final用の非公開入力・遅延Reveal・複数Episode集計を追加 |
| `apps/api/src/plan6-competition.ts`、Webのstore | Disasterの参加者、Revision、Final Entry選択、Redis境界 | 選択UIと締切後の不変Freezeは別。既存の公開済みinstant-final setを秘密のFinalとして扱わない |
| `packages/contracts/src/BenchmarkAttestation.sol`、`AllowlistRunnerIdentityAdapter.sol` | EIP-712、重複防止、旧Runner資格インターフェース | AllowlistはENSv2 Permissionの証拠ではない。旧2軸ContractをCREの汎用Receiverとして使わない |
| `packages/contracts/src/FrontierRewardPool.sol`、`Docs/deployments/` | Allocation commitment、RewardPaid、Sepolia Demo Evidence | 新Finalの結果を結び付ける前提を追加。過去のRewardPaidを新Sponsor実行の証拠に流用しない |
| WebのArena / Evidence画面、`design-qa.md` | 既存の説明・Replay・支払い状態の表示 | `/sponsors`と3専用ページは未実装。文字コントラストの恒久ルールを適用する |

ローカルのPATH確認では`pnpm`、`baz`、`bun`を検出し、`baz --version`は`0.8.0`。`cre`と`forge`は検出できなかった。アカウントの有効性や秘密情報の設定値は今回確認していない。

## 3. 公式資料から確認した条件

確認日: 2026-09-11。API / ABI / Deploymentは実装着手時にも再確認し、採用したVersionと参照元を記録する。

| 対象 | 確認結果 | 計画への影響 |
| --- | --- | --- |
| ENS Best Use of ENSv2 | SepoliaのENSv2を機能の中心で利用し、動くDemoと公開コードを示す | Mockだけでは完了しない。実ネットワーク上の権限変更Evidenceまで必要 |
| Bazantic Help an Agent Use Your Hackathon Project | Continuity Track限定。同一条件のRecipe比較、Gateway、Recipe、動画、usernameが必要 | 参加区分を確認。Recipe以外に通信経路や権限を変える比較を避ける |
| Bazanticの他の賞 | 複数サービスや新API追加など、それぞれ別要件がある | 自分のAPIをGatewayへ登録するだけで全賞に該当するとは扱わない |
| Chainlink Best Confidential Workflow | 意味のあるTEE handlerを使い、公式CLI SimulationまたはLive実行の成功Evidenceを提出できる | Simulationを実装上の到達点にできる。ただしTEE稼働済みとは表示しない |
| Chainlink Confidential Workflows | Live利用は通常のDeploy accessとは別のPrivate Beta申請が必要 | Local SimulationとLive受入条件を分ける |
| CRE TypeScript runtime | WASM / QuickJSで動作し、Node APIすべては使えない | 既存packageのimportだけで動くと仮定せず、依存ライブラリとHashの一致を実機で検証 |

出典: [ENS Prize](https://ethglobal.com/events/ethonline2026/prizes/ens)、[Bazanticを含む公式Prize一覧](https://ethglobal.com/events/ethonline2026/prizes)、[Chainlink Prize](https://ethglobal.com/events/ethonline2026/prizes/chainlink)、[Confidential access](https://docs.chain.link/cre/account/confidential-workflows-access)、[CRE TypeScript runtime](https://docs.chain.link/cre/concepts/typescript-wasm-runtime)。

BazanticのWebドキュメント本文は今回の取得で確認できなかった。CLIの実際の`--help`は確認した。既存READMEの`baz api register`は、この環境のCLI 0.8.0のコマンド一覧にない。現行CLIは`baz gateway add --spec-url ... --endpoint ...`を案内している。実装時は公式CLIのVersionとDashboardの現行仕様を確認してrunbookを書き直す。Gateway URLは`baz gateway list --json`等の実応答から取得し、組み立てない。

## 4. 最小の統合対象とArchitecture

推奨する最初の対象は、既存Rescue Roomの決定論的Doctrineである。新しいゲームやAI inference環境をCRE内に作らず、Agentが作った`rescue-doctrine-v0`を固定し、既存SimulatorがHidden Episode群でどう動くかを評価する。

選定理由は、`generateRescueEpisode`、`createRescueDoctrinePolicy`、`runRescuePolicy`、`replayRescueEpisode`が既にあり、公開情報だけから判断する境界も存在するため。まず1 Episode、次に小さな複数Episode packで検証する。Episode数・pack・Metric集計方式は受付開始前に固定する。

```text
AI Agent
  └─ Bazantic Gateway / MCP + Recipe
       └─ Practice: Doctrine作成 → 評価 → 改訂 → Tradeoff説明
            └─ 参加者が1つのArtifactをFinal EntryとしてFreeze
                 └─ ENS Snapshot + Admission確認 → Evaluator選択
                      └─ CRE Confidential handler
                           Hidden input → 同じDoctrine / Simulator → Outcome / Result
                                └─ Report → Ethereum Final commitment
                                     └─ Reveal → Local reproduction
                                          └─ 同じEvidenceを各Value Poolが別々にAllocation
```

ENSによる通常Runner dispatchも実装・実証する。CRE実行では、ENSで承認された受付identityと、CRE workflow identity / code hashの対応をRoundに固定し、通常Runnerの署名がCRE reportの代わりにならないようにする。

Bazantic実験はまずRescue Doctrineの同一Practice packを使う案とする。比較の道具としてDisaster Responseの既存SDK / CLI契約を再利用できるが、異なるArenaやContextの結果を同じ比較へ混ぜない。CRE互換性に問題がある場合は、Classic Emergency Supply等の小さな既存Evaluatorを候補に戻し、変更理由と境界を記録する。

初回では任意コードの実行、LLMのTEE内推論、公開Service marketplace、実Service決済、全Arenaの移植を要求しない。後続でRescue Room AI pathを扱う場合も、LLMの再実行と記録済みActionの再現を区別する。

## 5. 最初に追加する共通契約

以下の名称は新規アプリ内Schema案であり、Sponsor APIの実在する型名ではない。

| Schema案 | 固定する内容 |
| --- | --- |
| `EvaluationRequestV2` | Round / job、Artifact hashと取得先、Evaluator code/version、Context、必要capability、ENS Snapshot hash、実行方式 |
| `EvaluatorSnapshotV1` | chainId、blockNumber / blockHash、正規化name、registry / resolver、採用実装Version、records、signer、権限・Admissionの根拠 |
| `FinalRoundManifestV1` | 公開Context、Metric方向・単位・bounds、Hard Constraints、Episode集計規則、hidden pack commitment、Evaluator / workflow hash、Snapshot、受付と締切、失敗時の扱い |
| `FrozenFinalEntryV1` | Round、認証された参加者、1つのArtifact hash、Revision、固定時刻・受付根拠、entry-set rootへの所属 |
| `EvaluationResultV2` | Context、Artifact、Episode結果hash、correctness / failures、独立Outcome、集計Version、決定論的Result Hash |
| `ExecutionEvidenceV1` | Result Hash、署名 / workflow / 実行ID、時刻、実行方式、report / tx、検証結果 |

実装要件:

- 決定論的Resultには時刻、job UUID、tx hash、実行IDを含めない。それらはExecution Evidenceへ置く。旧AttestationのHash仕様を黙って変更しない。
- Canonical JSON、数値の整数単位、丸め、文字列順序、配列順序を固定する。既存の`localeCompare`等がNodeとQuickJSで同じ結果になるか検証する。
- 比較集合とbaselineをContextに固定する。個別Resultの後で全候補からPareto / Contributionを再計算し、比較集合hashも別に記録する。
- Sponsorの通信ErrorとHard Constraint違反は別。通信失敗を架空の0点にしない。
- Domain、chainId、検証先、Round、Artifact、Context、Snapshotを署名対象に結び付け、別Job / Roundへのリプレイを拒否する。
- Artifactは型検証したデータとして扱う。候補名・説明・Recipe外の自由文を権限やEvaluatorコードとして実行しない。

## 6. ENSv2で実装すること

### 6.1 Namespaceと編集権限

まず管理者、Evaluator A、Evaluator Bを分け、管理下の親nameに`evaluators`、`pools`、`services`を置く。名前は未取得の設計例であり、実ENS nameや存在するIDとして表示しない。

Permissioned Resolverはname / text key単位の委譲を公式に提供する。今回確認した仕様では、個別keyのGrant / Revokeには`authorizeTextRoles`を使い、Resolverの一般的な`grantRoles` / `revokeRoles`は利用しない。実装時は公式ABIと引数のencodingを固定する。[Permissioned Resolver公式資料](https://docs.ens.domains/ensv2/permissioned-resolver/)

| Record / 操作 | 管理者 | 該当Evaluator | 他Evaluator |
| --- | --- | --- | --- |
| 自分のendpoint / service version / 公開Service説明 | 更新可 | 指定keyのみ委譲 | 不可 |
| capabilityの承認、role、Admission status | 更新可 | 自己承認不可 | 不可 |
| 署名identity、reward destination | 更新可。変更は次Roundで採用 | 不可 | 不可 |
| Competition rules / Value Pool manifest hash | 更新可。受付前に固定 | 不可 | 不可 |
| resolver変更、name移転、alias、clear、upgrade、権限の再委譲 | 必要な管理者だけ | 不可 | 不可 |

「レコードを書ける権限」と「評価を任される資格」は別物である。EACで保護された管理者用Admission / capability recordsとRoundの許可条件を照合する。Evaluator自身が`active`や任意capabilityを書くだけで参加資格を得られる設計にしない。

Evaluatorにnameのowner権限を丸ごと渡すと、resolverの交換等でkey制限を迂回できる可能性がある。管理対象namespaceの所有・registry権限まで確認し、委譲範囲の迂回をnegative testに含める。

### 6.2 Runtime接続

- [ ] ENSv2対応library、Sepolia、公式deployment / ABIを固定。Universal Resolverのアドレスを独自に直書きしない。書き込み前は現resolverを再解決する。[App guide](https://docs.ens.domains/ensv2/tutorial-app-developers/)、[Deployments](https://docs.ens.domains/learn/deployments/)
- [ ] `EnsRecordReader`をblock固定readへ拡張し、同じblockのRecordとPermissionでSnapshotを作る。必要な過去stateを取得できるRPCも準備する。
- [ ] 宣言capabilityと承認capability、signer、role、status、Round許可集合を照合し、決定論的な順序でeligible evaluatorを選ぶ。
- [ ] HTTPS endpointのprivate IP / loopback / metadata IP / redirectを拒否し、timeout・応答サイズ・retry・idempotencyを制限する。ENSレコードを任意ネットワークへのHTTP権限にしない。
- [ ] 新Job形式をRunner handlerまで通し、返却JSONのContext / Artifact / Outcomes / Result Hash / signatureを検証してから保存する。
- [ ] 未解決、権限なし、capability不一致、wrong signer、異なるContext、改ざん結果では、当該Runnerを利用しない。任意の未承認endpointやDemo dispatcherへfallbackしない。
- [ ] Value Pool / Service identityをそれぞれ既存manifestへ結び付ける。ServiceのENS発見を、Serviceが実AIであることや実決済の証明とは扱わない。

Snapshot後の変更規則も必要。過去結果の検証は当時のSnapshotを使う。現在の権限失効は新規dispatchの拒否に反映し、進行中Roundの停止・再試行・取消規則は受付前に固定する。失効を理由に過去のResultを書き換えない。

### 6.3 Demoと完了条件

- [ ] Grant → Aが自分のendpointを更新成功 → B / 保護keyへの更新拒否 → Revoke → Aの同じ更新が拒否される、をSepoliaで実証する。
- [ ] 更新前後の実Recordでdispatch先が変わること、および固定済みRoundのSnapshotが変わらないことを確認する。
- [ ] 実Grant / update / revokeのreceiptを保存する。拒否は`eth_call` / estimateでのrevertか、実送信した失敗txかを区別し、送信していない操作のtx hashを作らない。
- [ ] `/sponsors/ensv2`でIdentity、権限表、Snapshot block、実Job / signer検証とEvidenceを表示する。

ローカルMock Testの成功だけではENSv2 Integration完了にしない。

## 7. Bazanticで実装すること

### 7.1 接続とRecipe

- [ ] 公開APIとOpenAPIを一致させ、実Gateway / MCPのtool一覧を取得して差分確認する。ローカルのtool数とDashboardに記載されたtool数が一致するとは仮定しない。
- [ ] Rules / Schema取得、Candidate作成・検証・評価、履歴、比較、Tradeoff説明までRecipeを更新する。Metric数を2に固定せず、方向・単位・Hard Constraintsを都度読む。
- [ ] 現行のGateway authenticationと参加者authenticationを整理する。Provider credentialとAgentの参加者権限を混同しない。一般のBazantic AgentにReward送金やAdmin操作を公開しない。
- [ ] まずPublic Practiceの候補評価をEnd-to-Endで通す。保存Submission / Final Entryが必要な次段階では、既存の認証・idempotencyを維持して明示的に接続する。
- [ ] 有料操作のnetwork / token / price / 払い手 / budgetを実設定で確認する。`baz curl`は402への支払い機能を持つため、無制限のretryや暗黙の課金を避ける。
- [ ] 実際のRecipe identifier / version / 内容hashを保存する。外部サービスが独立したMCP IDを返さない場合は実MCP URLと応答を保存し、架空IDを補わない。

### 7.2 A/B実験

比較対象は次の2つ。AもBも同じGateway / MCP toolsと権限を使用し、Bにだけ実Recipeの案内を追加する。「Aは直API、Bは別Gateway」の通信差まで同時に変えない。

- A: Raw API schema / toolsのみ。
- B: 同じAPI schema / tools + Bazantic Recipe。

共通system prompt、user task、model識別子、model settings、API snapshot、初期候補 / baseline、Context、tool-call上限、attempt上限、出力token上限、payment上限、retry方針を実験Manifestへ固定する。Recipeを追加する方法とそのtoken量はTreatmentの一部として記録する。

最初のpilot案は3タスク × 各5ペア、合計30 Agent runs。これは実行前に費用上限とともに確定する提案値であり、実行済み回数ではない。順番を入れ替え、A/B間でメモリ・候補・会話を共有しない。Modelがseed設定に対応しない場合も、対応したふりをしない。

| 独立した測定 | 判定方法案 |
| --- | --- |
| Constraint violations | Evaluatorの失敗code別件数。違反Candidate数も併記 |
| Invalid submissions | Schema / Context不一致等で受理されなかった回数。通信障害は別集計 |
| Valid submissions | 受理された候補数と、重複Artifact hashを除いた候補数 |
| Non-dominated candidates | 固定Contextで全候補を再計算。重複・同値Outcomeの扱いを事前に定義 |
| Frontier-expanding candidates | 固定baselineに対する拡張と、最終候補集合のexclusive contributionを区別して計数 |
| Unnecessary tool calls | 同一入力・同一stateの重複取得等、事前定義した分類別件数。必要なpoll / retryは除外 |
| Tradeoff explanation correctness | Artifact参照、Metric数値・方向、dominance主張を構造化させ、Evaluatorから照合。自由文の意味評価は別のreviewとして記録 |

旧`rubric.json`の配点を合算したOverall Scoreは作らない。ProtocolによるPareto / AllocationにもLLMの文章評価を入れない。LLMの個別回答に不適切な総合点が出た場合は失敗例として記録し、Protocol側では利用しない。

結果が改善なし・悪化でも全runを残す。Recipeの調整用pilotと、固定したRecipeを評価するholdout taskを分ける。単発の成功例だけで改善や再現性をclaimしない。

### 7.3 Demoと完了条件

- [ ] 実Gatewayを経由するA/B harness、tool trace、応答、候補Artifact、測定JSONを保存する。
- [ ] `/sponsors/bazantic`に同条件の2 Agent、actions、valid / invalid、発見したTradeoff、独立測定の比較を表示する。
- [ ] HTTP 402 / auth failure / invalid candidate / Context mismatchの回復も検証する。
- [ ] 実username、Gateway、MCP、Recipe、外部execution ID（提供される場合）を収集する。ローカルtrace IDは外部IDと区別する。
- [ ] 入力・結果・違いを見せる画面収録を用意し、応募区分に合う要件を最終確認する。

## 8. Chainlink CREで実装すること

### 8.1 最優先の互換性検証

- [ ] CRE CLI、SDK、公式Confidential template、Bun等の必要toolchainを導入し、Versionを固定する。Windows対応とFoundry実行環境を確認する。
- [ ] 既存Rescue Doctrineと1 Episodeを入力し、Node側とCRE CLI側で同じSimulator関数を実行する。
- [ ] `viem` / `zod` / sharedの依存とbundleを検証する。必要なら純粋なEvaluator部分を独立entrypointへ切り出し、計算を二重実装しない。
- [ ] Outcome、constraint failures、Episode Result Hash、pack Result Hashが完全一致するgolden fixtureを作る。
- [ ] 実行時間・memory・WASM size・Report sizeが公式制限内か、小packで計測する。NodeでのUnit TestだけをCRE互換性の証明としない。

公式の[Hello Confidential Workflows](https://docs.chain.link/cre-templates/hello-confidential-workflows)では`cre.handlerInTee`、秘密取得、公開可能な結果をDON側へ返す構造を確認できる。Source / binary自体は秘密ではなく、Simulationは実TEEではない。Seedをコードや公開configへ埋め込まない。

### 8.2 Hidden Finalの状態管理

```text
DRAFT → CONTEXT_COMMITTED → ENTRY_OPEN → ENTRIES_FROZEN
      → EVALUATING → RESULTS_COMMITTED → REVEALED → REPRODUCED
```

異常時は理由付きの停止 / 失敗状態へ遷移し、別入力による成功結果へすり替えない。

- [ ] Final Scenario群をPracticeとは別に生成する。少数の予測可能なseed文字列をHashするだけにせず、十分な乱数と秘密saltを使ったpack commitmentを受付前に公開する。
- [ ] Commitmentにはgenerator version、pack全体、順序、saltを結び付ける。生成者が事前に都合のよいpackを選ばなかったことまで証明するものではない、とTrust boundaryに書く。
- [ ] Hidden入力の取得はenclave内で行う。通常APIにはcommitmentしか返さず、トリガー、URL、Web bundle、ログ、error、cache、Reportへseed / salt / private Scenarioを出さない。
- [ ] 参加者の1 Entry、Artifact bytes、entry-set root、締切を原子的・永続的にFreezeする。締切後の改訂やResultを見てからの差し替えを拒否する。
- [ ] CREがcommitmentとFrozen Entryを検査して、同じDoctrine interpreterとSimulatorを秘密入力上で実行する。外部APIから完成済みScoreを受け取るだけにはしない。
- [ ] 全参加者のFreeze前にFinal Outcomeを公開しない。Official Final endpointを何度も叩いて秘密条件を探索できる経路を作らない。
- [ ] 複数Episodeの損失・費用の合計、Availabilityの集計と丸めを事前固定する。既存の平均方式を変更する場合は別Version / Contextにする。
- [ ] Hard Constraint失敗は理由付きで保存し、Frontier / Reward資格から除外する。全候補評価後に順序非依存で再計算する。
- [ ] 結果確定後にseed / salt / packをRevealし、commitment検証、同一Artifactの再実行、OutcomeとResult Hashの一致を行う。API credentialやwallet keyはReveal対象外。

Simulationで使う秘密入力はDemo用の破棄可能なpackに限定する。実TEEの証明がなくても、commit / freeze / compute / reveal / reproduceの動作検証はできる。

### 8.3 ReportとEthereum Receiver

- [ ] `packages/contracts`に新しい汎用Final Receiverを追加する案とし、既存の2軸Attestation / Settlementを変更して流用しない。
- [ ] 受付前のRound commitmentと、Freeze済みentry-set rootを固定する。Resultだけを事後Hashして「事前に固定済み」と呼ばない。
- [ ] 公式Receiver仕様に沿ってForwarder、workflow ID等のmetadata、chain / Round / Context / Artifactを検証する。実際のABIとmetadata形式をVersion固定する。[Consumer Contracts](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/building-consumer-contracts)
- [ ] 重複report、別Roundへのreplay、未Freeze entry、変更済みContext、未承認workflow、直接呼び出しを拒否する。
- [ ] 一度確定したRoundのrootを差し替えできない状態遷移を実装する。receiver自身が任意のOutcomeを正しいと証明するものではない。
- [ ] Simulation用ReceiverとLive用Receiverの信頼設定を区別し、Simulationを通すための検証省略をLiveへ持ち込まない。
- [ ] Sepoliaへの書き込みを行った場合、receipt / eventとResult rootを照合する。Simulation起点のtxも、実TEE / DON実行の証明とは呼ばない。
- [ ] 同じResult集合を既存Value Pool計算に渡すadapterを用意する。最初はAllocation previewとFinal commitmentまで。Reward token送金を行う段階では専用資金・権限・receipt検証を追加する。

### 8.4 到達状態と完了条件

| 状態 | 言えること | 必要なEvidence |
| --- | --- | --- |
| 未設定 | 実行環境・入力・権限が不足 | 不足項目と確認結果 |
| CRE simulated | 実CRE CLIでConfidential handlerとEvaluatorを実行した | Version、command、log、output、reproduction結果 |
| simulated + onchain committed | Simulation由来の結果をSepoliaに記録した | 上記 + 実tx / event。TEEの保証は付かない |
| Live confidential | 実Confidential Workflowが利用可能な環境で成功した | 実workflow / execution情報、利用可能なattestation検証、Reportとonchain情報 |

画面は`/sponsors/chainlink-cre`。Evidenceがある段階だけを点灯し、Context → Entry → Hidden computation → Outcomes → Hash → Report → Reveal → Reproductionを示す。

## 9. Evidenceの保存設計

保存先案:

```text
artifacts/evidence/sponsors/
  ensv2.json
  bazantic.json
  chainlink-cre.json
  runs/<local-run-id>/...
Docs/sponsors/
  ensv2.md
  bazantic.md
  chainlink-cre.md
  MANUAL_ACTION_REQUIRED.md
```

上記は作成予定。現時点で実txや外部ID入りのEvidenceが存在すると意味しない。各IntegrationのJSONは最新成功runへのindexとし、過去runを上書きしない。

共通項目はschema version、実測timestamp、environment、chain / network、source commit、使用コード・lockfile / workflow binaryのhash、input / output / Context / Artifact / Result hashes、実行command、状態、検証結果、raw evidenceへの参照。未コミットコードでの実行にはdirty状態とsource bundle hashも記録し、commit SHAだけで再現可能としない。

ENSではname、Record、block、registry / resolver、権限操作を追加。Bazanticでは実username、Gateway / MCP / Recipe、model settings、各runのtool traceを追加。CREではcommitment、Frozen Entry、workflow / execution、Report、Reveal / reproductionを追加する。

credential、Authorization header、Cookie、署名鍵、秘密saltのReveal前の値は保存・公開しない。失敗ログもredactする。存在しない外部IDは`null`と理由を保存し、ローカルIDで代用しない。

`executionMode`、`verificationStatus`、`commitmentStatus`、`paymentStatus`を別軸にする。Simulationでもオンチェーンcommitmentはあり得る。`committed`を`paid`や`tee-verified`へ自動昇格しない。

## 10. 人間の設定・外部準備が必要なもの

秘密情報は会話やMarkdownへ貼らず、既存のローカル環境 / Secret管理へ設定する。実装側は未設定でも理由付きで停止できるようにする。

| 必要なもの | 用途 / 確認事項 | 不足していても進められる作業 |
| --- | --- | --- |
| ETHOnline参加区分と応募対象 | 特にBazantic Recipe比較賞のContinuity資格 | コードと実験設計 |
| Sepolia RPC、管理可能なENS親name | Record / EAC、Snapshot。過去block readも確認 | Mock / Contract Test、runtime契約 |
| 管理者・Evaluator A/Bの役割wallet、Sepolia gas | 委譲成功・越権拒否・失効の実証 | 署名・権限のnegative test |
| Bazantic account / username、既存Gatewayのアクセス | 既存設定を再利用できるか、Recipe編集・公開状態を確認 | OpenAPI整合、Recipe原稿、実験harness |
| 公開HTTPS API、Gatewayの認証設定 | Agentから実際にAPIを利用する | ローカルIntegration Test |
| Agent model credentialと試行 / 支払い上限 | 同条件の実A/B run。Model accessとBazantic支払いは別 | Fixtureによるharness検証 |
| CRE CLI、account / organization、SDK | 公式CLI Simulation | 純粋なEvaluator抽出・golden fixture |
| CRE Deploy access + Confidential access | Live時に必要な2つの利用条件 | CRE SimulationとReveal検証 |
| Foundryと隔離された永続store検証環境 | Receiver Test、締切・Entry Freeze・再起動後の検証 | Schema / 状態遷移設計 |
| Sepolia Receiverの役割・funding、公開Demo配置先 | 実onchain commitmentとJudgeアクセス | Local Demoと再現script |

実装中にDashboard作業が残った場合は`Docs/sponsors/MANUAL_ACTION_REQUIRED.md`を作り、操作対象、現在値の確認方法、変更内容、取得すべき公開ID、確認command、完了判定を書く。未確認の画面名やボタン名は推測せず、公式資料または実画面で確認してから手順を確定する。

## 11. 実装順序とGate

| Phase | 作業 | 次へ進む条件 |
| --- | --- | --- |
| 0 | 参加区分・外部アクセス・CLI / ABIの確認、CREで既存Evaluatorを1回実行 | Node / CREのOutcomeとHash一致、必要な外部作業一覧が確定 |
| 1 | 共通Envelope、Context / Snapshot / Frozen Entry / Evidence契約 | 改ざん・Context違い・重複・時刻差を検証できる |
| 2 | ENSv2権限、Runtime dispatch、署名応答 | 実Grant / Reject / Revokeと、実EvaluatorへのRequestがつながる |
| 3 | Bazantic登録済み接続、Recipe、A/B実験 | 実Gatewayのtraceと独立測定結果が揃う。改善の有無もそのまま残る |
| 4 | Hidden FinalのCRE実行、Freeze、Receiver、Reveal | CLI SimulationとLocal reproductionが一致し、実施したcommitment状態を証拠で示せる |
| 5 | `/sponsors`入口、3 Demo、共通Evidence viewer、動画とDocs | Judgeが1〜2分で境界とEvidenceを確認できる |
| 6 | 外部アクセスが得られた範囲のLive接続 | 実行ID / tx / attestationを再確認し、その段階のclaimを更新 |

Phase 0のCRE互換性検証は前倒しする。外部設定待ちの間は、Mockの決定論的テストやEvidence validatorを進められる。実装を並行分担する場合はユーザーの指示に従い、ENS / Bazantic / CREの専用ファイルを分け、shared Schema、API入口、OpenAPI、lockfileは統合担当がまとめる。

追加予定の主な配置:

- `packages/shared/src/` — 新VersionのEvaluation / Final / Evidence Schema。
- `packages/ens-adapter/src/` — block固定read、EAC、Snapshot。
- `apps/api/src/` — Sponsor用service module、実dispatch / 検証、Final Roundの状態遷移。
- `apps/runner/src/` — Doctrine対応handler / 署名Envelope。Signer interfaceの型を旧Ledger package依存から分離する案も検討。
- `packages/rescue-room/src/` — 必要最小限のpure export / Final pack評価wrapper。既存Practiceの返却形式を維持。
- `workflows/chainlink-cre/` — 新規CRE project案。CLIの生成構成を確認後に確定。
- `packages/contracts/src/` — 汎用Final Receiverと対応test / deploy script。
- `bazantic/`、`scripts/` — Recipe、実験、Evidence収集 / 再現script。
- `apps/web/src/app/sponsors/` — 入口と3専用Demo。既存`/sponsor`のChallenge作成とは別route。
- `openapi/` — 新API契約とSDK / CLI生成物の整合。

## 12. 必須テストと回帰確認

| 領域 | 必須ケース |
| --- | --- |
| ENS | Allowed / denied / revoked、wrong capability / signer、resolution failure、保護key・他nameの更新拒否、resolver迂回、Snapshot不変、endpoint拒否 |
| Dispatch | Request / Response形式一致、署名・hash・Context照合、改ざん、再送、timeout、duplicate、未設定時の明示Error |
| Bazantic | 同じtask / tools / settings、invalid candidate、Metric保持、Weighted ScoreがProtocol計算へ入らない、同値候補、失敗runの保存、認証・課金境界 |
| CRE | Context commitment、締切・Entry Freeze競合、hidden input不一致、同入力の同Outcome / Hash、入力変更時のResult Hash変更、Reveal / reproduction、漏えい検査 |
| Receiver | wrong Forwarder / workflow / chain / Round、replay、未Freeze、既存root上書き、simulation / live設定の分離 |
| 比較・Allocation | 全候補の順序を入れ替えて同じFrontier / Reward、Hard Constraint失敗排除、Context混在拒否、Metric方向・bounds、最大6次元の既存テスト |

既存のCalldata CompressionはSolidity runtimeとCancun EVMでcorrectness / malformed input / calldata gas / decoder gasを回帰確認する。Secret Gateはbrowser worker proof、verify、atomic nullifier再利用拒否を維持する。Rescue AI pathはPublic View Hashと記録済みActionのReplay一致を維持し、LLMの再生成一致を要求しない。

実装後の確認command:

```bash
pnpm env:check
pnpm lint
pnpm format:check
pnpm contracts:cli:check
pnpm typecheck
pnpm test:ts
pnpm test:contracts
pnpm --filter @frontier/web build
pnpm verify:cli
pnpm security:scan
```

加えて、公式CRE CLI Simulation、Node / CRE再現、ENSの実read / write、Bazantic実GatewayのA/B runを個別に実行してEvidenceを保存する。正確なcommandは生成したprojectと固定tool versionで動作確認してからrunbookへ記載する。

WebはDesktop / Mobile、console error、横overflow、keyboard操作、未設定・失敗状態、Evidence Downloadを確認する。`design-qa.md`の「lime背景＋白文字禁止」を3ページすべてに適用する。初期表示は説明付きの図と結果にし、詳細ログは補助表示にする。

## 13. 完了時のDocsとclaim

- [ ] `Docs/ARCHITECTURE.md`へ3つの実行・信頼境界とHash chainを追記。
- [ ] `Docs/STATUS.md`へ実際に動いた範囲、未設定項目、実テスト結果を反映。
- [ ] `Docs/INTEGRATIONS.md`へ実環境・外部ID・設定要件を記録。
- [ ] `Docs/sponsors/*.md`にWhat works / Evidence / Trust boundary / Non-claims / Reproduction / Demo routeを記載。
- [ ] README / README_JAのSponsor claimを、取得したEvidenceの範囲で更新。
- [ ] 最終報告には3 Integrationの動作、Demo、Evidence、実ID、残る手作業、Test、claim可否を整理。

完成の判断はスポンサー名の表示やSDK importではなく、ENSで未承認Evaluatorが拒否され、Bazantic経由でAgentが候補を評価でき、CRE handlerで秘密入力上の実計算が行われ、Reveal後に同じResultが再現することによる。

その結果がEthereumに記録された場合でも、Evaluatorの社会的妥当性、秘密packの選び方の公平性、LLMの決定論性、実際の支払い、ZK証明まで成立したとはclaimしない。

## 14. 今回の文書作成で完了したこと

- [x] 添付要件と既存の主要実装 / trust boundaryを照合。
- [x] 公式Prize条件、ENSv2権限モデル、CREのSimulation / Private Beta / runtime制約を確認。
- [x] ローカルBazantic CLIのVersionと現行commandを確認。
- [x] 追加実装、最初の検証、外部設定、Evidence、Demo、受入条件を整理。
- [ ] Sponsor Integration本体の実装・実行・デプロイ。これは次の作業。

文書のみの変更なので、この段階では全workspace Testや外部課金runを実行しない。Markdown整形と差分を確認する。

## 15. 並行実装 第1バッチ — 共通契約とローカル接続

2026-09-11。分担・統合記録は[`PARALLEL_IMPLEMENTATION.md`](PARALLEL_IMPLEMENTATION.md)を参照。

- [x] `EvaluationRequestV2` / `EvaluationResultV2` / `ExecutionEvidenceV1`とHash・対応検証を追加。旧Attestation / Arena Hashは変更しない。
- [x] Artifact・Context・Evaluator code hash・Metric全定義・集計Version・Round / Snapshot参照を固定。時刻・Job・実行方式・Transactionを決定論的Resultから分離。
- [x] 新Envelope専用のCanonical JSONをUTF-16コード単位順へ固定し、locale依存を除去。旧Canonical JSONは維持する。
- [x] 不正JSON、改ざん、余分なmetadata、Metric不足・重複、別Request / Jobへの付け替えを拒否するテストを追加。
- [x] 既存Rescueの公開Doctrine / 1 Episodeを実際に評価し、新Envelopeへ接続するローカルadapterとReplayテストを追加。
- [x] `pnpm verify:rescue-envelope`でNode、Node APIに依存しないbrowser-target bundle、Bunの同じ結果を照合。使用したbundle自体のHashと結果を一時レポートへ保存する。
- [ ] 公式CRE runtimeでの実行・QuickJS互換性、Hidden pack、署名、ENS認可、Receiver、実commitment。

共通Schemaは「対応とHashの整合性」を検証するもので、Evaluatorの実行やENS権限を暗号学的に証明するものではない。Execution Evidenceの検証状態は`unverified`のみを許可する。ローカルadapterは任意のFinal / 外部URL / CRE実行要求を受け付けず、Public Practiceだけを扱う。

NodeとBunの一致はCRE Phase 0の合格ではない。CRE CLI / Foundryはこの端末では未検出であり、Sponsor実接続とContract実行テストは未完了のままとする。API・画面・実送金にはまだ接続していない。

## 16. 残り2日：公式CRE検証と提出Gate

2026-09-12。§15時点のCLI未導入状態から、公式CRE CLI 1.33.0をHash確認のうえローカル導入した。詳細は[sponsors/chainlink-cre.md](../../../hackathon/sponsors/chainlink-cre.md)。

- [x] 独立した`workflows/chainlink-cre/`に公式SDK 1.20.1の通常handler／`handlerInTee`を用意し、既存Rescue Evaluatorの公開Fixtureへ接続。型検査・Node側Envelope照合を実行。
- [x] 公式CLIの通常／Confidential Simulationを実際に試行し、両方とも`CRE_AUTHENTICATION_REQUIRED`で停止することを確認。結果を公開互換性レポートへ保存。
- [ ] 人間のCREログイン後、公式RuntimeでSimulationが完走し、Reveal後のResultと一致することを確認。
- [ ] Confidential賞に対応する意味のある秘密入力と処理。現状の公開Fixtureを秘密計算と呼ばない。
- [ ] ENSv2実認可／Bazantic実接続と該当賞の証跡。設定値の存在を成功扱いにしない。

認証・参加Track・動画規則・公開操作は[sponsors/MANUAL_ACTION_REQUIRED.md](../../../hackathon/submission/HACKATHON_SUBMISSION.md)へ分離した。スポンサー成功は未達。アカウント登録、ENS変更、Gateway登録、公開／提出は自動実行しない。CREの認証待ちを理由に、Plan9の提出デモとPlan12の公開Replay検証は止めない。

## 17. 人間不在バッチ — 認証不要のローカル準備

2026-09-12。計画後の実行指示により着手。横断優先順と停止条件は[NEXT_UNATTENDED_BATCH.md](NEXT_UNATTENDED_BATCH.md)。

- [x] **S11-1 / ローカル前段:** 最大8 Episodeの非本番Packをcommit → 検査 → 既存Evaluator → reveal → 再現する純粋関数を追加。31新規テストと実際にHashしたbrowser bundleのNode実行一致を確認。公開receiptに秘密・未Reveal Outcomeを含めない。§8.2の一部準備であり、永続Freeze・公式CRE・本番Hidden Finalの完成ではない。
- [x] **S11-2 / ローカル実験準備:** Bazantic Recipeを実装済み非課金APIへ更新。同条件・Recipe有無だけを変える比較harness、全組の失敗・同等・悪化を保持する記録形式を追加。35テストと4組のローカル確認が成功。未完了Tool呼出し・不正HTTP Statusを拒否し、返却後もReport Hashが変わらないことを検証。注入Fixtureの成功を実Gateway / 実AI比較の証明としない。

CRE公式Simulationは着手済み・認証待ち。本人ログインなしに完了できる項目へ数えない。ENSの実権限操作、Gateway / Recipe登録、有料Gateway呼出し、CRE Live / Receiver送信はこの無人準備に含めない。提出用素材と再現確認が終わってから下位項目へ進む案とする。

## 18. 外出中の追加準備 — 提出claimの整理

2026-09-12。[SUBMISSION_CHANGE_INVENTORY.md](../work-notes/SUBMISSION_CHANGE_INVENTORY.md)で、直近のRescue実装区間・基準時点の既存機能・別担当OceanのCommitを分離した。区間はイベント期間や応募資格の認定ではない。スポンサーの認証・実操作は進めず、ローカル準備を実接続成功へ読み替えない。

## 19. 既存アカウント・Namespaceの再確認

2026-09-12。本人のENS作成済み／Bazantic設定済み連絡を受け、[既存接続確認](../work-notes/EXISTING_SPONSOR_CONNECTION_CHECK.md)を実施。§16〜18の認証待ちは当時の状態として残し、現在は以下を優先する。

- [x] CRE / BazanticのCLIログイン成功を確認。新規登録・再ログインは実行しない。
- [x] CRE通常Simulationの停止段階をOrganization情報取得と特定。既存検証スクリプトの「未認証」分類は今回の原因を正確に表していない。
- [x] Bazantic既存active Gateway、設定URL / slugとの一致、MCP接続、64 Toolsを確認。
- [x] 非課金`getCliArena`の実呼出しで404を確認。直接公開APIは200で、転送設定の点検が必要。
- [x] ENS親名・Resolver・同一BlockでのRunner一覧読取を確認。必要な一覧はnull。
- [ ] CRE DashboardでOrganization状態の確認後、公式通常／Confidential Simulationの完走を検証。
- [ ] Bazantic既存Gatewayの転送設定と既存Recipeを確認。必要な変更範囲を合意した後、非課金Practiceまで接続。
- [ ] ENSの所有・権限・実Runner接続先を確認し、許可された範囲のRecord設定／Grant・Revoke検証。

登録や権限の変更、Gatewayの上書き、送金はこの確認では行わない。設定の存在・MCP接続だけでスポンサー要件完了とはしない。

## 20. Bazantic実接続の修復 — 本人依頼後の実行

2026-09-12。§19は読取時点。今回は本人の修復依頼を受け、既存Gatewayの限定更新まで実施。[詳細とEvidence](../../../hackathon/sponsors/BAZANTIC_RESCUE_LIVE.md)。

- [x] CLI 0.10.0の公式Source・管理APIから、MCP Spec更新に対しルート表が旧15件のままだったと特定。
- [x] 旧ルート・料金のSnapshotを保存し、Manifest・Starter・Doctrine評価の3ルートだけを無料追加。PATCH 200と18ルートの完全読戻し一致。
- [x] Gateway HTTPの6要求、Starter SHA、SDK独立Hash、反復一致を確認。
- [x] MCPのManifest取得と2回の戦略評価が成功。返却JSON全体が反復とローカルEvaluatorの双方で一致。
- [x] 既存Recipeが0件と確認。無料2 Toolだけの`rescue-room-strategy-comparison`をdraft作成し、全定義の読戻し一致。
- [ ] Recipeの実AI試行と出力検証。Model設定だけでは実行成功にしない。
- [ ] Recipe公開、同条件の有無比較、対象賞に必要な外部Agentの実演。

残り45のSpec-onlyルートは意図的に未追加。無関係なArena・認証・Final・Settlementを有効化せず、既存GatewayのURL・IDは維持。追加課金・推論・送金0。今回は新規Gateway・Web公開・Git Pushを実行しない。

別途確認済み：ENSv2親所有者は本人の提示アドレスと一致。CREはログイン成功、最新の停止理由はRPC設定不足。次の作業でこれらを未登録・未ログインへ戻して扱わない。

## 追加実行: 2026-09-12 Sponsor最低動作と撮影導線

上の接続確認後に本人承認の範囲で実施。遠隔操作中のPC再起動・スリープ・ネットワーク変更・既存サーバー停止はしない。

- [x] CREのRPC・Windows空白path・WASM path制約・QuickJS初期計算・JSON null境界・キー順差を修正。通常／Confidentialとも公式Simulationの全EnvelopeがNodeと一致。
- [x] 既存Rescue evaluatorを使う秘密Scenario Packを新規生成し、事前commit→secret input→confidential handler→salt付きreceipt→明示Reveal→独立Replayを公式CLIで実行。
- [x] ENSv2の既存所有名に専用Rescue capabilityを登録。許可済みHTTPS Originへの実API discoveryと、単一Text key grant→delegate更新→pause拒否→restore→revokeを確認。7取引、取消後はeth_call拒否。
- [x] ENS撮影用のread-only再確認commandを追加。追加送金・秘密鍵不使用。
- [x] 外部実AIがBazantic MCPを利用してManifest取得・Baseline・候補評価。SDK Integrity＋ローカル再評価＋独立3軸比較。予算90→60だが結果同点を保持。
- [x] 英語`/sponsors/demo`、実取引リンク、3証跡Download、1〜2分英語台本・日本語撮影手順を追加。
- [ ] Bazantic-hosted Recipeの実行／公開、Recipe有無の事前固定A/B。今回の外部OpenAI author実行と区別する。
- [ ] Live CRE TEE attestation、ネットワークDeploy、onchain Final commitment。Local official simulationの成功と区別する。
- [ ] 第三者Service Market、未知Final大会全体・報酬。今回の最低Sponsor実演の範囲外。
- [x] Sponsor実証コードのPushとWeb公開確認（2026-09-13）。
- [ ] スポンサー提出・選択賞の要件への適合確認。公開成功とは別。

[実行結果](../../../STATUS.md)、[撮影手順と代表GitHubリンク](../../../hackathon/sponsors/SPONSOR_DEMO.md)。Gateway無料接続と実AIは成功したが、賞の応募要件全体への適合や入賞を保証しない。
