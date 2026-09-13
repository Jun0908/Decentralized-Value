# ETHOnline 2026 — Frontier Protocol
## Codex向け実装企画書：ENSv2 × Bazantic × Ledger

**ステータス:** ハッカソン実装ブリーフ  
**メインプロダクト:** Frontier Protocol / Value Decentralization  
**Sponsor連携:** ENS、Bazantic、Ledger  
**UX基盤（Prize対象外）:** Privy  
**メインネットワーク:** Ethereum Sepolia  
**フロントエンド:** Next.js + TypeScript + App Router

---

# 0. 最初に読むこと

**3つのSponsorデモをつなぎ合わせるのではなく、1つの一貫したProtocolを作ること。**

作るものは **Frontier Protocol**。

Frontier Protocolは、複数の価値を同時に成立させられる「可能領域」を広げたArtifactへ報酬を与えるオープンProtocolである。

最初のハッカソンArenaは、Ethereum / EVM上の技術Frontierとする。

> **Gas Efficiency × Parallel Throughput**

同じ機能要件を満たす複数の実装を、同じContextで比較する。

CorrectnessはHard Constraintとして扱う。

再現可能なRunner AgentがOutcomeを測定し、署名付きAttestationを作成する。

Pareto Frontier上に残る、非支配のArtifactを可視化する。

3つのSponsor技術は、それぞれ**異なるProtocol上の問題**を解決する。

> **ENS:** 誰が存在し、Protocol上のどこに属し、何を変更できるのか。  
> **Bazantic:** AgentがProtocolをどう発見し、理解し、支払い、利用するのか。  
> **Ledger:** 結果をAttestするMachineを、なぜ信頼できるのか。

Privyは、人間向けのログインとWallet UXのためだけに使う。

Prizeを増やすためだけにHederaや別Chainを追加しない。

---

# 1. Product Thesis

多くのコンテストやFunding Systemは、複数の価値を1つのScoreに潰し、1つのWinnerを選ぶ。

Frontier Protocolは、それとは違う。

1. Sponsorが **Value Challenge** を定義する。
2. Challengeには以下を含める。
   - 独立したOutcome Axis
   - Hard Constraint
   - Evaluation Context
   - Reward / Evaluation Rule
3. Builderが、同じ課題を解く複数の **Artifact** を提出する。
4. 独立した **Runner Agent** が、同じContextでArtifactを評価する。
5. Runnerが署名付き **Outcome Attestation** を作成する。
6. Protocolが **Pareto Frontier** を更新する。
7. 既存の可能領域を外側へ広げたArtifactが、非支配解として残る。

問いたいのは、

> どの実装が1つの指標で一番高いか？

ではない。

問いたいのは、

> どの実装が、複数の価値を同時に成立させられる可能領域を広げたか？

である。

Canonical Pitch:

> **Prediction Markets pay for discovering what is true. Frontier Markets pay for expanding what is possible.**

---

# 2. ハッカソンで作る範囲

## Technical Frontier MVPだけを作る

最初のArenaはEVM。

### 評価軸

- `gasPerOrder`: 小さい方が良い
- `parallelThroughput`: 大きい方が良い

### Hard Constraints

すべてのArtifactは以下を満たす必要がある。

- 同じPublic APIを持つ
- 同じInvariantを満たす
- Reference workloadに対して同じ論理的Final Stateを生成する
- 同じInputに対して決定論的に動く
- 禁止されたExternal Stateへ依存しない

### Demo Artifacts

意図的に設計の異なる4つの実装を用意する。

- `PackedBook`
- `ShardedBook`
- `FrontierBook`
- `BadBook`

内部実装はハッカソン向けに簡略化してよい。

ただし以下を満たすこと。

- 4つすべてが同じInterfaceを実装する
- 少なくとも1つはCorrectness FailureまたはDominatedになる
- 少なくとも2つのNon-dominated Artifactが残る
- 最後のPlotでFrontierが動くことが視覚的に分かる

必要に応じて、Social Frontier、Humanitarian Aid、Energy、Public Procurement、Tokenomics、Governance、より高度なExecutionなどへ拡張してよい。

ただし、追加実装はFrontier Protocolの中心概念を強める場合に行い、Core Demoの完成度とのバランスを見ながら判断すること。

---

# 3. Core Architecture

