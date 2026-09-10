# Rescue Room

**状態:** Phase 0の成立性検証は`GO`。Phase 1完了。参加者Playbookを実際のOpenAI Commanderで動かすPhase 2 Controlled Practiceをローカル実装済み。Hidden Final、Revision / Final Entry、Sepolia Service Paymentは未実装。

Rescue Roomは、架空のEthereum Protocolで起きた異常に対し、限られた情報、時間、予算を持つIncident Commanderが、Service AgentからEvidenceを購入しながら介入を決めるArenaである。

単純なセキュリティクイズではない。True StateはCommanderから隠され、情報取得にも時間と費用がかかる。全面Pause、何もしない、すべてのServiceを買う、といった固定戦略には、それぞれ異なる失敗と機会費用がある。

## 現在動くもの

- Seed付きの決定論的Incident Generator
- 7つのIncident familyと35 Episodeの公開Practice Pack
- 60分のGame Clock、100 Rescue Credits、最大12 Action
- Pause、Resume、Wait、Service購入、Patch、Close
- 6つのCurated Service Agent
- reserve、release、refundを分けたGame Credit Ledger
- Action、Payment、Receipt、Observation、Protocol StateのTranscript
- 同じEpisodeとActionから同じOutcomeとHashを作るReplay
- 8つのReference Commander Policy
- 3つの独立Outcome、Pareto Frontier、4つのPractice Value Pool
- APIとIncident Room UI
- 固定OpenAI Agents SDK Runtimeと参加者編集可能なCommander Playbook
- Model、Prompt、Token、Action、Public View Hashを含むAI Provenance
- Playbook Schema、公開Alert、Service Catalog、Runtime Contractを含むStarter Kit
- Context + Result EvidenceのJSON Download

Reference Commanderは引き続き決定論的Policyである。加えて、AI Playbook Modeでは`@openai/agents 0.17.2`とmodel ID `gpt-5.6-luna`を使い、同じModel ID、Action Schema、Token、Turn、Timeout条件で実際にAI Commanderを実行する。これは1 EpisodeのControlled Practiceであり、公開TournamentやReward Entryではない。`gpt-5.6-luna`は日付付きSnapshotではないため、Hidden Finalでは不変なModel Versionの固定または事前Commitが別途必要である。

## Protocol world

Protocolは次の6 Moduleを持つ。

- withdrawals
- borrowing
- liquidations
- oracle
- governance
- bridge

Incident familyは次の7種類である。

- false-positive
- oracle-manipulation
- accounting-drift
- compromised-key
- liquidity-crisis
- contract-exploit
- external-dependency

EpisodeはSeverity、Affected Module、Loss Rate、Demand、正しいPatch、初期Signalを持つ。ただし、これらのHidden StateはPractice実行終了までCommander-visible payloadへ含めない。

## Commander Action

現在のEvaluatorが受け付けるActionは次の通りである。

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

Reference APIは選択した決定論的Commanderを1 Episodeに対して実行する。AI Commander APIは参加者のPlaybookを受け取り、現在のPublic Stateから1 turnにつき1つの構造化Actionを選ばせる。Playbookが許可していないServiceまたはProtocol Actionを選ぶとHard Constraint違反になる。

## Curated Service Market

| Service | Task | Price | Delivery |
| --- | --- | ---: | ---: |
| Pulse Monitor | SCAN_ACTIVITY | 5 RC | 2分 |
| Trace Audit | TRACE_EXECUTION | 16 RC | 6分 |
| Accounting Audit | CHECK_ACCOUNTING | 18 RC | 7分 |
| Second Opinion | SECOND_OPINION | 12 RC | 4分 |
| Patch Builder | BUILD_PATCH | 28 RC | 8分 |
| Patch Verifier | VERIFY_PATCH | 10 RC | 4分 |

Serviceは万能ではない。Incidentとの相性により分類精度が変わり、inconclusiveまたは誤ったFindingを返す場合がある。各Orderは予算をreserveし、納品時にreleaseする。Game Horizon内に納品されなかったOrderはrefundする。同じEpisode、Service、対象、Patch artifactに対するEvidence品質は購入順に依存せず、Commander間で同じrealizationを使う。

このPaymentは決定論的なGame Credit Ledgerである。Rescue CreditsはTokenではなく、Service Agent wallet、Escrow Contract、Sepolia transactionも現在は存在しない。

## 独立Outcome

| Key | 表示 | 方向 | 集約 |
| --- | --- | --- | --- |
| `totalUserLossUsd` | Total user loss | Minimize | 共通Episode Packの合計 |
| `servedProtocolDemandPpm` | Protocol demand served | Maximize | Episode平均 |
| `netResponseSpendCredits` | Response spend | Minimize | release済みGame Creditの合計 |

`worstEpisodeUserLossUsd`もEvidenceとして保存するが、Phase 0で単発のService誤分類に過敏だと判明したため、主要なProtection軸にはPack全体の`totalUserLossUsd`を使う。3軸をWeighted Scoreへ統合しない。

## Practice Value Pool

4 Poolは同じ35 EpisodeのEvidenceを読み、別々の公開Ruleで10,000 Practice Creditsを配分する。

