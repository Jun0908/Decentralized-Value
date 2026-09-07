# Frontier Protocol Plan 2

## Implementation status (2026-09-07)

Emergency Supply Allocation now has a working practice vertical slice:

- [x] Versioned public supplier, route, price, capacity, and failure data
- [x] User-entered allocation (not a preselected Artifact ID)
- [x] Shared hard-constraint validation: whole non-negative kits, exact target, capacity, known vendors
- [x] Exhaustive evaluation of five supplier failures and four route failures
- [x] Two measured axes: total procurement cost and worst-case delivered kits
- [x] Pareto comparison against published baseline strategies
- [x] Deterministic context hash and result hash
- [x] HTTP scenario/evaluation endpoints and an interactive frontend
- [x] Unit, API, type, build, formatting, and browser-flow verification
- [ ] Participant source-code submission and isolated execution
- [ ] World ID participant registration and one-final-entry enforcement
- [ ] Hidden final workload and deadline scheduler
- [ ] Sepolia reward token deployment and payout settlement

The checked items are real and runnable without a wallet. The unchecked items must not be represented as completed in the demo; they are the next tournament-layer implementation.

Ethereum Calldata Compression now also has a working practice vertical slice:

- [x] Versioned public transfer batches including repeated addresses and boundary values
- [x] Standard ABI, fixed-width packed, and address-dictionary encoders
- [x] Checked-in Solidity decoders compiled with pinned solc, optimizer, and Cancun settings
- [x] Correctness comparison using a shared decoded state digest
- [x] Malformed encoding rejection check
- [x] Exact EIP-2028 zero/non-zero byte calldata gas
- [x] Actual `executionGasUsed` from Solidity runtime bytecode executed in EthereumJS EVM
- [x] Two-axis Pareto comparison, per-batch evidence, context hash, and result hash
- [x] HTTP scenario/evaluation endpoints and interactive frontend
- [ ] Arbitrary participant encoder/decoder source submission and isolated compilation
- [ ] Hidden final batches, World ID final entry, and Sepolia reward settlement

最終更新: 2026-09-07  
対象: 公平な参加機会、1人1最終Artifact、2軸実測、最終日Settlementを共有する2つのCompetition Arena

## 1. このPlanで実装するもの

共通Competition基盤の上に、性格の異なる次の2つのArenaを実装する。

### Arena 1: Emergency Supply Allocation Frontier

- 目的: 緊急物資を安く調達しながら、単一障害が起きてもできるだけ多く届ける
- 提出物: 公開された入力から各業者へのキット割当を返すTypeScriptプログラム
- 軸1: `totalProcurementCost`（総調達費、低いほど良い）
- 軸2: `worstCaseDeliveredKits`（全単一障害ケース中の最低配送数、高いほど良い）
- Hard Constraints: 整数・非負、必要数、業者供給上限、許可された業者とルート、決定性
- 対象: 一般エンジニア、非Web3参加者、AIを使って戦略をコード化する参加者

### Arena 2: Ethereum Calldata Compression Frontier

- 目的: Ethereumへ送るBatch Dataを小さくしながら、OnchainでのDecodeと実行も安くする
- 提出物: TypeScript EncoderとSolidity Decoderの組
- 軸1: `calldataGas`（圧縮後データの実Calldata Gas、低いほど良い）
- 軸2: `decodeExecutionGas`（Decodeと規定操作実行のEVM Gas、低いほど良い）
- Hard Constraints: Round-trip一致、規定操作後のState一致、決定性、外部依存禁止、EVM制限遵守
- 対象: Ethereum、Smart Wallet、Account Abstraction、Rollup、Smart Contract開発者

### 2つに共通するCompetitionルール

- 正しさ: 点数ではなくHard Constraint。1件でも不正解ならFrontier対象外
- 参加単位: World IDなどで確認した1人のParticipant
- 提出期間中: 全員に同じ提出上限・公開テスト・計算枠を与え、改善版を提出可能
- 締切時: 1人につき選択中の1 Artifactだけを最終エントリーとして固定
- 最終日: 全員を同じ非公開ワークロードで評価し、最終Frontierを確定
- 報酬: 最終Frontierの参加者WalletへSepolia ERC-20を実際に送金