```text
Human
  │
  │ Privy
  ▼
Web App
  │
  ├──────────── read/write ────────────┐
  │                                    │
  ▼                                    ▼
Frontier API                     Ethereum Sepolia
  │                                    │
  │                                    ├─ ChallengeRegistry
  │                                    ├─ ArtifactRegistry
  │                                    ├─ BenchmarkAttestation
  │                                    └─ ParetoSettlement
  │
  ├──────── ENSv2 discovery / permissions ────────┐
  │                                               │
  ▼                                               ▼
ENSv2 namespace                            Runner Agent identity
  │                                               │
  │ eligible runnerをdiscover                     │
  └──────────────────────┐                        │
                         ▼                        │
                    Runner Agent                  │
                         │                        │
                         │ benchmark実行          │
                         ▼                        │
                    Outcome Vector                │
                         │                        │
                         ▼                        │
                  Ledger Key Ring                 │
                         │                        │
                         │ resultHashへ署名       │
                         ▼                        │
                  Signed Attestation ─────────────┘
                         │
                         ▼
                 Frontier Protocol
                         │
                         ▼
                   Pareto update


External AI Agent
      │
      ▼
Bazantic MCP + Recipe
      │
      │ Frontier APIを理解
      │ 必要ならx402/MPP Gatewayを通過
      ▼
Frontier API
```

---

# 4. Sponsor Architecture

# 4.1 ENSv2 — Protocol Namespace / Identity / Discovery / Permission

## Sponsor Story

ENSを単なるAddress Labelとして使わない。

ENSv2は **Frontier Protocolの重要な基盤** として使う。

今回の連携で見せたいもの:

- Hierarchical ENSv2 Namespace
- Permissioned Registry / Permissioned Resolver
- Enhanced Access Control
- Delegated Permission
- Agent / Runner Identity
- Service Discovery

ENSv2は現在Sepolia中心の新しい仕組みなので、必ず最新のOfficial Docsと現在のSepolia Deploymentを確認して実装すること。

## Namespace Model

概念的には以下のような構造を目指す。

```text
frontier.eth
│
├── arenas.frontier.eth
│   └── evm-orderbook.arenas.frontier.eth
│
├── challenges.frontier.eth
│   └── gas-parallel.challenges.frontier.eth
│
├── runners.frontier.eth
│   ├── runner-a.runners.frontier.eth
│   ├── runner-b.runners.frontier.eth
│   └── runner-c.runners.frontier.eth
│
└── agents.frontier.eth
    └── scout.agents.frontier.eth
```

ENSv2 Testnet上の制約によってLabelは変更してよい。

## Runner Records

各Runner AgentにLive Dataを持たせる。

例:

```text
runner-a.runners.frontier.eth

address              = <runner signing identity>
frontier.role        = runner
frontier.capability  = evm-orderbook,gas,parallelism
frontier.endpoint    = https://...
frontier.version     = 0.1.0
frontier.status      = active
```

Application側では実際にENSv2 Resolutionを行うこと。

UIに値をHardcodeしない。

## Permission

Enhanced Access Controlを意味のある形で使う。

概念例:

```text
Challenge Sponsor
  ├─ challenge metadataを更新可能
  ├─ Context Author権限をdelegate可能
  └─ Runner Attestationを偽造できない

Runner
  ├─ 自分に許可されたRunner Recordを管理可能
  └─ Challenge Configurationは変更できない

Maintainer
  └─ 一部Protocol Metadataを更新可能

Parent Namespace
  └─ 設計上必要なRevocation / Controlだけ保持
```

Demoでは、最低1つのPermission Mutationを実際に見せる。

## Load-bearing Behavior

少なくとも1つのRuntime Behaviorが、Live ENSv2 Dataに依存すること。

推奨Flow:

1. APIがEvaluation Requestを受け取る
2. ENSv2 Runner NamespaceからEligible RunnerをDiscover / Resolveする
3. RunnerのIdentity / Capability / EndpointをENSv2から読む
4. Required Capabilityを満たすRunnerだけへJobをDispatchする
5. Ledger-backed Signatureが、そのENS Runner Identityと一致することを検証する

ENSv2の実際のAPIが想定と異なる場合はOfficial Docsに従う。

Contract InterfaceやMethod名を推測で作らない。

## Judge向け一文

> **ENSv2 is not our address book. It is the namespace, identity, service-discovery, and permission layer of Frontier Protocol.**

---

# 4.2 Bazantic — Agent-native Protocol Interface

## Sponsor Story

Bazanticの役割は、Frontier Protocolを

> Creatorが横でAPIを説明しなくても、Agentが自力で使えるProtocol

にすること。

