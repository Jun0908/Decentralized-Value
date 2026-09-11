# Frontier Protocol 計画9 — Rescue Room

**作成日:** 2026-09-10

**状態:** Phase 0は`GO`。Phase 1、Phase 2のControlled AI Practice、Strategy Game UX Pass A/B/Cを実装済み。Phase 3はToken、Escrow、Evidence Schema、Reconciliation、Payment Journeyまでローカル実装済みで、Sepolia Deployと実Transactionは未実施

**前計画:** Secret Gateの参照実装は維持し、競技化は`PIVOT`として終了

**目的:** AI Agentが不完全な情報の中で調査、委託、支払い、Protocol操作を自律判断する、再現可能なIncident Response Arenaを成立させる

この文書はRescue Roomの設計仮説、検証順序、実行記録を定める。Phase 0で成立性を確認し、Phase 1のローカルPractice Arenaを完成した。Phase 2では参加者Playbook、固定OpenAI Agents SDK Runtime、AI Action Evidence、Starter KitまでをControlled Practiceとして実装した。Phase 3ではGame Paymentと将来のSepolia Paymentを同じEvidence Chainで結ぶ基盤まで実装した。次はCompetition基盤を増やす前に、初見理解、Live Simulation、結果理解を成立させるUX Gateを実行する。Hidden Final、Revision / Final Entry、参加者一意性、Sepolia上の実Service Paymentは未実装である。

## 1. 中心となる考え方

Rescue Roomを、単なる「AIにIncident対応を説明させるゲーム」にはしない。

中心となる問題は次である。

> 不完全な情報の中で、限られた時間と予算を使って情報と専門性を購入し、いつ、どこまでProtocolへ介入するかを判断する。

CommanderはIncidentのTrue Stateを直接見ることができない。追加情報、Second Opinion、Patch、Patch Verificationには価格とゲーム内時間が必要になる。

```text
INFORMATION HAS A COST
+ DELAY HAS A COST
+ INTERVENTION HAS A COST
+ INACTION HAS A COST
```

AI Agentを使う意味は、固定された少数の数値を探索することではなく、時間とともに増えるEvidenceを解釈し、仮説を更新し、次を選び、限られた予算を配分することにある。

## 2. 用語

| 用語 | この計画での意味 |
| --- | --- |
| Episode | 1件のProtocol IncidentまたはFalse Positiveを開始から終了まで進める評価単位 |
| World State | Incident種別、Severity、影響範囲、攻撃進行、Protocol残高などの非公開状態 |
| Observation | Commanderへ公開されたAlert、Log、Trace、Protocol状態の一部 |
| Commander Agent | Observationを読み、Service購入とProtocol Actionを決める参加Agent |
| Service Agent | 限定された調査、監視、監査、Patch作成、検証を有償で提供するAgent |
| Service Order | CommanderがService、対象、価格上限、依頼内容を指定する注文 |
| Evidence Receipt | Serviceが返した構造化Finding、根拠、信頼度、deliverable hash |
| Payment Receipt | reserve、release、refundを含むService代金の記録 |
| Action | Pause、Apply Patch、Resume、WaitなどProtocolへ影響する命令 |
| Transcript | Observation、Order、Receipt、Action、State Transitionを順番どおりに固定した記録 |
| Commander Playbook | Commanderの指示、権限制限、利用可能Toolなどを表す参加Artifact |
| Rescue Credits | MVP内だけで使う仮想のIncident Response予算。Tokenではない |
| Final Entry | 公式評価へ進める、参加者ごとに1つ選ばれたCommander Artifact |

## 3. このArenaが示すもの

Rescue Roomが最終的に示すべき内容は次である。

1. AI Agentが、観測だけでは確定できないIncidentへ逐次対応できる。
2. AI Agentが、他のAgentの能力、価格、速度、精度を比較してServiceを購入できる。
3. Service購入、Protocol操作、支払い、EvidenceをひとつのReplayで確認できる。
4. 同じEpisodeと確定済みTranscriptから、同じProtocol Final StateとOutcomeを再現できる。
5. User Protection、Availability、Treasury StewardshipをWeighted Scoreへ統合しない。
6. Ethereumが、予算、Service Escrow、Final commitment、Allocation、Settlementを検証可能にする。

## 4. 言わないこと

Evidenceが存在しない段階では、次の表現を使わない。

- Game内Rescue CreditsをTokenまたは実際の支払いと呼ばない。
- Scripted Serviceを、実際に稼働した独立AI Agentと呼ばない。
- Off-chain ReceiptをEthereum Transactionと呼ばない。
- Agentの自由文説明が正しいためOutcomeも正しい、と扱わない。
- Replay可能であることを、同じLLM推論が再現できることと混同しない。
- Instant Demoを、締切とSecret Finalを持つProduction Tournamentと呼ばない。
- Serviceのwallet、Escrow、Transaction、deliverableが確認できない状態で「AI paid another AI」と表示しない。

## 5. Product invariant

既存のFrontier Protocolと同じ原則を守る。

- 正しさを最初のGateにする。
- Evaluator、Generator、Episode Pack、Action Limit、Service Catalog、Metricsが一致する結果だけを比較する。
- すべてのOutcomeと方向を独立させる。
- Hidden Weightを持つOverall Scoreを作らない。
- Pareto、Contribution、Hash、Allocationを提出順に依存させない。
- `simulated`、`measured`、`committed`、`paid`を区別する。
- Practiceは無制限に近くしてよいが、Final EntryとFinal Evaluationの機会は平等にする。
- AIの名称、説明文、利用Model、試行回数をReward Signalにしない。
- 悪い判断を説明文で救済しない。OutcomeはSimulatorが計算する。

## 6. 基本ゲームループ

```text
Committed Episode Definition
          |
          v
Deterministic Hidden World
          |
          v
Limited Observation -------> Commander Agent
                                  |
                    +-------------+-------------+
                    |                           |
                    v                           v
              Service Order               Protocol Action
                    |                           |
                    v                           |
              Service Agent                    |
                    |                           |
          Evidence + Payment Receipt            |
                    +-------------+-------------+
                                  |
                                  v
                    Deterministic State Transition
                                  |
                     next observation / next turn
                                  |
                                  v
                    Transcript + Final Outcomes
                                  |
                                  v
                 Value Pools + Frontier + Settlement
```

各Actionはゲーム内時間を進める。実際のLLM API latencyやEthereum confirmation timeは公式Outcomeへ入れない。外部環境の混雑を競技結果へ混ぜないためである。

概念上の状態遷移は次の純粋関数として扱う。

```text
nextState = transition(previousState, action, dueEvents, episodeDefinition)
outcomes  = aggregate(orderedEpisodeResults)
```

## 7. 架空Protocol

MVPでは架空のEthereum LendingまたはStablecoin Protocolを1つだけ使う。名称と詳細TopologyはPhase 0で決める。

最低限、次のModuleを持たせる。

- Deposit / Withdrawal
- Borrow / Repay
- Liquidation
- Price Oracle
- Accounting
- Admin / Upgrade権限
- External liquidityまたはBridge依存

全面Pauseだけでなく、Module単位のPartial Pauseを可能にする。Protocolを動かし続けなければRiskを解消できないScenarioも含め、即時全面Pauseが常に正しくならない因果関係を作る。

## 8. Commander Agent

CommanderだけがService購入とProtocol操作を決定する。Service AgentはCommanderの許可なくProtocol状態を変更できない。

### 8.1 MVP Action候補

```text
BUY_SERVICE
PAUSE_MODULE
PAUSE_PROTOCOL
APPLY_PATCH
RESUME_MODULE
RESUME_PROTOCOL
WAIT
CLOSE_INCIDENT
```

各Actionは厳格なSchemaを持つ。自由文はProvenanceとして保存できるが、State Transitionの入力にはしない。

例:

```json
{
  "type": "BUY_SERVICE",
  "serviceId": "accounting-audit-standard",
  "task": "CHECK_ACCOUNTING_INVARIANTS",
  "target": "withdrawal-module",
  "maxPriceCredits": 30
}
```

### 8.2 Commander Artifact

Phase 1の公式Practiceでは、同じModel、Tool Schema、Token Limit、Turn Limitを全Entryへ適用し、参加Artifactを`Commander Playbook`とする案を優先する。

Playbookは次を含められる。

- Commander instructions
- 使用可能なToolと権限
- 1注文あたりの支出上限
- Protocol Actionの許可範囲
- ModelとRuntimeのProvenance

Strategy Spaceを再び小さな有限設定へ縮めない。一方で、任意コードをすぐに実行対象へ入れない。

BYO Agent endpointはPractice用の別Contextとして先に許可できる。公式比較へ入れるのは、実行隔離、同一Compute Limit、Timeout、Network Policy、Transcript Attestationが完成してからにする。

### 8.3 Chain of Thought

内部Chain of Thoughtの提出や再現を要求しない。必要なら短い`reasonCode`、判断時の仮説、confidenceをProvenanceとして保存するが、Rewardには使用しない。

## 9. Service Agent

Service Agentには能力境界を持たせ、Hidden World全体を見せない。

| 種類 | 役割 | 代表的なTradeoff |
| --- | --- | --- |
| Monitoring Agent | Address、Volume、Event、Oracle変動を追加観測する | 安価で速いが誤検知が多い |
| Trace Audit Agent | Transaction TraceとCall経路を調べる | 中価格。実行系Incidentに強い |
| Accounting Audit Agent | Balance、Share、Debt invariantを検査する | 高価格で遅いがAccountingに強い |
| Second Opinion Agent | 既存Findingを独立検証する | 重複費用と誤判断低減のTradeoff |
| Patch Agent | 原因候補に対応するPatch Artifactを返す | 高価。原因が違えば無効または有害 |
| Patch Verification Agent | Patchの安全性と適合性を検査する | 再開が遅れる代わりにRegressionを減らす |

### 9.1 Service Contract

各Serviceはversion付きManifestを持つ。

- `serviceId`とProvider identity
- Capabilityと対象Module
- 固定価格または公開価格規則
- ゲーム内delivery time
- 公開された過去の精度またはCalibration
- Input Schema
- Evidence Receipt Schema
- Failure、Timeout、Refund規則
- walletとEscrow情報。MVPではnull

### 9.2 MVPのMarket境界

最初は5〜6個のCurated Serviceだけを固定価格で提供する。

次はMVPへ入れない。

