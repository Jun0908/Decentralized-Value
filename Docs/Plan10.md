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
