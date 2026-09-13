# Value Decentralization

[English](README.md)

**価値の移転だけでなく、「何を進歩と定義するか」まで分散化する。**

**Shared evidence. Independent values. Verifiable settlement.**

多くのコンペティションや評価制度は、コスト、性能、レジリエンス、公平性などを一つの重み付きスコアへまとめます。しかし、その重みを決めた時点で、すでに一つの「何を良いとするか」が埋め込まれています。

Value Decentralizationは、**事実は共有しながら、価値判断は一つに統一しない**ためのオープンな評価プロトコルです。正しい解決策を同じ条件で測定し、それぞれのOutcomeを独立したまま残します。その上で、異なるValue Poolが効率性、レジリエンス、公平性、新しいトレードオフなどを別々に評価できます。Global WinnerやMaster Scoreは必要ありません。

[Live Product](https://web-rho-seven-d6te7t3f0y.vercel.app) · [Architecture](https://web-rho-seven-d6te7t3f0y.vercel.app/architecture) · [Sepolia Reward](https://sepolia.etherscan.io/tx/0xd976a968aefeb66d7e60fba7a9cf64c8711195fc3652aeccc20c7448069ad708) · [Whitepaper](https://github.com/Jun0908/Decentralized-Value-Whitepaper)

## Judge向け：60秒で見るなら

### 1. 実際のEVM評価を動かす

**[Ethereum Calldata Compression](https://web-rho-seven-d6te7t3f0y.vercel.app/arenas/calldata-compression)**

事前に用意した数字ではなく、**コンパイル済みSolidity decoder bytecodeをEthereumJS Cancun EVM内で実行**します。

現在のPacked codecの再現可能な結果:

| Calldata gas | Decoder gas | Correctness | Frontier contribution |
| -----------: | ----------: | :---------: | --------------------: |
|      `8,200` |    `13,061` |   `PASS`    |              `+5.27%` |

DictionaryはCalldataが小さく、PackedはDecoderが安い。どちらも他方を完全には上回らないため、両方がPareto Frontierに残ります。Standard ABIは両軸で劣るためFrontierから外れます。

### 2. 一つの問題に複数の「進歩」を残す

**[72-Hour Disaster Response](https://web-rho-seven-d6te7t3f0y.vercel.app/arenas/emergency-supply)**

5 Supplier、4 Route、4 Regionに対する戦略を7つのDisruption ScenarioでReplayし、次を独立して測定します。

- 72-hour cost — minimize
- worst-case delivery — maximize
- worst-region coverage — maximize

同じEvidenceに対して、Efficiency / Resilience / Fairness / Frontier Expansionの各Value Poolが別々に配分します。**一つの総合点も、一人の総合優勝者も作りません。**

### 3. 最終配分が本当に支払われたことを確認する

- [Allocation commitment](https://sepolia.etherscan.io/tx/0x96fd7a9d1f4a3bbd2fa7a9ea28d250a16e8eedbaff05b51a4f33e581c3839f2c)
- [RewardPaid](https://sepolia.etherscan.io/tx/0xd976a968aefeb66d7e60fba7a9cf64c8711195fc3652aeccc20c7448069ad708)
- [Machine-readable deployment evidence](Docs/deployments/sepolia-reward-demo.json)

Sepoliaのデモでは、Allocation Commitmentから`RewardPaid`までを実行し、Recipient balanceが`10,000 FDT`増加したことを記録しています。FDTは金銭価値を主張しないDemo Tokenです。

[Bazantic経由のRescue Practice](Docs/sponsors/BAZANTIC_RESCUE_LIVE.md)は2026-09-12に実接続を確認しました。既存Gateway / MCPから無料の参加情報取得・戦略評価が動き、反復結果がローカルEvaluatorと一致しています。戦略比較Recipeは保存済みの未実行draftであり、自律AI実行や有料大会の完成ではありません。

---

## 核となる考え方

> **Shared evidence does not require shared values.**
>
> 同じ事実を共有しても、「何を支援すべきか」まで一つに統一する必要はない。

従来のWeighted Scoreでは、例えば

```text
40% cost + 35% resilience + 25% fairness = one winner
```

となります。

Value Decentralizationでは、同じ測定結果に対して独立した判断を残します。

```text
                    ┌─ Efficiency Pool
Shared Evidence ────├─ Resilience Pool
                    ├─ Fairness Pool
                    └─ Frontier Expansion Pool
```

Pareto Frontierは「新しい万能スコア」ではありません。**有効なトレードオフを早すぎる段階で捨てないためのSafeguard**として使います。

## 何が技術的に独特なのか

### 1. 最大6次元の決定論的Multi-objective Engine

[`packages/shared/src/multiobjective.ts`](packages/shared/src/multiobjective.ts) は、単なるチャート描画ではありません。

- `MINIMIZE` / `MAXIMIZE`を同じEngineで処理
- Hard Constraint失敗をFrontier計算前に除外
- 公開Boundを使って0〜1,000,000へ正規化
- 完全なPareto Frontierをfull-fieldで再計算
- 最大6 MetricまでExact Hypervolumeを計算
- Exclusive Frontier Contributionを計算
- stable sortによりSubmission Orderの影響を排除

Frontier Expansion Poolでは、あるArtifactを取り除いたときに失われるOutcome Spaceを、そのArtifact固有のContributionとして扱います。

```text
exclusive[i] = HV(all results) - HV(all results without i)
```

Reward Allocationも整数演算と固定Tie-breakで決定論的に行います。

### 2. 評価そのものをEvidence Chainにする

評価条件、提出物、結果を単なるDatabase rowとして扱いません。

```text
dataset + constraints + metrics + evaluator version
                         ↓
                    Context Hash
                         ↓
artifact + measurements + correctness
                         ↓
                     Result Hash
                         ↓
pool rules + final allocations
                         ↓
                   Allocation Root
                         ↓
              Ethereum commitment/payment
```

Canonical JSONとKeccak-256を使うため、Dataset、Evaluator、Metric、Artifact、Outcomeのどれかが変われば対応するEvidenceも変わります。

### 3. Mockではなく、実BytecodeをEVMで評価

Calldata Compressionでは、Solidity CodecをCompileし、そのRuntime BytecodeをEthereumJS Cancun EVMで実行します。

Evaluatorは同時に:

- reference outputとの一致
- malformed inputのreject
- calldata gas
- decoder execution gas

を確認します。

つまり「自分の実装は速い」という自己申告ではなく、**実行可能ArtifactそのものからEvidenceを作ります。**

### 4. Browser内で実際のZero-Knowledge Proofを生成

**[Secret Gate](https://web-rho-seven-d6te7t3f0y.vercel.app/arenas/secret-gate)** はSemaphore V4を利用します。

- Disposable IdentityをBrowser内で生成
- Public CommitmentだけをEnroll
- Web Worker内で実際のMembership Proofを生成
- ServerでOfficial Semaphore verification
- Atomic nullifier storeでsame-scope reuseを拒否

秘密Identityそのものを公開Onchain Stateにする必要がありません。

### 5. 非決定的AIを、再現可能なArtifactへ変換

**Rescue Room**では、決定論的Reference Commanderに加え、OpenAI Agents SDKを使ったAI Commander経路があります。

LLMに「同じPromptなら必ず同じ推論をする」とは仮定しません。

代わりに:

```text
Public View Hash
      ↓
Structured Action
      ↓
Action Record
      ↓
Deterministic Replay
      ↓
Same Outcome / Result Hash
```

というBoundaryを作っています。

**AIのChain of Thoughtではなく、実際に世界へ作用したActionを再現性の単位にする**ことで、AI Agentを評価可能なArtifactとして扱います。

---

## 6つのArena、1つのProtocol

| Arena                             | 独立したOutcome                                      | State                    |
| --------------------------------- | ---------------------------------------------------- | ------------------------ |
| **72-Hour Disaster Response**     | cost ↓ · worst-case delivery ↑ · regional coverage ↑ | Demo competition         |
| **Ethereum Calldata Compression** | calldata gas ↓ · decoder gas ↓                       | Practice                 |
| **Community Microgrid Dispatch**  | cost ↓ · worst-case energy ↑ · carbon ↓              | Practice                 |
| **Secret Gate**                   | proof latency ↓ · memory ↓                           | Practice / observational |
| **Rescue Room**                   | user loss ↓ · demand served ↑ · response spend ↓     | Controlled Practice      |
| **Ocean Commons**                 | livelihood ↑ · restraint ↑ · cooperation ↑           | Practice                 |

問題ごとに専用Evaluatorは必要ですが、**Context / Hard Constraint / Outcome / Pareto / Evidence / Value Pool**というProtocol Primitiveは共通です。

## なぜEthereumなのか

すべての計算をOnchainにすることが目的ではありません。

Arenaごとの評価は、Simulation、Compiler、EVM Execution、AI Action Replayなど形が大きく異なるためOffchainで行います。その代わり、入力・Evaluator・OutcomeをHashで固定し、**結果を見た後でOperatorに書き換えてほしくない境界**をEthereumへ移します。

`FrontierRewardPool`は現在のDemo Pathで:

- Challengeごとに1回だけAllocationをCommit
- Pool balanceを超えるReserveを拒否
- 同じWalletへの同一Challenge Reward重複を防止
- Batch Distributionから漏れたParticipantにClaim Pathを保持
- `RewardPaid` Eventを公開

します。

Blockchainは「Offchain Evaluatorが社会的に正しい」ことを証明しません。**何が確定され、何が実際に支払われたかを検証可能にする**ために使っています。

## Evidenceを誇張しない

このProjectでは、異なる種類の証拠を同じ「verified」という言葉でまとめません。

| State       | Meaning                                                  |
| ----------- | -------------------------------------------------------- |
| `measured`  | deterministic evaluatorが結果を生成した                  |
| `simulated` | modeled boundaryであることを明示している                 |
| `committed` | 対応するOnchain Evidenceが存在する                       |
| `paid`      | Transfer/EventとRecipient Evidenceが存在する             |
| `Practice`  | Measurementは実物だがProduction Tournament Layerは未完成 |

現在のPublic EvaluatorとSepolia Reward Demonstrationは実在しますが、それはProduction Tournamentが完成したという意味ではありません。

## 現在動いているもの

- compiled Solidity bytecodeのCancun EVM実行
- direction-aware Pareto / exact hypervolume / exclusive contribution
- Context-bound deterministic Result Hash
- 72-Hour Disaster ResponseのStrategy Builder、7 Scenario、Replay、Revision、Final Entry
- Microgridの3-axis deterministic evaluation
- Browser-side Semaphore V4 proof generation
- Rescue Roomのdeterministic incident simulatorとAI Playbook path
- Redis-backed participant state for production-configured competition paths
- Sepolia allocation commitmentとRewardPaid demonstration
- Same-origin public API / OpenAPI

実装境界の正確な一覧は [`Docs/STATUS.md`](Docs/STATUS.md) を参照してください。

## Architecture

```text
Challenge
  │
  ├─ Hard Constraints
  ├─ Independent Metrics
  ├─ Versioned Context
  └─ Independent Value Pools
          │
          ▼
Human / AI Agent
          │
       Artifact
          │
          ▼
Deterministic Evaluator
  ├─ Correctness Gate
  ├─ Outcome Vector
  ├─ Pareto Frontier
  ├─ Hypervolume / Contribution
  └─ Context + Result Evidence
          │
          ▼
Independent Allocations
          │
          ▼
Ethereum Commitment / Settlement
```

## Local development

Requirements:

- Node.js `22+`
- pnpm `11.24.0`
- Foundry `1.8.1` for contract tests

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Full verification:

```bash
pnpm run ci
```

## Repository map

```text
apps/web                      Next.js application + same-origin routes
apps/api                      reusable API / competition orchestration
apps/runner                   evaluation / attestation boundary
packages/shared               schemas, hashes, Pareto, hypervolume, allocation
packages/disaster-response    seven-scenario Strategy evaluator
packages/calldata-compression Solidity codecs + Cancun EVM evaluator
packages/microgrid-dispatch   deterministic energy evaluator
packages/secret-gate          Semaphore policy / evidence
packages/rescue-room          incident simulator / AI action replay
packages/ocean-commons        multi-agent commons simulator
packages/contracts            Solidity settlement contracts
openapi/frontier-v1.yaml      public API source of truth
```

## 長期ビジョン

私たちの野望は、より良いコンペティションを作ることではありません。

あらゆるコミュニティが、自分たちの重要だと思う価値を定義し、それを測定・検証可能にし、独立した資金を付け、その価値を改善すること自体に継続的な需要を生み出せる世界を目指しています。

その需要が続けば、専門のBuilder、Evaluator、標準、企業、そして最終的には、これまで市場が評価してこなかった価値を中心とする新しい産業が生まれます。

**Ethereumが「誰が所有し、取引できるか」を分散化したのなら、Value Decentralizationは次の問いに挑みます。**

> **「何を進歩と定義するか」を分散化できるだろうか。**

## Documentation

- [Whitepaper](https://github.com/Jun0908/Decentralized-Value-Whitepaper)
- [Product model](Docs/PRODUCT.md)
- [Architecture and trust boundaries](Docs/ARCHITECTURE.md)
- [Current implementation status](Docs/STATUS.md)
- [Demo guide](Docs/DEMO.md)
- [External integrations](Docs/INTEGRATIONS.md)

## Provenance

Development began during ETHOnline on 2026-09-05. The human project owner directed the product thesis, arena choices, metrics, fairness model and reward philosophy. Codex and Claude Code supported implementation. Generated work is checked through deterministic fixtures, TypeScript and Foundry tests, production builds, benchmarks and browser verification.