- 誰でもServiceを登録できるOpen Marketplace
- Auctionと動的価格競争
- Service Agent同士の再委託
- Reputation Token
- Dispute Jury
- 任意のPatch source code実行

Service Provider間の競争はCommander競技とは別の将来ArenaまたはMarketとして扱う。2つの競技を最初から同時に作らない。

### 9.3 Service Evidenceの公平性

全Final Entryが同じEpisodeで同じServiceを同じ条件で購入した場合、同じEvidence Receiptを得なければならない。

MVPではService結果を決定論的Simulatorから作る。実際のAI Serviceを導入する場合は、`(episode, service, task, target)`ごとに一度だけ生成、Schema検証、Commitし、全Entryへ同じ結果を返す。

これによりService AgentのLLM出力差が参加者間の運にならないようにする。

## 10. Information has a cost

情報購入は常に得になってはいけない。

- Service代金によって残り予算が減る。
- Deliveryまでゲーム内時間が進み、Incidentが悪化する可能性がある。
- 安いServiceはFalse Positiveや見逃しを含む。
- 高価なServiceも専門外では弱い。
- 複数ServiceのEvidenceが相関し、購入しても新情報にならない場合がある。
- Second Opinionは誤判断を減らすが、対応を遅らせる。
- Patch購入後もVerificationまたはApply判断が必要になる。
- 何もしない間にもProtocol Stateは変化する。

Episode集合には、情報購入が有効な場合と、待たずに介入した方がよい場合の両方を含める。

## 11. Scenario Generator

Scenarioを文章のランダムな組み合わせにはしない。非公開World StateからObservationとState Transitionが生まれる因果Modelを作る。

### 11.1 Hidden parameter候補

- `incidentFamily`
- `severity`
- `affectedModules`
- `lossRate`
- `propagationDelay`
- `attackerAdaptation`
- `userDemandPattern`
- `pauseSideEffects`
- `recoverability`
- `validPatchFamily`
- `telemetryQuality`
- `serviceAvailability`
- `serviceAccuracyRealization`
- `serviceDeliveryTimeRealization`
- `initialObservationQuality`

### 11.2 Incident family候補

- Benign withdrawal spike
- Oracle manipulation
- Accounting drift
- Compromised operator key
- Liquidity crisis
- Contract exploit
- Bridgeまたはexternal dependency failure

False Positiveを必ず含める。重大Incidentと正常な需要増加が同じ初期Observationを持つ場合を作り、最初のAlertだけでは正解Actionを確定できないようにする。

### 11.3 Generatorの決定論

すべての外生EventはSeed付きで決定する。Action列によって乱数消費位置がずれないよう、乱数を次のようなkeyから個別導出する。

```text
randomValue = hash(
  generatorVersion,
  episodeSeed,
  eventKind,
  serviceId,
  task,
  requestOrdinal
)
```

これにより異なるCommander間でも、購入した同一Serviceの品質実現値を公平に比較できる。

### 11.4 Generator property

生成Episodeは自動Testで次を満たす。

- 必ず終了条件がある。
- BudgetとAction Limit内に少なくとも1つ実行可能な対応経路がある。
- True StateとObservationが矛盾しない。
- Service EvidenceはCapability境界を越えない。
- Agent-visible fieldからSeedやIncident IDを推測できない。
- 同一Seedから同一Episode Hashが得られる。
- 異なるIncident familyで同じActionが常に最適にならない。
- Pause、Audit、Wait、Patchの結果が因果的に説明できる。

## 12. PracticeとFinal

### 12.1 Practice

- Generator、基本分布、Action Schema、Service Manifest、Evaluatorを公開する。
- Practice回数は多く許可し、Agentの学習とSimulationを禁止しない。
- Practice SeedとFinal Seedを分離する。
- Personalまたは外部Agent Contextを、公式Reference Runner Contextと混ぜない。
- Practice結果はReward Settlementへ使わない。

### 12.2 Final

- 参加者ごとに1つのFinal Entryだけを使う。
- 全Final Entryを同じ複数Episode Packで評価する。
- Entry締切後にFinal Packを開示する。
- Final実行中はユーザーがCommanderへ介入できない。
- Turn、Token、Service Call、Action、Budget、Timeoutを同一にする。
- Final Transcriptを確定後に開示し、独立Replayできるようにする。

MVPは既存Disaster Responseと同じInstant Finalでもよい。その場合は、事前Commit後すぐにRevealするDemoであり、Scheduled Hidden Finalではないと表示する。

### 12.3 将来のFinal Seed

Productionに近づける場合は、次の方式を検討する。

```text
organizer commits hash(secretSalt) before entries close
future Ethereum block value becomes available after entries close
organizer reveals secretSalt
finalSeed = hash(secretSalt, committedBlockValue, generatorVersion)
```

運営者がEntryを見て有利なFinal Packを選ぶことと、参加者がFinal Seedを先に知ることの両方を難しくする。

## 13. ReplayとEvidence

LLM推論そのものは決定論的でなくてよい。確定済みTranscriptからのSimulator Replayは完全に決定論的でなければならない。

Transcriptには次を記録する。

- Commanderがその時点までに見たObservation
- Commanderが選んだAction
- Service Orderと価格
- reserve、release、refundを含むPayment Event
- Service Evidence Receiptとhash
- ゲーム内clock
- Action前後の公開Protocol State
- 非公開State TransitionのEvaluator Evidence
- Patch ArtifactとVerification結果
- Episode終了理由
- 最終Outcome

Hash chainは次を基本とする。

```text
generatorVersion + episodeDefinition
  -> episodeHash

Commander Artifact + Runtime Context
  -> commanderHash

ordered Observation + Order + Receipt + Action + Transition
  -> transcriptHash

episodeHash + commanderHash + transcriptHash + outcomes
  -> resultHash

Final results + Value Pool allocations
  -> allocationRoot
```

Timestampはゲーム内clockだけをCanonical Resultへ含める。表示用の実時間、API request ID、生成日時はResult Hashへ入れない。

## 14. Correctness Gateと判断結果

Correctness GateはAgentの判断の良し悪しではなく、Competition Contractを守ったかを判定する。

### Hard Constraint候補

- ActionとService OrderがSchemaに合う。
- Rescue Creditsを超過しない。
- Commanderに許可されたProtocol Actionだけを使う。
- 存在しないService、Patch、Receiptを参照しない。
- Turn、Action、Service Call、Token、Timeout上限を守る。
- Future ObservationやHidden Stateを参照しない。
- Patchは購入済みArtifactだけを適用する。
- Transcriptが順番どおりで欠落していない。

False PositiveでPauseした、重大Incidentで待ちすぎた、誤Patchを適用した、といった判断ミスは失格にしない。User Loss、Availability、SpendのOutcomeとして残す。

## 15. 独立Outcome

MVPの候補は次の3軸とする。

| Outcome | 暫定定義 | 方向 |
| --- | --- | --- |
| Total user loss | Final Pack全体で発生したユーザー資産損失の合計 | 小さいほどよい |
| Served protocol demand | Final Pack全体で処理できたユーザー需要の割合 | 大きいほどよい |
| Net response spend | Service、Patch、非返金手数料へ実際に使ったRescue Credits | 小さいほどよい |

実装前に単位、上下限、丸め、Episode集約方法を固定する。実時間や文章品質をOutcomeへ入れない。

3軸をWeighted Scoreへ変換しない。全軸で同じCommanderが優れていれば、そのCommanderだけがFrontierに残ることを受け入れる。複数Winnerを作るために不自然なTradeoffを追加しない。

## 16. Value Pools

同じTranscriptとOutcome Evidenceに対し、異なるFunderが異なる公開ルールを適用する。

### User Protection Pool

- Total user lossが最小のEntryを支援する。
- Exact tieは決定論的に分割する。

### Availability Pool

- 公開されたUser Protection最低基準を満たすEntryだけを対象にする。
- その中でServed protocol demandが最大のEntryを支援する。

### Treasury Stewardship Pool

- 公開されたProtectionとAvailabilityの最低基準を満たすEntryだけを対象にする。
- その中でNet response spendが最小のEntryを支援する。

### Frontier Expansion Pool

- 3軸の独立OutcomeからParetoとexclusive contributionを計算する。
- Reward対象には公開された最低Safety資格を設定できる。
- 正のexclusive contributionを持つEntryへ比例配分する。

「何もしないため支出ゼロ」のEntryがFull Pareto表示へ残る可能性はある。Reward Poolがそれを支援するかは、Hidden WeightではなくManifestに明記した資格条件で決める。Full FrontierとReward-eligible FrontierをUI上で区別する。

## 17. Web3の役割

SimulationとAI inferenceはoff-chainでよい。Ethereumは、運営者または参加者が後から書き換えたくなる境界に使う。

### Phase A — Game Ledger

- Rescue Creditsをoff-chainで管理する。
- Service Orderごとにreserve、release、refundを記録する。
- Receipt HashをTranscriptへ含める。
- `paid`ではなく`simulated payment`または`game credits spent`と表示する。

### Phase B — Commitment

- Challenge Manifest
- Final SeedまたはFinal Pack commitment
- Generator version
- Service Catalog hash
- Transcript root
- Allocation root

をEthereumへCommitできるようにする。

### Phase C — Sepolia Service Escrow

まず1つのShowcase Episodeだけで実際のAgent-to-Agent支払いを行う。

```text
Commander wallet
  -> EscrowへService代金をreserve
  -> Service Agentがdeliverable hashを提出
  -> RunnerまたはPolicyが受領条件を確認
  -> Service Agent walletへrelease
```

Chainのconfirmation時間やGas価格はゲームOutcomeへ入れない。Game State上の価格と時間はCommitted Contextの固定値を使い、Chain Transactionは支払いEvidenceとして分離する。

### 「AI paid another AI」と言える条件

次をすべて確認できる場合だけ使用する。

1. Commanderが実際に稼働したAI Agentである。
2. Service deliverableが識別可能な別Agentから生成された。
3. Commanderの支払い判断が人間の注文操作なしに行われた。
4. CommanderとService Providerのwalletが区別されている。
5. EscrowまたはPayment TransactionがSepolia上に存在する。
6. Paymentがdeliverable hashと結び付いている。
7. Transaction、Receipt、Event、Balanceを公開Evidenceから確認できる。

### Phase D — 将来のService Market

- Service Agent identityとcapability registry
- ENSなどによるDiscovery
- Providerごとのwallet
- Reputationと過去のCalibration
- Dispute、Timeout、Refund
- 複数Runner Attestation

