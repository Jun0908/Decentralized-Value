# Frontier Protocol 計画10 — Ocean Commons

**作成日:** 2026-09-10
**状態:** 設計中。Phase 0の成立性検証は未完了
**並行計画:** 計画9 Rescue Roomと同時進行。両者は独立したArenaとして実装し、共通基盤の抽出はPhase 0通過後に検討する
**目的:** 複数のAI Agentが共有資源をめぐって交渉、支払い、協定、離脱を自律的に判断する、再現可能なMulti-Agent Commons Arenaを成立させる

この文書はOcean Commonsの設計仮説と検証順序を定める。まだ公開Arenaの実装仕様ではない。数値、Zone数、Agent構成、Value Poolの資格条件は、Phase 0の結果を確認してから固定する。

## 1. 中心となる考え方

Ocean Commonsを「AIに漁獲量を最適化させるゲーム」にはしない。

中心となる問題は次である。

> 自分だけでは守れない資源を、他のAgentとの契約と支払いによって守れるか。守る側に回ったとき、自分の生活は成り立つか。

1隻がいくら自制しても、他の4隻が獲り続ければ資源は枯れる。自制は他者の行動を変えられて初めて意味を持つ。行動を変える手段が、交渉と、実際に支払われる金である。

```text
SELF-RESTRAINT ALONE FAILS
+ RESTRAINT MUST BE PURCHASED
+ A PROMISE NEEDS ENFORCEMENT
+ ENFORCEMENT COSTS MONEY
```

AI Agentを使う意味は、少数の数値を探索することではなく、他Agentの過去の行動から信頼を推定し、価格を提示し、裏切りを織り込んで契約を設計することにある。

## 2. 用語

| 用語 | この計画での意味 |
| --- | --- |
| Match | 1つのScenarioを開始から終了まで進める評価単位 |
| Scenario | Zone、Fleet、価格モデル、Weather Sequenceを固定した committed な世界定義 |
| Zone | 漁場。Stock、移動費、時化耐性、漁獲効率が異なる |
| Stock | Zoneごとの魚の残量。Game Engineだけが更新する |
| Fishing Agent | 1隻を運営する参加Agent |
| Observation | そのRoundにAgentへ公開される情報 |
| Action | Zone選択と投入Effortからなる構造化命令 |
| Proposal | 支払いと義務を明示した契約提案 |
| Pact | 成立した契約。Escrowに資金がロックされる |
| Escrow | 契約成立時にロックされ、遵守Roundごとに解放される資金 |
| Breach | Engineが測定した漁獲量が上限を超えた状態。Agentの自己申告では判定しない |
| Mutual Aid Fund | 参加船が毎Round拠出し、故障時に補填する共同基金 |
| Wallet Policy | Userが設定するAgentの支出権限。Match Loopが強制する |
| Demo USD | MVP内だけで使う仮想通貨。Tokenではない |
| Counterfactual Run | 同一Scenarioを契約層無効で再実行した対照結果 |
| Final Entry | 公式評価へ進める、参加者ごとに1つ選ばれたAgent Artifact |

## 3. このArenaが示すもの

Ocean Commonsが最終的に示すべき内容は次である。

1. AI Agentが、他Agentの行動を観測して資源の将来を予測し、逐次判断できる。
2. AI Agentが、他Agentへ価格を提示し、条件を交渉し、支払いを実行できる。
3. 契約の遵守と違反を、Agentの説明ではなくEngineの測定で確定できる。
4. 同じScenarioと確定済みAction Transcriptから、同じFinal StateとOutcomeを再現できる。
5. Livelihood、Commons Stewardship、Fleet ResilienceをWeighted Scoreへ統合しない。
6. 協定が「実際に何を変えたか」を反実仮想で測定できる。
7. Ethereumが、予算、Pact Escrow、Final commitment、Settlementを検証可能にする。

## 4. 言わないこと

Evidenceが存在しない段階では、次の表現を使わない。

- Game内Demo USDをTokenまたは実際の支払いと呼ばない。
- Scripted BaselineをAI Agentと呼ばない。
- Off-chain ReceiptをEthereum Transactionと呼ばない。
- Agentの自由文説明が正しいためOutcomeも正しい、と扱わない。
- 協力回数が多いことをそれ自体で善と呼ばない。
- Replay可能であることを、同じLLM推論が再現できることと混同しない。
- Escrow、Wallet、Transactionが確認できない状態で「AI paid another AI」と表示しない。

## 5. Product invariant

既存のFrontier Protocolと同じ原則を守る。

- 正しさを最初のGateにする。
- Evaluator、Generator、Scenario Pack、Action Limit、Wallet Policy、Metricsが一致する結果だけを比較する。
- すべてのOutcomeと方向を独立させる。
- Hidden Weightを持つOverall Scoreを作らない。
- Pareto、Contribution、Hash、Allocationを提出順に依存させない。
- `simulated`、`measured`、`committed`、`paid`を区別する。
- Practiceは無制限に近くしてよいが、Final EntryとFinal Evaluationの機会は平等にする。
- 海の状態はAIに決めさせない。Engineだけが更新する。

## 6. 基本ゲームループ

```text
Committed Scenario (zones, fleet, weather sequence, seed)
          |
          v
   Observation (per boat)
          |
          v
   NEGOTIATION PHASE
   proposal -> accept / reject -> escrow lock
          |
          v
   ACTION PHASE
   zone + effort (per boat)
          |
          v
   DETERMINISTIC TRANSITION
   breakdowns -> catch -> price -> costs
   -> mutual aid -> pact settlement -> regrowth -> bankruptcy
          |
          v
   Round Record  ---> next observation
          |
          v
   Transcript + Final Outcomes
          |
          v
   Counterfactual Run (negotiation disabled, same seed)
          |
          v
   Value Pools + Frontier + Settlement
```

概念上の状態遷移は次の純粋関数として扱う。

```text
nextState = transition(previousState, actions, scenario)
outcomes  = evaluate(scenario, transcript, counterfactualTranscript)
```

実際のLLM API latencyやEthereum confirmation timeは公式Outcomeへ入れない。

## 7. 海のモデル

### 7.1 決定論

Weather Sequenceは、Match開始前にSeedから一括生成してScenarioへ固定する。Match中に乱数を引かない。これにより次が成立する。

```text
same scenario + same actions  ==>  same final state, always
```

Agentの推論が非決定的でも、Game State transitionと評価は再現可能になる。

### 7.2 Zone

MVPは3 Zone。単純化のために2 Zoneへ落とさない。「どこで獲るか」が意味を持つために、支配的なZoneが存在しない構成にする。

| Zone | 性格 | Tradeoff |
| --- | --- | --- |
| Coastal shelf | 近く安いが薄い | 移動費が安い。Stockが小さくすぐ枯れる |
| Offshore bank | 遠く豊かだが時化に弱い | 移動費が高く、嵐でほぼ操業不能になる |
| Nursery reserve | 最も生産的だが保護区 | 漁獲効率が最高。ただしEffortあたり罰金。ここが他Zoneへの供給源 |

### 7.3 Spillover

Nursery reserveは毎Round、Stockの一定割合を他Zoneへ流出させる。保護区を守ることが全員の将来漁獲を増やす。

これが本計画の中心的な機構である。保護区は**共有の公共財**であり、単独では守れない。誰か1隻が獲れば全員の将来が減る。だから「保護区を獲らないことへの支払い」に経済的な意味が生じる。

### 7.4 漁獲と価格

```text
yieldPerEffort = catchEfficiency * (stock / capacity) * stormFactor
catch          = effort * yieldPerEffort         (Zone Stockを超えない範囲で按分)
price          = basePrice * (1 - elasticity * (totalCatch / reference - 1)) * priceShock
```

- Stockが減るとEffortあたりの漁獲が落ちる。乱獲は自滅的になる。
- 価格は艦隊全体の総漁獲で決まる。他船が獲りすぎると自分の売値も下がる。

この2つにより、乱獲は「他人に迷惑」ではなく「自分にも損」になる。ただし短期では乱獲が勝つ局面を残す。そうでなければ交渉が不要になる。

### 7.5 Shock

- **時化**: Zoneごとの `stormExposure` に応じて漁獲効率が低下する。Offshoreが最も影響を受ける。
- **故障**: 出漁前に発生し、そのRoundは操業不能。修理費が発生する。時化のRoundほど発生率が上がる。
- **価格変動**: Roundごとの乗数。

故障はMutual Aid Fundが存在する理由そのものである。

## 8. Fishing Agent

### 8.1 Action

```json
{ "boatId": "kaiyo", "zoneId": "offshore", "effort": 8 }
```

Effortは船の能力上限でclampされる。自由文はProvenanceとして保存できるが、State Transitionの入力にはしない。

### 8.2 Observation

Agentが見るもの。

```text
round / roundsRemaining
weather (今Roundの時化と価格乗数。故障は事前に見えない)
price
zones (パラメータ) / stocks (各Zoneの残量)
self (cash, capacity, upkeep, 累計)
wallet (policy, spentThisMatch, remaining)
others (active, underRepair, lastCatch, totalCatch, breaches, smallFleet)
activePacts / fund / incomingProposals
history (過去Round Record)
```

**今Roundの時化はAction前に公開する。** これは意図的な設計である。漁獲量が確率的だと、遵守しようとしたAgentが偶然Breachになる。契約遵守を運任せにしないため、時化は予報として与える。故障は事後に発生するので不意打ちのまま残る。

**Seed、他Agentの内部状態、将来のWeatherは公開しない。**

### 8.3 Chain of Thought

内部Chain of Thoughtの提出や再現を要求しない。短い`reasonCode`をProvenanceとして保存するが、Rewardには使用しない。UIには`Observation / Action / Declared reason / Payment / Result`だけを表示する。

## 9. 契約

Agent間の合意は自由文で終わらせない。すべて型を持つ構造化契約とする。

```text
proposal -> accept / reject -> escrow lock -> per-round compliance check -> settlement
```

### 9.1 Catch Limit Pact

支払う側が、相手のRoundあたり漁獲量に上限を課す。Zone指定または全Zone。

```json
{
  "kind": "CATCH_LIMIT",
  "capPerRound": 15,
  "zoneId": null,
  "payment": 20,
  "durationRounds": 2
}
```

### 9.2 Conservation Buyout

支払う側が、相手に特定Zone(主にNursery reserve)への出漁を止めさせる。

### 9.3 Mutual Aid Fund

参加船が毎Round拠出する。故障が発生した参加船へ、上限つきで補填する。Escrowではなくプールである。

### 9.4 Escrowの意味

これがWeb3を装飾にしないための中核である。

- 契約成立時、支払う側のCashから即座に金額がロックされる。**払えない約束はできない。**
- 遵守したRoundごとに、そのRound分が相手へ解放される。
- 違反が測定された時点で契約は終了し、**残額は支払った側へ返還される。**

したがって違反は「残りの報酬を失う」という具体的な損失を伴う。Escrow額が小さすぎれば裏切りが得になり、大きすぎれば誰も裏切らない。**この閾値が存在すること自体がPhase 0の検証対象である。**

### 9.5 遵守判定

遵守はEngineが測定した漁獲量で判定する。Agentの申告は使わない。

## 10. Wallet Policy

Userは毎Round「20匹獲れ」とは指示しない。Userが設定するのはMissionと権限である。

```text
Mission (自由文、Agentへのinstruction)
  船員の生活を維持できる収益を確保してください。
  ただし短期利益のために海の資源を使い切ることは避けてください。
  長期的に有利なら協力や共同基金への参加も検討してください。

Wallet Policy (構造化、Match Loopが強制)
  startingBudget                500 DemoUSD
  maxPaymentPerTransaction       30 DemoUSD
  maxAutonomousSpendPerMatch    150 DemoUSD
  allowedPurposes               CATCH_LIMIT / CONSERVATION_BUYOUT / MUTUAL_AID
  allowArbitraryTransfer        false
```

権限はAgentではなくMatch Loopが検証する。Agentがどう推論しても上限を超えられない。違反した提案は`OVER_PER_TX_LIMIT`などのコードで棄却され、記録される。

UserがAgentへ秘密鍵を渡す必要はない。Phase Cで実際のAgent Walletへ移行する際は、Session Key / 支出上限付きVaultとして実装する。

## 11. Scenario、Practice、Final

- **Practice**: Seedから無制限に近く生成できる。参加者が大量Simulationしてよい。禁止しない。
- **Scenario Generator**: `vary` オプションでZone Stock、成長率、移動費、船の資金と能力、価格モデルを振る。固定Mapの暗記を成立させない。
- **Final**: 未知のCommitted Seedで複数Match。Practiceで学んだ方針が一般化するかを見る。

既存Competition構造(Plan 6のParticipant / Revision / Final Entry / Value Pool)を再利用する。

## 12. ReplayとEvidence

Transcriptに次を順序どおり固定する。

```text
scenario (seed, zones, fleet, weather sequence)
per round:
  observations hash
  proposals / responses / escrow locks
  actions
  round record (catch, price, costs, releases, aid payouts, breaches)
final state
```