中心となるIntegration:

- Frontier Protocolを新しいUseful API Serviceとして公開
- x402 / MPP Gatewayを作る
- MCP経由で利用可能にする
- 再利用可能なRecipeを作る
- RecipeによってAgentのTool Useが実際に改善することを証明する

主なPrize Target:

> **Agentify a new API**

追加Prizeは、工数が少なくEligibilityが明確な場合だけ狙う。

## Frontier API

Versioned HTTP APIとOpenAPI Specificationを作る。

想定Endpoints:

```text
GET  /v1/arenas
GET  /v1/arenas/:arenaId
GET  /v1/arenas/:arenaId/frontier

GET  /v1/challenges/:challengeId
GET  /v1/challenges/:challengeId/artifacts
GET  /v1/challenges/:challengeId/attestations

GET  /v1/runners
GET  /v1/runners/:ensName

POST /v1/artifacts
POST /v1/evaluations
POST /v1/challenges/:challengeId/disputes
```

Public APIには、不要なSponsor-specific detailsを漏らさない。

## Bazantic Gateway

Bazanticの現在のOfficial Workflowを使って以下を構築する。

- MCP Server / Tool Access
- x402 / MPP Gateway
- Custom Recipe

独自に2つ目のx402 Payment Architectureを作らない。

ハッカソンでは:

- Read系EndpointはFreeでもよい
- `POST /v1/evaluations` をPaid / Gated Operationにするのが自然
- Payment Engineering自体を主役にしない
- 面白さは **AgentがProtocolを利用できること**

## MCP Tool Concept

Protocol ActionとToolが1対1で分かりやすく対応するようにする。

```text
frontier.list_arenas()
frontier.inspect_challenge(challenge_id)
frontier.get_frontier(challenge_id)
frontier.find_runners(capability)
frontier.submit_artifact(...)
frontier.evaluate_artifact(...)
frontier.get_attestation(...)
```

Bazantic Platformが本来Host / Generateするものは、可能な限りBazantic側に任せる。

Testingに必要な場合を除き、BazanticのMCP / Gateway機能をLocalで再実装しない。

## Recipe

概念名:

> **Evaluate an artifact against a Value Frontier**

このRecipeはAgentに以下を教える。

1. Frontier Protocolをいつ使うべきか
2. 正しいArena / Challengeの探し方
3. ContextとHard Constraintの読み方
4. Current Frontierの読み方
5. New Evaluationが必要なタイミング
6. Evaluation Requestの出し方
7. Outcome Vectorの解釈
8. ArtifactがDominatedかFrontierを拡張したかの判断
9. Context付きで結果を説明する方法

Agent Task例:

> "Find the current non-dominated EVM orderbook designs. Evaluate FrontierBook under the registered context, then tell me whether it expands the Gas × Parallel Throughput frontier and why."

## 必須Bazantic Experiment

同じ条件で2つの比較結果を作る。

共通条件:

- 同じPrompt
- 同じModel
- 同じSettings
- 同じAPI Access

Test A:
- Raw API Informationのみ

Test B:
- 同じ条件 + Bazantic Recipe

差分を保存する。

Recipeありの方が、

- Tool Call Sequence
- Challenge Contextの理解
- Frontier Statusの解釈
- Final Answer

で明確に良くなること。

## Judge向け一文

> **Bazantic turns Frontier Protocol from an API that developers must learn into a protocol agents can discover, understand, pay for, and use autonomously.**

---

# 4.3 Ledger — Runner AgentのMachine Trust

## Sponsor Story

Frontier Protocolで最も重要なTrust BoundaryはWeb UIではない。

重要なのは、

> 「私はこのArtifactを、このContextで実行し、この結果を得た」

と言うMachineである。

Runner Networkが分散していても、すべてのRunner Attestation Keyが`.env`に置かれていたらTrust Modelとして弱い。

LedgerはRunner AgentのSigning Identityを守るために使う。

現在のPrize要件に合わせて、**Ledger Agent Stack**、特に **Ledger Key Ring CLI (`wallet-cli ring`)** を使う。

Ledgerの狙っているユースケースである、

> VPS / CI Runner / Hosted AgentをEnrollし、Secretを漏らせないMachine Identityを作る

という形に寄せる。

## Runner Agent

Hosted / Autonomous Runner Serviceを実装する。

概念:

```text
Evaluation Job
     │
     ▼
Runner Agent
     │
     ├─ Challenge / Context取得
     ├─ Allowed Artifact取得
     ├─ Deterministic Benchmark実行
     ├─ Hard Constraint検証
     └─ Outcome Vector計算
               │
               ▼
          resultHash
               │
               ▼
        Ledger Key Ring
               │
               ▼
       signed attestation
               │
               ▼
   BenchmarkAttestation.sol
```

## Security Rule

Demo Pathでは以下にRaw Private Keyを置かない。

- `.env`
- GitHub Actions Secrets
- Runner Source Tree
- Local Plaintext Key File

Ledger Key RingをOfficial Agent Stack Docsに従って使うこと。

Local Insecure SignerをTest用に用意する場合は、明示的なDevelopment Flagの後ろに置く。

Demo Pathでは絶対に使わない。

## Attestation Payload

DeterministicなTyped Payloadを使う。

概念:

```ts
type OutcomeAttestation = {
  challengeId: Hex;
  artifactHash: Hex;
  contextHash: Hex;
  constraintResultHash: Hex;
  gasPerOrder: bigint;
  parallelThroughput: bigint;
  runnerEnsName: string;
  runnerAddress: Address;
  resultHash: Hex;
  issuedAt: bigint;
};
```

Canonical EncodingからStable Hashを作る。

そのHashにLedger経由で署名する。

以下を検証する。

- SignatureがValid
- SignerがENSv2 Runner Nameに紐づくIdentityと一致
- Challenge / Context / Artifact HashがRegistered Objectと一致

## Hosted Runner Target

可能なら以下のいずれかを実際に使う。

- VPS
- CI Runner
- Hosted Agent

LedgerのPrize Storyに直結するため。

可能であればGitHub Actions Exampleも用意し、

> Signing Private KeyをGitHub Secretsに置かなくてもRunnerがAttestできる

ことを見せる。

## Optional Human-in-the-loop

Core Path完成後に余裕があれば追加する。

High-risk ActionだけLedger Confirmationを要求する。

例:

- ENS Permission Escalation
- New Trusted Runner Registration
- Dispute Finalization
- Challenge Configuration変更

これはSecondary。

Runner Attestation MVPを阻害しない。

## Judge向け一文

> **Ledger secures the machines that measure the frontier. The attestation key never lives inside the runner process.**

別表現:

> **ENS tells us who the runner is. Ledger proves the authorized machine signed the result.**

---

# 4.4 Privy — Human UX専用

Privyは使いやすさのために使う。

Prize Targetではない。

用途:

- Email / Social Login
- Embedded Wallet
- Existing Wallet Connect
- 通常のUser Transaction Signing
- User Address / ENS Identity表示

PrivyをCore Protocol Architectureへ入れない。

Privy専用のSponsor Storyに時間を使わない。

---

# 5. Core Contracts

Foundryを基本とする。

ただし既存Repoに明確な理由がある場合は調整してよい。

Contractは最小限かつAuditableにする。

## 5.1 `ChallengeRegistry.sol`

責務:

- Challenge登録
- 以下を保存
  - Challenge ID
  - Artifact Type
  - Context Hash
  - Hard Constraint Spec Hash
  - Axis Definition
  - Runner Requirement
  - Status
- Event発行

大きなJSONはOnchain保存しない。

必要に応じてContent Hash / URIを使う。

## 5.2 `ArtifactRegistry.sol`

責務:

- Artifact Metadata登録
- Owner / Author
- Source Commit / Artifact Hash
- Challenge Mapping
- Version
- License / URI

## 5.3 `BenchmarkAttestation.sol`

責務:

- Signed Outcome Attestationを受け取る
- Allowed Runner Identityを検証
- Signature検証
- Duplicate / Invalid AttestationをReject
- Compact Resultを保存
- Event発行

可能ならENSv2 Identity Resolution / Authorizationを直接、または小さな`RunnerIdentityAdapter`経由で接続する。

Hard-coded Addressだけ確認しているのに、ENS連携したように見せない。

## 5.4 `ParetoSettlement.sol`

ハッカソンでは2次元だけを扱う。

- Gas: 小さいほど良い
- Throughput: 大きいほど良い

責務:

- Dominance判定
- Non-dominated Set維持
- Event発行
  - Artifact added to frontier
  - Artifact dominated
  - 新しいArtifactによって旧Frontier PointがDominatedされた場合のRemoval

Onchain Hypervolume Contributionが複雑すぎる場合は、Frontier SetだけOnchainで正しく管理し、HypervolumeはOffchainで計算・表示してよい。