は、Curated Marketが成立した後に追加する。

## 18. 既存コードから再利用するもの

| 既存領域 | Rescue Roomでの再利用 |
| --- | --- |
| `packages/shared` | Challenge Manifest、Context、metric direction、Pareto、最大6軸Hypervolume、Contribution、Canonical Hash |
| `packages/disaster-response` | 決定論的Scenario、複数Scenario集約、Replay Trace、説明用derivativeの分離 |
| `apps/api/src/plan6-competition.ts` | Participant、Revision、Final Entry、Value Pool、完全なField再計算、Allocation Evidence |
| `apps/web/src/lib/plan6-store.ts` | Redisを使うdurable participant stateとnamespace分離のPattern |
| `apps/runner` | Context一致確認、Job実行、Attestation boundary |
| `apps/web/src/lib/arenas.ts` | Arena RegistryとPractice lifecycle |
| `apps/web/src/lib/arena-adapters.tsx` | Rescue Room固有Workbenchへのfail-closed adapter |
| `FrontierRewardPool` | Final Allocation commitment、distribution、claim fallback |
| `FrontierDemoToken` | 金銭価値を主張しないSepolia Demo TokenのPattern |
| OpenAPIとStarter Kit | HumanとAgentが同じContractを読む公開入口 |

既存ParetoとSettlementは再利用できるが、Rescue Room Simulator、multi-turn Commander実行、Service Receipt、Escrow Stateは新しいArena Adapterとして実装する。

## 19. 追加予定の主なファイル

正確な配置はPhase 0で既存Package構成を再確認してから決める。初期候補は次である。

```text
packages/rescue-room/
  src/
    protocol-state.ts
    episode-schema.ts
    scenario-generator.ts
    observations.ts
    actions.ts
    services.ts
    transition.ts
    transcript.ts
    evaluator.ts
    baselines.ts
    evidence.ts
  test/

apps/runner/src/
  rescue-room-runner.ts
  commander-adapter.ts

apps/web/src/components/
  rescue-room-workbench.tsx
  rescue-room-replay.tsx

apps/web/src/app/v1/rescue-room/
  route.ts
  evaluations/route.ts

Docs/arenas/rescue-room.md
benchmarks/rescue-room/
```

Phase 1以降は既存Competition API、Store、Starter Kit、Settlementを一般化して再利用する。最初からPlan 6実装を全面的に抽象化しない。

## 20. 最小MVP

Phase 0が`GO`になった場合の最小MVP候補は次である。

- 架空Protocol 1つ
- Incident family 6種類前後
- Curated Service Agent 5〜6体
- Episode開始予算100 Rescue Credits
- 1 Episodeあたり最大10〜12 decisions
- 60分前後の仮想Incident horizon
- Unlimitedに近いPractice Generator
- 複数の固定Instant Final Episodes
- 1つのReference Commander Runtime
- 参加者が編集できるCommander Playbook
- Manual tutorialはPractice専用
- Always PauseなどのBaseline
- 完全なAction、Payment、Evidence、State Replay
- 3つの独立Outcome
- 4つのPractice Value Pool
- Revision Historyと1つのFinal Entry

MVPへ含めないもの:

- 実際のSepolia Service Payment
- Open Service Marketplace
- 任意のService Agent登録
- 任意コードや任意Patchの実行
- Scheduled Hidden Final
- Production participant uniqueness
- Multi-runner consensus
- DisputeとSlashing
- Mainnet Tokenまたは金銭価値の主張

## 21. Phase 0 — Arena成立性のSimulation

### 目的

UI、LLM、Ethereumを作る前に、情報購入と介入判断が非自明で、複数の独立Outcomeを持つゲームとして成立するかを確認する。

### 最初に実装するもの

- [x] 最小Protocol State Machine
- [x] Seed付きScenario Generator
- [x] Observation生成
- [x] Service Catalogと決定論的Evidence Receipt
- [x] Game ClockとService delivery queue
- [x] Pause、Wait、Patch、ResumeのState Transition
- [x] Budget Ledger
- [x] TranscriptとReplay
- [x] 3つのOutcome集約
- [x] Context、Episode、Transcript、Result Hash
- [x] Baseline Policy
- [x] 大量Simulation Runner

### Baseline

最低限、次を比較する。

- Always Pause
- Never Pause
- Monitor First
- Audit Everything
- Cheapest Service Only
- Spend Everything
- Patch Immediately
- Simple Adaptive Policy
- Hidden Stateを知るOracle Policy
- Seed付きRandom Policy

### 調べること

- どの固定PolicyがどのIncidentで失敗するか。
- 同じ初期Observationから異なる正しいActionが必要になるか。
- Service Evidenceによって最適Actionが変わるか。
- 情報購入が有効なEpisodeと無駄なEpisodeが両方あるか。
- Price、delivery time、accuracyの違いがProvider選択を変えるか。
- 全面Pause、何もしない、全Service購入が支配しないか。
- User Loss、Availability、Spendがほぼ同じ順位になっていないか。
- Episode Packを変えたときFrontierが極端に反転しないか。
- Practiceで学習したAdaptive Policyが未知Seedへ一般化するか。

測定前に、Baseline数、Simulation Seed、Episode数、意味のある差、Frontier安定性の数値基準を固定する。

### GO条件

次をすべて満たした場合だけPlayable MVPへ進む。

1. 同じContext、Episode、Action Transcriptから同じFinal State、Outcome、Hashを再現できる。
2. Always Pause、Never Pause、Always Auditなどの固定Policyが全Outcomeを支配しない。
3. 意味の異なる複数PolicyがPareto Frontierへ残る。
4. Simple Adaptive Policyが、少なくとも主要な固定Policyより未知Episodeで有用な改善を示す。
5. Service購入が有効な場合と不利な場合の両方がある。
6. 最適なServiceまたは最初のActionがIncident条件によって変わる。
7. User Loss、Availability、Spendが独立したTradeoffとして機能する。
8. Final PackのSampleを変えても、Arena成立性の結論が大きく反転しない。
9. Agent-visible inputからSeed、Hidden Incident、将来Eventが漏れていない。
10. 1 Entryを複数Episodeで評価するCompute Costが公開運用可能な範囲に収まる。

### PIVOT条件

次の場合はScenario、Action、Service、Outcomeを変更して再検証する。

- 即時Pause、何もしない、常にAuditなどが支配する。
- Serviceを多く買うほど単調に良くなる。
- Service間の違いが価格だけで、Capability選択に意味がない。
- Patchが原因に関係なく常に成功または常に危険になる。
- 3軸がほぼ同じ順位になり、独立価値にならない。
- Episode Packの偶然でFrontierが大きく変わる。
- Action Spaceが小さく、全探索Lookupだけで未知Finalも攻略できる。

### STOP条件

次の場合はRescue RoomのCompetition化を中止する。

- 恣意的なRandom罰則なしでは固定戦略を防げない。
- 情報購入に一貫したValue of Informationを作れない。
- Adaptive Policyが単純な固定Policyに対して意味のある差を作れない。
- 再現可能なState Transitionと公平なAgent比較を両立できない。
- 評価費用または実行時間がTournamentとして現実的でない。

STOPしても、Incident ReplayまたはAgent-to-Agent PaymentのReference Demoとして価値があるかは別に判断する。

### Phase 0判定 — GO（Evaluator v1再測定）

2026-09-10に固定Seed `phase0-v0-{0..1999}`、2,000 Episode、10 Baseline Policy、400 Episodeずつの5 Packで検証し、`GO`と判定した。その後、同じService・対象のEvidence品質がCommanderの購入順に依存しないようEvaluatorをv1へ修正した。UX GateではFalse Positiveの内部Safe状態がPublic Viewへ漏れないようEvaluator v2へ更新し、全件を再測定した。実行時間は62,690 msで、事前の運用上限120,000 msを下回った。

| 判定材料 | 結果 |
| --- | ---: |
| Replay deterministic | PASS |
| 固定Policyによる全軸支配 | なし |
| Full Frontier | 7 Policy |
| Adaptive Policy | Frontierに残存 |
| Serviceが有効なEpisode | 1,315 |
| Serviceが不利なEpisode | 596 |
| Incident依存のfirst action | 3種類 |
| Incident family | 7 / 7 |
| 5 PackのFrontier | 共通7 Policy、1 Packのみ`monitor-first`も追加 |
| Correct Baseline | 10 / 10 |

Seeded Randomも低支出というTradeoffでFull Frontierへ残った。これはPareto membershipを品質やReward資格と同一視できないことを示すため、結果から除外しない。Value Pool側で公開されたSafety・Availability資格を適用し、Full FrontierとReward-eligible resultを分離する。

Raw Evidenceは[`../benchmarks/rescue-room/results/latest.json`](../benchmarks/rescue-room/results/latest.json)に保存した。Evaluator v2のEvidence Hashは`0xa5da26f534ff1345a3139f2579edafc4ea8dd40c7b3abc5c16650be8977bceb3`である。

## 22. Phase 1 — Playable Practice Arena

Phase 0が`GO`の場合だけ開始する。

- [x] Rescue Room PackageとEvaluatorを完成させる
- [x] 参加者Playbookまたは逐次Actionを受け付けるCommander Action APIを追加する
- [x] Curated Service Catalogを公開する
- [x] Game Credit LedgerとPayment Receiptを実装する
- [x] Reference Commanderを1体以上動かす
- [x] ServiceありとServiceなしのCommanderを比較する
- [x] Incident Room UIを追加する
- [x] Budget、Clock、Protocol State、Evidence Inboxを表示する
- [x] Agent-to-Agent purchaseをReplayする
- [x] 3つのOutcomeを独立表示する
- [x] Practice Paretoと4つのValue Poolを追加する
- [x] ContextとResult EvidenceをDownload可能にする
- [x] MobileとDesktopでReplayを確認する
- [x] Game CreditsとPaymentの表示を明確に分ける

`POST /v1/rescue-room/evaluations`はReference Commander用、`POST /v1/rescue-room/commander-evaluations`は参加者Playbookを固定Runtimeで実行するAI Commander用である。後者は1 EpisodeのControlled Practiceであり、Reward Entryではない。

この段階では`Practice`、`simulated payment`、`off-chain evaluation`と表示する。

## 23. Phase 2 — Controlled AI-assisted Competition