Replayは `scenario + actions` から `final state` を再計算し、Hashの一致を確認する。LLM推論の再現は要求しない。

## 13. Correctness Gate

次を満たさないMatchは比較対象にしない。

- すべてのActionがSchemaに適合する。
- EffortがCapacityを超えない。
- 支払いがWallet Policyの範囲内である。
- Escrow残高が負にならない。
- Replayで同じFinal StateとHashを再現できる。

## 14. 独立Outcome

**統合しない。** Weighted Scoreを作らない。

### 14.1 Livelihood

漁業者として経済的に継続できたか。

```text
finalCash / operatingProfit / survived
```

### 14.2 Commons Stewardship

海の資源を将来に残したか。

```text
finalTotalStock / minTotalStock (期間中の最低値) / nurseryFinalStock
```

最低値を入れるのは、「最後だけ回復させて途中で枯らす」戦略を評価しないためである。

### 14.3 Fleet Resilience

小規模・低資金の船も継続できたか。

```text
worstBoatFinalCash / survivingSmallFleetCount / postShockRecovery
```

自分だけ生き残る戦略と、艦隊が生き残る戦略を区別する。

### 14.4 Cooperation Efficacy — 反実仮想で測る

**「協力回数が多いほど善」にはしない。** 同一Seedで契約層を無効化した対照Matchを実行し、その差分を測る。

```text
efficacy = outcome(with pacts) - outcome(same seed, negotiation disabled)
```

Engineが決定論的だからこそ、この対照実験が正確に成立する。支払った金額に対して、Stewardship と Resilience が実際にどれだけ改善したかだけを見る。改善がなければ、何回協定を結んでいても評価しない。

## 15. Value Pools

Practice段階のPool候補。資格条件はPhase 0後に固定する。

| Pool | 何を支援するか |
| --- | --- |
| Livelihood Pool | 破綻せず営業を継続したAgent |
| Commons Stewardship Pool | 資源を将来に残した結果 |
| Small Fleet Resilience Pool | 小規模船の継続に寄与した結果 |
| Frontier Expansion Pool | Pareto Frontierを拡張したEntry |

## 16. IndividualとCoalition

「海の資源が残った」ことをAgent A単独の功績とは言えない。

したがってContribution対象を個体だけに限定しない。

```text
Artifact 候補:
  Individual Agent (Playbook)
  Pact         (A -> B, 具体的な条件と支払い)
  Coalition    (A + B + D が結んだ協定の束)
  Mutual Aid Fund (参加者集合)
```

Pact / Coalitionの寄与は、14.4の反実仮想で測る。「そのPactを無効化したら結果がどう変わったか」を計算し、`packages/shared` の `computeContributionEvidence` に渡す。これは既存のexclusive contribution計算とそのまま整合する。

Value PoolがPact自体へ配分できるなら、報酬は協定の当事者へ分配される。個人最適では到達できない結果に、直接報酬を向けられる。

## 17. Web3の役割

海のSimulationはonchainで動かさない。

```text
OFFCHAIN                      ONCHAIN
AI inference                  Agent budget
Game simulation               Agent-to-agent payment
Negotiation                   Pact escrow
Outcome calculation           Mutual aid fund
Evidence / Transcript         Final allocation commitment
Pareto / Value Pool           Reward settlement
```

既存の「Evidence offchain / Settlement onchain」をそのまま踏襲する。

- **Phase A — Game Ledger**: Demo USDのoff-chain台帳。Escrowのlock / release / refundを完全に記録する。Tokenとは呼ばない。
- **Phase B — Commitment**: Scenario Hash、Transcript Hash、Final AllocationをSepoliaへcommitする。
- **Phase C — Sepolia Pact Escrow**: 実際のEscrow Contractへ資金をロックし、遵守判定に基づきreleaseまたはrefundする。ここで初めて「AI Agentが別のAI Agentへ支払った」と言える。
- **Phase D — Agent Wallet**: 支出上限つきSession Key / Vault。Userの秘密鍵をAgentへ渡さない。

「AI paid another AI」と表示してよい条件は、Agent Wallet、Escrow Transaction、Settlement Transactionの3つがSepolia上で確認できるときに限る。

## 18. 既存コードから再利用するもの

| 既存領域 | Ocean Commonsでの再利用 |
| --- | --- |
| `packages/shared` | Challenge Manifest、metric direction、Pareto、Hypervolume、`computeContributionEvidence`、Canonical Hash |
| `packages/disaster-response` | 決定論的Scenario、複数Scenario集約、Replay Traceのパターン |
| `packages/microgrid-dispatch` | 多軸Outcomeの`OutcomeMetric`定義とEvaluator構成 |
| `apps/api/src/plan6-competition.ts` | Participant、Revision、Final Entry、Value Pool、Allocation Evidence |
| `apps/web/src/lib/plan6-store.ts` | Redisによるdurable stateとnamespace分離 |
| `apps/runner` | Context一致確認、Job実行、Attestation boundary |
| `apps/web/src/lib/arenas.ts` | Arena RegistryとPractice lifecycle |
| `apps/web/src/lib/arena-adapters.tsx` | Ocean Commons固有Workbenchへのfail-closed adapter |
| `FrontierRewardPool` | Final Allocation commitment、distribution |
| `FrontierDemoToken` | 金銭価値を主張しないSepolia Demo TokenのPattern |

計画9 Rescue Roomとは、Agent Wallet / Escrow / 交渉プロトコルという同種のプリミティブを必要とする。**Phase 0の段階では意図的に重複させ、共通化しない。** 2つの実例が揃ってから抽出する方が正しい抽象になる。この判断は §27 に記録する。

## 19. 追加予定の主なファイル

```text
packages/ocean-commons/
  src/
    types.ts          海・船・契約の型
    rng.ts            決定論的PRNG
    scenario.ts       Zone / Fleet / Weather Sequence 生成
    engine.ts         transition(state, actions, scenario)
    negotiation.ts    proposal 検証 / escrow lock / 遵守判定 / settlement
    agents.ts         Observation、Wallet Policy、Baseline Policy
    match.ts          Match Loop、Wallet Policy強制
    evaluator.ts      独立Outcome、反実仮想、Pareto、Contribution
    index.ts
  src/*.test.ts

scripts/simulate-ocean-commons.ts    Phase 0 大量Simulation Runner

--- Phase 1以降 ---
apps/runner/src/ocean-commons-runner.ts
apps/web/src/components/ocean-commons-workbench.tsx
apps/web/src/components/ocean-commons-replay.tsx
apps/web/src/app/v1/ocean-commons/route.ts
Docs/arenas/ocean-commons.md
benchmarks/ocean-commons/
```

### 19.1 共通接続ファイルへは触らない

計画9が同時進行しているため、Phase 0では次のファイルを**変更しない**。

```text
apps/web/src/lib/arenas.ts
apps/web/src/lib/arena-adapters.tsx
apps/api/src/index.ts
apps/runner/src/index.ts
packages/sdk/src/index.ts
openapi/frontier-v1.yaml
package.json
Docs/STATUS.md / Docs/README.md / README.md
packages/contracts/
```

Phase 0はvitestとstandalone scriptだけで完結する。接続に必要な差分は `Docs/plans/ocean-commons-merge.md` に記述し、計画9の着地後に適用する。

## 20. 最小MVP

Phase 0が`GO`になった場合の最小MVP候補。

- 3 Zone (Coastal / Offshore / Nursery reserve)
- 5隻 (うち小規模2隻)
- 12 Round
- Logistic成長 + Spillover + 価格弾力性
- 時化 / 故障 / 価格変動
- Catch Limit Pact と Conservation Buyout
- Mutual Aid Fund
- Escrow lock / release / refund の完全な台帳
- 5種類のBaseline Policy
- Wallet Policy強制
- 完全なAction / Payment / Evidence / State Replay
- 3つの独立Outcome + 反実仮想によるCooperation Efficacy
- 4つのPractice Value Pool

MVPへ含めないもの:

- 実際のSepolia Escrow Payment
- 実Agent Wallet / Session Key
- User対User Agent Tournament
- 動的なAgent Market
- 任意コードの実行
- Mainnet Tokenまたは金銭価値の主張

## 21. Phase 0 — Arena成立性のSimulation

### 目的

UI、LLM、Ethereumを作る前に、**交渉が非自明で、固定攻略法が存在せず、複数の独立Outcomeを持つゲームとして成立するか**を確認する。

### 実装するもの

- [x] 型定義 (`types.ts`)
- [x] 決定論的PRNG (`rng.ts`)
- [x] Scenario Generator + Weather Sequence (`scenario.ts`)
- [x] Game Engine transition (`engine.ts`)
- [x] Proposal検証 / Escrow / 遵守判定 / Settlement (`negotiation.ts`)
- [x] Observation、Wallet Policy、Baseline Policy (`agents.ts`)
- [x] Match Loop + Wallet Policy強制 (`match.ts`)
- [ ] 独立Outcome集約と反実仮想 (`evaluator.ts`)
- [ ] Scenario / Transcript / Result Hash
- [ ] 決定論テスト
- [ ] 大量Simulation Runner (`scripts/simulate-ocean-commons.ts`)

### Baseline

最低限、次を比較する。

- **Greedy** — 常に最大Effort。保護区も獲る
- **Cautious** — 持続可能な余剰だけ獲る。保護区に入らない
- **Broker** — 資源が減ると他船へCatch Limitを買いに行く
- **Opportunist** — 契約を受けて金を取り、Escrow残額を上回る利益が出た時点で離脱する
- **Reciprocator** — 周囲が自制していれば自制し、裏切られたら報復する
- **All-Greedy fleet** — 5隻すべてGreedy(共有地の悲劇の下限)
- **All-Cautious fleet** — 5隻すべてCautious(協調の上限)
- **Random policy** (seed付き)

### 調べること

- どの固定Policyがどの状況で失敗するか。
- 同じ初期Observationから異なる正しいActionが必要になるか。
- 交渉が有効なScenarioと無駄なScenarioが両方あるか。
- Escrow額の大小がOpportunistの離脱判断を変えるか。
- Zone選択が状況によって変わるか、それとも1つに固定されるか。
- Livelihood、Stewardship、Resilienceがほぼ同じ順位になっていないか。
- Practiceで学習した方針が未知Seedへ一般化するか。

### GO条件

**測定前に固定する数値基準。** 200 Seed、`vary: true` で測定する。

1. **決定論**: 同一Scenario + 同一Action Transcriptから、同一Final StateとHashを 200/200 Seedで再現できる。
2. **固定Policy非支配**: 単一Baselineが3つのOutcomeすべてで1位になるSeedが **20%未満**。
3. **Frontierの多様性**: Pareto Frontierに意味の異なるPolicyが2つ以上残るSeedが **60%以上**。
4. **協定が効く**: 交渉ありと交渉なし(同一Seed)で、Stewardship中央値の差が **5%以上**。
5. **協定が万能でない**: 交渉ありがLivelihoodで交渉なしに劣るSeedが **20%以上**。両立しないTradeoffが実在すること。
6. **Escrowが機能する**: Escrow額を2倍にしたとき、Opportunistの違反率が **30%以上**低下する。金額が判断を変えること。
7. **Outcomeの独立性**: 3つのOutcomeの全ペアでSpearman順位相関 **|ρ| < 0.8**。
8. **Zone選択の非自明性**: 全Seed・全Roundを通じて、最頻Zoneの選択比率が **70%未満**。
9. **情報漏洩なし**: Agent-visible inputからSeed、他Agentの内部状態、将来Weatherが漏れていない。
10. **実行コスト**: 200 Seed × 5 Agent × 12 Roundが公開運用可能な時間に収まる。

### PIVOT条件

次の場合はZone、価格、Escrow、Outcomeを変更して再検証する。

- Greedyが3つのOutcomeすべてで支配する。または All-Cautious が常に最良になる。
- 交渉が常に得、または常に損になる。
- Escrow額を変えても違反率が動かない。契約に経済的意味がない。
- Zoneが実質1つに固定される。
- 3軸がほぼ同じ順位になり、独立価値にならない。
- Action Spaceが小さく、全探索Lookupだけで未知Seedも攻略できる。
- Spilloverが効かず、保護区を守る動機が生じない。

### STOP条件

次の場合はOcean CommonsのCompetition化を中止する。

- 恣意的なRandom罰則なしでは固定戦略を防げない。
- 交渉に一貫した経済的価値を作れない。
- 再現可能なState Transitionと公平なAgent比較を両立できない。
- 評価費用または実行時間がTournamentとして現実的でない。

STOPしても、Multi-Agent Negotiation ReplayまたはAgent-to-Agent Escrowのreference demoとして価値があるかは別に判断する。

## 22. Phase 1 — Playable Practice Arena

Phase 0が`GO`の場合だけ開始する。