Frontier Updateが完成する前に複雑なTokenomicsへ進まない。

---

# 6. Runner Benchmark

Benchmarkはハッカソンとして十分にReproducibleであること。

最低限記録するもの:

- Git Commit
- Compiler Version
- Compiler Flags
- Artifact Bytecode / Source Hash
- Context Hash
- Workload Version
- Run Timestamp
- Repeated Measurements
- Median Result

## Metrics

### Gas

明確に定義されたOperation / Workloadを測る。

例:

- Gas per Order
- Fixed Batch内のMedian Gas per Order

### Parallel Throughput

Artifact Design間のConcurrency / Contention差分が出るDeterministic Benchmarkを作る。

FrontendにFake Numberを置かない。

Benchmark CodeがMetricを生成すること。

本物のParallel EVM実行にSpecialized Harnessが必要なら、

- 何を測っているのか
- どこまでReal EVMなのか
- どこがSimulationなのか

を明示する。

## Correctness

最初にInvariant / Reference Testを実行する。

Correctness FailureしたArtifactはPareto Comparisonに入れない。

---

# 7. ENS + Ledger Combined Trust Model

この2つのSponsor Storyは組み合わせると強い。

```text
runner-a.runners.frontier.eth
          │
          │ live ENSv2 records
          ▼
Identity + capability + endpoint
          │
          │ Enhanced Access Control
          ▼
Authorized Runner Agent
          │
          │ benchmark実行
          ▼
Outcome Vector
          │
          │ Ledger Key Ring
          ▼
Signed Attestation
          │
          ▼
BenchmarkAttestation.sol
```

Applicationが説明できる状態にする。

> Random HTTP Serverが数字を返したから信頼するのではない。  
> ENSv2からAuthorized RunnerをDiscoverし、そのResultがLedger-secured Identityで署名されていることを要求する。

これは、

> Smart ContractをDeployしてWalletを接続しました

とは全く違う。

---

# 8. Bazantic + ENS + Ledger End-to-End Agent Flow

Sponsor Integrationは、最後に**1本のDemo Flowへ収束させる**。

## Agent Task

External Agentに以下を依頼する。

> "Evaluate FrontierBook against the current EVM Gas × Parallel Throughput challenge and tell me whether it expands the frontier."

## Expected Flow

```text
1. AgentがTaskを受け取る
2. Bazantic RecipeがFrontier Protocolを選択
3. Bazantic MCPで:
      challenge取得
      current frontier取得
4. AgentがEvaluationが必要だと判断
5. AgentがEvaluationをRequest
6. Frontier APIがENSv2からEligible Runner AgentをResolve
7. RunnerがBenchmarkを実行
8. RunnerがresultHashを生成
9. Ledger Key RingでAttestationへ署名
10. AttestationをSepoliaへSubmit
11. ParetoSettlementがFrontierをUpdate
12. Bazantic AgentがUpdated Frontierを取得
13. Agentが以下を説明:
      - Context
      - Metrics
      - Correctness Status
      - Dominance / Frontier Status
      - なぜこの結果が重要か
```

この1本をCentral Demoとする。

---

# 9. Frontend

使用:

- Next.js App Router
- TypeScript
- Privy
- 必要ならviem / wagmi
- Lightweight Chart LibraryまたはSVG

UIを作り込みすぎない。

## 必須Pages

### `/`

Product説明 + Current Arena

### `/arena/[id]`

表示:

- Challenge Title
- 2つのAxes
- Hard Constraints
- Context
- Frontier Chart
- Artifact List
- Latest Attestations

### `/artifact/[id]`

表示:

- Source / Version
- Benchmark Metrics
- Runner ENS Name
- Ledger-backed Attestation Status
- Frontier / Dominated Status

### `/runners`

Live ENSv2 Runner Identitiesを表示:

- ENS Name
- Resolved Address
- Capabilities
- Endpoint / Status
- Last Attestation

### `/sponsor-debug`

Hackathon専用Integration Observability Page。

表示:

- ENSv2 Resolution Output
- EAC / Permission State
- Bazantic API / Gateway Status
- Current Recipe Identifier
- Ledger Signing Mode
- Latest Result Hash / Signature

Judge向けにも使えるようにVisualはCleanにする。

---

# 10. Repository Layout

pnpm Monorepoを基本にする。