- [x] Commander Playbook Schemaを固定する
- [x] 同一Model、Action Schema、Token、Turn、Timeout Limitを固定する
- [x] Public Training GeneratorとStarter Kitを公開する
- [ ] Revision HistoryとFinal Entryを追加する
- [ ] 複数Final Episode Packを事前Commitする
- [ ] Final中の人間介入を禁止する
- [x] 全Entryを同じService Evidence realizationで評価する
- [ ] Full Fieldを一括再計算する
- [ ] Tie、Rounding、Contribution、Allocation Testを追加する
- [x] TranscriptとReplayを公開する
- [x] Model、Prompt、構造化ActionをProvenanceとして保存する
- [x] Agent proseと試行回数をReward Signalから除外する

Scheduled Hidden Final、Participant Uniqueness、外部Agent隔離が未完成の間は、Controlled Practice Competitionと明記する。

### Phase 2 Runtime v1 実行記録

`@openai/agents 0.17.2`、model ID `gpt-5.6-luna`、reasoning effort `none`、最大12 model turn、各turn最大400 output token、各request 20秒、Episode全体90秒に固定した。各Decisionは過去のLLM会話を引き継がず、現在のPublic Stateだけから1つの構造化Actionを返す。Arena側がActionを適用し、次のPublic Stateを作る。これによりLLMの非決定性とEvaluatorの決定論性を分離する。

ただし、現在の`gpt-5.6-luna`は日付付きSnapshotではない。Controlled Practiceでは同じmodel IDと実行条件をEvidenceへ残すが、Hidden Finalを正式競技として開く前に、日付付きSnapshotへ固定するか、Providerが返す解決済みModel Versionを事前Commitして全Entryを同じ短い評価Windowで実行する必要がある。これはPhase 2の未完了Gateである。

2026-09-10のEvaluator v2実API Smokeでは、1 Episodeを10 requests、16,317 total tokens、21,771 msで完了した。OutcomeはUser Loss 0 USD、Demand Served 100%、Response Spend 63 RCで、4つのService Agentを自律購入し、Action replayが同じResult Hashへ一致した。Raw Evidenceは[`../benchmarks/rescue-room/results/ai-smoke-latest.json`](../benchmarks/rescue-room/results/ai-smoke-latest.json)に保存した。この単発結果はArena品質やFinal performanceの証明ではなく、実AI経路、支出判断、Provenance、Replay境界の疎通証拠である。

### Phase 2 UX Gate — Incident Experience Reconstruction

**状態:** 2026-09-10にEmergency Supplyとの比較監査を完了。選択案2「Incident Storyboard」のP0中心実装と自動UI検証を完了し、Reference / AI比較と初見5人テストが残る。

監査時点のControlled Practiceは技術的には動作していたが、画面はIncident ResponseゲームよりEvaluatorの技術デモに近かった。Emergency Supplyの、最初の一枚でゲーム世界が分かるIllustrationと、Simulation後に「なぜこの数値になったか」を説明する因果表示を基準に再構成した。現在はProtocol、Commander、Service Agent、Payment、Evidence、Action、OutcomeをIncident Storyboard、Live Stage、Outcome説明で接続している。

このUX Gateが完了するまで、Revision History、Hidden Final、Sepolia Paymentの実装を優先しない。

#### UXの中心ループ

画面全体を次の一つの流れとして理解できるようにする。

```text
Alert
  → Commanderが限られたPublic Evidenceを読む
  → Service Agentを雇いRescue Creditsをreserveする
  → Game Timeが進みEvidenceが届く
  → Pause / Patch / Resume / Waitを判断する
  → Protocol StateとUser Loss / Availability / Spendが変化する
  → 同じOutcome Evidenceを複数Value Poolが別々に評価する
```

#### P0 — 次に実装するUX

- [x] Rescue Room版`Whole game in one picture`をHero直下へ追加する
  - 架空Ethereum ProtocolのModuleを見せる
  - Commander、Service Agents、Payment、Evidenceの方向を見せる
  - Pause、Patch、Resumeが3つのOutcomeへ影響することを見せる
- [x] `Alert → Hire → Evidence → Action → Outcome`を3〜5 Stepで説明する
- [x] Service Market単体を先に並べず、Alertと同じIncident文脈へ統合する
- [x] Alertと最初のPractice CTAをDesktopの初期Viewportまたは1 Scroll以内に置く
- [x] Mobileでは6枚のService Cardより先にAlertとPractice CTAを置く
- [x] Protocol Map中心のLive Incident Stageを作る
  - withdrawals、borrowing、oracle、liquidations、governance、bridgeを表示する
  - Risk、Serving、Restricted、PatchedをModuleごとに表示する
  - Current Game Time、Available / Reserved / Paid budgetを常時表示する
  - Active Service Job、Delivery ETA、Payment stateを表示する
  - CommanderからServiceへのPaymentと、ServiceからCommanderへのEvidenceを視覚的に結ぶ
  - Pause、Patch、Resumeの対象Moduleを強調する
- [x] Timelineを最新Eventへ自動追従させる
- [x] SimulationにPause、Step、Speed、Skip to resultを追加する
- [x] 各EventでUser Loss、Demand Served、Budgetの変化量を表示する
- [x] 結果画面へ`WHY THESE NUMBERS`を追加する
  - 各Outcomeを決めたActionとState Transitionを示す
  - Response SpendのService別内訳を示す
  - User Lossを防いだActionとAvailabilityを失ったActionを示す
- [x] 結果画面へ`WHAT WENT RIGHT / WHAT WAS WASTEFUL / NEXT MOVES`を追加する
- [x] Default Episodeの物語整合性を修正する
  - Evidence 0件で`Incident state resolved`と表示しない
  - Service Agentの誤判定を`uncertain`、`incorrect`、confidence付きで説明する
  - `False positive`と`compromised-key`の差を結果で説明する
  - Pause対象、Patch対象、Affected Moduleの関係を説明する
- [x] 35-Episode集計の`Dominated / Frontier`を実行前の答えとして見せず、比較結果へ移す

#### P1 — AI Competitionとして必要なUX

- [x] `Cautious / Evidence-first / Availability-first`のPlaybook Presetを用意する
- [x] 初回はBasic設定だけを表示し、Prompt、Action権限、価格上限はAdvancedへ分離する
- [x] 各Presetが重視するValue、典型Action、想定Tradeoffを表示する
- [ ] Reference CommanderとAI Commanderを同じEpisodeで比較できるようにする
- [ ] Revision間で変更したPlaybook、Action列、Outcome差分を表示する
- [ ] AIへ渡されたPublic ViewをDecisionごとに確認できるようにする
- [ ] Chain of Thoughtを表示せず、Observation、Action、Reason Code、Confidenceだけを表示する
- [ ] Current Runが各Value Poolの資格条件を満たすかPractice表示する（各Poolが読む現在値までは表示済み。35-Episode集計に基づく資格判定は未実装）
- [ ] 同じEvidenceからPoolごとに異なるAllocationになる流れを図示する

#### P2 — Competition化後のUX

- [ ] Practice、Revision、Final Entry、Hidden Final、RewardのLifecycleを表示する
- [ ] Sepolia導入後にEscrow reserve、deliver、release、refundの実Transactionを表示する
- [ ] Service AgentごとのCalibration、過去精度、Delivery履歴を表示する
- [ ] Open Service Market導入時にProvider比較と選択理由を表示する

#### UX Gateの合格条件

次をすべて満たすまで、Rescue RoomをPlayable MVPとは呼ばない。

1. 初見ユーザー5人中4人以上が10秒以内に「AI Commanderが有料ServiceからEvidenceを買い、Protocol操作を判断するゲーム」と説明できる。
2. 初見ユーザー5人中4人以上が説明なしで60秒以内に最初のPracticeを開始できる。
3. 1枚の視覚表現だけでProtocol、Commander、Service、Payment、Evidence、Outcomeの関係を追える。
4. Simulation中に現在のGame Time、Protocol State、雇用中Service、支払い、最新Evidence、最新Actionを同時に確認できる。
5. 各Outcomeについて、どのEventがその値を作ったかを画面から追跡できる。
6. False Positive、Service誤判定、無駄な支出が意図したゲーム結果として理解でき、表示矛盾に見えない。
7. ReferenceとAIの違い、およびPlaybookを編集すると何が変わるかを説明できる。
8. Current RunとValue Poolの関係を、Weighted Scoreなしで説明できる。
9. Desktop 1440×900とMobile 390×844で主要操作に横Overflow、固定Headerによる遮蔽、読めない文字がない。
10. Keyboard操作、Focus表示、`prefers-reduced-motion`、Timeline読み上げ量を確認する。
11. Console Errorがなく、Action ReplayとResult HashがUX変更前後で一致する。

#### UX実装順序

1. Public StateとHidden Stateの表示語彙を整理し、Default Episodeの矛盾を解消する。
2. Whole game Illustrationを作り、Heroと短いGame Loopを再構成する。
3. Protocol MapとLive Incident Stageを実装する。
4. Timelineの再生Controlと自動追従を実装する。
5. Outcomeの因果説明と次の改善案を実装する。
6. Playbook Preset、Basic / Advanced、Reference比較を実装する。
7. Current RunとValue Poolを接続する。
8. Desktop、Mobile、Keyboard、Reduced Motion、Screen Readerを検証する。
9. 5人の初見テストでUX Gateを判定し、Evidenceを保存する。

監査Screenshotと詳細な指摘は[`../artifacts/ux-audit-rescue-room/AUDIT.md`](../artifacts/ux-audit-rescue-room/AUDIT.md)に保存した。

#### Incident Storyboard実装記録

選択案2を基準に、専用Hero、1クリックSample、4-Step Game Loop、Protocol Module State、Active Service Job、Budget、Timeline自動追従、Pause / Step / 2× / Skip、Service confidence、Outcome因果説明、Service別Spend、次のPlaybook改善導線を実装した。`Cautious / Evidence first / Availability first`はBasic Presetとし、Prompt、権限、価格上限をAdvancedへ分離した。

False Positiveは内部的に開始時からSafeでも、CommanderのPublic Viewと途中のState TransitionではResponseがCloseされるまで`incidentResolved=false`とするEvaluator v2へ更新した。これにより初期AlertだけでTrue Stateを識別できない。変更後の2,000 Episode再測定も`GO`であり、Evidence Hashは上記Phase 0記録と[`../benchmarks/rescue-room/results/latest.json`](../benchmarks/rescue-room/results/latest.json)へ保存した。