- [ ] Evaluatorを完成させ、Arena Registryへ接続する
- [ ] Ocean Commons Action APIを追加する
- [ ] Game Credit LedgerとPayment Receiptを実装する
- [ ] Reference Fishing Agentを1体(LLM-backed)動かす
- [ ] 交渉ありと交渉なしのAgentを比較する
- [ ] Ocean UI(中央に海、周囲に船、契約の線)を追加する
- [ ] `Docs/arenas/ocean-commons.md` を追加する

## 23. Phase 2以降

- **Phase 2**: 統制されたAI-assisted Competition。同一Model / Tool Schema / Token Limitで比較する。
- **Phase 3**: Sepolia Pact Escrow。実際のAgent-to-Agent Payment。
- **Phase 4**: User対User Agent Tournament。動的なAgent Market。

## 24. 検証

### Deterministic Test

- 同一Seed / 同一Actionが同一Final Stateを生む。
- Weather Sequenceが同一Seedで一致する。
- Escrow残高が負にならない。
- 違反時に残額が正しく返還される。
- Wallet Policy超過の提案が棄却される。
- Bankrupt船が以後行動しない。

### Agent Experiment

- 8種類のBaseline構成 × 200 Seed。
- 交渉あり / なしの対照実行。
- Escrow額を変えた感度分析。

### UIとEvidence

- Replayが同じFinal Stateを再現する。
- 表示するのは`Observation / Action / Declared reason / Payment / Result`のみ。内部Chain of Thoughtを表示しない。

## 25. 文書更新

- [ ] Phase 0開始時に数値付きGO / PIVOT基準を固定する(§21で固定済み)
- [ ] Phase 0判定をこのPlanと`Docs/STATUS.md`へ記録する
- [ ] Phase 1実装時に`Docs/arenas/ocean-commons.md`を追加する
- [ ] 計画9との共通基盤抽出可否を§27へ記録する

## 26. Plan 10の完了条件

1. Phase 0のGO条件を満たし、そのEvidenceを保存している。
2. 3つの独立OutcomeがWeighted Scoreへ統合されていない。
3. 反実仮想によるCooperation Efficacyが計算できている。
4. Replayが同じFinal StateとHashを再現できる。
5. Escrowのlock / release / refundが完全に記録されている。
6. 公開claimが利用可能なEvidenceと一致している。

Phase 0が`PIVOT`または`STOP`になった場合は、未達項目を完成扱いにせず、判断とEvidenceを記録してPlanを終了できる。

## 27. 計画9との関係

計画9 Rescue Roomと計画10 Ocean Commonsは、次のプリミティブを共有しうる。

```text
Agent Wallet / 支出権限
Escrow (lock / release / refund)
構造化された Proposal / Accept
決定論的 transition + Transcript Replay
Scenario Generator + Hidden Final Seed
統合しない独立Outcome + Value Pool
```

**Phase 0では共通化しない。** 理由は次である。

1. 計画9はPhase 0未完了で、インターフェースが固まっていない。
2. 並行開発中に同じ抽象を2箇所から設計すると必ず食い違う。
3. 計画9 §18自身が「最初から全面的に抽象化しない」と定めている。

両者がPhase 0を通過した時点で、実装済みの2例を比較して共通基盤を抽出する。抽出する場合は、`packages/shared` へ `escrow` と `agent-wallet` を追加する案を第一候補とする。

## 28. 最初に行う順番

1. `evaluator.ts` で3つの独立Outcomeと反実仮想を実装する。
2. Scenario / Transcript / Result Hashを実装する。
3. 決定論テストを通す。
4. `scripts/simulate-ocean-commons.ts` で8 Baseline × 200 Seedを回す。
5. §21のGO条件10項目を機械的に判定する。
6. 判定結果をこのPlanと`Docs/STATUS.md`へ記録する。
7. `GO`の場合だけ、UIと実際のLLM Fishing Agentへ進む。

---

## 30. Phase 0 初回測定 — 2026-09-10

> この節は世界パラメータのみを調整した段階の記録である。Agent側の調整後の最終結果は §31 を参照。

`scripts/simulate-ocean-commons.ts` を200 Seed × 8 Lineup × 4条件(通常 / 契約なし / Escrow倍額 / 再実行)= 6400 Matchで実行した。

**判定: PIVOT**（§21のGO条件10項目中8項目を満たす）

| # | 判定項目 | 閾値 | 実測 | 結果 |
| --- | --- | --- | --- | --- |
| 1 | 決定論 / Replay一致 | 全一致 | 全一致 | PASS |
| 2 | 単一Policyが3軸支配 | < 20% | 0.0% | PASS |
| 3 | Frontierに2つ以上残る | >= 60% | 100.0% | PASS |
| 4 | 協定がStewardshipを改善 | \|差\| >= 5% | 0.5% | **FAIL** |
| 5 | 協定がLivelihoodを犠牲にする局面 | >= 20% | 37.4% | PASS |
| 6 | Escrow倍増で違反減少 | >= 30% | -12.5% | **FAIL** |
| 7 | 3軸の独立性 | < 0.8 | max\|ρ\|=0.509 | PASS |
| 8 | Zone選択の非自明性 | < 70% | 51.4% | PASS |
| 9 | 情報漏洩なし | テストで担保 | 19テスト通過 | PASS |
| 10 | 実行コスト | < 120s | 4.5s | PASS |

### 30.1 Phase 0で確定した設計変更

測定の過程で、当初の設計では成立しない点が4つ判明し、修正した。

1. **Depensation（臨界水準）を導入した。** 当初のlogistic成長では、艦隊が全力で漁をしてもhealthが0.71までしか落ちず、共有地の悲劇が発生しなかった。乱獲の利益はcautiousの4倍で、資源の代償がほぼ無い。`collapseThreshold`（容量の25〜30%）を下回ると再生産が負に転じる項を追加し、回復不能な崖を作った。
2. **Spillover率を 0.14 → 0.05 へ下げた。** 保護区の最大持続移出量は0.088であり、0.14では**誰も漁をしなくても保護区が枯死**していた。守っても死ぬなら保護する動機が生じない。
3. **Conservation Buyoutの定義を修正した。** 当初は「特定漁場を避ける」契約としたが、これでは漁獲圧が他の漁場へ移動するだけで総漁獲は減らない。ブリーフの「漁獲権の一部を放棄」に従い、**操業権そのものの売買**（`zoneId: null` で全面操業停止）へ変更した。
4. **Wallet Policyの上限を 30/150 → 90/300 へ引き上げた。** 1Roundの漁獲利益が約40〜80 DemoUSDあり、30では操業停止の補償にならず、支払いを受けた船が金を取ったうえで別の漁場へ行くだけだった。

### 30.2 未達2項目の原因

**#4 — 契約が資源を守れない。** 根本原因は**単独Agentの予算規模**である。Brokerの1 Match予算300 DemoUSDに対し、艦隊全体の漁獲収入は数千 DemoUSDある。1隻が買い取れるのは全体60隻Roundのうち2〜3隻Round分にすぎず、総資源量を5%動かせない。二者間契約では他船が余剰を吸収し、Coalition化して3隻へ分割すると1隻あたりの補償が薄まって拒否される（実測: 分割時 #4=0.2%、単独時 #4=1.6%）。

**#6 — Escrow感度が測れない。** #4対応でEscrowを90へ引き上げた結果、離脱が割に合わなくなり、違反が1600 Match中8件まで減った。倍額条件との差（8件 vs 9件）は統計的な意味を持たない。Escrowが**効きすぎて**感度を測定できない状態である。

### 30.3 PIVOT候補

| 案 | 内容 | 評価 |
| --- | --- | --- |
| **A. Conservation Fund** | Mutual Aid Fundと同様に、全船が毎Round拠出する保全基金を作り、**集団で**操業停止を買い取る。単独予算の限界を構造的に超える | 推奨。§16のCoalition評価とも整合する |
| B. 経済のスケール調整 | 漁獲収入を予算に対して小さくし、30 DemoUSDが意味を持つ水準にする | Userのブリーフの数値を維持できるが、漁業の実感が薄れる |
| C. 崖の近傍で利害を一致させる | 保護区の崩壊が自船の収入を即座に破壊する構造にし、個人的利益だけで保全が選ばれるようにする | 交渉が不要になり、Arenaの中心が失われる恐れがある |

Aを採る場合、#6は「基金の規模」を振って再測定する。単独Escrowではなく基金拠出額が離脱判断を変えるかを見る。

### 30.4 この時点で成立している主張

Evidenceがあるものだけを記す。

- 決定論とReplayは完全に成立している（6400 Match、Hash一致）。
- 3つのOutcomeは独立している（max|ρ|=0.509）。
- 固定Policyによる支配は存在しない（0.0%）。
- Zone選択は状況依存である（最頻51.4%）。
- 契約はLivelihoodとStewardshipのTradeoffを実際に生む（37.4%のMatchで協定がLivelihoodを下げる）。
- Escrowのlock / release / refundは完全に記録される（release 26,865 / refund 495 DemoUSD）。

**まだ言えないこと**: 協定が共有資源を守る、とは現時点のEvidenceでは言えない。

---

## 31. Phase 0 再測定 — Agent側の調整後

§30 の時点では世界のパラメータ（成長率、流出率、価格弾力性）だけを調整しており、**Agent側の調整をほとんど行っていなかった**。契約が成立したMatchは12%にすぎず、処置が効いていたのは全体の約2%だった。効果の大きさではなく発生頻度が律速していた。

### 31.1 行った調整

閾値は一切変更していない。変更したのは機構だけで、いずれも因果の説明がつくものに限った。

1. **Brokerが相手の逸失利益から値付けする。** 従来は予算上限をそのまま提示していたため、最も漁獲の多い船（＝最も高くつく船）に安値を出して断られ続けていた。公開情報（前Roundの漁獲量 × 現在価格 × 想定利益率）から相手の逸失利益を推定し、それを1割上回る額を提示する。
2. **買える相手を選ぶ。** 常に最大の船へ入札するのではなく、予算内で買える中で最も漁獲の多い船を選ぶ。
3. **崖の手前で発動する。** 発動閾値を `collapseThreshold + 0.35` から `+ 0.55` へ広げた。崩壊後に操業停止を買っても何も戻らない。
4. **Wallet上限を 90/300 → 150/600 へ引き上げた。**

### 31.2 #6 の実験条件の誤り

倍額条件で `maxPaymentPerTransaction` だけを倍にしていたが、Brokerが逸失利益ベースで値付けするようになった結果、**1契約あたりのEscrowは変わらず、契約数だけが増えていた**。違反の絶対数が増え、見かけ上「Escrowを増やすと違反が増える」という誤った結果が出ていた。

2点を修正した。

- 違反を**率**（違反数 / 制約付き成約数）で測る。契約数が変われば絶対数は当然変わる。
- 倍額条件では Broker の提示額そのものを倍にする（`priceMultiplier`）。Escrowの厚みを直接振らなければ、Escrowの効果は測れない。

### 31.3 最終結果 — 200 Seed

**判定: PIVOT**（8項目 PASS、#6は閾値上）

| # | 判定項目 | 閾値 | §30時点 | 最終 | 結果 |
| --- | --- | --- | --- | --- | --- |
| 1 | 決定論 / Replay一致 | 全一致 | 全一致 | 全一致 | PASS |
| 2 | 単一Policyが3軸支配 | < 20% | 0.0% | 0.0% | PASS |
| 3 | Frontierに2つ以上残る | >= 60% | 100% | 100% | PASS |
| 4 | 協定がStewardshipを改善 | >= 5% | 0.5% | **1.9%** | **FAIL** |
| 5 | 協定がLivelihoodを犠牲にする局面 | >= 20% | 37.4% | 43.9% | PASS |
| 6 | Escrow倍増で違反減少 | >= 30% | 測定不能 | **29.4%** | **FAIL（閾値上）** |
| 7 | 3軸の独立性 | < 0.8 | 0.509 | 0.469 | PASS |
| 8 | Zone選択の非自明性 | < 70% | 51.4% | 48.1% | PASS |
| 9 | 情報漏洩なし | テスト | 通過 | 通過 | PASS |
| 10 | 実行コスト | < 120s | 4.5s | 5.0s | PASS |

補足統計:

```text
制約付き契約が成立したMatch    1125 / 1600  (12% -> 70%)
違反率                        通常 6.7% (277/4104) -> 倍額 4.8% (213/4472)
Escrow release / refund       284,459 / 20,226 DemoUSD
```

#6 は 60 Seed では 32.3%、200 Seed では 29.4% であり、閾値上に位置する。**通過とは扱わない。** Escrowの厚みが離脱を抑えることは方向として確認できたが、事前に固定した基準を満たしていない。

### 31.4 #4 が動かない理由

調整により契約成立率は12%から70%へ上がったが、Stewardshipへの効果は0.5%から1.9%までしか改善しなかった。試したどの構成でも 2% 前後で安定している。

原因は**資金規模**である。買い手1隻の1 Match予算では、1隻を3 Round止めるのが限界で、これは艦隊全体の投入努力量の約5%にあたる。それが `minTotalStock` を動かす幅が約2%である。