```text
/
├── apps/
│   ├── web/                 # Next.js
│   ├── api/                 # Frontier HTTP API
│   └── runner/              # Hosted Runner Agent
│
├── packages/
│   ├── contracts/           # Foundry
│   ├── sdk/                 # Typed Frontier Client
│   ├── shared/              # Schema / Type
│   ├── ens-adapter/         # ENSv2 Integration
│   └── ledger-adapter/      # Key Ring Integration
│
├── artifacts/
│   └── orderbook/
│       ├── PackedBook.sol
│       ├── ShardedBook.sol
│       ├── FrontierBook.sol
│       └── BadBook.sol
│
├── benchmarks/
│   └── evm-orderbook/
│
├── bazantic/
│   ├── README.md
│   ├── recipe.md
│   ├── raw-api-test.md
│   └── recipe-test.md
│
├── openapi/
│   └── frontier.openapi.yaml
│
├── scripts/
│   ├── deploy-sepolia.ts
│   ├── setup-ensv2.ts
│   ├── seed-demo.ts
│   └── run-demo.ts
│
├── docs/
│   ├── architecture.md
│   ├── ens.md
│   ├── bazantic.md
│   ├── ledger.md
│   ├── demo-script.md
│   └── prize-checklist.md
│
├── .env.example
└── README.md
```

Official SDK要件が異なる場合は調整してよい。

---

# 11. Data Types

Shared TypeScript Packageを使う。

例:

```ts
export type Challenge = {
  id: `0x${string}`;
  slug: string;
  title: string;
  artifactType: "solidity-contract";
  contextHash: `0x${string}`;
  constraintSpecHash: `0x${string}`;
  axes: [
    {
      id: "gasPerOrder";
      direction: "MINIMIZE";
      unit: "gas";
    },
    {
      id: "parallelThroughput";
      direction: "MAXIMIZE";
      unit: "ops/s";
    }
  ];
};

export type OutcomeVector = {
  gasPerOrder: bigint;
  parallelThroughput: bigint;
};

export type RunnerIdentity = {
  ensName: string;
  address: `0x${string}`;
  endpoint: string;
  capabilities: string[];
  status: "active" | "inactive";
};
```

API BoundaryではZodまたは同等のValidationを使う。

---

# 12. API Behavior

## `POST /v1/evaluations`

Input:

```json
{
  "challengeId": "0x...",
  "artifactId": "0x..."
}
```

Flow:

1. Challenge / Artifact Validation
2. ENSv2からEligible RunnerをResolve
3. Evaluation Job作成
4. RunnerへDispatch
5. RunnerがBenchmark実行
6. Ledger経由で署名
7. Attestation Submit
8. Pareto Frontier Update / Read
9. Result返却

Response Concept:

```json
{
  "jobId": "...",
  "runner": {
    "ensName": "runner-a.runners.frontier.eth",
    "address": "0x..."
  },
  "outcome": {
    "gasPerOrder": "53120",
    "parallelThroughput": "360"
  },
  "correctness": true,
  "attestationTx": "0x...",
  "frontierStatus": "NON_DOMINATED"
}
```

Asyncにする場合はJob IDを返してPolling / SSEを用意する。

SophisticationよりReliabilityを優先する。

---

# 13. Demo Data / Demo Safety

DemoはReproducibleにする。

1 Command:

```bash
pnpm demo:seed
```

これで以下を行う。

- Contract Deploy / Config確認
- Arena / Challenge存在確認
- Sample Artifact存在確認
- ENSv2 Runner Namespace設定確認
- Runner Identity確認
- Ledger Integration Preflight
- 最後のInteresting Evaluationだけ未実行状態で残す

さらに:

```bash
pnpm demo:check
```

を作る。

Judge / Recording直前にExternal Dependencyを全部確認できるようにする。

Demo直前にDBを手編集しない。

---

# 14. 90–120秒 Demo Script

## 0–15秒 — Why

Pareto Plotを見せる。

> Most funding systems reward one metric. Frontier Protocol rewards artifacts that expand what is simultaneously possible.

## 15–35秒 — ENSv2

Runner Namespaceを開く。

見せるもの:

- `runner-a.runners.frontier.eth`
- Live capability / endpoint / identity records
- Delegated Permission
- ENSv2でAuthorized RunnerをDiscoverしていること

説明:

> ENS tells the protocol who exists, where they live, and what they are allowed to change.

## 35–70秒 — Bazantic Agent

AgentにEvaluation Taskを与える。

Bazantic Recipe / MCPが以下を呼ぶのを見せる。

- inspect challenge
- inspect current frontier
- request evaluation

説明:

> Bazantic lets an agent understand and use Frontier Protocol without a developer explaining our API.

## 70–95秒 — Ledger Runner

Runner Agentを見せる。

- Benchmark Run
- Outcome Vector
- `resultHash`
- Ledger Key Ring Signature
- Plaintext Signing Keyが存在しないこと

説明:

> Ledger protects the machine identity that attests the benchmark result.

## 95–120秒 — Frontier Update

見せる:

- Sepolia Attestation Transaction
- New Point
- Pareto Frontier Update

締め:

> Prediction Markets pay for discovering what is true. Frontier Markets pay for expanding what is possible.

---

# 15. Sponsor別 Submission Evidence

SponsorごとにScreenshot / Recording / Evidenceを分けて保存する。

## ENS Checklist

- [ ] ENSv2 Sepoliaを使用
- [ ] Real hierarchical namespace
- [ ] Permissioned Registry / Resolver等のENSv2固有機能
- [ ] Enhanced Access Controlを意味のある形で使用
- [ ] 少なくとも1つのDelegated PermissionをDemo
- [ ] Runner / AgentをNamespace / Identityとして表現
- [ ] Runtime BehaviorがLive ENSv2 Dataを読む
- [ ] Fake / Hard-coded ENS Recordなし
- [ ] Open-source
- [ ] Functional Demo / Video

## Bazantic Checklist

- [ ] Bazantic Account
- [ ] Frontier ProtocolをNew API Serviceとして追加
- [ ] Working x402 / MPP Gateway
- [ ] Working Recipe
- [ ] Agent利用しやすいOpenAPI
- [ ] Recipeなしの同条件テスト
- [ ] Recipeありの同条件テスト
- [ ] Input / Result保存
- [ ] Material ImprovementをRecording
- [ ] 他Builderが再利用できるRecipe
- [ ] Multi-service Prizeを狙う場合は2つ目のServiceがDecorativeでない

## Ledger Checklist

- [ ] Ledger Agent Stackを使用
- [ ] `wallet-cli ring` / Ledger Key Ring CLIを使用
- [ ] 可能ならVPS / CI / Hosted Agent Style Runner
- [ ] Demo Signing Keyが`.env`にない
- [ ] Result Attestationを実際にLedgerで署名
- [ ] SignatureがExpected Runner Identityと一致
- [ ] Device-backed SecurityがMain Story
- [ ] Optional Human ConfirmationはCore完成後のみ

---

# 16. 実装判断の原則

実装は固定的に制限せず、Sponsorの新機能や新しいアイデアがFrontier Protocolを強くするなら柔軟に取り入れる。

判断基準は以下。

- Sponsor IntegrationがProtocolの本質的な役割を持っているか
- Demoで価値が明確に伝わるか
- 他のBuilderが再利用できる形で残せるか
- Core Conceptとの整合性があるか
- 実装コストに対して、PrizeやProduct Storyへの効果が大きいか
- 既存の実装より面白い構造を発見した場合、Briefより良い案へ変更してよい

このBriefは設計の出発点であり、実装中により良い構造が見つかった場合は更新してよい。

---

# 17. Engineering Priority

この順番で作る。

## Phase 1 — Core Deterministic Demo

1. Repo Skeleton
2. 4 Artifact Implementations
3. Invariant / Correctness Test
4. Gas Benchmark
5. Throughput Benchmark
6. Pareto Calculation
7. Local Fixture DataでPlot

**Exit Condition:** Real Benchmark OutputでFrontierが動く。

## Phase 2 — Contracts

1. ChallengeRegistry
2. ArtifactRegistry
3. BenchmarkAttestation
4. ParetoSettlement
5. Sepolia Deployment
6. Tests

**Exit Condition:** Real AttestationでOnchain Frontier StateがUpdateされる。

## Phase 3 — ENSv2

1. Current Official ENSv2 Docsを読む
2. Namespace設定
3. Permissioned Resolver / Registry設定
4. EAC設定
5. Runner Identity / CapabilityをLive Resolve
6. Runner DispatchでResolutionを使う

**Exit Condition:** ENS Configurationを壊すとRunner Discovery / Authorizationが壊れる。

## Phase 4 — Ledger

1. Current Agent Stack Docsを読む
2. Ledger Key Ring CLIをInstall / Use
3. Demo Runner HostをEnroll
4. resultHashをLedger経由で署名
5. Protocol PathでSignature検証
6. Plaintext Demo Signer除去

**Exit Condition:** RunnerがPlaintext Private Keyを持たずにAttestできる。