Desktop 1440×1000とMobile 390×844では、主要Run、Replay、Evidence download、AI Editor、Result Revealを自動操作し、横Overflowなし、Console Errorなしを確認した。最終Heroは[`../artifacts/ux-audit-rescue-room/23-rescue-storyboard-desktop-final.png`](../artifacts/ux-audit-rescue-room/23-rescue-storyboard-desktop-final.png)、Mobileは[`../artifacts/ux-audit-rescue-room/24-rescue-storyboard-mobile-final.png`](../artifacts/ux-audit-rescue-room/24-rescue-storyboard-mobile-final.png)、Live Stageは[`../artifacts/ux-audit-rescue-room/27-rescue-live-stage-restarted.png`](../artifacts/ux-audit-rescue-room/27-rescue-live-stage-restarted.png)に保存した。初見5人テストは未実施であり、UX Gate全体はまだ通過扱いにしない。

### Phase 2 Strategy Game UX Revision — Commander Doctrine

**状態:** 2026-09-10にPass AとPass B0/B1を実装済み。構造化Doctrine Schema、決定論的Interpreter、Basic / Prompt / Artifact Studioが動作する。Revision差分とIncident Shiftは未実装。

#### 現状の問題

Incident Storyboardによって世界観とGame Loopの説明は改善したが、Practice本体はまだ「Alertと既製Policyを選び、`Run Reference Commander`を押すとTimeline Logが流れる」体験に見える。特に次が不足している。

1. 実行前に、プレイヤーがどのTradeoffを選んだのか分からない。
2. `Reference policy`が主役に見え、ユーザー自身のCommanderを作った感覚が弱い。
3. TimelineはAction、Payment、Evidenceを記録しているが、「なぜ今そのActionを選び、何を支払い、Stateがどう変わったか」を一つの因果として読めない。
4. Outcomeは独立3軸と因果を表示しているが、同一Incidentの他戦略や前回Runと比較できず、次に何を変えるべきか判断しにくい。
5. Service MarketがPractice Controlより後にあるため、実行前の戦略材料ではなく説明資料に見える。
6. 現在のCTAはSimulationを開始するだけで、StrategyをCommitする緊張と、結果を予想する楽しさがない。

面白さは派手なAnimationやRandom Rewardではなく、次の循環から作る。

```text
予想する
  → Commanderの判断原則を選ぶ
  → 未知のIncidentへ固定して投入する
  → AIが自律的にServiceを購入しProtocolを操作する
  → 予想外のEvidenceと結果を見る
  → Baselineと比較し、一つの判断原則を変更する
  → 再挑戦する
```

#### プレイヤーの役割

プレイヤーをIncident中の手動Operatorにはしない。プレイヤーはProtocol GovernanceまたはCommander Designerとして、Incident前にAI CommanderのMandateと支出権限を設計する。

Simulation中にユーザー自身がService購入、Pause、Patchを逐次クリックすると、「AI Agentが限られた情報から自律判断し、他のAI Agentを雇う」というArenaの中心が失われる。そのため、プレイヤーのAgencyは実行前のDoctrine設計と、実行後の比較・改訂に置く。

#### 新しい中心ループ

```text
1. BRIEFING
   Public Alertと不明点を読む

2. BUILD DOCTRINE
   Commanderの予算、Evidence条件、Pause権限、Service優先度を決める

3. LOCK & DEPLOY
   同じDoctrineを未知のIncidentへ固定して投入する

4. WATCH DECISIONS
   Commander、Service、Evidence、Protocolの因果を追う

5. DEBRIEF
   同一IncidentのBaselineと独立3軸で比較する

6. CHANGE ONE RULE
   一つだけDoctrineを変更し、再挑戦する
```

`Reference Commander`はプレイヤーの主CTAから外し、Tutorial、Baseline、Counterfactual比較として使う。主CTAは`作戦を固定してIncidentを開始`に変更する。

#### Commander DoctrineのBasic設定

初回ユーザーには自由文Promptを直接見せず、次の構造化された判断原則だけを見せる。

| 設定 | 選択例 | 戦略上の意味 |
| --- | --- | --- |
| Investigation Budget | 20 / 50 / 80 RC | 情報へどこまで支払うか |
| Evidence Rule | 1件で動く / 2件一致を待つ / 緊急時は省略 | 誤検知と対応遅延のTradeoff |
| Pause Authority | 禁止 / Moduleのみ / Protocol全体 | User ProtectionとAvailabilityのTradeoff |
| Service Priority | 速度 / 精度 / 価格 | どのService Agentを先に雇うか |
| Patch Safety | 直接適用 / 検証必須 | 復旧速度と誤Patch RiskのTradeoff |

開始Presetは次の3つとする。

- `Evidence First`: 複数Evidenceを集めてから介入する。
- `User Guardian`: 疑わしい場合は早く止め、User Lossを抑える。
- `Keep It Running`: 全停止を避け、安価で速い調査を優先する。

Preset選択後は、現在の設定を自然文で必ず要約する。

```text
このCommanderは最大50 RCを調査へ使う。
2つのEvidenceが一致するまでPauseしない。
Pauseは対象Moduleだけに限定し、Patch適用前には検証を要求する。
```

Advancedでは現在のAI Playbook instructions、Service Agent許可、Protocol Action許可、Service単価上限を残す。Basic設定とAdvanced設定は同じCommander Artifactへ正規化し、画面だけの飾りにしない。

#### Service Marketの配置

Service Marketを実行後の説明Sectionだけに置かず、Doctrine Builderの横または展開Panelに置く。各Service Agentには、実行前に比較できる情報だけを表示する。

- Price
- Delivery time
- 対象Task
- Calibrationされた精度またはConfidence範囲
- 典型的な弱点
- Commanderが現在そのServiceを購入可能か

ユーザー自身がServiceを購入するUIにはしない。「このCommanderへ誰を雇う権限を与えるか」を設定するUIにする。

#### Live Incidentの表示

Raw TranscriptはEvidenceとして保持するが、中心表示からは一段下げ、折りたたみ可能にする。中心は次の4 Laneで構成する。

```text
PROTOCOL        現在のModule状態とPublic Signal
COMMANDER       Observation、発火したRule、選択Action
SERVICE AGENTS  注文、Reserved Budget、ETA、Receipt
EVIDENCE        新しいFinding、Confidence、矛盾
```

各Decisionは単なるLog行ではなく、次の因果Cardで表示する。

```text
T+00  Accounting Auditを雇った

Trigger        Withdrawalと新規Addressを検知
Rule           Evidenceを得るまでPauseしない
Cost / Time    18 RCをreserve、ETA 7分
State change   Available 100 → 82 RC、Evidence 0 → 調査中
Alternatives   即Pause / Pulse Monitor / Close Incident
```

Chain of Thoughtは表示しない。`Observation / matched rule or reason code / Action / Cost / State delta / available alternatives`だけを、Replay可能なEvidenceから作る。True Stateの確率や将来Outcomeを途中表示して、Hidden Stateを漏らしてはならない。

#### Debriefと比較

単独の絶対値だけで終わらせず、同一Episode・同一Contextで少なくとも次を比較する。

- Your Commander
- Always Pause
- Never Pause
- Previous Revision（存在する場合）

比較はWeighted ScoreやRadar chartの面積へ統合しない。3 Outcomeを独立した列または小さなAxisとして表示する。

```text
                   User Loss   Availability   Spend
Your Commander            0          73.2%    46 RC
Always Pause              0          41.0%     0 RC
Never Pause          18,400         100.0%     0 RC
```

その下に、値を統合しない自然文のTradeoff説明を出す。

```text
User Lossは防いだ。
Always Pauseより多くProtocolを稼働させるため、46 RCを使った。
Never PauseよりAvailabilityは低いが、User Lossを回避した。
```

`Dominated in pack`だけを単独表示しない。比較対象、支配された軸、Frontierへ近づくために変更できるDoctrine Ruleを示す。ただし「正解の設定」は教えない。

結果画面の主CTAはEvidence Downloadではなく、`一つのRuleを変更して再挑戦`とする。Evidence DownloadはSecondary Actionへ移す。

#### PracticeからCompetitionへの接続

単一Episodeの最適化だけで終わらせないため、Practiceの最終段階に`Incident Shift`を追加する。

- 1つのCommander Doctrineを5つの未知Episodeへ固定する。
- Episodeごとに初期Budgetは同じにし、最初はEvaluatorの意味を変える共有Budgetを導入しない。
- Shift中はDoctrineを変更できない。
- 各Episode終了後のTrue State Revealは、Shift全体終了まで遅延する方式も比較検討する。
- 5 EpisodeのUser Loss、Availability、Spendを独立集計する。
- Reference BaselineとPareto関係を表示する。

これにより、見えているAlertごとの手動攻略ではなく、未知環境へ一般化するCommanderを作る競技であることを体験させる。

#### 実装境界

最初の改善ではEvaluatorのOutcome、Service Evidence、Payment、Hashを変更しない。既存の8 Reference Policy、35 Public Episode、Transcript、Outcome説明を再利用し、UIの戦略ループを先に成立させる。

**Pass A — 既存Evaluatorだけで実装する。**

1. [x] Policy selectを3つのDoctrine CardとTradeoff説明へ置き換える。
2. [x] Service Marketの比較情報を実行前へ移す。
3. [x] 開始前にDoctrine SummaryとLock状態を表示する。
4. [x] TranscriptからDecision因果Cardを作り、Raw LogをSecondaryへ移す。
5. [x] 同一EpisodeでYour Commander / Always Pause / Never Pauseを比較する。
6. [x] `一つのRuleを変更して再挑戦`をPrimary CTAにする。

実装のSource Visual Truthは[`../artifacts/ux-audit-rescue-room/34-strategy-game-selected.png`](../artifacts/ux-audit-rescue-room/34-strategy-game-selected.png)へ固定した。実装後のHero、Doctrine Builder、Live Decision、Debriefはそれぞれ[`35-strategy-game-desktop-hero.png`](../artifacts/ux-audit-rescue-room/35-strategy-game-desktop-hero.png)、[`36-strategy-game-desktop-builder.png`](../artifacts/ux-audit-rescue-room/36-strategy-game-desktop-builder.png)、[`37-strategy-game-desktop-live.png`](../artifacts/ux-audit-rescue-room/37-strategy-game-desktop-live.png)、[`38-strategy-game-desktop-result.png`](../artifacts/ux-audit-rescue-room/38-strategy-game-desktop-result.png)へ保存した。Mobile BuilderとDebriefは[`39-strategy-game-mobile-builder.png`](../artifacts/ux-audit-rescue-room/39-strategy-game-mobile-builder.png)と[`40-strategy-game-mobile-result.png`](../artifacts/ux-audit-rescue-room/40-strategy-game-mobile-result.png)で確認した。