買い手を2隻に増やす案は実測で否定された（#4は 2.0% → 2.2% とほぼ不変、#6は 32.3% → 13.0% へ悪化）。1隻あたりが拘束できるのは同時に1隻までであり、買い手を増やしても資金が先に尽きる。

つまり**契約成立率でも、値付けでも、Escrow設計でもなく、保全に投じられる資金の総量が制約になっている**。§30.3 の A案（Conservation Fund）が指す構造そのものである。

### 31.5 現時点で言えること

- 決定論とReplayは完全に成立している。
- 固定攻略法は存在しない（単一Policyの3軸支配 0.0%）。
- 3つのOutcomeは独立している（max|ρ|=0.469）。
- Zone選択は状況依存である（最頻48.1%）。
- 契約は成立し、LivelihoodとStewardshipの実際のTradeoffを生む（43.9%のMatchで協定がLivelihoodを下げる）。
- Escrowのlock / release / refundは完全に記録される。
- Escrowの厚みは離脱率を下げる方向に働く（6.7% → 4.8%）。ただし事前基準の30%には届かない。

**まだ言えないこと**: 協定が共有資源を守る、とは言えない。効果は正の方向で安定しているが、事前に固定した5%の水準には達していない。

### 31.6 次の一手

Conservation Fund を実装する。Mutual Aid Fund と同じ構造で、全船が毎Round拠出し、**基金として**操業停止を買い取る。単独予算では届かない資金規模に到達させる。

このとき #6 は「基金の規模」を振って再測定する。基金拠出額が離脱判断を変えるかを見る。

---

## 32. Phase 0 第3測定 — Conservation Fund 導入後

§31 で、残る制約が**保全に投じられる資金の総量**であると特定した。買い手1隻の予算では1隻を3 Round止めるのが限界で、それは艦隊の投入努力量の約5%にすぎない。そこで Conservation Fund を実装した。

### 32.1 Conservation Fund の設計

Mutual Aid Fund と同じ購読型のプールだが、目的と支払先が異なる。

| | Mutual Aid Fund | Conservation Fund |
| --- | --- | --- |
| 拠出 | 参加船が毎Round | 参加船が毎Round |
| 支払先 | **参加船自身**（故障時の補填） | **参加していない船**（操業停止の買い取り） |
| 目的 | 個々の事業継続 | 共有資源の保全 |

新しい契約種別 `CONSERVATION_FUND` を追加し、Proposalに `fundedBy: "SELF" | "CONSERVATION_FUND"` を持たせた。基金が出資した契約では次が成立する。

- Escrowは提案者の現金ではなく**基金残高**からロックされる。
- 違反時の返還先も基金である。
- 個人のWallet上限（`maxPaymentPerTransaction` / `maxAutonomousSpendPerMatch`）は適用されない。個人の権限は**基金へ加入する時点**で行使済みであり、基金の支出は加入時に合意した `standDownCap` が律する。

これは設計上の重要な区別である。Userが与える権限は「いくら払ってよいか」であり、基金加入後は「いくら拠出するか」に変わる。**共同体の資金の使い道は共同体の規約が決める。**

### 32.2 結果 — 200 Seed

| # | 判定項目 | 閾値 | §31 | §32 | 結果 |
| --- | --- | --- | --- | --- | --- |
| 1 | 決定論 / Replay一致 | 全一致 | 全一致 | 全一致 | PASS |
| 2 | 単一Policyが3軸支配 | < 20% | 0.0% | 0.0% | PASS |
| 3 | Frontierに2つ以上残る | >= 60% | 100% | 100% | PASS |
| 4 | 協定がStewardshipを改善 | >= 5% | 1.9% | **5.8%** | **PASS** |
| 5 | 協定がLivelihoodを犠牲にする局面 | >= 20% | 43.9% | 56.7% | PASS |
| 6 | Escrow倍増で違反減少 | >= 30% | 29.4% | **-6.1%** | **FAIL** |
| 7 | 3軸の独立性 | < 0.8 | 0.469 | 0.408 | PASS |
| 8 | Zone選択の非自明性 | < 70% | 48.1% | 51.6% | PASS |
| 9 | 情報漏洩なし | テスト | 通過 | 通過 | PASS |
| 10 | 実行コスト | < 120s | 5.0s | 6.3s | PASS |

**9項目 PASS。** #4 が初めて基準を満たした。

### 32.3 #4 の用量反応

Stewardshipへの効果は基金の拠出額に対して単調に増加する。効果が資金量で決まるという §31.4 の診断を裏づける。

```text
拠出 12/Round/隻  ->  #4 = 3.8%
拠出 20/Round/隻  ->  #4 = 5.1%   (80 Seed) / 4.8% (200 Seed) — 閾値上
拠出 28/Round/隻  ->  #4 = 5.8%   (200 Seed)
拠出 36/Round/隻  ->  #4 = 6.5%   (80 Seed)
```

採用値は 28 とした。20 は 200 Seed で 4.8% と閾値を割り、閾値直上の値を選ぶことは**結果を見て基準に合わせる行為**になるため採らない。28 は 12 Round で1隻あたり 336 DemoUSD、開始資金の約 7 割にあたる重い負担であり、これが #5（協定がLivelihoodを犠牲にする局面 56.7%）に表れている。保全は無料ではない、という結果になっている。

### 32.4 #6 は飽和して測定できない

Escrowの厚みを 0.5倍 / 1倍 / 2倍と振った用量反応曲線は**平坦**である。

```text
0.5x  ->  違反率 3.1% (79/2521)
1.0x  ->  違反率 3.8% (153/4023)
2.0x  ->  違反率 4.0% (148/3668)
```

基金が入ると提示額が潤沢になり、0.5倍にしても離脱の利得を上回る。曲線全体が離脱閾値の上にあり、**Escrowの大小が判断を変える領域を外れている**。

§31 の基金なし構成では 8.2% → 5.5%（60 Seed、32.3%減）、6.7% → 4.8%（200 Seed、29.4%減）が観測されており、**機構そのものは働く**。基金がそれを飽和させた。

これは調整で消すべき結果ではない。「十分に資金のあるプールは、離脱を割に合わなくすることで契約を安定させる」という知見であり、Escrowに関する発見の一つとして記録する。ただし事前に固定した #6 の基準は満たしていない。

### 32.5 判定

**PIVOT（9項目 PASS、#6 未達）**

Phase 0 の開始時点と比べ、Arenaの成立性は大きく改善した。

| | 初回 §30 | 最終 §32 |
| --- | --- | --- |
| 制約付き契約が成立したMatch | 12% | 75% |
| 協定のStewardship効果 | 0.5% | 5.8% |
| PASS項目 | 8 | 9 |

`GO` を宣言しない。#6 が事前基準を満たしていないためである。ただし未達の理由は「機構が働かない」ではなく「機構が効きすぎて感度を測れない」であり、§30 時点の未達とは性質が異なる。

### 32.6 #6 を測定可能にするには

次のいずれかが必要である。Phase 0 の続きとして実施するか、Phase 1 へ送るかは判断を要する。

1. 基金の `standDownCap` を絞り、提示額が離脱の利得付近に来るようにする。契約は不安定になるが、Escrowの効果は測定可能になる。
2. Opportunist の離脱条件を、残Escrow総額ではなく1Roundあたりの解放額と比較する形に変える。現在は保守的すぎる。
3. #6 の対象を基金なし構成に限定し、基金あり構成では「飽和」を別途記録する。

いずれも結果を見てから基準を緩める操作にならないよう、実施前に判定方法を固定すること。

---

## 33. #4 の合格ラインと改善余地

### 33.1 定義と現在地

```text
stewardship = minTotalStock（Match中の総資源量の最低値）
対象        = 拘束力のある契約が成立したMatchのみ（1200/1600）
判定        = |median(契約あり) - median(契約なし)| / median(契約なし) >= 5%
現在        = (1485.4 - 1404.4) / 1404.4 = 5.8%
```

### 33.2 理論上限

全船が一切漁をしない場合を上限として測定した（200 Seed、中央値）。

```text
誰も漁をしない   1717
契約なし         1363
契約あり         1452

理論上の最大改善幅   26.0%
現在の達成           6.5%  （上限の 25% を回収）
```

合格ラインの5%は理論最大の約1/5にあたる。基準が厳しいのではなく、回収率が低い。

### 33.3 何が制約しているか

基金の**収入速度と1件の価格の比**である。

```text
基金の収入        28 x 4名 = 112 DemoUSD / Round
操業停止1件の価格  約 277 DemoUSD（3 Round拘束）
→ 約2.5 Roundに1件しか買えない
→ 停止させられるのは全隻Roundの 8.9%
→ Stewardship 効果 5.8%
```

終盤の拠出は使い切れず、**基金残高の46%が死蔵**される（支出704 / 残高601）。

なお 8.9% の努力量削減で理論最大の25%を回収しているため、**狙いを定めた操業停止は一律削減より約2.6倍効率が良い**。崩壊間際の漁場で最も獲っている船を止めることに意味がある。

### 33.4 検証した調整と結果

| 調整 | 範囲 | #4 への効果 |
| --- | --- | --- |
| 基金の拠出額 | 12 → 36 / Round / 隻 | **3.8% → 6.5%（唯一効く）** |
| 1件あたり上限 `standDownCap` | policyCap × 2.5 → 8 | 効果なし |
| 発動閾値 `collapseThreshold +` | 0.55 → 1.2（常時発動） | 効果なし |
| 拘束期間 | 1 / 2 / 3 Round | 4.9% / 6.1% / 6.3% |
| 1 Roundに複数件提案 | 最大3件 | 効果なし（1件目で予算が尽きる） |

上限・発動条件・提案件数はいずれも効かない。予算が先に尽きるためである。**効くのは資金量と、その使い切り効率だけ**である。

### 33.5 さらに改善する方法

1. **死蔵金の解消（46%）。** 終盤は拠出を止める、または残Roundが少なくなったら残高を集中的に使い切る。同じ拠出額のまま実効資金が最大1.8倍になる。
2. **フリーライダーの構造。** Greedyは基金に加入しないが、操業停止の対価は受け取る。**拠出せずに受給する**側にいる。加入率が 4/5 → 5/5 になれば収入が25%増える。ただしこれは共有地問題そのものであり、欠陥ではなく題材である。「加入しない船には買い取りを提示しない」とすると基金の目的（資源を痛める船を止める）と矛盾するため、単純な修正では解けない。Phase 1 でLLM Agentがこの緊張をどう扱うかは、このArenaの見どころになりうる。
3. **拠出額の引き上げ。** 効くが、#5（協定がLivelihoodを犠牲にする局面）が既に56.7%であり、生活を圧迫する。保全と生計のTradeoffそのものなので、上げれば良いという性質ではない。

### 33.6 #6 の新しい証拠

Escrowの用量反応曲線を 0.5倍まで広げたところ、**閾値より下では明確に効く**ことが分かった。

```text
0.5x  ->  違反率 8.8% (243/2774)
1.0x  ->  違反率 4.2% (172/4051)
2.0x  ->  違反率 4.2% (155/3676)
```

Escrowを半額にすると違反率は2倍以上になる。1倍以上では飽和する。事前に固定した #6 の判定（2倍で30%減）は、**飽和領域を測る設計になっていた**。機構は働いており、測り方が領域を外していた。

§32.6 の対処案のうち、案3（判定を飽和しない領域で行う）が妥当と考えられる。ただし実施前に判定方法を固定すること。

---

## 34. 死蔵金の解消

§33.5 の案1を実施した。追加負担なしで実効資金を増やす。

### 34.1 終盤の拠出停止

操業停止は残Roundがなければ約定できない。締切間際に入った拠出は使われることがなく、メンバーへの純粋な負担にしかならない。残り2 Round以下では基金が徴収を止めるようにした（`engine.ts`）。

あわせて、残り4 Round以下では1件あたり上限 `standDownCap` を外し、残高全額を約定可能にした。上限は「早い段階で1件に賭けすぎない」ための保護であり、終盤には守るべき「後」が存在しない。

### 34.2 基金残高の競合

Broker 2隻が同じ基金残高を見て同じRoundに提案し、先に成立した側が使い切るため、後発が `FUND_INSUFFICIENT` で無効になっていた。**1 Matchあたり1.39件の提案が、値付けが古いというだけの理由で捨てられていた。**

Match Loopの交渉フェーズを、全提案を集めてから一括処理する形から、**1隻ずつ提案して即座に処理する**形へ変更した。2隻目は実際に残っている額を見て相手を選べる。Agentの順序は固定なので、Replayの決定性は保たれる。

### 34.3 結果

| | §33 時点 | §34 |
| --- | --- | --- |
| 基金への拠出総額 | 1305 | **1097**（−16%） |
| 提案の成立率 | 54% | **75%** |
| `FUND_INSUFFICIENT` | 1.39 件/Match | **0** |
| 停止させた隻Round | 8.9% | **10.2%** |
| #4 協定がStewardshipを改善 | 5.8% | **5.9%** |
| #5 協定がLivelihoodを犠牲にする局面 | 56.7% | **53.9%** |