- User Protection Pool: Availability Gateを通過したEntryのうちUser Lossを最小化
- Availability Pool: User Loss Gateを通過したEntryのうちDemand Servedを最大化
- Treasury Stewardship Pool: SafetyとAvailability Gateを通過したEntryのうちSpendを最小化
- Frontier Expansion Pool: 公開Safety・Availability Gateを通過したEntryの3軸の正のExclusive Hypervolume Contributionに比例

Practice Creditsには金銭価値がなく、Reward Settlementではない。1 Entryが複数Poolから支持されてもよく、全軸で優れたEntryが存在する場合に複数Winnerを無理に作らない。

## API

```text
GET  /v1/rescue-room
GET  /v1/rescue-room/starter-kit
POST /v1/rescue-room/evaluations
POST /v1/rescue-room/commander-evaluations
```

Evaluation input:

```json
{
  "policyId": "simple-adaptive",
  "episodeId": "episode-..."
}
```

Responseは`state: simulated`、`paymentState: game-credits`を持ち、Episode outcome、35 Episode aggregate、Pareto、Value Pool allocation、完全なTranscript、Context Hash、Manifest Hash、Evaluation Hashを返す。

AI Commander input:

```json
{
  "episodeId": "episode-...",
  "playbook": {
    "schemaVersion": "rescue-commander-playbook-v0",
    "name": "Evidence-aware Commander",
    "instructions": "Treat the initial alert as uncertain...",
    "allowedServiceIds": ["pulse-monitor", "trace-audit", "second-opinion"],
    "allowedProtocolActions": ["PAUSE_MODULE", "WAIT", "CLOSE_INCIDENT"],
    "maxServicePriceCredits": 20
  }
}
```

AI responseは`inferenceState: openai-api`を持ち、Playbook Hash、Commander Context Hash、Model / SDK / Prompt / Token provenance、各Decision時点のPublic View Hash、構造化Action、Outcome、Replay検証結果を返す。LLMを再実行して同じActionになるとは主張せず、保存したAction列から同じOutcome Hashを再計算できることを再現性の境界とする。

## Phase 0 Evidence

2026-09-10にEvaluator v1で2,000 Episode、10 Baseline Policyを実行し、事前条件をすべて満たして`GO`と判定した。

| 検証項目 | 結果 |
| --- | ---: |
| Deterministic replay | PASS |
| Simple fixed universal winner | なし |
| Frontier Policy数 | 7 |
| Serviceが有効だったEpisode | 1,315 |
| Serviceが不利だったEpisode | 596 |
| Incident依存のOracle first action | 3種類 |
| Incident family coverage | 7 / 7 |
| 400 Episode × 5 PackのFrontier | 共通7 Policy、1 Packのみ1 Policy追加 |
| Correct Baseline run | 10 / 10 |

Seeded Randomも低支出という独立TradeoffによりFull Pareto Frontierへ残った。これは隠さず表示する一方、ProtectionとAvailabilityの公開Gateを通らないためPractice Value Poolの配分対象にはならない。Pareto membershipそのものを品質保証やReward資格として扱わない。

Raw Evidenceは[`../../benchmarks/rescue-room/results/latest.json`](../../benchmarks/rescue-room/results/latest.json)に保存する。False Positiveの内部Safe状態がPublic Viewへ漏れないよう更新したEvaluator v2では、全10 Baseline、2,000 Episodeの実行時間は62,690 msで、事前上限120,000 ms以内だった。Evidence Hashは`0xa5da26f534ff1345a3139f2579edafc4ea8dd40c7b3abc5c16650be8977bceb3`である。

実AI Runtime v1 / Evaluator v2のSmoke Evidenceは[`../../benchmarks/rescue-room/results/ai-smoke-latest.json`](../../benchmarks/rescue-room/results/ai-smoke-latest.json)に保存する。1 Episodeを10 requests、16,317 tokens、21,771 msで完了し、4つのService Agentを自律購入した。Action replayは同じResult Hashへ一致した。この結果は経路の疎通証拠であり、Hidden Finalでの強さの証明ではない。

## Trust boundary

- Game world、Service Evidence、支払い、Outcomeはoff-chain simulationである。
- Public ScenarioはSeed、Incident family、Severity、正しいPatchを返さない。
- Practice終了後は学習用にTrue Stateを開示する。
- TranscriptとHashは再現可能だが、現時点ではEthereumへcommitしていない。
- AIのChain of Thoughtは要求も保存もしない。保存するのはPublic View Hash、Action、reason code、confidence、Model / Prompt / Token provenanceである。
- LLMの再実行は非決定的になり得る。保存Action列からのEvaluator replayだけを決定論的再現性として扱う。
- Reference Modeは決定論的Policy、AI Playbook Modeは固定された外部OpenAI Runtimeである。
- Hidden Final、参加者コード隔離、Participant Uniqueness、Runner attestation、Dispute、Slashingは未実装である。

## 次のGate

次のGateは、Revision HistoryとFinal Entry、不変なModel VersionのCommit、事前Commitした複数Hidden Final Episode、Final中の人間介入禁止、Full Field一括再計算を追加し、公開Practiceを大量学習したPlaybookが未知環境へ一般化できるかを測ることである。実際のSepolia Service Paymentは、Agent-to-Agent購入がゲーム上有効だと確認した後のPhase 3でのみ追加する。