自動UI検証は3 Doctrine、4 Live Lane、同一EpisodeのBaseline 2種、Previous Revision、Replay、Evidence Download、AI Playbook、Desktop / Mobileの横Overflow、Console Error、禁止Contrast Pairを対象にする。実AI Commanderも固定runtimeでAction Replayまで完了した。

Pass Aでは、`Evidence First / User Guardian / Keep It Running`を既存の決定論的Policyへ明示的に対応付けた。これは画面だけの架空設定ではなく、選択したDoctrineが実際のAction列、Service購入、支出、Protocol State、Outcomeを変える。通常の入口は再現可能なDoctrine Practiceとし、実OpenAI runtimeは`AI Commander`として別状態を明示することで、Scripted PolicyをAIと偽らない。

実行後は同じEpisode IDで`Always Pause`と`Never Pause`を再評価し、Your Commander、両Baseline、存在する場合はPrevious Revisionを3つの独立Outcome列で比較する。Raw Transcriptは折りたたみ可能なEvidenceへ下げ、中心表示を`Protocol / Commander / Service Agents / Evidence`の4 Laneへ変更した。Evaluator、Context Hash、Result Hashの計算は変更していない。

**Pass B — Strategy Artifactを拡張する。**

1. [x] **Pass B0:** Basic Doctrine設定を`rescue-doctrine-v0`の決定論的な構造化Schemaへする。
2. [x] **Pass B0:** AI PlaybookとBasic DoctrineをService権限、Protocol Action権限、Service単価上限、調査総予算の同じ実行Gateへ正規化する。
3. [x] **Pass B0:** Public Viewだけを読む決定論的Interpreterを実装し、各Actionへ`reasonCode`、Public View Hash、受理結果を記録する。
4. [x] **Pass B1:** `Basic / Prompt / Artifact`のStrategy Studioを追加し、設定、Prompt、正規化JSON、Artifact Hash、Runtime Versionを確認可能にする。
5. [ ] **Pass B2:** Doctrine Revision差分を永続保存し、前回RunとのRule単位の因果比較を追加する。
6. [ ] **Pass B3:** 1つのDoctrineを固定して走らせる5 EpisodeのIncident Shiftを追加する。

Pass B0/B1では任意のTypeScript / JavaScript実行を導入しない。Code ModeはSandbox、時間・Memory上限、依存関係、非決定性の扱いを定義した後、同じ`RescuePublicView → RescueAction`境界へ接続する上級者向け機能として扱う。

実装したDoctrineは、Investigation Budget、Evidence件数、Confidence Gate、Evidence不一致時の判断、Pause Authority、Service Priority、Patch Safety、予算切れ時の行動、Service許可を編集できる。設定変更は画面だけの表示ではなく、`/v1/rescue-room/doctrine-evaluations`へArtifactとして送られ、Action列とOutcomeを変える。

Pass Aの初見テストはPass B1の編集可能なStrategy Studioを含めて実施する。これが通った後にPass B2/B3へ進み、Hidden Final、Sepolia Service Payment、Open Service Marketはさらに後のGateとする。

#### Strategy Game UXの合格条件

1. 初見ユーザー5人中4人以上が、「自分はAI Commanderの作戦を決め、そのAIがService Agentを雇うゲーム」と10秒以内に説明できる。
2. 初回Runの前に、選んだDoctrineの強みと犠牲にするOutcomeを一つずつ説明できる。
3. Simulation中に、最新ActionのTrigger、Cost、Time、State deltaをLogの解読なしで説明できる。
4. Episode終了後、Your CommanderとAlways Pause / Never Pauseの違いを3 Outcomeそれぞれで比較できる。
5. Weighted Scoreなしで、自分が次に変更するDoctrine Ruleを一つ選べる。
6. AI CommanderがService購入とProtocol Actionを自律決定し、人間の途中介入に依存しない。
7. Raw Transcript、Action Replay、Result HashはUI再構成前後で一致する。
8. 同じDoctrineを複数の未知Episodeへ固定する意味をユーザーが理解できる。

#### Strategy Game UX実装順序

1. Reference PolicyをBaselineへ移し、Player Journeyの主役をCommander Doctrineにする。
2. Doctrine Card、Basic設定、Doctrine Summary、Lock CTAを作る。
3. Service Marketを実行前の判断材料として接続する。
4. Live Incidentを4 LaneとDecision因果Cardへ再構成する。
5. 同一EpisodeのBaseline比較とPrevious Revision比較を作る。
6. Rule変更から再挑戦までを一つのLoopにする。
7. 初見5人テストを実施する。
8. 合格後に構造化Doctrine SchemaとIncident Shiftを実装する。

## 24. Phase 3 — Sepolia Agent-to-Agent Payment

Game内Service購入に意味があると確認できた後だけ開始する。

§17はWeb3を使う境界を定める。本節は、そのうちToken、Wallet、Escrow、Payment Evidenceを実装できる粒度まで具体化する。目的はReward Tokenを先に発行することではなく、Commanderが自律判断で別のService Agentへ実際に支払い、第三者がその一連のEvidenceを検証できるShowcaseを成立させることである。

2026-09-11時点で、`RescueUSDDemo`、`IRescueServiceEscrow`、`RescueServiceEscrow`、Deploy Script、Contract Test、決定論的Payment Evidence、UIのPayment Journeyまで実装した。Sepolia Deploy、Wallet割当、Policy Executor、Transaction送信、実Receipt検証は未実施である。したがって現在の公開状態は引き続き`simulated`であり、`committed`または`paid`とは表示しない。

### 24.1 3つの残高とPayment状態を混同しない

| 層 | 表示名 | 実体 | 用途 | 許可する表現 |
| --- | --- | --- | --- | --- |
| Practice | Rescue Credits | Evaluator内の整数残高 | 戦略上の予算、Service価格、Outcome計算 | `simulated payment`、`game credits spent` |
| Sepolia Showcase | RescueUSD Demo | Sepolia上のDemo ERC-20 | Agent-to-Agent Escrowと実TransferのEvidence | Transaction確認後だけ`paid on Sepolia` |
| Final Reward | Frontier reward asset | `FrontierRewardPool`が扱う別資産 | Competition終了後のAllocationとReward | Settlement Evidence確認後だけ`reward paid` |

`RescueUSD Demo`は作業名とし、Contract symbolは`rUSD-DEMO`を候補とする。USD peg、償還、価格、利回り、Mainnet価値を一切主張しない。UIでは必ず`Sepolia demo token · no monetary value`を併記する。Practiceの100 Rescue CreditsをToken Balanceと表示せず、Sepolia BalanceをGame Outcomeへ加算しない。

Tokenは既存`FrontierDemoToken`の最小Patternを再利用し、Phase 3では次に限定する。

- SepoliaだけにDeployする。
- 1 Tokenを1 Rescue Credit相当の表示単位として扱うが、法定通貨との交換価値は持たせない。
- CommanderへEpisode開始前に固定額だけFundingする。
- 無制限Approveを使わず、Episode Budget以上をEscrowへ移せない。
- Mint権限、Deployer、Commander、Service Agent、EscrowのAddressをEvidenceへ記録する。
- Mainnet Deploy、Public Sale、Liquidity Pool、Bridge、外部価格OracleはPhase 3の対象外とする。

### 24.2 Paymentの主体と権限

```text
Sponsor / Faucet
  -> Commander WalletへEpisode Budgetをfund

Commander AI
  -> Public ViewからBUY_SERVICEを自律選択

Policy Executor
  -> AIへ秘密鍵を渡さず、許可済みActionだけを署名・送信

RescueServiceEscrow
  -> OrderごとにrUSD-DEMOをreserve

Service Agent Wallet
  -> Deliverable提出後にrUSD-DEMOを受領
```

MVPでは、AI Model自身へ秘密鍵や任意Transaction権限を与えない。AIが出力した構造化`BUY_SERVICE`を既存Action Gateへ通し、その後にPolicy ExecutorがTransactionを作る。Policy Executorには次の制約を設ける。

- 許可されたEscrow Contract以外を呼べない。
- Curated Service AgentのAllowlist外へ送金できない。
- 1 Order上限、Episode総額上限、Nonce、Deadlineを強制する。
- 任意Calldata、任意Token、Token Approval先をAI出力から受け取らない。
- Wallet Private Key、Session Key、RPC CredentialをPrompt、Transcript、Download Evidenceへ含めない。

最初のShowcaseはPolicy Executorが管理する専用Commander Walletでよい。ただしUIとEvidenceでは`policy-controlled demo wallet`と明示する。次の段階ではSmart Account Session Keyを使い、Service Allowlist、1回の上限、総予算、期限をOnchainまたはAccount Policyで制限する。

### 24.3 Escrow Contractと状態遷移

仮称`RescueServiceEscrow`は次の状態遷移だけを持つ。

```text
NONE
  -> FUNDED
       -> DELIVERED
            -> RELEASED
            -> REFUNDED
       -> REFUNDED
```

| 状態 | 必須Evidence | 実行主体 |
| --- | --- | --- |
| `FUNDED` | Order ID、Commander、Provider、Token、Amount、Deadline、Context Hash | Commander Wallet |
| `DELIVERED` | Deliverable Hash、Receipt Hash、Service Manifest Hash | Service AgentまたはRunner |
| `RELEASED` | Acceptance Hash、Transfer Event、Provider残高差分 | 制限付きPolicy Executor |
| `REFUNDED` | Deadline経過または明示された失敗理由、Refund Event、Commander残高差分 | Commanderまたは公開Timeout処理。納品記録後もRelease前にDeadlineを超えた場合は返金可能 |

Phase 3 MVPでは自由文の品質をOnchain判定しない。既存EvaluatorがService ID、Order ID、対象Episode、Receipt Schema、Context Hashの一致を決定論的に確認し、そのAcceptance HashをEscrowへ渡す。LLMの自己申告だけでreleaseしてはならない。

Contractは最低限、次を拒否する。