現在のOrderbook Arenaは技術Sampleとして残せるが、Plan 2の主Arenaにはしない。現在の `parallelThroughput` はストレージ構造から計算したシミュレーション値なので、新しい2 Arenaの評価軸には使わない。DEX Routingも今回のCritical Pathには入れない。

## 2. 設計上の重要な区別

### Participant

World ID、スポンサーAllowlist、またはWallet-only方式で登録された参加単位。デフォルトはWorld IDのProof of Humanを使用する。

### Submission

提出期間中に送信される改善版。スポンサーが事前に設定した同一上限まで、各Participantが複数回提出できる。

### Final Entry

締切時にParticipantが選択していた1つのSubmission。最終評価、Pareto判定、Rewardの対象になるのはこれだけ。

### Evaluation

提出コードを共通環境で実行した結果。提出期間中のPublic Evaluationと、締切後のFinal Evaluationを分離する。

この区別により「AI Agentで改善版を作る機会」と「1人が複数ArtifactでFrontierや報酬を占有しないこと」を両立する。

## 3. 完成時のユーザー体験

1. ユーザーがWalletを接続する。
2. Challengeの参加条件、提出上限、締切、入力方式、公開範囲、Rewardを確認する。
3. World IDなど、スポンサーが指定した方式でParticipant登録する。
4. コード貼り付け、ファイルUpload、またはGitHub Commit指定でコードを送る。
5. Public EvaluationでCorrectness、Gas、Bytecodeサイズを確認する。
6. 必要ならAI Agentで改善し、全員共通の提出上限内で新版を送る。
7. 自分のSubmission一覧から、最終Entryにする1つを選ぶ。
8. 締切時に選択中の1 Artifactが自動で固定される。
9. 最終日にFinal EvaluationとPareto判定を見る。
10. Frontier対象者のWalletへTokenが振り込まれ、残高とTransaction Hashを確認する。

新しいSubmissionを受理した時点では、そのSubmissionを暫定Final Entryにする。参加者は締切まで過去の有効なSubmissionへ選択を戻せる。これにより、明示的な最終選択を忘れてもEntryが消えない。

## 4. Sponsor-configurable Challenge Manifest

スポンサーはChallenge作成時に次を設定する。Challenge開始後は設定をImmutableにし、変更が必要なら新しいChallenge IDを作る。

| 設定                           | 内容                                | Hackathon Demo既定値         |
| ------------------------------ | ----------------------------------- | ---------------------------- |
| `identityMode`                 | `world-id` / `allowlist` / `wallet` | `world-id`                   |
| `worldIdCredential`            | Proof of HumanなどのCredential条件  | `poh`                        |
| `maxSubmissionsPerParticipant` | 参加者ごとの提出上限                | `10`                         |
| `maxConcurrentEvaluations`     | 同時実行枠                          | `1`                          |
| `submissionStart`              | 提出開始時刻                        | Sponsor設定                  |
| `submissionDeadline`           | 提出締切                            | Sponsor設定                  |
| `reviewDuration`               | 結果確認・異議申立期間              | Demoは`0`、大会はSponsor設定 |
| `sourceInputModes`             | `inline` / `upload` / `github`      | すべて許可                   |
| `sourceVisibility`             | 即時公開 / 締切後公開 / 非公開      | Sponsor設定                  |
| `arenaType`                    | Supply Allocation / Calldata Codec  | 2種類                        |
| `runtimeConfig`                | Node、solc、optimizer、EVM revision | Arena別の固定値              |
| `publicWorkloadHash`           | 公開練習データ                      | 固定値                       |
| `finalWorkloadCommitment`      | 非公開最終データの事前Commitment    | 固定値                       |
| `rewardToken`                  | ERC-20 Address                      | Sepolia Demo Token           |
| `rewardPool`                   | 総報酬量                            | Sponsor設定                  |
| `rewardRule`                   | 均等配分など                        | Final Frontier均等配分       |
| `payoutMode`                   | 自動送金 / Claim                    | 自動送金                     |

Manifest全体をCanonical JSONにしてHash化し、Challenge IDとOnchain Registryに結び付ける。すべての参加者が同じManifestで評価されたことを検証できるようにする。

## 5. 1人1最終Artifactを保証するIdentity設計

### 5.1 World IDを使う既定フロー

World ID 4.0のUniqueness ProofをChallenge参加登録時に1回だけ使う。