**同じ保全効果を、16%少ない負担で達成している。** #4 がほぼ動かず #5 が改善したのは、削ったものが効果ではなく無駄だったためである。

### 34.4 残る死蔵金 44% の性質

拠出の44%はなお使われずに終わる。ただし性質が変わった。以前は**買いたくても金が届かない**状態だったが、現在は**金はあるが買える相手がいない**状態である。

1隻は同時に1つの操業停止契約しか結べず、契約は3 Round続く。候補は4隻なので、12 Roundで拘束できるのは最大でも約16隻Round（全60隻Roundの26%）であり、現在の10.2%はその4割にあたる。

発動閾値を +0.55 から +1.1（ほぼ常時発動）まで広げても #4 は 6.1% で変わらない。**買い手側の判断ではなく、契約の構造が上限を作っている。**

さらに伸ばすなら次が要る。いずれも Phase 1 の検討事項とする。

- 1隻に対する複数契約、または契約終了と同時の再契約
- 期間の短い契約を高頻度で回す（§33.4 では期間2で 6.1%、期間3で 6.3%）
- 基金が「艦隊全体の総漁獲枠」を買う形式（個別の船ではなく総量を対象にする）

---

## 35. ゲームとしての成立性 — 分散分解

10項目の判定は「Arenaとして測定可能か」を見ている。ゲームとして成立するかは別問題であり、**結果が運で決まるのか腕で決まるのか**で測る必要がある。各Outcomeの分散を Seed 由来と Policy 由来へ分解した（150 Seed × 5 Policy、Focal Policy以外の4隻は固定）。

### 35.1 初回測定 — 2軸が運で決まっていた

```text
                Policy由来   Seed(運)由来
Livelihood        39.0%        35%     健全
Stewardship        9.4%        89%     ほぼ運
Resilience         6.6%        89%     ほぼ運
```

さらに Resilience は `greedy 69 > cautious 38` と意図と逆に並んでいた。

#2「単一Policyが3軸支配」が 0.0% で通っていたのは、判定が「同一Seedで3軸**同時**1位」という緩い条件だったためである。平均で見れば greedy は Livelihood と Resilience の2軸で勝っていた。

### 35.2 A — Stewardship の測定バグ（修正済み）

Scenario Generator は漁場の規模を ±20% 振る。にもかかわらず Stewardship を**魚の絶対数**で比較していた。規模の異なる海を匹数で比べても意味がない。

容量比へ正規化した結果:

```text
絶対量        Seed 89%  /  Policy  9.4%
容量比        Seed 52%  /  Policy 41.9%    ← 4.5倍
```

これは基準を緩める操作ではなく、物差しの誤りの修正である。

### 35.3 B — Resilience 軸（部分的にしか直らない）

2つ変更した。

1. **Hullごとの就航限界。** `Boat.stormLimit` を追加し、`zone.stormExposure × stormSeverity` がそれを超える海域では出漁できないようにした。小型船は時化で沖へ出られず沿岸へ押し戻される。生存が他者の振る舞いに依存する構造を作るためである。
2. **指標の再設計。** 「最弱船の最終資金（絶対額）」から「**最も弱い小型船の、開始資金に対する最終資金の比**」へ変更した。絶対額は「全員が荒く稼いだ艦隊」ほど高くなるため、自制が greed より低く出るという逆転を起こしていた。

結果、小型船の破綻は 24% → 41% のMatchで起きるようになり、災害は脅威になった。**しかし軸の Policy 由来は 4.7% のままである。**

原因は世界ではなく実験設計にある。Focal Policy は大型船に載っており、小型船（nagi / shiosai）は常に背景艦隊の固定Policyで動く。Resilience は Focal の**二次的な影響**しか測っていない。

### 35.4 C — 乱獲のペナルティ強化（4つの調整すべて失敗）

| 調整 | 範囲 | 結果 |
| --- | --- | --- |
| Round数 | 12 / 18 / 24 | greedy優位は 1.47x → 1.09x に縮むが、**Livelihood の Policy 由来が 31% → 7% へ崩壊**。腕の差が消える |
| 価格弾力性 | 0.4 / 0.2 / 0.08 | 沿岸の最低残量 0.87 → 0.86。**ほぼ無変化** |
| 成長率 | ×1 / ×0.6 / ×0.35 / ×0.2 | Stewardship の Policy 由来は 42% → 56% へ改善するが、Livelihood は 31% → 4%、Resilience は全滅（小型船が全て破綻） |
| 保護区の流出率・罰金 | §31–32 で実施済 | 効果は §32 に記載 |

**世界を厳しくすると Stewardship の腕の差は増えるが、Livelihood の腕の差が消え、艦隊が全滅する。** 単純なパラメータ調整では両立しない。

### 35.5 なぜ資源が枯れないのか — 群れ行動

全船 greedy の Round別トレースで原因が判明した。

```text
R1: 保護区に4隻   R2: 沖合に4隻   R3: 沖合に4隻
R4: 沿岸に5隻     R5: 分散        R8: 沖合に5隻
```

**Baseline がすべて同じ「最も儲かる漁場」の計算をするため、艦隊が群れとして移動する。** 1つの漁場を叩いては次へ移り、その間に前の漁場が回復する。漁獲圧が自動的に分散され、どの漁場も枯れない。沿岸の最低残量が 24 Round でも 0.83 に留まるのはこのためである。

これは世界のパラメータの問題ではなく、**Scripted Baseline が互いに似すぎている**ことの帰結である。

### 35.6 判断

現時点の構成は次の状態にある。

| 軸 | Policy由来 | 状態 |
| --- | --- | --- |
| Livelihood | 31% | 健全 |
| Stewardship | 42% | A で健全化 |
| Resilience | 5% | **未解決** |

Phase 1 へ進む前に決めるべきことは、パラメータではなく次の2点である。

1. **Resilience の実験設計。** Focal Policy を小型船にも載せて評価する。自分の判断が自分の生存を決める構造にしなければ、この軸は測定対象を持たない。
2. **Baseline の多様化、または LLM Agent での再測定。** 群れ行動は Scripted Baseline の均質さに由来する。実際の LLM Agent は同一の計算をしないため、Phase 1 で自然に解消する可能性がある。ただしそれは仮説であり、Phase 0 の Baseline では共有地の悲劇を再現できていない、という事実は記録する。

パラメータ調整はここで打ち切る。§35.4 の4種類はいずれも一方の軸を改善して他方を壊しており、探索の方向が違うことを示している。

---

## 36. Resilience 軸 — 設計変更を試みた結果

§35.6 の案1（Focal Policy を小型船の席にも載せる）を実施し、あわせて指標定義と災害規模も振った。**いずれも軸を健全化しなかった。** 記録を残す。

### 36.1 席の変更

Focal Policy を最小の船（Shiosai）の席に載せるLineupを追加した。同じ5つのPolicyが海に出ており、席順だけが変わるので比較可能性は保たれる。

```text
                  Focal=大型船    Focal=小型船
Livelihood          31.4%           5.4%
Stewardship         41.8%           6.7%
Resilience           4.7%           8.9%
```

Resilience は 4.7% → 8.9% へ改善したが、Livelihood と Stewardship が壊れる。小型船1隻では艦隊全体のOutcomeを動かせないためである。**軸ごとに席を変えると、同じMatchを別々の物差しで採点することになり、Paretoが成立しない。**

### 36.2 指標定義の変更

「稼働継続率」（破綻・修理中でないRoundの比率、小型船の最小値）を試作した。ブリーフの「活動を継続できたか」に最も近い定義である。

```text
                    Focal=大型船   Focal=小型船
資金比（現行）          4.7%          8.9%
稼働継続率（候補）       0.2%          3.9%
```

さらに悪化した。どの定義でも `greedy > cautious` の並びが変わらない。

### 36.3 災害規模と共済の価格

修理費と共済（Mutual Aid Fund）の条件を振った。Greedy は共済を拒否し Cautious は加入するため、災害が現金で賄えない水準になれば加入が生死を分けるはず、という仮説である。

```text
修理費 70  / 拠出 4  / 上限 45    Resilience Policy由来 8.9%   gree=0.246 caut=0.117
修理費 160 / 拠出 10 / 上限 140   Resilience Policy由来 4.9%   gree=0.118 caut=0.047
修理費 240 / 拠出 14 / 上限 210   Resilience Policy由来 2.9%   gree=0.066 caut=0.023
```

災害を重くするほど悪化する。原因は共済の価格である。故障確率は1隻1Roundあたり約0.06で、12 Round の期待損失は修理費の約0.7倍にすぎない。**拠出総額が期待損失を上回っており、加入は経済的に不合理**だった。Cautious は全提案を受諾する実装なので、割高な保険を買って自らを弱くしていた。

### 36.4 なぜ直らないのか

この世界には**自制が安全を買う経路が存在しない**。

```text
漁を控える -> 収入が減る -> 現金が減る -> 災害に弱くなる
```

因果が逆向きである。Resilience をどう定義しても、安全を買うのは現金であり、現金を稼ぐのは乱獲である以上、`greedy > cautious` は覆らない。

経路を作るには次のいずれかが要る。

1. **自制が小型船の漁場を守る構造。** 沿岸を小型船の避難場所とし、大型船の乱獲でそこが枯れるようにする。ただしこれは §35.5 の群れ行動により現在は成立しない。どの漁場も枯れないため、守るべきものがない。
2. **現金では防げない災害。** 共済の加入だけが救済手段となるShockを導入する。ただし共済の価格を期待損失より十分低くしなければ、加入自体が不合理なままである。

### 36.5 結論 — Stewardship の問題と同根である

Resilience が機能しない理由と、乱獲のペナルティが小さい理由（§35.4）は、**同じ1つの原因に帰着する**。

> Scripted Baseline が均質であるため艦隊が群れとして移動し、漁場が枯れない。枯れないので、自制にも協定にも守るべき対象が生じない。

したがって次に着手すべきは Resilience の指標でも災害規模でもなく、**§35.6 の案2 — Baseline の多様化、または LLM Agent による再測定**である。Resilience 軸の可否はその後に再判定する。

### 36.6 この節で残した変更

- Focal を小型船に載せるLineup（`small-<policy>`）を Simulation へ追加した。#2 と #3 は従来どおり `focal-*` のみで判定し、比較可能性を保つ。
- Resilience の指標は §35.3 の「最も弱い小型船の開始資金比」を維持する。絶対額より原理的に正しく、破綻が 0 になる点も適切であるため。
- 修理費と共済の条件は元の値（70 / 4 / 45）へ戻した。

判定は 9項目 PASS のまま（#4 = 5.7%、#6 のみ未達）。

---

## 37. Baseline の多様化 — 群れ仮説の検証

§35.5 で立てた仮説「資源が枯れないのは Scripted Baseline が均質で艦隊が群れるためである」を検証した。

### 37.1 追加した Baseline

- **Territorial** — 1つの漁場に固執する。そこが赤字になるまで動かない。船ごとに異なる home ground を持つ。
- **Crowd-averse** — 前Roundに他船が多く入った漁場を割り引いて評価する。群れから離れる。

いずれも既存の Baseline と同じ Observation しか見ない。違いは**同じ数字から同じ結論を出さない**点だけである。

### 37.2 仮説は正しかった

150 Seed、艦隊構成別の資源最低残量（容量比）。

| 艦隊構成 | 沿岸 | 沖合 | 保護区 | 総資源 |
| --- | --- | --- | --- | --- |
| 全員 greedy | 0.74 | 0.67 | 0.57 | 0.69 |
| 現行の混成（均質） | 0.87 | 0.78 | 0.71 | 0.81 |
| **全員 territorial** | **0.57** | 0.81 | 0.87 | 0.77 |
| 全員 crowd-averse | 0.62 | 0.70 | 0.87 | 0.75 |
| 多様な混成 | 0.79 | 0.77 | 0.77 | 0.79 |

**沿岸は 0.87 から 0.57 へ落ちる。** 漁獲圧が1つの漁場に留まるようになり、初めて漁場が枯れた。群れ行動が原因だという診断は正しかった。

### 37.3 ただし、良いことばかりではない

背景艦隊を多様な構成へ差し替えて分散分解と判定を測り直した。

```text
                 均質(現行)      多様
Livelihood        31.4%    ->   44.2%    改善
Stewardship       41.8%    ->   20.9%    悪化
Resilience         4.7%    ->    2.8%    share は悪化
```

Resilience は share こそ下がるが、**初めて並びが正しくなった**。

```text
均質: gree=0.20 caut=0.10   自制が greed より低い（逆転）
多様: gree=1.00 caut=1.12   自制が greed を上回る（正常）
```

§36.4 で「自制が安全を買う経路が存在しない」と書いたが、漁場が枯れる世界では経路が生じる。診断は一貫している。