## Phase 5 — API + Bazantic

1. Frontier API
2. OpenAPI
3. Bazantic Service
4. Gateway
5. MCP
6. Recipe
7. Raw vs Recipe Experiment

**Exit Condition:** External AgentがRecipeを使ってEvaluation Taskを完遂できる。

## Phase 6 — Web + Privy

1. Onboarding
2. Arena Page
3. Runner Page
4. Attestation Page
5. Sponsor Debug Page

## Phase 7 — Submission Hardening

1. Architecture Diagram
2. Public README
3. Sponsor Docs
4. Demo Seed / Check Scripts
5. Videos
6. Prize Checklist
7. Dead Code / Secrets除去
8. Clean MachineからPublic Repo Setup確認

---

# 18. Codex実装ルール

Codexは以下に従うこと。

1. **Integration Codeを書く前に必ず最新Official Docsを読むこと。**  
   ENSv2、Bazantic、Ledgerは新しく変化が早い。Package名、Contract Address、CLI Flag、SDK Methodを推測しない。

2. **Fake DepthよりReal Integrationを優先する。**  
   5個の疑似Sponsor Featureより、1つのReal ENS Permissionと1つのReal Ledger-signed Runnerの方が良い。

3. **Sponsor IntegrationはModularにする。**  
   Core Frontier ProtocolはAdapter / Interface経由でSponsor Integrationを切り離せるようにする。

4. **ただしDemo PathではLoad-bearingにする。**
   - ENSがRunner Discovery / Authorizationに必要
   - BazanticがAgent Useに必要
   - LedgerがAttestation Trustに必要

5. **FrontendはNext.js + TypeScript + App Routerを基本とする。**

6. **Strict TypeScriptを使う。**

7. **Environment Validationを入れる。**

8. **SecretをCommitしない。**

9. **Protocol Invariant Testを先に書く。**

10. **`docs/implementation-decisions.md` を常に更新する。**

Official Sponsor APIがこのBriefと異なる場合:

- Briefが何を想定していたか
- Current Docsが何をSupportしているか
- 実際に何を実装したか
- なぜそうしたか

を記録する。

11. **Core Conceptを勝手に変えない。**

Frontier Protocolの中心は:

- Independent Value Axes
- Hard Constraints
- Reproducible Evaluation
- Signed Attestations
- Pareto Frontiers

である。

---

# 19. Definition of Done

最低限、この1本のFlowが動けばHackathon MVPとして成立する。

> AgentがBazantic Recipeを使ってCurrent EVM Frontierを確認し、Real ArtifactのEvaluationを依頼する。Frontier ProtocolはENSv2を使ってAuthorized Runner AgentをDiscoverする。そのRunnerはReproducible Benchmarkを実行し、Plaintext Private Keyを持たずにLedger Key RingでOutcome Attestationへ署名する。Signed AttestationがSepoliaへ記録され、Pareto Frontierが画面上でUpdateされる。

ここを基準点として、時間とアイデアに応じてSocial Frontier、追加Arena、Governance、Tokenomics、追加Sponsor活用などへ拡張してよい。

---

# 20. Final Sponsor Narrative

## ENS

> **誰が存在し、Protocol上のどこに属し、何を変更できるのか。**

ENSv2はFrontier ProtocolのHierarchical Namespace、Runner Identity、Discovery、Delegated Permission Layer。

## Bazantic

> **AgentがProtocolをどう発見し、理解し、支払い、利用するのか。**

BazanticはMCP、Recipe、Gatewayを通じてFrontier ProtocolをAgent-native Serviceにする。

## Ledger

> **結果をAttestするMachineを、なぜ信頼できるのか。**

LedgerはRunner AgentのSigning Identityを保護し、Benchmark Attestationを`.env`に置かれたPrivate Keyから切り離す。

## Privy

> **人間がWallet Infrastructureを意識せず、どうProductへ入るか。**

使いやすいUX。

Prize Narrativeには入れない。

---

# 21. North Star

Sponsor Integrationは、このProtocolを作る根本理由を強化するものでなければならない。

> Web3は、お金だけを分散化するためのものではない。  
> より良い技術や社会のRuleを、公開された仕組みで発見し、試し、検証し、資金を流し、再利用できる社会基盤を作るためにも使える。

ETHOnlineではまず、再現可能な測定ができるTechnical Frontierで、この考え方を実証する。

その後、Ethereum Technical FrontiersからSocial Rule Frontiersへ広げる。