1. Actionを `frontier-join:<challengeId>` としてChallenge単位に分ける。
2. SignalへParticipantのWallet Addressを含める。
3. BackendがWorld Developer API `POST /api/v4/verify/{rp_id}` でProofを検証する。
4. `nullifier + action` の使用済み状態をDurable Storageへ保存する。
5. 同じ人が別Walletで同じChallengeへ再登録しようとした場合は拒否する。
6. 検証済みParticipant IDを1つのWalletへBindする。
7. 以後のSubmissionとFinal Entry選択は、そのWalletの署名で認証する。

World ID 4.0ではUniqueness Proofのnullifierは一回利用向けなので、毎回の提出Identityとして使わない。最初のParticipant登録に使い、その後はBind済みWalletで複数Submissionを管理する。

Privacy上、氏名、メール、World ID Proof本体などは保存しない。ChallengeにScopeされたParticipant ID、使用済みnullifier、Bind先Wallet、検証時刻だけを保存する。

World ID 4.0のOnchain Verifierは現時点でPreview扱いのため、MVPはDeveloper APIで検証し、Backend Verifierの署名を `ParticipantRegistry` が受理する構成にする。Verifierが安定後、直接Onchain Verificationへ交換できるAdapter境界を残す。

参考:

- [World ID Concepts](https://docs.world.org/world-id/concepts)
- [World ID 4.0 Migration](https://docs.world.org/world-id/4-0-migration)
- [IDKit integration](https://docs.world.org/world-id/idkit/integrate)
- [World ID Verify API](https://docs.world.org/api-reference/developer-portal/verify)
- [Onchain Verification](https://docs.world.org/world-id/idkit/onchain-verification)

### 5.2 Sponsorによる代替Identity

スポンサー要件や参加地域によってWorld IDを必須にできない場合は、Challenge開始前に次から1つを選ぶ。

- `allowlist`: スポンサーがParticipantごとにWalletを登録
- `wallet`: 1 Walletを1 Participantとして扱う。Sybil耐性が弱いことをUIに表示

Challenge途中でIdentity方式を変更しない。同一Challenge内の全員に同じ条件を適用する。

## 6. 公平な複数Submissionルール

- 提出上限はParticipant単位で数え、Wallet単位では数えない。
- 上限値はChallenge開始前に公開する。
- コードが受理されSubmission IDが発行された時点で1回消費する。
- Compile failureやCorrectness failureでも消費済み回数は戻さない。
- 通信障害などでRequest自体が受理されなかった場合は消費しない。
- 同じSource Hashの再送は新規Submissionにせず、元のSubmissionを返す。
- 全員に同じSource size、Compile timeout、Evaluation timeout、Queue priorityを適用する。
- Queueは原則FIFOとし、締切前に受理済みなら実行完了が締切後でもPublic Resultを返す。
- Final Entryの選択変更は提出回数を消費しない。
- 締切後は新規提出、選択変更、Wallet変更を拒否する。

Public EvaluatorはRepository内でも実行可能にし、参加者自身の計算資源での練習回数まではProtocolが制限しない。公式Service上の計算枠だけを全員同一Quotaにする。

## 7. コードの送り方と公開範囲

### 7.1 Input modes

Evaluatorが最終的に同じNormalized Source Bundleを受け取れるよう、入口だけを切り替える。

- `inline`: BrowserのEditorへTypeScript / Solidityコードを貼り付ける
- `upload`: Arenaが許可する`.ts` / `.sol`ファイルをUploadする
- `github`: Public RepositoryのRepository、40文字Commit SHA、File Pathを指定する

Arena別のArtifact仕様:

| Arena                | 必須ファイル                         | 標準Interface                                   |
| -------------------- | ------------------------------------ | ----------------------------------------------- |
| Emergency Supply     | `allocation.ts`                      | `allocate(input): Allocation`                   |
| Calldata Compression | `encode.ts`、`SubmissionDecoder.sol` | `encode(batch): Hex`、`decodeAndExecute(bytes)` |

共通制限:

- Arena Manifestで固定したNode / TypeScript / Solidity Versionを使う
- Constructor引数、Package追加、外部Network、Filesystem、FFIを禁止
- Source Bundleのファイル数と合計Sizeに上限を設ける
- 提供済みInterface、型、Test HelperだけImport可能
- 同じ入力に対して常に同じ出力を返す
- SPDX Licenseを必要なSolidity Sourceへ付ける

GitHubは必須にしない。Private GitHub RepositoryとのOAuth連携はMVPに含めず、非公開コードは`inline`または`upload`で受け取る。

### 7.2 Source visibility

スポンサーはChallengeごとに次から選ぶ。

- `public-immediate`: 受理後すぐ公開
- `public-after-deadline`: 締切までは非公開、締切後に公開
- `private`: スポンサー、Evaluator、許可されたJudgeだけ閲覧可能

非公開SourceをBlockchainへ書かない。OnchainにはSource Hash、Artifact Hash、Storage Content Hashだけを記録する。Source本体は暗号化したObject Storageへ置き、Challenge専用暗号鍵をSecret Storeで管理する。

`private`では一般ユーザーがSourceから再実行できないため、「公開再現可能」ではなく「許可された複数Evaluatorが再現可能」とUIとEvidenceに明示する。スポンサーがOpen Sourceを要件にする場合は`public-immediate`または`public-after-deadline`を選ぶ。

## 8. 公平な計測仕様

### 8.1 固定する実行環境

- Node / TypeScript / solc Version
- Solidity optimizer、metadata、EVM revision
- Evaluator package/versionとContainer/Image Hash
- Public / Final Workload Version
- 入力順序、Seed、Caller、Block Context、初期State
- 各Metricの集計式と丸め規則
- Timeout、Memory、Source size

### 8.2 Correctness Hard Gate

各ArenaのReference Modelと比較する。

Emergency Supply:

- すべての割当が整数かつ非負
- 割当合計が規定キット数と一致
- 各業者の供給上限を超えていない
- 入力にない業者やRouteを使用していない
- 価格、供給上限、Route、障害Scenarioを改変していない
- 同じ入力とData Versionから同じ割当を返す

Calldata Compression:

- Encoder出力をDecoderへ渡すと元のBatchと一致
- 規定操作後のBalance、Nonce、Event、State RootがReferenceと一致
- 空Batch、最大件数、重複Address、境界Amountを処理できる
- 不正Encodingを規定どおりRevertする
- 同じBatchから同じEncodingと最終Stateを生成する
- 外部ContractやEnvironmentへ依存しない

Compile failure、Timeout、Revert不一致、出力不一致のいずれかがあれば `correctness=false` とし、2軸の値が良くてもFrontierには入れない。

### 8.3 Arena 1: Emergency Supplyの2軸

#### totalProcurementCost（MINIMIZE）

- Participantが返した業者別キット数に、Version固定された単価を掛ける。
- 配送Route費、固定発注費などManifest記載の費用を加える。
- Final Corpus全Instanceの費用を整数最小単位で合計する。
- 為替や当日の市場価格を使わず、Challenge Dataに含まれる値だけを使う。

#### worstCaseDeliveredKits（MAXIMIZE）

- Data Versionに含まれるすべての単一障害Scenarioを列挙する。
- 各Scenarioで実際に届くキット数を計算する。
- Instanceごとの最小配送数を取り、Final Corpus全体で合計する。
- Random故障抽選や確率推定ではなく、同じ障害一覧を全Artifactへ適用する。

公開Demoでは、どの業者・Routeが停止し、何個失われたかを可視化する。

### 8.4 Arena 2: Calldata Compressionの2軸

#### calldataGas（MINIMIZE）

- 全Final BatchをParticipantのEncoderで圧縮する。
- EncodingをTransaction calldataへ入れた場合のIntrinsic Calldata GasをByteごとに実計算する。
- Zero ByteとNon-zero ByteのGas差を、Manifestが指定するEVM Ruleで計算する。
- 全BatchのCalldata Gasを合計する。

#### decodeExecutionGas（MINIMIZE）

- 各Batchは新しい同一EVM Stateから開始する。
- ParticipantのDecoderへ圧縮済みDataを渡す。
- Decodeと規定操作完了までにEVMが実際に消費したGasを取得する。
- 全Batchの実行Gasを合計する。
- Deployment Gasは含めず、Bytecode SizeはHard ConstraintとしてEIP上限を確認する。
- `CREATE` / `CREATE2`、許可外Contractへの `CALL` / `DELEGATECALL`をTraceで拒否する。

CPU時間やNetwork速度から性能を推定せず、2軸とも同じEVM規則から整数値として取得する。

Ethereum上のデータ圧縮が利用者Fee削減につながる背景は、[Ethereum.orgのZK-rollup解説](https://ethereum.org/developers/docs/scaling/zk-rollups/)を参照する。CalldataのZero / Non-zero Byte Costは[EIP-2028](https://eips.ethereum.org/EIPS/eip-2028)、Account AbstractionのUserOperationとBundlingは[ERC-4337](https://eips.ethereum.org/EIPS/eip-4337)に従う。BlobはEVMから内容を直接参照できないため、最初のCompression ArenaはBlobではなくCalldataを対象にする（[EIP-4844](https://eips.ethereum.org/EIPS/eip-4844)）。

### 8.5 共通Pareto判定

Challenge Manifestが各軸の `MINIMIZE` / `MAXIMIZE` を定義する。

- Emergency Supply: CostはMINIMIZE、Worst-case DeliveryはMAXIMIZE
- Calldata Compression: Calldata GasとDecode Gasの両方がMINIMIZE
- Aが全軸でB以上、かつ少なくとも1軸でBより良い場合だけ、AがBをDominateする

2軸を足し合わせた総合点や重み付けScoreは作らない。完全に同じ2軸結果はTieとして両Participantを同じFrontier Pointに関連付ける。

## 9. Public EvaluationとFinal Evaluation

### Public Evaluation

- 提出期間中に各Submissionへ実行する。
- 公開Workloadだけを使う。
- Correctness、Arena固有の2軸、Evidenceを本人へ返す。
- Leaderboardの途中公開範囲はSponsor設定に従う。
- Rewardや最終Frontierは確定しない。

### Final Evaluation

- Challenge開始時にFinal Workload JSONのHashだけを公開する。
- 実データは締切までEvaluator側で暗号化して保持する。
- 締切時にParticipantごとのFinal Entryを1つにFreezeする。
- Final Entryだけを同じFinal Workloadで評価する。
- 全件評価完了後、Workloadを公開可能なChallengeではRepositoryへ追加する。
- 公開されたWorkloadからCommitment Hashと結果を再計算できるようにする。

提出回数が複数でも、非公開Final Workloadで採点されるのは1人1 Artifact・1回だけなので、非公開ケースへ繰り返し適応することはできない。

## 10. 最終日SettlementとToken送金

最終日の状態遷移を次に固定する。

```text
OPEN
  -> SUBMISSIONS_CLOSED
  -> FINAL_ENTRIES_FROZEN
  -> EVALUATING
  -> RESULTS_COMMITTED
  -> REVIEW
  -> FINALIZED
  -> DISTRIBUTING
  -> COMPLETE
```

1. `submissionDeadline`で新規提出とEntry変更を停止する。
2. 1 Participantにつき1 Final EntryをSnapshotする。
3. 全Final Entryを同じContextで評価する。
4. Correctnessを通過した結果から最終Pareto Frontierを計算する。
5. Result Merkle Root、Evidence Hash、FrontierをOnchainへCommitする。
6. Sponsor設定のReview期間を置く。Demoでは0にできる。
7. 全件数と評価件数が一致する場合だけRoundをFinalizeする。
8. `FrontierRewardPool`が対象WalletへERC-20をBatch送金する。
9. Gas上限で1 Transactionに収まらない場合は、誰でも継続可能な複数Batchに分ける。
10. 全送金完了後にChallengeを `COMPLETE` にする。

Rewardは途中順位や評価到着順では配らない。最終Frontier確定後にのみ送る。

MVP Reward Rule:

- Sponsorが開始前に固定Poolを入金する。
- Baseline Artifactは比較対象だがReward対象外。
- Correctnessを通過し、BaselineにDominateされず、最終Frontierに残ったParticipantが対象。
- Poolを対象Participant数で均等分割する。
- Tieも別Participantなら同条件で対象にする。
- 送金先は締切時にBindされていたPayout Walletに固定する。
- `Transfer` Event、Payout Transaction、`balanceOf`の変化をEvidenceに残す。

自動送金に失敗したWalletだけは、同額を後から受け取れるClaim fallbackを用意する。Sepolia Demo Tokenには金銭価値がないことをUIに明記する。

## 11. 実装するコンポーネント

### 11.1 Shared Schema v2

`packages/shared` に以下を追加する。

- `ChallengeManifestV2`
- `IdentityPolicy`
- `SubmissionPolicy`
- `SourcePolicy`
- `ParticipantRecord`
- `SubmissionRevision`
- `FinalEntry`
- `EvaluationEvidenceV2`
- `RoundState`
- `RewardAllocation`
- 軸名、方向、単位をManifestから検証できる汎用2軸Outcome / Attestation
- Emergency Supply用Input、Allocation、Failure Scenario Schema
- Calldata Compression用Batch、Action、Encoding Schema

既存v1 Fixtureを誤って読まないよう、`schemaVersion: "2"` と新しいContext Hashを必須にする。

### 11.2 Participant / World ID Service

- IDKit 4.xのFrontend flow
- RP Context発行Endpoint
- World Developer API v4へのBackend Verify
- Action、Signal、Wallet Addressの一致確認
- 使用済みnullifierのDurableなUnique保存
- Participant IDとWalletのBinding
- World ID / Allowlist / Wallet Adapter
- Replay、別Wallet再登録、別Challenge ActionのTest

### 11.3 Source Ingestion / Storage

- Inline、Upload、GitHub Adapter
- Line ending、Path、Compiler inputの正規化
- Source HashとContent Hash生成
- Source size、Import、Contract名Validation
- Arena別Source Bundle Validation
- Public、Delayed Public、Private Visibility
- Private Sourceの暗号化保存と権限付き取得
- 同一Source HashのIdempotency

### 11.4 Deterministic Evaluator

新しく `packages/evaluator-core` を作り、Arena固有EvaluatorをPluginとして分離する。

- 共通Sandbox、Resource Limit、Canonical Evidence、Result Hash
- `benchmarks/emergency-supply`: Allocation実行、全単一障害列挙、Cost / Delivery計算
- `benchmarks/calldata-compression`: Encoder実行、固定solc Compile、隔離EVM Deployment
- ArenaごとのReference ModelとCorrectness比較
- Calldata Gas、Decode Execution Gasの実測
- Opcode / Call Traceによる禁止動作検出
- Evidence JSONとResult Hash生成
- 同一Artifactを2回評価したときの一致Test
- Emergency Supplyの手計算FixtureとのCross-check Test
- Calldata CodecのFoundryとのCross-check Test

Emergency Supplyは整数計算だけをScoreに使い、プログラム実行時間はHard Limitにする。Calldata CompressionではOS処理時間を点数に使わず、EVM Gasだけを使う。FoundryはCIで既知Codecを測り、Evaluatorとの一致を確認する独立手段として残す。

### 11.5 Contracts v2

- `ChallengeRegistryV2`: Manifest、Deadline、Workload Commitment、Reward設定
- `ParticipantRegistry`: 検証済みParticipant、Wallet、Challengeごとの一意参加
- `ArtifactRegistryV2`: 複数Revision、提出回数、選択中Final Entry
- `BenchmarkAttestationV2`: v2 ResultとEvaluator署名を検証
- `ParetoSettlementV2`: Manifestの軸方向に従う汎用2軸Final Frontier
- `FrontierRewardPool`: Pool、Allocation、Batch送金、Claim fallback
- `FrontierDemoToken`: Sepolia用ERC-20

World ID ProofやSource本体はOnchainへ保存しない。

### 11.6 API v2

- `POST /v2/participants/world-id/context`
- `POST /v2/participants/world-id/verify`
- `POST /v2/participants/allowlist/register`
- `POST /v2/submissions/prepare`
- `POST /v2/submissions`
- `GET /v2/submissions/{submissionId}`
- `GET /v2/participants/me/submissions`
- `PUT /v2/participants/me/final-entry`
- `GET /v2/challenges/{challengeId}`
- `GET /v2/challenges/{challengeId}/frontier`
- `GET /v2/evaluations/{submissionId}/evidence`
- `POST /v2/admin/challenges/{challengeId}/close`
- `POST /v2/admin/challenges/{challengeId}/evaluate-final`
- `POST /v2/admin/challenges/{challengeId}/finalize`
- `POST /v2/challenges/{challengeId}/distribute`

APIのin-memory Storeを公式状態のAuthorityにしない。Participant、Submission、Source、QueueはDurable Storageへ保存し、Final Result、Frontier、RewardはSepolia Eventから再構築可能にする。

### 11.7 Sponsor Console

- Identity方式とCredential条件
- Submission上限と締切
- Input modeとSource visibility
- Compiler / Evaluator設定
- Arena TypeとArena固有Data / Interface
- Public / Final Workload UploadとCommitment確認
- Reward Token / Pool / Rule
- Review期間とPayout方式
- Manifest Preview、Hash、Challenge作成Transaction
- Round Close、Evaluation進捗、Finalize、Distribution進捗

危険な設定変更はChallenge開始後にできないようにする。

### 11.8 Participant Frontend

- Top: 「改善版は提出可能、最終参加は1人1Artifact」と明示
- Challenge条件と残り提出回数
- Wallet ConnectとWorld ID Verify
- Inline Editor、File Upload、GitHub入力
- Source公開範囲の表示
- Public Evaluation結果
- Submission履歴とFinal Entry選択
- 締切後のFinal Evaluation進捗
- Manifestの軸名・単位・方向に対応する2軸Frontier Chart
- Emergency Supplyの業者割当と障害Scenario可視化
- Calldata Codecの圧縮DataとDecode Cost内訳
- EvidenceとSource visibility表示
- Token自動送金状態、残高Before/After、Transaction Hash

Topから2つのArenaを選べるようにする。既存Orderbook Artifactを選ぶだけの `/demo` は主Demoから外し、技術Sampleとして残す場合も公式提出やRewardと混同させない。

## 12. 実装順序

### Phase A: Competition仕様とManifest

- [ ] `emergency-supply-v1` Manifest Schemaを作る
- [ ] `calldata-compression-v1` Manifest Schemaを作る
- [ ] Sponsor設定とImmutable条件を定義する
- [ ] Public WorkloadとFinal Workload Commitmentを作る
- [ ] v2 Result HashのTest Vectorを作る
- [ ] Round State Machineを定義する

### Phase B: Participant Identity

- [ ] Participant Registryを実装する
- [ ] World ID 4.0 Verify flowを実装する
- [ ] Wallet Bindingと使用済みnullifierをDurableに保存する
- [ ] Allowlist / Wallet fallbackを実装する
- [ ] 1人が複数Walletで同じChallengeへ入れないTestを追加する

### Phase C: Sourceと複数Submission

- [ ] Inline / Upload / GitHub Sourceを正規化する
- [ ] Public / Delayed / Private Storageを実装する
- [ ] Participantごとの共通Quotaを実装する
- [ ] Revision履歴とFinal Entry選択を実装する
- [ ] 締切Freezeと1 Participant・1 Final Entryを検証する

### Phase D: 2つの実測Evaluator

- [ ] Emergency Supplyの公開Data、Reference Model、単一障害列挙を実装する
- [ ] `allocation.ts`をSandboxで実行し、Cost / Worst-case Deliveryを計算する
- [ ] 不正割当、Data改変、非決定的出力、Timeoutを失格にする
- [ ] Calldata Codecの公開Batch、Reference Model、Starter Codecを実装する
- [ ] `encode.ts`と`SubmissionDecoder.sol`を固定条件で実行する
- [ ] Calldata GasとDecode Execution GasをEVM規則から取得する
- [ ] 不正Decode、許可外Opcode、外部依存、Timeoutを失格にする
- [ ] 両Arenaで複数のNon-dominated Fixtureと不正Fixtureを検証する

### Phase E: Final SettlementとReward

- [ ] v2 AttestationとPareto Settlementを実装する
- [ ] Final Entry Snapshotと全件Evaluation確認を実装する
- [ ] Result RootとEvidence HashをOnchainへ記録する
- [ ] Reward Pool、均等Allocation、Batch送金を実装する
- [ ] 自動送金失敗時のClaim fallbackを実装する
- [ ] Replay、二重評価、二重送金のContract Testを追加する

### Phase F: Sponsor ConsoleとParticipant UI

- [ ] Challenge設定画面を実装する
- [ ] TopとArena一覧に2つのChallengeを表示する
- [ ] Wallet / World ID参加画面を実装する
- [ ] 3種類のSource入力を実装する
- [ ] Submission履歴とFinal Entry選択を実装する
- [ ] Final FrontierとEvidenceを表示する
- [ ] Token送金と残高変化を表示する
- [ ] OpenAPI、README、Demo Scriptをv2へ更新する

### Phase G: 本当に動くDemo

- [ ] World ID StagingでParticipant一意性を確認する
- [ ] Sepoliaへv2 ContractsとDemo TokenをDeployする
- [ ] 2つのChallengeを登録し、各Reward PoolへDemo Tokenを入金する
- [ ] Emergency Supplyへ複数の改善版を提出し、Final Entryを1つ選ぶ
- [ ] Calldata Compressionへ複数の改善版を提出し、Final Entryを1つ選ぶ
- [ ] 両Challengeを締切Freezeする
- [ ] 別Walletで同じParticipantが重複参加できないことを確認する
- [ ] Emergency SupplyのFinal DataでCost / Worst-case Deliveryを計算する
- [ ] Calldata CompressionのFinal BatchでCalldata / Decode Gasを実測する
- [ ] 両ArenaのAttestationとFinal FrontierをSepoliaへ記録する
- [ ] 両Arenaの対象WalletへTokenを自動送金する
- [ ] Token残高増加と全Transaction Hashを公開画面で確認する
- [ ] 公開可能なSourceとFinal Workloadから結果を再生成する

## 13. 完了条件

以下をすべて満たしたときだけ、このDemoを「実動」と呼ぶ。

- GitHub必須ではなく、コード貼り付けとFile Uploadでも提出できる。
- SponsorがSource入力方法と公開範囲を開始前に選べる。
- TopからEmergency SupplyとCalldata Compressionの2 Arenaへ入れる。
- 全Participantへ同じ提出上限と計算Quotaが適用される。
- World ID Challenge Actionにより、同じ人の重複Participant登録を拒否できる。
- 1 Participantは改善版を複数提出できるが、最終Entryは1つだけである。
- 締切後にSubmissionとFinal Entryを変更できない。
- Emergency SupplyのCostとWorst-case Deliveryが、固定Dataと全単一障害列挙から整数で再計算できる。
- Calldata Compressionの2軸が、同じEVM規則から実Calldata Gasと実Execution Gasとして取得される。
- Correctness failureがFrontierへ入らない。
- 同じArtifactとContextから同じResult Hashを再生成できる。
- Final Workload Commitmentが開始前に固定されている。
- 全Final Entryの評価完了前にSettlementできない。
- Pareto結果がTypeScriptとSolidityで一致する。
- Sepolia上にChallenge、Final Result、Frontier、RewardのTransactionがある。
- Finalize後にERC-20が対象Walletへ実際に送られる。
- `Transfer` EventとWallet残高増加を確認できる。
- Private Sourceを公開したと誤認させず、再現可能範囲を正しく表示する。
- 主Demo画面に `simulated` の結果を本物の評価として表示しない。
- `pnpm ci` と新しいE2E Testが成功する。
- 両Arenaで少なくとも1つの実提出、最終評価、Frontier確定、Token送金が完了する。

## 14. 外部設定が必要になるもの

- World Developer PortalのRP ID、Action、Server signing key
- Production用Durable Database
- Source / Evidence用Object Storage
- Private Source暗号化鍵
- Sepolia RPCとDeployer / Evaluator Wallet
- Sepolia ETH
- Reward Token Addressと事前入金済みPool
- VercelのEnvironment Variables

これらが未設定でも、Local Evaluator、Wallet-only Participant、Public Source、Local Demo Tokenで開発とTestを進められるようAdapter化する。

## 15. 今回のCritical Pathに入れないもの

- DEX Routing Frontier
- Orderbook OptimizationをPlan 2の主Arenaにすること
- シミュレーションによるParallel Throughput
- Wall-clock速度、Network速度、Energy消費の比較
- Participantが複数Artifactで最終Frontierを占有する仕組み
- 1つのWeighted Score
- Ledger実機
- ENSv2、Bazanticを評価成立の必須条件にすること
- Private GitHub RepositoryへのOAuth接続
- Mainnet Tokenや金銭価値があるという表現

ENSv2とBazanticはCore Competition完成後に発見・配布・Sponsor Evidenceとして接続する。公平なIdentity、同一機会の複数Submission、1人1 Final Entry、実測Pareto、最終日Token Distributionを先に完成させる。