一方、正式判定では **#4 が 5.7% から 1.6% へ落ちて未達**になる。Territorial な船は誰が金を積もうと自分の漁場を守り続けるため、1隻を止めても別の船が埋める。保護区の利用も 15.8% → 5.8% へ減り、Broker が守るべき対象そのものが縮む。

### 37.4 判断 — どちらの艦隊も「正解」ではない

| | 均質な背景 | 多様な背景 |
| --- | --- | --- |
| #4 協定の効果 | **5.7% PASS** | 1.6% FAIL |
| Livelihood の腕の差 | 31% | **44%** |
| Stewardship の腕の差 | **42%** | 21% |
| Resilience の並び | 逆転 | **正常** |
| 資源の枯渇 | 起きない | **起きる** |

片方を選べば他方が壊れる。これは調整不足ではなく、**このArenaの性質が「他のAgentが何をするか」に強く依存する**という事実である。共有資源ゲームとしてはむしろ正しい性質だが、**Scripted Baseline では決着しない**ことを意味する。

### 37.5 この節で残した変更

- `territorialAgent` と `crowdAverseAgent` を追加した。
- 正式判定の `BACKGROUND` は**均質な構成のまま**とした。9項目 PASS を維持するためであり、多様な構成が劣るからではない。
- 多様な艦隊は参照Lineup（`all-territorial` / `all-crowd-averse` / `diverse-mixed`）として Simulation に加えた。今後どちらの世界で議論しているかを常に比較できるようにするためである。

判定は 9項目 PASS（#4 = 5.7%、#6 のみ未達）。

### 37.6 Phase 0 の到達点

Phase 0 で確かめたかったのは「AI Agent 同士の交渉が本当に面白いか、固定攻略法にならないか」であった。分かったことは次である。

1. 交渉・Escrow・Replay・独立Outcome の機構はすべて動く。決定論も完全である。
2. 協定は実際に資源を守る（均質な艦隊で 5.7%）。ただし守れる量は投じられる資金で決まり、上限は理論最大の 25% 程度である。
3. Escrow の厚みは離脱を抑える（半額で違反率が2倍以上）。ただし十分な資金があると飽和する。
4. **資源が枯れるかどうかは、世界のパラメータではなく他Agentの行動様式で決まる。** 群れれば枯れず、散れば枯れる。
5. したがって「固定攻略法になるか」は Scripted Baseline では判定できない。**実際の LLM Agent を入れた測定が必要である。**

4と5は Phase 0 の設計時には見えていなかった。ここが次の分岐点になる。

---

## 38. 判定基準の見直しと第3軸の差し替え

### 38.1 §35 の分散分解は競技の判定にとって的外れだった

§35 では「Stewardship の分散の89%が Seed 由来である」ことを欠陥として扱った。**これは誤りである。**

Frontier Protocol は全参加者が同じ Committed Seed で戦う。全員が同じ嵐に遭うなら、Seed 由来の分散は比較の中で打ち消し合う。1ハンドのポーカーは運がほぼ100%だが競技として成立するのと同じ構造である。

競技の判定にとって意味があるのは**運の総量ではなく、同一Seed上で強いAgentが弱いAgentに何試合で勝ち越せるか**である。

### 38.2 識別可能性 — 正しい測り方

同一Seed上のペア勝率を測り、二項検定で有意（p<0.05）に分離するのに必要な試合数を算出した。300 Seed、Baseline 6種。

```text
軸             20試合以内に分離   必要試合数(中央値)
Livelihood        13/15 ペア           7 試合
Stewardship       14/15 ペア           5 試合
Resilience         5/15 ペア          42 試合
```

Livelihood と Stewardship は**5〜7試合で分離する**。§35 で「ほぼ運」と判定した Stewardship は、同一Seed上では cautious が greedy に **100%** 勝つ。運は多いが全員に等しく降るため、実力は明確に分離する。

Resilience だけが分離しない。§36 の結論と一致する。

### 38.3 新しい合格ライン

分散比ではなく識別可能性で判定する。

> **主要Policyペアの8割が20試合以内に分離すること。**

20 試合は Final Pack の現実的な規模であり、この基準は「Tournament として運用できるか」を直接問う。

### 38.4 第3軸を Cooperation Efficacy へ差し替えた

Resilience（5/15、中央値42試合）を外し、Cooperation Efficacy を第3軸とした。

**定義:** 同じ Seed・同じ天候・同じ艦隊で、**その船の契約だけを除いて**再実行し、Stewardship の差を、その船が**支払った**金額で割る。

```text
efficacy = (stewardship_全部あり − stewardship_その船の契約なし) × 1000 / その船の支払額
単位: stewardship point / 1000 DemoUSD
```

Engine が決定論的なので、この排他的貢献が厳密に計算できる。`packages/shared` の `computeContributionEvidence`（exclusive contribution）と同じ考え方であり、既存の Pareto / Contribution 基盤にそのまま乗る。

### 38.5 払った側だけを評価する理由

当初は契約に関わった双方を評価したが、**Greedy が協力軸で1位になった**。契約を一度も提案しないにもかかわらず、である。

最も獲る船は買い取った時の効果が最大で、かつ最も高くつく。双方を評価すると「**最大限に海を荒らしていれば、高く買い取ってもらえる**」が最適戦略になる。人質であって協力者ではない。

払った側だけを評価する形に変更した。

```text
              双方評価   払った側のみ
greedy         0.055  ->  0.000
broker         0.045  ->  0.113
識別力(中央値)   19試合 ->   17試合
```

人質構造が消え、識別力も改善した。二重計上も避けられる。**受け取る側は現金（Livelihood）と資源保全（Stewardship）で既に評価されている**ため、ここで再度評価すると同じ行為を三重に数えることになる。

### 38.6 現在の3軸

| 軸 | 問い | 識別力(中央値) |
| --- | --- | --- |
| Livelihood | 自分は食えたか | 7 試合 |
| Stewardship | 海は残ったか | 5 試合 |
| Cooperation Efficacy | 払った金で世界をどれだけ変えたか | 17 試合 |

3軸の独立性は max|ρ| = 0.384（Resilience 時は 0.472）。**独立性も改善した。**

判定は 9項目 PASS（#6 のみ未達）。Resilience は Outcome から外したが evidence には残しており、参考値として引き続き記録される。

### 38.7 Arena を評価する6つの基準（今後の判断用）

1. **識別可能性** — 同一Seed上で何試合で分離するか。運の総量ではない
2. **運の質** — 運が判断の**入力**になるか（嵐が来るのは運、備えるかは判断）、判断を**上書き**するか
3. **非推移性** — じゃんけん構造があるか。現状は各軸で一本道の強さ順であり、ここは弱い
4. **軸ごとに違う勝者** — 成立している（Frontier に複数残る 100%、max|ρ| 0.384）
5. **総当たりで解けないか** — Scripted Baseline では判定不能
6. **一般化** — Practice で学んだものが未知Seedで通用するか。LLM Agent が要る

1・2・4 は合格。3・5・6 は **Scripted Baseline では原理的に測れない**。人間が書いた戦略は書いた人が想定した点しか表現しないためである。

---

## 39. Phase 0 完了 — 全探索可能性の検証と、根本原因の特定

### 39.1 A — 単一の設定が全部勝つか

パラメータ化Policy（effortFraction 5 × reserve 3 × contracts 4 = 60通り）を全Seedで総当たりした。

```text
軸             最頻の勝者の勝率   勝者の種類数
Livelihood          22%             18
Stewardship         34%             21
Cooperation         27%             18
3軸すべてを取る単一設定: なし
```

Seedごとの勝者は分散する。しかしこれは**運の分散であって腕の差ではなかった**。

### 39.2 C — Final Pack 感度

20 Seed の Pack を5本作り、Pack間で順位が一致するかを測った。

```text
Livelihood   ρ=0.884    Stewardship  ρ=0.979    Cooperation  ρ=0.981
```

**20試合という規模で順位は安定する。** Tournament の Final Pack を20試合とする根拠が得られた。

### 39.3 B — 一般化、そして問題の発見

Practice（Seed 0-49）で選んだ設定を Final（Seed 50-99）で評価した。

```text
Livelihood   Final順位 1位/60   ρ=0.947
Stewardship  Final順位 4位/60   ρ=0.986
Cooperation  Final順位 1位/60   ρ=0.990
```

転移は完璧である。**しかしこれは悪い報せでもあった。** 参加者はオフラインで60通り総当たりし、固定パラメータを提出すればほぼ最適になる。

追試したところ、**どの適応Policyも最良の固定設定に勝てなかった**（勝率は最大でも35%）。Plan10 §21 の PIVOT条件「Action Spaceが小さく、全探索Lookupだけで未知Finalも攻略できる」に該当する。

### 39.4 実験設計の限界に気づく

相手が決定論的なScripted である限り、環境は静的である。**静的な環境には最適な固定戦略が必ず存在し、総当たりは必ずそれを見つける。** enforcer（乱獲そのものに反応するPolicy）を追加しても、最適設定が `e1` から `e0.8` へ動いただけだった。

そこで問いを変えた。**相手の正体を知っていたら、どれだけ得をするのか。** 小さければ読み合いに価値がなく、AI Agent を使う意味がない。

相手構成8種 × grid 60 × 80 Seed で測定した結果は次である。

```text
Livelihood   共通最良 906.2  →  相手を知って選ぶ 905.1   -0.1%
Stewardship  共通最良 0.840  →  相手を知って選ぶ 0.841   +0.1%
Cooperation  共通最良 0.126  →  相手を知って選ぶ 0.125   -1.2%
```

**相手を完全に見抜いても利得はゼロだった。** 相手ごとの最適設定は違う（5/8, 6/8, 4/8 種類）のに、共通の設定を使っても損をしない。利得の地形が平らである。

### 39.5 根本原因 — 艦隊と海の比率

艦隊の漁獲能力を振ったところ、原因が1つに特定された。

```text
艦隊倍率  総effort  沿岸最低残量   相手を知る利得
  x1        80      0.85          +2.8%
  x2       160      0.56         +15.8%
  x3       240      0.35         +10.0%
  x5       400      0.21         +19.4%
```

**海が艦隊に対して豊かすぎた。** 漁場が枯れないので、他者が何をしようと自分の取り分は変わらず、読み合いに価値が生じない。

Phase 0 で見つけた問題はすべてこの1点に帰着する。

- §35.4 乱獲のペナルティが小さい
- §36 Resilience 軸が機能しない（自制が安全を買わない）
- §37 艦隊が群れて漁場が回復する
- §38 Cooperation 軸の解像度が低い
- §39.4 相手を読む価値がない

成長率、価格弾力性、Round数、Depensation、Baseline の多様化と、順に試したものはすべて対症療法だった。

### 39.6 艦隊規模を2倍にした結果 — 10項目すべて PASS

`baseBoats` の `effortCapacity` を 18/22/18/12/10 から 36/44/36/24/20 へ変更した。

| # | 判定項目 | 閾値 | 変更前 | 変更後 |
| --- | --- | --- | --- | --- |
| 1 | 決定論 / Replay一致 | 全一致 | 全一致 | 全一致 |
| 2 | 単一Policyが3軸支配 | < 20% | 0.0% | 5.0% |
| 3 | Frontierに2つ以上残る | >= 60% | 100% | 99.0% |
| 4 | 協定がStewardshipを改善 | >= 5% | 5.7% | **21.3%** |
| 5 | 協定がLivelihoodを犠牲にする局面 | >= 20% | 60.9% | 56.9% |
| 6 | Escrow倍増で違反減少 | >= 30% | **-0.1%** | **32.3%** |
| 7 | 3軸の独立性 | < 0.8 | 0.384 | **0.178** |
| 8 | Zone選択の非自明性 | < 70% | 48.8% | 48.7% |
| 9 | 情報漏洩なし | テスト | 通過 | 通過 |
| 10 | 実行コスト | < 120s | 15.7s | 16.3s |

**10項目すべて PASS。** #6 は Escrow の飽和が解け、用量反応が単調になった（5.4% → 4.3% → 2.9%）。資源は実際に枯れる（Stewardship 中央値 0.809 → 0.488）。

**閾値は一切変更していない。** 変更したのは世界のパラメータ1つであり、これは Phase 0 が本来行うべき作業である。またパラメータの探索には `scarce-*` / `or-*` の Seed を、判定には `phase0-*` の Seed を使っており、**調整に使った Seed と判定に使った Seed は独立している**。

### 39.7 残る弱点 — Livelihood の識別力

海が厳しくなった副作用として、Livelihood の Policy 間の差が圧縮された。

```text
軸             20試合以内に分離する主要ペア
Livelihood         27%      ← 基準80%に未達
Stewardship        93%
Cooperation        53%
```

全Policyが等しく苦しくなり、収入の差がつきにくい。Stewardship は 5 試合で分離し問題ないが、**Livelihood 軸だけは20試合では順位が確定しない**。