- 同じOrder IDの再利用
- Episode BudgetまたはOrder上限を超えるreserve
- Allowlist外ProviderまたはToken
- Deliverableなしのrelease
- 異なるOrder、Context、ProviderのDeliverable Hash
- 二重release、release後のrefund、refund後のrelease
- Deadline前の無条件refund
- Reentrancyと任意外部Call

Dispute、Challenge Period、Slashing、可変価格、Provider登録はOpen Service Marketまで導入しない。

### 24.4 Off-chain GameとOnchain Paymentの接続

Game SimulationはChain confirmationを待たず、現在の決定論的Game Clockと固定Service価格で進める。Accepted `BUY_SERVICE`ごとに、Payment Adapterが同じOrderをSepoliaへMirrorする。

```text
1. CommanderがBUY_SERVICEを選ぶ
2. Evaluatorが権限、価格、残予算を検証する
3. Game LedgerがRescue Creditsをreserveする
4. Payment Adapterが同じOrder IDでrUSD-DEMOをEscrowへdepositする
5. Service AgentがEvidenceを返す
6. EvaluatorがReceiptとContextを検証する
7. Deliverable HashをEscrowへ記録する
8. rUSD-DEMOをService Agent Walletへreleaseする
9. Transaction、Event、Balance EvidenceをRunへ関連付ける
```

Game OutcomeのUser Loss、Availability、Response Spendは、Committed ContextにあるGame価格とGame Timeから計算する。Gas、Block Time、RPC障害、Sepolia混雑は競技Outcomeへ含めない。Chain側が失敗してもGame EvaluationとResult Hashを変更せず、Paymentだけを`failed`または`unpaid`にする。

同じService購入をGame LedgerとChainの両方へ記録するため、各Orderは少なくとも次を共有する。

- `orderId`
- `episodeContextHash`
- `commanderActionHash`
- `serviceManifestHash`
- `providerAddress`
- `amount`
- `deliverableHash`
- `receiptHash`

### 24.5 Payment Evidence Schema

Run Evidenceに`paymentEvidence`を追加し、最低限次を保存する。

```json
{
  "network": "sepolia",
  "chainId": 11155111,
  "paymentState": "released",
  "token": {
    "symbol": "rUSD-DEMO",
    "address": "0x...",
    "decimals": 6,
    "monetaryValueClaim": false
  },
  "orderId": "0x...",
  "commanderWallet": "0x...",
  "serviceAgentWallet": "0x...",
  "escrowAddress": "0x...",
  "amount": "5000000",
  "deliverableHash": "0x...",
  "receiptHash": "0x...",
  "acceptanceHash": "0x...",
  "depositTransactionHash": "0x...",
  "releaseTransactionHash": "0x...",
  "blockNumber": 0,
  "eventLogIndex": 0,
  "providerBalanceBefore": "0",
  "providerBalanceAfter": "5000000"
}
```

`paymentState`は`not-requested / submitted / funded / delivered / released / refunded / failed`のいずれかとする。UIの上位Stateは次のように扱う。

- Game Ledgerだけなら`simulated`。
- Transactionが確認され、OrderとDeliverableがHashで結ばれたら`committed`。
- Release EventとService Agentの受領残高が確認できたら`paid`。
- Transaction Hashだけ存在しReceipt確認前なら`paid`と表示しない。

### 24.6 UIで見せるPayment Journey

Incident Theatreの現在のPayment Routeをそのまま拡張する。

- Practiceでは`12 Rescue Credits reserved · simulated`と表示する。
- Sepolia Showcaseでは`5 rUSD-DEMO funded`、`deliverable submitted`、`released to Audit Agent`を状態別に表示する。
- Commander、Service Agent、Escrowの短縮Addressを表示する。
- Deposit、Deliver、Release、RefundごとにEtherscan Linkを表示する。
- Game Credit残高とWallet Token残高を別の行にする。
- Pending、Reverted、Refundedを成功色で表示しない。
- `AI chose the purchase`と`Policy Executor submitted the transaction`を分けて表示する。
- Release後だけ`AI hired another AI and paid it`のShowcase文言を許可する。

### 24.7 FailureとRecovery

- Deposit失敗: Gameは継続し、Onchain Paymentを`failed`とする。自動でpaid扱いにしない。
- Service timeout: Game Ledgerはrefundし、Onchain EscrowもDeadline後にrefundする。
- Deliverable不一致: releaseせず、Order、Receipt、Contextの不一致理由をEvidenceへ残す。
- Release Transaction失敗: 冪等な同一Order操作として再送できるが、二重払いはContractで拒否する。
- RPCまたはExplorer停止: Local Receiptを保持し、復旧後に再照合する。確認前は`submitted`のままにする。
- Chain reorg: Confirmation数を満たすまで`paid`へ昇格しない。
- Commander Run失敗: 未納品Orderをrefundし、残ったTokenと未完Orderを回収Evidenceへ含める。

### 24.8 実装順序

1. [x] `RescueUSD Demo`の名称、Symbol、Decimals、no-value表示を固定する。
2. [x] `RescueServiceEscrow` InterfaceとEvent Schemaを固定する。
3. [x] Token、Escrow、Duplicate、Overspend、Timeout、RefundのContract Testを書く。
4. [ ] SepoliaへTokenとEscrowをDeployし、Deployment Evidenceを保存する。
5. [ ] Commander、Monitoring Agent、Audit Agent、Patch Agentへ別Walletを割り当てる。
6. [ ] Policy ExecutorへService Allowlist、Order上限、Episode総予算、期限を設定する。
7. [ ] 既存Game OrderとOnchain Orderを同じIDとHashで結ぶPayment Adapterを実装する。Order、Action、Manifest、Deliverable、Receipt、Amountを照合する純粋なReconciliation層までは実装済み。署名・送信Adapterは未実装。
8. [ ] 1つのShowcase EpisodeでDeposit、Deliver、Releaseを完了する。
9. [ ] 別EpisodeでTimeout Refundを完了する。
10. [ ] Incident TheatreへWallet、Escrow State、Transaction Evidenceを追加する。Game Ledgerと未接続Sepoliaを分離するPayment Journeyまでは実装済み。
11. [ ] Transaction、Receipt、Event、Balanceを別RPCでも再検証する。
12. [ ] Evidenceが揃った後だけ`paid`表示とShowcase文言を有効にする。

### 24.9 Phase 3 GO条件

次をすべて満たした場合だけ、Sepolia Agent-to-Agent Paymentを`GO`とする。

1. AI Commanderが人間の途中操作なしにService購入を選んだ。
2. CommanderとService Agentが別Walletである。
3. Episode Budgetを超える支払いがContractとPolicy Executorの両方で拒否される。
4. Order、Action、Context、Deliverable、Receipt、PaymentがHashで一意に結ばれている。
5. Deposit、Release、Provider残高増加をSepolia Evidenceから確認できる。
6. Timeout時にCommanderへRefundされる。
7. Duplicate releaseと異なるDeliverableの差し替えがContract Testで失敗する。
8. Chain障害がGame Outcome、Transcript Hash、Result Hashを変更しない。
9. Secret、Private Key、Session Key、RPC CredentialがPromptと公開Evidenceへ含まれない。
10. UIが`simulated / committed / paid / refunded / failed`を正しく区別する。

このGO条件を満たすまでは、Payment機能をPublic CompetitionやReward Settlementへ接続しない。

### 24.10 実装Checklist

- [x] Rescue Creditsと実際のTokenを明確に分離する
- [x] Service Order、reserve、deliverable、release、refundのContractを設計する
- [ ] Commander用の制限付き支出権限を実装する
- [ ] Service Agentごとに別walletを使う
- [x] Deliverable HashとPaymentを結び付ける
- [ ] 1つのShowcase Episodeで自律購入を完了する
- [ ] Transaction、Receipt、Event、Balance Evidenceを保存する
- [ ] Transcript RootとAllocation RootをCommitする
- [ ] Final Rewardは既存`FrontierRewardPool`を再利用する
- [x] Duplicate releaseとbudget overspendをContract Testで拒否する
- [ ] Chain failure時にGame結果とPayment状態を混同しない

## 25. Phase 4 — Optional Open Service Market

Phase 3までのCurated Marketが成立した場合だけ検討する。

- Service Provider登録
- Capabilityと価格の公開Manifest
- Service Agent identityとwallet discovery
- CalibrationとDelivery履歴
- Provider間競争
- Service Agentへの独立Value Pool
- DisputeとChallenge period
- Multi-runner acceptance
- Service Agentによる再委託

このPhaseはPlan 9 MVPの完了条件に含めない。

## 26. 検証

### Deterministic Test

- 同一EpisodeとTranscriptのFinal State一致
- GeneratorとEpisode Hashの一致
- ObservationからHidden Stateが漏れない
- Action順序とGame Clock
- Service deliveryとTimeout
- Escrow reserve、release、refund
- Budget超過拒否
- Module PauseとResume
- 正しいPatch、誤Patch、未検証Patch
- False Positive
- Incident propagation
- Outcome方向と上下限
- 3軸ParetoとContribution
- 提出順に依存しないAllocation
- TieとRounding

### Agent Experiment

- 固定Policy同士の比較
- Adaptive Policyと固定Policyの比較
- Serviceあり／なしの同一Commander比較
- Practice SeedとHoldout Seedの差
- 異なるFinal PackでのFrontier安定性
- Tool Call上限とTimeout
- Free-form rationaleを除外してもOutcomeが一致すること

### UIとEvidence

- Commanderが何を見たかを時点ごとに確認できる
- Service購入、Receipt、Paymentを追える
- Protocol Stateの変化をReplayできる
- Public StateとHidden evaluator evidenceを区別する
- Practice、Final、committed、paidを区別する
- Desktop、Mobile、Console Error
- Secret、Prompt、Credential、Hidden SeedがLogへ漏れない

## 27. 文書更新

- [x] Phase 0開始時に数値付きGO／PIVOT基準を固定する
- [x] Phase 0判定をこのPlanと`Docs/STATUS.md`へ記録する
- [x] Phase 1実装時に`Docs/arenas/rescue-room.md`を追加する
- [x] Active Arenaになった時点で`Docs/PRODUCT.md`を更新する
- [x] RuntimeとTrust Boundary実装後に`Docs/ARCHITECTURE.md`を更新する
- [x] Agent、Service、Payment、Sepoliaの状態を`Docs/INTEGRATIONS.md`へ記載する
- [x] 検証済みPublic Journeyだけを`Docs/DEMO.md`へ追加する
- [ ] Public Deploy後にだけroot `README.md`を更新する
- [ ] 完了または中止後にこのPlanを`Docs/archive/plans/`へ移す