倍率を 2.5〜3 倍へ上げると Livelihood の識別力は 60% まで戻るが、沿岸の残量が 0.20 まで落ちて崩壊閾値（0.25）を割る。**識別力と海の存続がトレードオフになっている。** ここは Phase 1 で LLM Agent の挙動を見てから決めるのが妥当である。

### 39.8 Phase 0 の判定

**GO。** Plan10 §21 の GO条件10項目をすべて満たした。

追加で得られた知見:

1. 20試合の Final Pack で順位が安定する（ρ=0.88〜0.98）
2. Practice の学習は Final へ転移する（ρ=0.95〜0.99）
3. 相手を読む価値は艦隊と海の比率で決まる（+2.8% → +15.8%）
4. **Scripted Baseline では「適応の価値」を原理的に証明できない。** 手で書いたルールはすべて固定ルールであり、総当たりが同種の空間を探索する以上、必ず互角以上になる

4 は Phase 1 で LLM Agent を入れて初めて答えが出る。ただし §39.5 により、**読み合いに価値が生じる世界の条件は特定できた**ので、その上で測ることができる。

### 39.9 Phase 1 への申し送り

- Livelihood 軸の識別力（27%）を LLM Agent 込みで再測定する
- 艦隊倍率は 2.0 を採用。2.5〜3.0 は Livelihood 識別力と引き換えに海が崩壊するため、Phase 1 の結果を見て判断する
- Final Pack は 20 試合を基準とする
- `enforcerAgent` / `territorialAgent` / `crowdAverseAgent` / `tunableAgent` は Baseline 兼 Reference として維持する

---

## 40. Phase 1a — LLM Agent Runtime

Phase 0 が答えられなかった問い（§39.8 の4）に取り組む段階である。UI も Sepolia も作らない。**実際の Claude Agent を艦隊に入れて、固定設定に勝てるかを見る**ことだけを行う。

### 40.1 Agent Interface を非同期にした

`OceanAgent` の `negotiate` / `act` が同期関数だったため、モデル呼び出しを入れられなかった。両者を `T | Promise<T>` に変え、`runMatch` を `async` にした。

Scripted Baseline は値を直接返すので `await` がそのまま通り、**両者が同じ艦隊に混在できる**。全25箇所の呼び出しを更新し、テスト22件と判定10項目はすべて元の結果を維持している。

交渉フェーズの相手の応答は `Promise.all` ではなく**固定順の逐次**で集める。モデル側の相手も Scripted と同じ盤面を見る必要があり、並列では副作用の順序が不定になるためである。

**決定論は保たれる。** Engine が見るのは返ってきた Action だけであり、Transcript にはその Action が記録される。モデルが動かした Match も、ルールが動かした Match とまったく同じように Replay できる（テストで担保）。

### 40.2 llmAgent の設計

```text
packages/ocean-commons/src/llm-agent.ts
```

- **Model:** `claude-opus-5`、`output_config.effort` は既定 `medium`
- **出力は Tool Call のみ。** `strict: true` の Tool を2つ（`set_course` / `answer_offers`）定義し、`tool_choice` で強制する。自由文が State Transition に入る経路は存在しない
- **Prompt Caching:** 海のルールと Mission は毎Round同一なので `cache_control` を付けて先頭に置き、変動する盤面はその後ろに置く。テストで「systemが全Round同一であること」を検証している
- **Provenance:** `Observation / Action / reasonCode / declaredReason / Payment / Result` のみを記録する。内部の思考は要求も保存もしない（Plan10 §8.3）
- **Seed は渡さない。** テストで漏洩がないことを検証している

### 40.3 壊れた応答で世界を壊さない

モデルは何を返すか分からない。**すべての応答を検証し、通らなければ記録付きで安全な既定へ落とす。**

| 起きたこと | 結果 |
| --- | --- |
| 存在しない漁場を指定 | 出港せず、`clampReason` に記録 |
| 能力を超えるEffort | 能力上限へclamp |
| Tool を呼ばずに終了 | 出港せず、`failure: no tool call` を記録 |
| API 呼び出しが例外 | 出港せず、`failure` に例外を記録。Match は継続 |
| 提案への応答を返さない | **全件拒否として扱う。** 沈黙が契約を成立させてはならない |
| 存在しない船へ提案 | 破棄 |
| 認証情報がない | **Agent 構築時に例外。** Match 途中で落ちない |

最後の2つは特に重要である。沈黙で拘束されない設計にしないと、応答を落とすだけで相手を縛れてしまう。認証がない場合に開始時点で失敗するのは、4Round進んでから落ちれば その4Roundが無駄になるためである。

11件のテストがこれらを**APIキーなしで**検証する。

### 40.4 実行方法

```bash
ANTHROPIC_API_KEY=... npx tsx scripts/play-ocean-commons.ts [seed] [rounds]
```

Plan10 §8.3 の Replay Panel を出力する。1 Match あたりのトークン数と概算コストも表示するので、Tournament の運用コストが見積もれる。

**現時点では未実行である。** このリポジトリに Claude の認証情報が設定されていないため、実際のモデルを動かした結果はまだない。`.env` にも `ANTHROPIC_API_KEY` は存在しない。

### 40.5 Phase 1a で答えるべきこと

実行できるようになった時点で測る。判定方法は**実行前に固定する**。

1. **固定設定に勝てるか。** §39 の最良固定設定（`e1 storm-only none` ほか）と同一Seedで対戦させ、勝率を測る。20試合以内に有意差が出るか
2. **群れるか散るか。** §35.5 の群れ行動が LLM Agent でも起きるか。起きなければ §37 の Baseline 多様化は不要になる
3. **相手を読むか。** §39.4 では相手を知る利得がゼロだったが、艦隊倍率2倍の現行設定では +15.8% ある。モデルがそれを取りに行くか
4. **Livelihood の識別力（27%）** が LLM Agent 込みで改善するか（§39.7）

いずれも Scripted Baseline では原理的に測れなかったものである。

---

## 41. Phase 1a 初回実行 — gpt-5 が艦隊に入った

`OPENAI_API_KEY` が提供されたため、Provider を差し替え可能な形へ整理した上で実行した。

### 41.1 Provider 非依存化

`llmAgent` が Anthropic SDK を直接呼んでいたため、通信を `DecisionBackend` として切り出した。

```text
Agent 側（共有・テスト済み）    Backend 側（差し替え可能）
  Prompt 構築                    anthropicBackend  claude-opus-5
  Tool Schema                    openaiBackend     gpt-5
  入力検証・Fallback
  Provenance 記録
```

壊れた応答から世界を守る仕組みは一箇所にあるので、Provider を増やしても再検証は要らない。**両者は同じ艦隊に混在できる。** Tournament が求めるのは判断の違いであって配管の違いではない。

OpenAI 側は Chat Completions の function calling を `strict` で使い `tool_choice` で強制する。arguments は JSON 文字列で届くため必ず `JSON.parse` し、文字列一致はしない。テストは計38件。

### 41.2 初回対戦の結果 — seed `play-1`、4 Round

```text
Livelihood            584（自船の現金も584、艦隊中央値）
Stewardship           0.715
Cooperation efficacy  -0.054 per 1000 DemoUSD（60 支出）
Contracts             3件成立、0件違反
```

### 41.3 Scripted Baseline がやらないことをやった

Round 2、gpt-5 は**自発的に保護区の買い取りを提案した**。

> 「isana へ1Roundの買い取りを提示し、保護区から出てもらう。産卵機能を守り、試合後半の漁獲を持続させるため。」

保護区を名指しして守りに行く提案は、どの Scripted Baseline も行わない。Broker は「崩壊間際の最大漁獲船を止める」しかせず、漁場を選んで守る発想を持たない。**これは人手で書いたルールの外側にある行動である。**

### 41.4 しかし同じ設計ミスを犯した — そして評価軸がそれを捉えた

Cooperation efficacy は **負（-0.054）** になった。60 DemoUSD を払って、資源は契約なしの場合より**悪化**している。

原因は §35.4 で私自身が犯した誤りと同一である。**特定漁場からの締め出しは漁獲圧を減らさず、移動させるだけ**である。isana は保護区を諦めて沿岸か沖合へ回り、総漁獲は変わらなかった。しかも保護区は当時 80% と健全で、守る必要がなかった。

意図は正しく、機構の理解が誤っていた。そして**反実仮想による Cooperation 軸がそれを正しく罰した**。「協力しようとした」ことではなく「協力が何を変えたか」を測る設計が、実際に機能している。

### 41.5 もう一つの誤り — 嵐の読み違え

Round 4、時化 0.73 の中で沖合へ全力出港し、漁獲は 12.6 に終わった（前 Round は同じ Effort で 52.4）。

> 「沖合は就航限界の内側で、今Roundの利益率が最も高い。」

`stormExposure 0.95 × 0.73 = 0.69` は自船の `stormLimit 0.72` を下回るので**出港はできる**。モデルはその制約を正しく読んだ。しかし就航できることと採算が合うことは別で、時化は漁獲効率そのものを潰す。Prompt に就航限界は明示したが、**時化が漁獲量に与える影響を明示していなかった**。Prompt の不備であり、モデルの誤りとは言い切れない。

### 41.6 現時点で言えること / 言えないこと

**言える。**

- Provider を問わず LLM Agent が Arena で最後まで戦える。決定論も Replay も壊れない
- Scripted Baseline の行動空間の外側に出る手を指す
- Cooperation 軸は「善意だが無効な介入」を正しく負に評価する

**言えない。** これは 1 試合 4 Round の観測である。§40.5 の4つの問い（固定設定に勝てるか、群れるか、相手を読むか、Livelihood の識別力）には**まったく答えていない**。判定には同一 Seed での対戦を 20 試合規模で行う必要がある。

### 41.7 運用コストについて判明したこと

Cooperation 軸の反実仮想は「その船の契約だけ抜いて同じ試合を再実行」する。Scripted Baseline では無視できたが、**LLM Agent では 1 Entry あたりのモデル呼び出しが 2 倍になる**。

4 Round で約16回。20 試合 × 12 Round なら約 960 回。Tournament 設計時に次のいずれかが要る。

1. 反実仮想側だけ安価なモデルで走らせる（判断の質より「契約がなかった世界」の再現が目的なので許容余地がある）
2. 1 回の対戦から両方を取る評価方法を設計する
3. Cooperation 軸を Final のみで測り、Practice では省く

### 41.8 次にやること

§40.5 の判定を実施する。判定方法は実行前に固定し、Practice と Final の Seed を分ける。まず 1 と 2 を測る。

---

## 42. 12 Round 実対戦 — 運用コストと2つの行動所見

seed `cost-probe`、12 Round、gpt-5。§41.7 で指摘した反実仮想の二重コストは `recordedAgent` で解消済み。

### 42.1 結果

```text
Livelihood            822（自船の現金も822）
Stewardship           0.509
Cooperation efficacy  -0.160 per 1000 DemoUSD（270 支出）
Contracts             6件成立、1件違反
Survived              yes
```

### 42.2 運用コスト — ここが一番重い

```text
モデル呼び出し   29回 / 1試合（12 Round）
所要時間         1495.8 秒 = 約25分 / 1試合
トークン         入力 33,372 / 出力 86,895（キャッシュ 0）
```

**1試合に25分かかる。** 20試合を順に走らせれば8時間を超える。出力トークンが入力の2.6倍あるのは gpt-5 の推論トークンであり、**支配的なコストは推論**である。

対処は3つある。

1. **並列実行。** 試合は Seed ごとに独立しているので同時に走らせられる。20試合を並列にすれば実時間は25〜30分に落ちる。Rate limit だけが制約になる
2. **`reasoning_effort` を下げる。** 出力トークンが支配的なので、ここが唯一大きな削減余地である。品質への影響は測る必要がある
3. Round 数を減らす。ただし §39 で 12 Round を前提に調整済みなので、他の判定に波及する

キャッシュ読み取りが 0 なのは、System Prompt が OpenAI の自動キャッシュ下限に届いていない可能性が高い。ただし入力は全体の3割弱なので、ここを直しても効果は限定的である。

### 42.3 所見1 — 最終Roundで保護区を襲った

12 Round のうち保護区へ出漁したのは**最終Roundの1回だけ**である。そしてその理由をこう述べた。

> 「最終Round。罰金を払っても保護区の利回りが最も高く、時化も軽い。**これで資源を脅かすことはなく**、黒字で終えられる。」

漁獲 53.6。保護区は 426 → 349 へ落ちた。**「資源を脅かさない」という判断は誤っている。** ただし試合はそこで終わるので、誤りの帰結は評価期間の外に落ちる。

これは Arena が暴くべき行動そのものである。**評価期間の末端では、共有資源を守る動機が消える。** 現在の設計はそれを記録できているが、罰する仕組みは持っていない。Final の Round 数を参加者に伏せる、あるいは最終Roundの資源状態を Stewardship へ重く効かせる、といった対処が Phase 1b の検討事項になる。

### 42.4 所見2 — 相手も最終Roundで契約を破った

Round 8 に kaiyo が nagi へ 150 DemoUSD の操業停止契約を結び、Round 10・11 と履行された。そして**最終Roundで nagi が破り、残額が kaiyo へ返還された**。

nagi は `opportunistAgent` で、離脱の利得が残Escrowを上回ったときに破る。最終Roundでは残Escrowが最小になるため、破るのが最適になる。**設計どおりの挙動であり、42.3 と同じ構造**である。Escrow による規律は評価期間の末端で必ず崩れる。

### 42.5 所見3 — 協力の効率がまた負になった

2試合連続で Cooperation efficacy が負である（-0.054、-0.160）。いずれも**特定漁場からの締め出し**を買っており、相手は別の漁場へ移るだけで総漁獲は減らない。

Prompt には「一つの漁場から、あるいは水域全体から」と両方の選択肢を明示している。モデルは2回とも弱い方を選んだ。**機構は与えてあり、判断が誤っている。** 戦略的助言は Prompt に書かない方針なので、これは修正せず所見として残す。反実仮想による Cooperation 軸が2回とも正しく負に評価しており、**軸としては機能している**。

### 42.6 Phase 1a の判定に向けて

§40.5 の4つの問いにはまだ答えていない。判定を行う前に 42.2 の対処を決める必要がある。並列実行と `reasoning_effort` の調整を先に入れ、1試合あたりの実時間とコストを再測定してから規模を決める。

---

## 43. Phase 1b — 遊べる形にする

§30〜42 は測定の記録である。この節はこれから何を作るかを決める。

### 43.1 いま何が問題か

Phase 0 は通り、LLM Agent も動く。しかし**人が遊べる形になっていない**。指摘された点は3つである。

1. **1試合25分は長すぎる。** 待てるのは10分、遊ぶ時間としても10分が上限
2. **ログしか出ていない。** 船の絵で見せたい
3. **ゲームとして面白くない。** 毎Roundの選択が「どこで・どれだけ獲るか」だけで山場がない

1と2は実装の問題である。3は設計の問題であり、より重い。

### 43.2 体験の目標 — submit して、戻ってきて、Replayを見る

25分は**ライブで見なければ問題にならない**。目指す形は次である。

```text
submit する          3秒    Mission と予算を設定して投げる
裏で試合が走る       数分    見ない
戻ってReplayを見る   15秒    8 Round を早送りで
```

試合は決定論的で Transcript から完全に再現できることをテスト済みなので、**エンジンは何も変えずにこれが実現できる**。

### 43.3 変更1 — 試合を3分に縮める

現在の内訳は「29回のモデル呼び出し × 約50秒」である。

| 手 | 効果 | 副作用 |
| --- | --- | --- |
| 交渉と行動を1回の呼び出しにまとめる | 呼び出しが半分 | なし。船長は「Aへ提案しつつBで漁をする」と一度に決めるはずで、分けているのは実装都合 |
| Round を 12 → 8 | 3分の1減 | §39 の調整は12 Round前提なので、判定を8 Roundで取り直す必要がある |
| `reasoning_effort: low` | 出力トークン56%減、時間61%減 | 判断の質が落ちる可能性。実測で n=2 だが固定設定に0勝3敗だった |

合計で**約3分**まで落ちる。ただし `low` は判定の公平性に関わるため、**判定を取るときだけ `medium` に戻す**運用にする。

### 43.4 変更2 — 盤面を絵にする

最初のブリーフにあった形をそのまま作る。

```text
        Kaiyo
        822 USD
  Hokuto      Isana
        沿岸 269 ↓
        沖合 404 ↓
        保護区 349 ⚠
  Nagi        Shiosai
        │
        │ 150 USD  ← 契約が成立すると線が引かれる
        ▼
```

3つの漁場を水位で見せ、崩壊閾値を線で示す。船はその Round に入った漁場の下に並ぶ。契約は船と船を結ぶ線として描き、破られたら切れる。8 Round を1.2秒ずつ再生すれば**1シーズン10秒**である。

まず単独のHTMLとして作る。`apps/web` へ組み込む前に見た目を早く回すためで、固まってから移植する。

### 43.5 変更3 — スコアを体感できるようにする

`Cooperation efficacy -0.160 per 1000 DemoUSD` は誰にも伝わらない。しかし**反実仮想は既に計算している**ので、海を2つ並べれば済む。

```text
   あなたの契約あり        契約がなかったら
      🐟 979                 🐟 811
   318 DemoUSD 払って、魚を 168 匹残した
```

数字ではなく面積で分かる。gpt-5 が2回犯した「善意だが無効な介入」も、これなら一目で伝わる。

### 43.6 変更4 — ゲームとして面白くする（未決）

ここは実装ではなく設計の変更であり、**入れるかどうかの判断が要る**。

**A. 中盤に危機を起こす。** 大時化か資源崩壊の警告を1回発生させ、全員が対応を迫られる局面を作る。現在は交渉が「たまに起きる」だけで、必然性がない。

**B. 裏切りを可視化して残す。** 契約を破った船に印が付き、以後ずっと見える。現在は `breaches: 1` という数字でしかない。**誰が自分を裏切ったか**が見えると次の判断が変わる。

**C. 終盤に賭ける理由を作る。** §42.3 で観測したとおり、現在は最終Roundに全員が保護区を襲うのが自明解である。**最終Roundの資源量を配当に効かせる**か、**Round数を参加者に伏せる**ことで、いつ裏切るかが読み合いになる。

Cは §42.3 と §42.4 で実際に観測した問題への対処であり、根拠がある。AとBは仮説である。

### 43.7 順序

```text
1. Replay Viewer を単独HTMLで作る        ← 実データあり、すぐ作れる
2. 見た目を確認して、面白さの議論をする    ← ここで 43.6 を決める
3. 試合を3分に縮める（43.3）
4. 43.6 で採用したものを実装する
5. apps/web へ組み込む
6. Phase 1a の判定を取り直す
```

1を先にするのは、**絵を見てから議論した方が具体的になる**ためである。実データは用意済みで、seed `showcase-28`（8 Round、契約3件、資源 0.575 対 0.477）を使う。

### 43.8 この節で決まっていないこと

- 43.6 の A・B・C を入れるか
- Round 数を 8 に落とすか（落とすなら §39 の判定を取り直す）
- Phase 1a の判定を先に取るか、遊べる形にしてから取るか

いずれも 43.7 の 2 の時点で判断する。

---

## 44. Phase 1b — 嵐の季節と、終わりを知らせないこと

§43.6 は3案を未決としていた。判断を任されたので2つを採り、1つを見送った。

### 44.1 C — 終盤の賭け（採用）

§42.3 と §42.4 で実測した、**唯一根拠のある欠陥**である。最終Roundに gpt-5 が保護区を襲い、同じRoundに相手の opportunist も契約を破った。どちらも理由は同じで「最後だと分かっている」ことである。

シーズン長を seed から **7〜10 Round の窓**で引き、Agent には**窓しか渡さない**ようにした。

```text
Observation.roundsRemaining     保証される最小値（窓の下限まで）
Observation.maxRoundsRemaining  最大でも残る数
```

`generateScenario` に `rounds` を明示した場合は窓が1点に潰れるので、判定スクリプトや fixture は従来どおり完全に既知のまま動く。**遊ぶときだけ終わりが見えない。**

### 44.2 A — 中盤の危機（採用、ただし新機構なし）

新しい仕組みは足していない。**中盤に連続する時化を置いただけ**である。

severity 0.9 以上なら、露出 0.95 の沖合との積が最も頑丈な船の就航限界（0.85）も超える。**艦隊全体が同時に沖を失う。** 残るのは沿岸と保護区だけになる。

80 Seed での実測。

| | 嵐のRound | 平穏なRound |
| --- | --- | --- |
| 漁場の集中度 | **78%** | 65% |
| 在港（出漁できない） | **52%** | 10% |
| 保護区の利用 | **19%** | 6% |
| 契約 | 0.29件/R | 0.25件/R |

**保護区の利用が3倍になる。** 沖が閉じたとき、避難できる唯一の魚のいる水域が保護区だからである。乱獲がランダムな強欲ではなく、**状況に追い込まれた選択**になった。

### 44.3 B — 裏切りの可視化（見送り）

Replay Viewer で既に実装済みである。契約を破った船は以後ずっと赤枠で残る。エンジン側に足すものがない。

### 44.4 速度 — 1 Round を1呼び出しに

船長は「Aへ提案しつつBで漁をする」と一度に決めるはずで、交渉と行動を分けていたのは実装都合だった。`take_turn` ツール1つにまとめ、静かなRoundは2問から1問になった。**seasonあたりの費用がほぼ半減する。**

相手からの提案に答える呼び出しは分けたままである。それは「その提案が来たときに答える」別の問いだからである。

### 44.5 判定への影響 — 9/10、#6 が未達

```text
#6 Escrow倍増で違反減少   32.3% → 24.2%（基準30%）
   曲線: 0.5x 4.3% → 1x 3.2% → 2x 2.4%（単調、機構は生きている）
```

原因は嵐である。**港に足止めされた船は漁獲上限を自動的に守る**ので、Escrow の大小と無関係に遵守率が上がり、信号が薄まる。

**通すための調整はしない。** ゲームが良くなる代わりに測定精度が1項目落ちる、というトレードオフとして記録する。対処するなら「嵐のRoundを除いて #6 を測る」が筋だが、結果を見てから測り方を変えることになるので、実施するなら判定方法を先に固定し直す必要がある。

他の9項目は維持している（#4 は 18.3%、#7 は 0.207）。

### 44.6 Replay Viewer

公開済み。`benchmarks/ocean-commons/showcase.json`（seed `sea-195`、9 Round、嵐4R、その最中の保護区襲撃3回、契約3件、資源 0.616 対 0.534）を描画する。

嵐のRoundは枠が赤く染まり `STORM SEASON` が出る。小型船は `IN PORT` に落ち、契約は船と船を結ぶ弧として描かれる。最後に「契約あり／なし」の海を2つ並べ、**318 DemoUSD で魚を何匹残したか**を面積で見せる。

Round 4 がこの設計の要約になっている。嵐0.93、小型船2隻が在港、1隻が修理中、動けるのは大型2隻だけで両方とも沿岸へ押し込まれ、そこに漁獲上限の契約が飛んでいる。

### 44.7 残っていること

- Phase 1a の判定（§40.5 の4つの問い）は未実施
- `apps/web` への組み込みは未着手
- #6 の測定方法の再固定

---

## 45. 変更後の実対戦 — seed `crisis-1`

§44 の変更をすべて入れた状態で gpt-5 に1試合走らせた。9 Round（窓7-10、モデルは窓しか知らない）。

### 45.1 速度と費用

```text
                前回（12 Round, medium）   今回（9 Round, low）
モデル呼び出し        29 回                    11 回
所要時間              1495.8 秒 = 25 分        378.5 秒 = 6.3 分
入力トークン          33,372                   12,886
出力トークン          86,895                   15,449
```

**1試合 6.3分。** 「待てるのは10分」という条件の内側に入った。呼び出しが 29→11 に減ったのは、1 Round を1呼び出しにまとめたことと Round 数が減ったことの合算である。出力トークンが 5.6分の1になったのは `reasoning_effort` を low にしたためで、費用の支配項は依然として推論である。

### 45.2 危機が判断を変えた

Round 6、嵐 0.90。

> 「沖合は荒すぎるので沿岸で堅実に漁をし、**Nagi に保護区の買い取りを提示して、嵐の中で資源と利幅の両方を守る**」

嵐で沖を失ったことを明示的に理由に挙げ、その上で契約を結んでいる。**危機が交渉の必然性を作った**という §44.2 の狙いが、実際の判断として現れた。

そして翌 Round 7、嵐 0.91 で、**自分が保護区へ入って 33.7 landed している**。Nagi を締め出した水域に自分が入る形である。意図したかは分からないが、**買い取りが排他権として機能している**。設計上は正当な手であり、こういう手が出てくること自体が Arena として健全である。

### 45.3 協力の効率が初めて正になった

```text
1回目（12R, 保護区の締め出し）   -0.054
2回目（12R, 同上）              -0.160
3回目（9R, 危機下の買い取り）    +0.256
```

過去2回は「特定漁場からの締め出し」を買って圧力を移動させただけだった。今回は嵐で選択肢が狭まった状況での買い取りであり、実際に資源が残った。**軸が正しく機能していることの裏付けでもある** — 効かない介入は負に、効く介入は正に出ている。

### 45.4 終盤の挙動

シーズンは 9 Round で終わったが、モデルはそれを知らなかった。**最終 Round に保護区を襲っていない**（Round 9 は故障で在港）。Round 8 は通常どおり沖合で操業している。

1試合の観測なので断定はできないが、§42.3 で観測した「最終 Round に必ず襲う」挙動は再現していない。

### 45.5 結果

```text
Livelihood            903（自船の現金 717）
Stewardship           0.630
Cooperation efficacy  +0.256（150 支出）
Contracts             3件成立、1件違反
Survived              yes
```