## 28. Plan 9の完了条件

次をすべて満たしたときだけRescue Room MVPを完成とする。

1. Phase 0のGO条件を満たし、そのEvidenceを保存している。
2. Commanderが限られたObservation、Budget、Game Timeから逐次Actionを選べる。
3. Service購入がActionとOutcomeへ実際に影響する。
4. 固定戦略が全Outcomeを単純に支配しない。
5. 同じEpisodeとTranscriptからFinal State、Outcome、Hashを再現できる。
6. Commanderが見た情報とHidden Stateを明確に分離している。
7. User Loss、Availability、SpendをWeighted Scoreへ統合していない。
8. Value Poolごとの資格条件とAllocation Ruleを公開している。
9. Full FieldのPareto、Contribution、Allocationが提出順に依存しない。
10. PracticeとFinal Entryを分けている。
11. AI provenanceとReward Signalを分けている。
12. Game Credits、off-chain payment、on-chain paymentをEvidenceに合わせて表示している。
13. Action、Payment、Evidence、Protocol StateをReplayできる。
14. 未完成のHidden Final、外部Agent隔離、Uniqueness、Settlement機能を明示している。
15. Phase 2 UX Gateの10秒理解、60秒開始、Live State、Outcome因果説明の条件を満たし、初見テストEvidenceを保存している。
16. UX変更後も同じAction列から同じFinal State、Outcome、Result Hashを再現できる。

Phase 0が`PIVOT`または`STOP`になった場合は、未達項目を完成扱いにせず、判断とEvidenceを記録してPlanを終了できる。

## 29. 実行順序

### 完了した成立性確認

1. [x] 架空Protocolの最小StateとModuleを決める。
2. [x] Incident GeneratorへFalse Positiveを含む7 familyを実装する。
3. [x] Pause、Wait、Service購入、Patch、Resumeを実装する。
4. [x] Always Pause、Never Pause、Always Auditを含む10 Baselineを実装する。
5. [x] 2,000 Seedを実行し、単純戦略の支配とOutcome相関を調べる。
6. [x] Service Evidenceが購入順に依存しないよう修正し、再測定する。
7. [x] `GO`後にIncident Roomと実AI Commanderを実装する。

### 現在の実行順序

1. [x] Public / Hidden Stateの表示矛盾を解消する。
2. [x] Whole game Illustrationと初見Game Loopを作る。
3. [x] Protocol Map中心のLive Incident Stageと再生Controlを作る。
4. [x] Outcome因果説明とPlaybook Presetを作る。
5. [x] Reference PolicyをBaselineへ移し、Commander DoctrineをPlayer Journeyの主役にする。
6. [x] Doctrine Card、Basic設定、Summary、Lock CTAを実装する。
7. [x] Service Marketを実行前の戦略材料として接続する。
8. [x] Live Incidentを5 ChapterのIncident TheatreとDecision因果Cardへ再構成する。
9. [x] 同一EpisodeのYour Commander / Always Pause / Never Pause比較を作る。
10. [x] `一つのRuleを変更して再挑戦`までを一つのLoopにする。
11. [x] Desktop、Mobile、Reduced Motion、Contrast、Console Errorの自動検証を完了する。
12. [ ] 初見5人テストでStrategy Game UX Gateを判定する。
13. [ ] Gate通過後にDurable Revision History、Incident Shift、Final Entryを実装する。
14. [ ] 不変なModel Versionと複数Hidden Final PackをCommitし、Full Fieldを評価する。
15. [ ] Agent-to-Agent購入がゲームとして有効だと確認した後だけSepolia Paymentへ進む。

現在は、競技基盤を広げる前に「ユーザーがRescue Roomを理解し、Simulationの因果を追い、次のPlaybook改善へ進めるか」を先に証明する。

## 30. Pass C — Incident TheatreとStrategy Legibility

**開始日:** 2026-09-11

**目的:** SimulationをRaw Logの連続ではなく、Commander、Service Agent、Payment、Evidence、Protocol Stateが動く戦略ゲームとして理解できるようにする。設定項目は内部Parameter名ではなく、「何を決めるRuleか」「上げ下げすると何を守り、何を失うか」「今回のRunでどう作用したか」を説明する。

### 30.1 現在の問題

1. Incident Storyboardは世界観を示しているが、実際のEventと十分に連動しておらず、背景画像に見える。
2. 1 EventごとにTimeline Rowを追加するため、Simulationが進むほどRaw Logを読む体験になる。
3. `Investigation Budget`、`Evidence required`、`Confidence gate`などが同じ強さで並び、初心者には数値を変えた結果が予測できない。
4. AI Model ParameterとCommanderの権限・戦略Ruleの違いが画面上で明確でない。
5. Action、Payment、Evidence、State Transitionが別々の行に分かれ、一つの判断が何を変えたかを視線だけでは追えない。

### 30.2 Incident Theatre

- [x] Raw Transcriptを初期状態で閉じ、監査用Evidenceへ格下げする。
- [x] Transcript EventをGame Minute単位のStory Beatへまとめ、`Step`を1 Eventではなく1判断ターンとして進める。
- [x] `Alert / Investigate / Decide / Recover / Outcome`のChapter進行を常時表示する。
- [x] Commander、Protocol、Service AgentをIncident Storyboard上のActorとして表示する。
- [x] Service購入時にCommanderからServiceへRescue Creditsが移動する方向を表示する。
- [x] Service完了時にEvidenceがCommanderへ戻る方向、Confidence、対象Moduleを表示する。
- [x] Pause、Patch、Resume、CloseをProtocolへのActionとして表示し、対象Moduleの状態へ反映する。
- [x] User Loss、Demand Served、Available / Reserved / Paid Budgetを盤面上で同時に追えるようにする。
- [x] 再生中の主説明は最新Story Beat一つに限定し、Raw Eventを画面へ積み上げない。
- [x] `prefers-reduced-motion`では自動Animationを省略し、同じ最終Evidenceへ到達させる。

### 30.3 Strategy Parameterの説明

- [x] Strategy Studioの冒頭で「これはModel tuningではなく、Commanderの権限と判断Ruleである」と明示する。
- [x] 各設定に、Plain-languageの意味とOutcome Tradeoffを常時表示する。
- [x] Investigation Budgetは「調査全体に使える総額」と説明し、情報量とTreasury消費の関係を示す。
- [x] Evidence CountとConfidence Gateは「いつ判断してよいか」を決める組として説明する。
- [x] Pause AuthorityはUser ProtectionとAvailabilityのTradeoffとして説明する。
- [x] Service Priority、Disagreement、Patch Safety、Budget Exhaustion、Single-service Capの挙動を説明する。
- [x] 現在の設定を`Spend / Certainty / Containment`の3つの読みやすいSummaryへ変換する。
- [x] PromptはAI Commanderだけを制御し、Temperature、Model Version、Turn Limitは公平なContextとして固定されることを説明する。
- [x] Artifact JSONとRaw parameter名はExpert / Evidence層に残す。

### 30.4 実装結果

2026-09-11にPass Cをローカル実装した。従来の4 Lane中心表示は`Incident Theatre`へ置き換え、Canonical Transcript自体は変更せず、同一Game MinuteのEventだけを有限のStory Beatへ束ねて再生する。盤面は3 Actor、双方向のService取引、Protocol Action、5 Chapter、6 Module、3 Outcomeを一つの視覚階層へ統合した。Chapterは現在地だけでなく通過済み状態も保持する。

Strategy Studioには全10個の決定論的RuleとAI Playbookの主要3設定について、意味とTradeoffを常時表示した。現在設定は`Spend / Certainty / Containment`へ翻訳するが、Evaluatorへ送るArtifactとHashは従来どおりであり、表示用Summaryを新しいWeighted Scoreとして使用しない。

自動UI検証はDesktop / MobileのHTTP 200、3 Actor、5 Chapter、10 Parameter説明、3 Strategy Summary、Raw Transcript初期閉鎖、Replay、Baseline比較、横Overflowなし、Console Errorなし、禁止Contrast Pairなしを確認した。実OpenAI CommanderもService購入からAction Replay検証まで完了した。初見5人による理解度テストは人間参加が必要なため、引き続き未完了とする。

実装Evidenceは[`42-incident-theatre-desktop-builder.png`](../artifacts/ux-audit-rescue-room/42-incident-theatre-desktop-builder.png)、[`43-incident-theatre-desktop-live.png`](../artifacts/ux-audit-rescue-room/43-incident-theatre-desktop-live.png)、[`44-incident-theatre-mobile-live.png`](../artifacts/ux-audit-rescue-room/44-incident-theatre-mobile-live.png)、[`45-incident-theatre-desktop-result.png`](../artifacts/ux-audit-rescue-room/45-incident-theatre-desktop-result.png)、[`46-incident-theatre-ai-result.png`](../artifacts/ux-audit-rescue-room/46-incident-theatre-ai-result.png)へ保存した。

### 30.5 合格条件

1. Raw Transcriptを開かなくても、誰が誰へ支払い、何を受け取り、Protocolへ何をしたかを追える。
2. 1 Episodeの自動再生が有限のStory Beatとして完了し、縦方向へLogが増え続けない。
3. 初見ユーザーが主要設定について、値を上げた場合の利点と犠牲を画面内の説明だけで答えられる。
4. Reference Doctrine、AI Prompt、固定Model Context、Artifact Evidenceの役割が混同されない。
5. Desktop 1440幅とMobile 390幅でActor、Chapter、現在判断、主要Outcomeが欠けない。
6. Keyboard、Screen Reader、Reduced Motionで同じAction Replayへ到達できる。
7. Action列、Final State、Outcome、Transcript Hash、Result HashはPass C前後で変化しない。

### 30.6 実装順序

1. [x] Story Beat groupingとChapter判定を追加する。
2. [x] Incident Storyboardを動的なIncident Theatreへ置き換える。
3. [x] Raw Transcriptを閉じ、Decision Causeを現在のStory Beatへ接続する。
4. [x] Parameter meaningと3つのStrategy Summaryを追加する。
5. [x] Desktop / Mobile / Reduced Motion / Console / Contrastの自動検証を更新する。
6. [x] 同一Episode、同一DoctrineでAction Replay、Outcome、Hashが不変であることを確認する。
