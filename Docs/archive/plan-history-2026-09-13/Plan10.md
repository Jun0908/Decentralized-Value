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

---

## 46. Phase 1a 判定 — 事前登録した検定の結果と、その検定の欠陥

§40.5 の問い1「model は最良の固定設定に勝てるか」を、判定方法を先に固定した上で実施した。

### 46.1 結果（`reasoning_effort: low`、12 Seed）

| 軸 | 対戦相手 | model中央値 | 固定中央値 | 勝率 | p値 | 判定 |
| --- | --- | --- | --- | --- | --- | --- |
| livelihood | e0.8 never none | 785.9 | 797.3 | 4/12 | 0.182 | NO EFFECT |
| stewardship | e0.2 never cheap | 0.632 | 0.730 | 0/12 | **0.002** | **LOSES** |
| cooperation | e1 always cheap | 0.000 | 0.188 | 0/12 | **0.005** | **LOSES** |

```text
モデル呼び出し  125回（0失敗）  入力 146,586 / 出力 177,504 トークン
実時間          845秒（70秒/seed、並列4）
漁場選択        沿岸 57% / 沖合 40% / 保護区 3%
```

**事前に固定した判定基準に照らせば、2軸で負け、1軸で有意差なし。**

### 46.2 交絡 — cooperation の中央値が 0.000

半数以上の試合で**契約を1件も結んでいない**。`scoreCooperation` は支出ゼロなら 0 を返す設計なので（§38.5「棄権を罰しない」）、契約しない船は必ず 0 になる。対戦相手 `e1 always cheap` は毎Round契約するため、この軸は自動的に勝つ。

つまり cooperation の LOSES は「協力が下手」ではなく「**協力しなかった**」である。

これは §42.2 で事前に警告した交絡でもある。

> `low` で判定すると、答えが「modelは勝てない」側に偏る。節約のためにモデルの手を縛った状態で問うのは公平ではない。

同じ `low` でも seed `crisis-1` では3件契約している（§45）ので、効果量の問題であって能力の欠如ではない可能性がある。`medium` での再測定を実施する。

### 46.3 検定そのものの欠陥（結果を見てから気づいた）

**私が事前登録した検定は、3軸Paretoのゲームに対して誤っていた。**

対戦相手は「各軸の最良固定設定」である。`e0.2 never cheap` は努力20%でほとんど漁をしないので Stewardship で勝つのが当然であり、`e1 always cheap` は毎Round契約するので Cooperation で勝つのが当然である。**バランス型のEntryは、各専門家にその専門軸で構造的に勝てない。**

そしてこのArenaが報酬を出すのは各軸での勝利ではない。**Pareto Frontier に乗るかどうか**である。Value Decentralization は「1つの総合点へ統合しない」ことを核にしており、専門家に各軸で負けることと、良いEntryであることは矛盾しない。

**この気づきは結果を見た後に得たものである。** したがって §46.1 の結果は事前登録どおりのものとして残し、置き換えない。Frontier による測定は**別の検定として追加**する。

### 46.4 Frontier membership は識別力を持つ（無料の較正）

3体の専門家に対して、Scripted Baseline が Frontier に残る割合を 40 Seed で測った。

```text
broker          68%   ← Scripted の最良
balanced e0.6   50%
opportunist     48%
enforcer        45%
cautious        43%
crowd-averse    38%
greedy          30%
territorial     30%
```

30%〜68% の幅があり、**各軸での勝敗より遥かによく識別する**。gpt-5 がこの分布のどこに入るかが、Phase 1a の本来の問いである。

判定スクリプトに生スコアの保存と Frontier 判定を追加した。次の実行から出力される。

### 46.5 現時点の答え

**事前登録した検定では、model は勝てていない。** ただし2つの留保がある。

1. `low` では半数以上の試合で契約していない（`medium` で再測定中）
2. 検定そのものが、3軸Paretoにおける汎用Entryを不当に不利に扱っている

どちらも結論を覆すとは限らない。**Frontier membership でも broker の 68% を下回るなら、このArenaに AI Agent を使う価値はない**という §39.8 の懸念が裏付けられることになる。

---

## 47. `medium` での再測定 — 推論量は効かない

§46.2 の留保「`low` がモデルの手を縛っている」を確かめるため、同じ12 Seed・同じ対戦相手で `reasoning_effort` を `medium` にして再測定した。

| 軸 | low | medium | 固定 | 判定 |
| --- | --- | --- | --- | --- |
| livelihood | 785.9 | **729.5** | 797.3 | NO EFFECT (p=0.084) |
| stewardship | 0.632 | 0.629 | 0.730 | LOSES (p=0.002) |
| cooperation | 0.000 | **0.000** | 0.188 | LOSES (p=0.006) |

```text
出力トークン  177,504 → 445,537（2.5倍）
実時間        845秒 → 1501秒（1.8倍）
結果          同じか、わずかに悪化
```

**推論量を増やしても改善しない。** livelihood はむしろ下がった。そして **cooperation の中央値は `medium` でも 0.000** で、契約しないのは推論の不足ではない。§46.2 の留保1は消える。

### 47.1 契約しない理由の仮説 — Mission

私が与えた Mission の1行目は「船員の生活を維持できる収益を確保してください」である。

**自分の生活を最適化するなら、他船に金を払わないのが正しい。** 単独の支出が報われないことこそ共有地のジレンマであり、モデルはそれを正しく解いている可能性がある。

一方 Cooperation 軸の対戦相手 `e1 always cheap` は、**個体としては不合理な支出を毎Round行う固定設定**である。その軸はそれを報酬する。つまりこの比較は「支出する意思」を測っており、「巧拙」を測っていない。

これは §46.3 で指摘した検定の欠陥と同根である。**3軸のうちどれを取りに行くかは Mission が決めるべきもので、Arena の設計としてはそれで正しい。** User が Cooperation で戦いたければ、そう書いた Mission を渡す。

判定スクリプトに `OCEAN_MISSION` を追加した。Mission を変えたときに3軸のスコアがどれだけ動くかを測れば、**「モデルの差」と「指示の差」のどちらが支配的か**が分かる。これは Phase 1a の問いそのものよりも、Arena の設計判断として重要かもしれない。

---

## 48. Frontier による測定 — Phase 1a の答え

§46.3 で「事前登録した検定は3軸Paretoに対して誤っていた」と判断したため、**Arena が実際に報酬を出す基準**である Pareto Frontier での測定を追加した。

### 48.1 結果

3体の専門家に対して gpt-5 が Frontier に残る割合は **6/12 = 50%** である。

Scripted Baseline の同じ測定（40 Seed）と並べる。

```text
broker          68%   ← Scripted の最良
gpt-5           50%   ← ここ
balanced e0.6   50%
opportunist     48%
enforcer        45%
cautious        43%
crowd-averse    38%
greedy          30%
territorial     30%
```

**gpt-5 は中位の固定パラメータと同じ位置にある。** 標本が12なので信頼区間は広く（およそ21〜79%）、broker の 68% を下回ると断定はできない。**しかし上回る証拠もない。**

### 48.2 何が Frontier 残留を決めていたか

生スコアを見ると、構造は単純だった。

```text
契約した試合            7/12
Frontier に残った試合    6/12   ← ほぼ同じ集合
```

```text
model と生活専門家（e0.8 never none）の平均
  Stewardship   model 0.625  vs  0.630   ほぼ同じ
  Cooperation   model 0.019  vs  0.000   model がわずかに上
  Livelihood    model が負けることが多い
```

生活専門家は Livelihood で勝り、Stewardship はほぼ同じ、Cooperation は 0 である。したがって **model の Cooperation が 0 なら完全に支配され、0 より少しでも上なら支配を免れる。**

**Cooperation 軸は 0 のところに段差があり、それが Frontier 残留を支配している。** 1 DemoUSD 払って効果がほぼ無くても 0 より上になるため、この軸は**巧拙ではなく参加の有無を測っている**。

これは §38.5 で「棄権を罰しない」ために意図的に 0 を返す設計にした結果である。意図は正しかったが、Pareto と組み合わせると段差が支配的になる。**Phase 1b で扱うべき設計上の欠陥である。**

### 48.3 Phase 1a の答え

§40.5 の問い1「model は最良の固定設定に勝てるか」への答えは次である。

> **勝てていない。** 各軸の専門家に対しては2軸で有意に負け、Frontier 残留でも Scripted 最良の broker を上回らない。推論量を増やしても変わらない。

問い2（群れるか散るか）については、漁場選択が沿岸52% / 沖合47% / 保護区1% であり、**保護区をほぼ使わない**という点で Scripted とは異なる挙動を示している。ただしこれを「散った」と呼べるかは判定していない。

問い3（相手を読むか）と問い4（Livelihood の識別力）は未測定である。

### 48.4 ただし、まだ1つ変数が残っている

§47.1 の仮説である。Mission の1行目が「船員の生活を維持せよ」であるため、**モデルは Livelihood を最適化しており、他の2軸を取りに行っていない**可能性がある。

Mission を保全寄りに書き換えて同じ12 Seed で測り直せば、**「モデルの差」と「指示の差」のどちらが支配的か**が分かる。指示の方が支配的なら、この Arena は「良い Mission を書くゲーム」であり、それは最初のブリーフにあった「User が Mission と権限を設定する」という設計とむしろ一致する。

---

## 49. Mission は効く。しかし足りない — Phase 1a の結論

§48.4 の最後の変数を測った。同じ12 Seed、同じ対戦相手、同じ `low`。Mission だけを保全寄りに書き換えた。

### 49.1 結果

| | 生活Mission | 保全Mission | 固定専門家 |
| --- | --- | --- | --- |
| livelihood | 749.6 | **592.6** | 797.3 |
| stewardship | 0.626 | **0.655** | 0.730 |
| cooperation | 0.014 | **0.037** | 0.188 |
| Frontier 残留 | 6/12 | 7/12 | — |
| 保護区の利用 | 1% | 0% | — |

**3軸が指示どおりに一貫して動いた。** 保全へ寄せれば資源と協力が上がり、収入が下がる。トレードオフを言葉で指定でき、モデルはそれを守る。

**これは固定パラメータには絶対にできないことである。** ベクトルは散文で方向を変えられない。

しかし移動幅は小さい。Stewardship のギャップ 0.104 のうち埋めたのは 0.029（約28%）で、代わりに Livelihood を 157 落とした。Frontier 残留の 6/12 → 7/12 は標本12では誤差の範囲である。

### 49.2 Phase 1a の結論

§40.5 の4つの問いに答える。

**問い1「model は最良の固定設定に勝てるか」— 勝てない。**

生活Missionで2軸 LOSES・1軸 NO EFFECT、保全Missionで3軸 LOSES。Arena が実際に報酬を出す Frontier 残留でも 50〜58% で、Scripted 最良の broker（68%）を上回らない。`reasoning_effort` を 2.5 倍にしても変わらない。

**問い2「群れるか散るか」— 部分的に散る。**

漁場選択は沿岸52% / 沖合47% / 保護区1%。**保護区をほぼ使わない**点で Scripted と明確に異なる。§35.5 の群れ行動とは別の挙動だが、それが有利に働いてはいない。

**問い3「相手を読むか」・問い4「Livelihood の識別力」— 未測定。**

問い1が明確に否である以上、この2つを測る価値は下がった。

### 49.3 では、この Arena に AI Agent を使う意味はあるのか

**競技としては、現時点で意味がない。** 参加者はオフラインで60通り総当たりし、最良の固定ベクトルを提出すればよい。それが model より強い。§39.3 で懸念し、§39.8 で「Scripted では原理的に測れない」と保留した問いに、実測で否の答えが出た。

**ただし1つだけ、固定ベクトルにできないことがある。** Mission である。

```text
固定ベクトル   effortFraction 0.8 / reserve never / contracts none
Mission        「海は季節より長く続く。艦隊が全力で漁をした場合より
                良い状態で終えること、保護区を臨界の上に保つことが第一の務め」
```

後者は人が書ける。前者は書けない。**そして §49.1 のとおり、書けば実際に3軸が動く。**

Arena を「最も強い固定設定を探す競技」と見るなら、AI Agent は不要である。「**書いた指示がどう世界に現れるかを見る場**」と見るなら、AI Agent こそが唯一の実装手段になる。最初のブリーフが「User が Mission と権限を設定する」と書いていたのは、後者の設計である。

**この2つは別の製品であり、どちらを作るかはまだ決まっていない。**

### 49.4 Phase 1b の選択肢

| | 方向 | 何を作るか | 何が要るか |
| --- | --- | --- | --- |
| A | **Mission を書く競技にする** | Mission を提出物とし、同じモデル・同じ予算で比較する | §48.2 の段差の修正。Mission の識別力の測定 |
| B | **競技をやめ、実演にする** | Replay と Mission の差分を見せる展示。順位をつけない | Web UI への組み込み。Value Pool は保留 |
| C | **Arena を作り直す** | 固定ベクトルで解けない構造を探す。相手の行動履歴に応じた条件付き契約など | Phase 0 相当のやり直し |

Aが最初のブリーフに最も近い。Bは最も早い。Cは最も遠いが、競技として成立させたいなら避けられない。

### 49.5 先に直すべきもの（どの道を選んでも）

**Cooperation 軸の 0 における段差。** §48.2 のとおり、Frontier 残留がほぼ「契約したかどうか」だけで決まっている。1 DemoUSD 払って効果が無くても 0 より上になる。棄権を罰しない意図（§38.5）は保ちつつ、参加そのものが報酬にならない形へ直す必要がある。

## 50. §49 の結論は誤りだった — 測っていたものが壊れていた

「gpt-5 は調整済み固定パラメータに3軸すべてで負ける」という §49 の結論を、前提から検証し直した。**結論は撤回する。** LLM が弱かったのではなく、**勝敗を分ける判断がアリーナ側に存在しなかった。**

### 50.1 対戦相手は「固定パラメータ」ではなかった

`tunableAgent` は毎ラウンド `bestZone()` を呼ぶ。その中身は `expectedProfit()` — エンジンの数式そのもの（`yieldPerEffort` / `travelCost` / `effortCostPerUnit` / `reserveFinePerEffort`）を使い、3漁場の利益を厳密に計算して argmax を取る最適化器である。3つのダイヤルはその上に乗った修飾にすぎない。

一方 LLM が受け取るのは散文のパラメータ表（`llm-agent.ts` の漁場説明）だけで、収穫関数は与えられない。**電卓に暗算で挑ませていた。** livelihood での敗北はほぼ同語反復であり、判断力の比較になっていない。

### 50.2 3軸すべてが effort 1本の単調関数だった

圧力1倍（現行）、80〜120 seed、`reserve: never` / `contracts: cheap` 固定で effort を振った結果：

| effort | livelihood | stewardship | cooperation |
| --- | --- | --- | --- |
| 0.2 | 725.1 | 0.7056 | 0.1217 |
| 0.4 | 703.1 | 0.6848 | 0.1189 |
| 0.6 | 728.3 | 0.6696 | 0.1500 |
| 0.8 | 771.3 | 0.6584 | 0.2122 |
| 1.0 | 775.1 | 0.6416 | 0.2443 |

stewardship は完全な単調減少、livelihood と cooperation は単調増加。**最適値は必ず端にある。** livelihood と stewardship は独立した2軸ではなく、同じダイヤルを逆から読んだだけだった。端が答えの問題に知能の出番はなく、3軸 Pareto Frontier も1次元の曲線を3方向から見ていたにすぎない。§48 の frontier 残留率 50〜68% という数字自体が無意味だった。

Phase 0 の10基準がこれを見逃したのは、**最適値が端にあるか内側にあるかを問う基準が1つも無かった**ため。`scripts/monotonicity-ocean-commons.ts` として追加した。

### 50.3 判定基準そのものにも欠陥があった（自戒）

最初の版は「内点 かつ seed ごとの最良がばらける」で PASS とした。これは平坦な軸を誤って通す。実際 surplus production が 0.2501 / 0.2504 / 0.2512 / 0.2502 / 0.2495（変動幅0.7%）で「内点・ばらけ86%・PASS」と出た。平坦だから argmax が雑音でばらけていただけである。**効果量（端に対する優位 >= 3%）を第3の条件として追加した。** 三つ揃わないものはダイヤルであってアリーナではない。

同様に、圧力1.5倍・2倍で内点最適が現れたとした最初の報告は seed 数60での揺らぎだった。120 seed では端である。

### 50.4 漁獲圧を上げると2軸が生き返る

`OCEAN_PRESSURE` で `effortCapacity` を一律に倍する（`scenario.ts` の一時的なつまみ）。120 seed：

| 圧力 | livelihood | stewardship | cooperation | 判定 |
| --- | --- | --- | --- | --- |
| 1x | 端 (0.0%) | 端 | 端 (0.0%) | 0/3 |
| 2.5x | 内点 (1.3%) | 端 | 端 | 0/3 |
| **3x** | **内点 +13.9% ばらけ72%** | 端 | **内点 +23.5% ばらけ77%** | **2/3** |
| 3.5x | 内点 (4.1%) | 端 | 内点 (104.5%) | 2/3 |

**3倍が最良点。** 全船全開でも資源が64%残る海では、崩壊閾値 0.25 に誰も近づかない。3倍で初めて「獲りすぎると自分の首が絞まる」が成立し、最適点の位置が seed ごとに動く。

3倍では他のダイヤルでも同様：livelihood は effort / reserve / contracts の3本すべてで内点（+13.9% / +6.1% / +6.3%）、cooperation は effort と reserve で内点（+23.5% / +15.5%）。

### 50.5 stewardship 軸は圧力では直らない

`stewardship = minTotalStock / totalCapacity` は「魚を残すほど良い」であり、**定義から単調**。何もしない船が満点を取る。どの圧力・どのダイヤルでも端のままだった。

代替案を2つ測り、どちらも失敗した：

- **余剰生産**（季節を通じて海が産んだ魚）… 1倍で変動幅0.7%、3倍以降は単調減少
- **持続可能収量**（崩壊させずに獲れた量）… どの圧力でも端
- **総漁獲量** … どの圧力でも端

失敗の理由は共通している。**注目する1隻は5隻中の1隻でしかなく、世界全体の指標を動かせない。** 背景の4隻が海の状態を決めてしまうので、世界指標は誰が座っても似た値になる。

なぜ cooperation だけが機能するのか。あれは**比率**（stewardship の改善 ÷ 支払った金額）だからである。分母にある希少資源が内点最適を作っている。反実仮想で1隻に帰属させるだけでは不十分で（世界指標が線形なら定数を引くだけで単調性は変わらない）、**分母が要る。**

### 50.6 次にやること

第3軸を、**自分が諦めた漁獲 1 単位あたり、海をどれだけ良くしたか**という比率で定義し直す。全く漁をしない船は諦めた量が大きいのに他の4隻が獲ってしまうので低い。全開の船は分子が0。山は間にあり、その位置は「自分が残した魚を他が獲るか」に依存する — つまり相手を読む価値がそこに生まれる。

これを実装して 50.4 の圧力掃引と組み合わせ、3/3 を狙う。そのうえで初めて、LLM 判定（§49）を意味のある問いとして回し直せる。§49.5 の 0 における段差もこの再定義で同時に扱う。

**イラスト版 Replay の制作はこの後。** 中身の勝敗が成立していないものに絵を付けても意味がない。

## 51. 第3軸を作り直した — restraint

§50.5 の設計をそのまま実装した。

### 51.1 比にしただけでは足りなかった

最初の実装は「諦めた漁獲1単位あたりの stewardship 改善」（`seaGain / forgone`）。**effort=1.0 で最大**になり、直そうとした欠陥をそのまま再現した。原因は分母で、全開の船は諦めた量がほぼ0なので、小さい値どうしの比が発散する。

| effort | 比による restraint (圧力3倍) |
| --- | --- |
| 0.2 | 0.0209 |
| 0.6 | 0.0261 |
| 1.0 | **0.0535** ← 全開が最高 |

### 51.2 分母を「残した魚」にすると成立する

`scoreRestraint(full, ifTaken, boatId)` — 同じ seed を、その席だけ `takerAgent`（契約せず、合法な漁場で全力）に差し替えて再生し、

```
forgone  = taker の漁獲 − 自分の漁獲        （水に残した魚）
retained = 期末資源量の差                    （実際に残った魚）
efficacy = retained / forgone                （残したもののうち残ったもの）
```

意味が明確になる。**貪欲な船が向かう漁場に魚を残しても何も買えない** — その場で他が獲るだけで海は変わらない。誰も来ない漁場に残す、あるいは産卵に間に合うだけ早く残せば、諦めた量以上が返ってくる。上に有界で、何も諦めない船は0、闇雲に全部諦める船も低い。山は間にあり、そこを見つけるには**他の4隻がどこへ行くかを読む**必要がある。

分母が小さすぎる領域（`forgone <= taker漁獲の2%`）は丸め誤差を読むだけなので0にした。

### 51.3 圧力3倍で 3/3 PASS

120 seed：

| 軸 | 最良effort | 内点か | 端に対する優位 | ばらけ | 判定 |
| --- | --- | --- | --- | --- | --- |
| livelihood | 0.6 | 内点 | +13.9% | 72% | PASS |
| restraint | 0.8 | 内点 | +14.6% | 72% | PASS |
| cooperation | 0.6 | 内点 | +23.5% | 77% | PASS |
| ~~stewardship~~ | 0.2 | 端 | 0.0% | 43% | FAIL（軸から外す） |

独立性 max|ρ|=0.612（軸間 0.240 / 0.328 / 0.612）。圧力1倍・2倍では 0/3 なので、**定義の変更と圧力の両方が必要**だった。

`stewardship` は証拠としては残すが、判定する3軸からは外した。判定側（`simulate-ocean-commons.ts` の #2 #3 #7）も restraint に差し替えた。

### 51.4 圧力だけでは10基準と両立しない

軸を差し替えたうえで Phase 0 の10基準を各圧力で測った（原設計比）：

| 圧力 | 単調性 | #2 支配 | #5 協定の代償 | #6 Escrow | stewardship中央値 |
| --- | --- | --- | --- | --- | --- |
| 1.5x | 0/3 | PASS 10.5% | PASS 22.1% | FAIL 25.5% | 0.309 |
| 2x | 0/3 | PASS 5.5% | FAIL 8.0% | FAIL 17.6% | 0.158 |
| 2.5x | 0/3 | PASS 14.0% | FAIL 4.6% | FAIL 21.8% | 0.092 |
| **3x** | **3/3** | FAIL 23.0% | FAIL 6.2% | FAIL 25.4% | **0.053** |

**両立する圧力が存在しない。** 単調性が消えるのは3倍だけだが、その3倍では海が容量の5%まで壊滅し、協定が常に得になる（＝ジレンマが消える）ため #2 と #5 が落ちる。

原因は、低圧力（何も希少でない）と高圧力（必ず全滅）が同じ1本のダイヤル上にあること。**海が季節内に回復できない**（沿岸 r=0.22 では9ラウンドで何も戻らない）ため、間の窓が存在しない。

### 51.5 次 — 圧力 × 成長率の2次元探索

成長率を上げれば「重い圧力の下でも、上手く漁れば持続する」窓が開くはず。獲る時期を見極める価値＝技能が生まれる。`OCEAN_PRESSURE` × `OCEAN_GROWTH` で探索中。

## 52. 圧力でも成長率でも窓は開かない — 原因は背景の艦隊だった

### 52.1 2次元探索（圧力 × 成長率）

海が季節内に回復できれば「重い圧力でも上手く漁れば持続する」窓が開く、という §51.5 の仮説を測った。12点、単調性120 seed・10基準200 seed：

| 圧力(baked比) | 成長 | 単調性 | #2 | #5 | #6 | steward中央値 |
| --- | --- | --- | --- | --- | --- | --- |
| 1.0 | 2 | 3/3 | 26.5% FAIL | 5.7% FAIL | 22.9% FAIL | 0.036 |
| 1.0 | 4 | 3/3 | 20.0% FAIL | 6.1% FAIL | 28.7% FAIL | 0.019 |
| 1.33 | 2 | 2/3 | 8.0% PASS | 6.9% FAIL | 33.7% PASS | 0.014 |
| **1.33** | **4** | **3/3** | **12.5% PASS** | 7.1% FAIL | **33.0% PASS** | **0.005** |
| 1.67 | 3 | 0/3 | 16.5% PASS | 11.8% FAIL | 19.0% FAIL | 0.007 |
| 2.0 | 3 | 1/3 | 36.0% FAIL | 8.9% FAIL | 17.9% FAIL | 0.007 |

**仮説は外れた。** 成長率を上げると stewardship 中央値は上がるどころか下がる（0.036 → 0.019）。増えた生産を貪欲な船が食い尽くすだけで、海には何も残らない。#5 はどの点でも落ちる。

### 52.2 原因の特定 — 海は生き延びられる、背景の艦隊が殺している

「そもそもこの海が生き残る戦略profileは存在するのか」を直接測った（60 seed）：

| 編成 | stewardship | 生存率 | 総漁獲/容量 |
| --- | --- | --- | --- |
| 全船が抑制的 (e0.2) | **0.878** | 98% | 0.53 |
| 全船が enforcer | **0.742** | 94% | 0.35 |
| 全船が貪欲 | 0.237 | 13% | 0.81 |
| **mixed（全実験で使ってきた背景）** | **0.072** | **12%** | 0.97 |

**世界のパラメータは壊れていない。** 抑制的な艦隊は海を容量の88%に保ったまま容量の半分を水揚げする — 持続的な漁業が成立している。壊しているのは背景の `greedy` + `opportunist` で、これが入っている限り参入者が何をしても海は死ぬ。

だから抑制は何も買えず、restraint 軸に測るものが無く、協定は常に得（＝ #5 が落ちる）になっていた。**§50 以降で追ってきた症状の多くは、この1点に帰着する。**

### 52.3 ただし「反応する背景に替える」だけでは解けなかった

`enforcerAgent` を1体または2体入れた背景で測り直した（120 seed）：

| 圧力 | 背景 | livelihood | restraint | cooperation | 計 |
| --- | --- | --- | --- | --- | --- |
| 1.0 | reactive (enforcer×1) | 端 | 端 | 内点 +23.1% | 1/3 |
| 1.0 | enforcer×2 | 内点 +27.0% | 内点 +0.8% | 端 | 1/3 |
| 1.33 | reactive | 内点 +19.5% | 端 | 内点 +56.0% | 2/3 |
| 1.33 | enforcer×2 | 内点 +8.9% | 端 | 端 | 1/3 |
| **1.0** | **mixed（現行）** | **内点 +13.9%** | **内点 +14.6%** | **内点 +23.5%** | **3/3** |

皮肉なことに、単調性だけを見れば現行の mixed 背景が最良である。相手が報復するようになると restraint は端（全開）に戻る。

### 52.4 現在地

`scenario.ts` に圧力3倍を焼き込み、restraint 軸を実装・判定側へ配線した状態：

- **単調性 3/3 PASS**、独立性 max|ρ|=0.612 — §50 で見つけた致命的欠陥は解消した
- **Phase 0 10基準は 7/10** — #2（単一Policy支配 23%）、#5（協定の代償 6.2%）、#6（Escrow 25.4%）が未達
- 期末の海は容量の 5%。テスト 40件 PASS

### 52.5 ここから先は設計判断であり、測定では決まらない

残る選択肢は3つで、それぞれ別のものを諦める：

- **A. 背景の艦隊を作り直す。** greedy / opportunist を、希少性に反応する船へ置き換える。§52.2 が示すとおり原因はここにあるが、§52.3 のとおり素朴な差し替えでは単調性が壊れる。相手の設計をやり直すのが最も筋が良く、最も時間がかかる。
- **B. 現行（圧力3倍・restraint 軸）で確定し、#2 #5 #6 の未達を明示したまま進む。** 単調性は通っているので「上手さが効く」ことは担保される。ただし毎回ほぼ全滅する海で、協定が常に得になる。
- **C. 圧力1.33 × 成長4 を採る。** 10基準は #5 だけの未達まで改善するが、海は容量の0.5%まで壊滅する。

**どれを選ぶかは「このアリーナで何を見せたいか」の判断であり、私が測って決められるものではない。** 荒れ果てた海で技能を競わせるのか、持続可能な漁業を成立させることそのものを競わせるのか。後者なら A しかない。

## 53. ルールを差し替える — 隠された海と、硬い燃料

### 53.1 なぜ作り直すのか

§50〜52 で 3 度ルールを保ったままパラメータを変え、3 度とも同じ壁に当たった。圧力を上げれば内点は出るが海が全滅し、成長率を上げれば増えた分を貪欲な船が食い尽くし、相手を反応させれば restraint が端に戻る。

原因はパラメータではない。**共有地のジレンマは、個人の最適解が数学的に自明な構造である。**「もっと獲る」が支配戦略で、だからこそ「悲劇」と呼ばれる。構造的な性質にパラメータをぶつけていたので収束するはずがなかった。共有地のジレンマは見せるための装置であって、競わせるための装置ではない。

同じリポジトリで動いている 72-Hour Disaster Response は「$72,000 の上限を 4 地域へ配分する」— 硬い予算と逓減リターンで、内点最適が構成的に存在する。成立しているアリーナはその構造を持っている。

### 53.2 内点最適が構成的に保証される構造

| 構造 | なぜ確実か |
| --- | --- |
| 硬い予算 + 逓減リターン | 予算制約と凹なリターンから内点最適が構成的に存在し、最適配分は状況で動く |
| 隠された情報 + 探索/活用 | 情報を得る費用と使う利益の釣り合いに必ず山ができる |
| 破産閾値 | 攻めすぎれば退場、守りすぎれば増えない |

Ocean Commons に 1 番目と 2 番目を入れる。3 番目（崩壊閾値・破産）は既にある。

### 53.3 変えるもの その 1 — 資源量を隠す

**現状。** `Observation.stocks: Record<ZoneId, number>` で、全船が全漁場の現在量を毎ラウンド正確に見ている。だから最適解が計算可能で、エンジンの数式を持つソルバーが必ず勝つ（§50.1）。

**変更後。** 現在量は誰にも配られない。船が持てるのは測深記録だけ：

```ts
export type Sounding = {
  zoneId: ZoneId;
  /** Stock when this reading was taken. */
  stock: number;
  /** The round it was taken in. Older readings are worth less. */
  round: number;
  source: "FISHED" | "OBSERVED" | "SHARED";
};
```

- **FISHED** … 自分が前ラウンド操業した漁場。水揚げから逆算できるので正確
- **OBSERVED** … 他船がその漁場で挙げた水揚げからの推定。`PublicBoatView.lastZoneId` と `lastCatch` は既にあるので、**他船の動きが唯一の情報源になる**
- **SHARED** … 契約で相手から受け取った測深記録

初期状態では誰も何も知らず、公表されている生物学（`carryingCapacity`、`growthRate`、`catchEfficiency`）だけが事前分布として与えられる。

これが効く理由は 3 つある。第一に、未知の漁場へ行くこと自体に価値が生まれ、探索と活用の釣り合いに必ず内点ができる。第二に、**相手を読むことが選択ではなく必須になる** — 他船がどこへ行き幾ら揚げたかが、自分が行っていない海についての唯一の証拠だから。第三に、**契約が情報の取引になる**。今の協定は漁獲制限と金しか動かせないが、測深記録を交換する契約は、抑制を売る契約とは別種の駆け引きを生む。

### 53.4 変えるもの その 2 — 燃料を硬い予算にする

**現状。** 制約は 1 ラウンドあたりの船体能力 `effortCapacity` だけ。ラウンド間に配分の問題が存在せず、毎ラウンド独立に「行けるだけ行く」が解になる。

**変更後。** 季節を通じて使える燃料の総量を先に配る。

```ts
/** Fuel for the whole season, not per round. Spent on effort and on travel. */
fuelBudget: number;
```

エンジンは毎ラウンド `effort * fuelPerEffort + zone.travelFuel` を引き、残量を超える effort は残量ちょうどに切り詰める。尽きた船は港から出られない。

内点が保証される理由：早く使い切れば価格が崩れ（`elasticity` は既にある）資源も薄くなった後半を漁れない。薄く延ばせば `upkeepPerRound` に食われ、時化のラウンドに燃料を残せない。**季節の長さは 7〜10 で隠されたまま**（`SEASON_WINDOW`）なので、配分は常に horizon の不確実性の下で行われる。

`effortCapacity` は 1 ラウンドの上限として残すが、拘束するのは燃料の側になる。§52 で焼き込んだ 3 倍は一度捨て、燃料予算を決めたあとに 1 回だけ測って決め直す。

### 53.5 変えないもの

- 決定論。`transition(state, actions, scenario)` は純粋関数のまま。天候は seed から先に生成。リプレイのハッシュ一致もそのまま
- 契約（CATCH_LIMIT / CONSERVATION_BUYOUT / MUTUAL_AID / CONSERVATION_FUND）とエスクロー。ここに測深記録の共有を 1 種類足す
- 3 軸を合算しないこと。`livelihood` / `restraint` / `cooperation`
- `scoreRestraint`（§51）と `takerAgent`。隠された海でも参照は同じように作れる
- `scripts/monotonicity-ocean-commons.ts`（§50）

### 53.6 消すもの

`OCEAN_PRESSURE` / `OCEAN_GROWTH` / `OCEAN_BACKGROUND` の 3 つの掃引つまみ。探索用に入れたもので、本番の設定に残すものではない。

### 53.7 実装の順序

1. `Sounding` 型と `Observation` の差し替え。`stocks` を消して `soundings` にする
2. エンジン側で測深記録を生成（自分の操業 → FISHED、他船の水揚げ → OBSERVED）
3. `fuelBudget` を `Boat` に追加し、`transition` で消費と切り詰めを実装
4. 既存 5 エージェントを新しい観測に対応させる。`bestZone` は現在量ではなく測深記録から期待値を組む
5. 契約に `SOUNDING_EXCHANGE` を追加
6. `llm-agent.ts` のプロンプトを新しい観測に合わせる
7. 燃料予算を 1 回だけ掃引して決める

### 53.8 停止規則 — ここを先に決めておく

§50〜52 を繰り返さないために、測る前に決める。

- 測るのは **`scripts/monotonicity-ocean-commons.ts` の 1 本だけ**
- 合格は **3 軸すべてが内点、端に対する優位 3% 以上、seed ごとのばらけ 40% 以上、独立性 max|ρ| < 0.8**
- 燃料予算の掃引は **1 回限り**。それで 3 軸揃わなければ **パラメータには触らず、このルールを捨てる**
- 調整を 1 周でも始めたら、それは §50〜52 の再演である

Phase 0 の 10 基準は、単調性が通ったあとに測る。順序を逆にしたことが §52 までの遠回りの一因だった。

### 53.9 約束しないこと

内点最適が構成的に存在することは保証できる。**「gpt-5 が調整済みソルバーに勝つ」ことは保証できない。** これは別の主張であり、隠された情報はソルバー側の優位（エンジンの数式を持つこと）を削るが、勝敗を約束するものではない。

72-Hour Disaster Response も *LLM > ソルバー* を証明してはいない。見せているのは「あなたの戦略がどの価値の組み合わせに着地するか」である。Ocean Commons もその基準で成立させる。§49 の判定はこの基準に合わせて書き直す。

## 54. フロントエンド — 他のアリーナと同じ流れに乗せる

### 54.1 統合の契約（既存アリーナ 5 本を読んで確認した）

新しいアリーナを web に出すのに必要なものは 3 箇所だけで、どれも既存の型に従う。

**1. パッケージ側の輸出**（`packages/ocean-commons/src/index.ts`）

```ts
export const oceanCommonsManifest = parseChallengeManifest({ ... });  // ChallengeManifestV2
export const oceanCommonsManifestHash = hashChallengeManifest(oceanCommonsManifest);
export function publicOceanCommonsScenario() { ... }   // 隠し状態を含まない公開シナリオ
```

`rescue-room` の `index.ts:2218` と同じ形。`lifecycle`、`valueTension`、`hardConstraints`、`metrics`、`contexts`、`submission`、`reward` を埋める。

**2. カタログ登録**（`apps/web/src/lib/arenas.ts`）

`arenaRegistry` に 1 エントリ。`slug: "ocean-commons"`、`kind: "ocean"`、`metrics` は 3 軸（Crew livelihood / Restraint efficacy / Cooperation efficacy）。`status: "Practice"`、`reward: "No practice reward"`。**§53.9 のとおり競技として未証明なので、`Demo competition` にはしない。**

**3. アダプタ**（`apps/web/src/lib/arena-adapters.tsx`）

```ts
const oceanAdapter: ArenaAdapter = {
  kind: "ocean",
  challengeId: "ocean-commons-v1",
  async renderWorkbench() { ... <OceanCommonsWorkbench scenario={publicOceanCommonsScenario()} /> },
  async loadManifest() { ... },
};
```

これで `/arenas/ocean-commons` が `[slug]/page.tsx` から自動で生える。`generateStaticParams` が registry を読むので、ルートを手で足す必要はない。

### 54.2 ページの流れ

72-Hour Disaster Response の節構成をそのまま踏襲する。左が参照、右が Ocean Commons。

| # | 参照アリーナ | Ocean Commons |
| --- | --- | --- |
| — | THE WHOLE GAME IN ONE PICTURE<br>“Routes fail. Your strategy reroutes aid.” | **THE WHOLE GAME IN ONE PICTURE**<br>“The sea is hidden. What you leave, someone else may take.” |
| 01 | THE MISSION | 船団の任務 — 燃料の総量と、隠された海 |
| — | RULES IN 30 SECONDS | 30 秒でルール — 見えるのは自分が行った海だけ |
| 02 | THE VALUE MARKET（4 プール） | 3 つの価値 — 生計 / 抑制 / 協力 |
| 03 | BUILD YOUR RESPONSE | **Mission と Wallet Policy を書く**（配分数値ではない） |
| 04 | HOW DECENTRALIZED VALUE WORKS | 同じ |
| 05 | WATCH THE CONSEQUENCES | **航海リプレイ**（§54.3） |
| 06 | CHOOSE YOUR FINAL | 同じ |
| — | YOUR VALUE RESULT | 3 軸の着地点と Pareto Frontier |
| 07 | VALUE ALLOCATIONS | 同じ |
| 08 | SOLUTION LANDSCAPE | 同じ |
| 09 | ETHEREUM SETTLEMENT | 同じ |

ユーザーが言った流れ（**パラメータか Prompt を入れる → イラストが動く → 勝敗 → 賞金**）は、03 → 05 → YOUR VALUE RESULT → 07 に一対一で対応する。既存の骨格がそのまま答えになっている。

### 54.3 リプレイを絵にする

**現状の失敗。** 作った Replay Viewer は水位タンク 3 本と船カードと SVG の弧で、情報としては正しいが**図表であって場面ではない**。「棒グラフが動いているだけで何をやっているのか分からない」という指摘はそのとおり。

**参照アリーナの手法**（`disaster-replay-stage.tsx:275`）。1 枚のイラストを背景に敷き、その上に replay トレースから生成した DOM マーカーを絶対配置し、15 秒を 4 フェーズに割る。絵は絵として用意し、動くものだけを重ねている。全部を SVG で描こうとしたのが敗因だった。

**Ocean Commons の場面。** 上から見た漁場を 1 枚の情景として組む。左に沿岸、右奥に沖合、中央下に柵で囲った保護区。5 隻の船を配置し、魚影の濃さで資源量を表す。ただし**参照アリーナと違い、資源量は隠されている**（§53.3）ので、絵もそれに従う：

- **自分が行っていない海は霧で覆う。** 濃さが情報の古さ。これがルールを一目で伝える
- 他船が水揚げすると、その海の霧が一段薄くなる — **相手を見ることが情報になる**ことが絵で分かる
- 船が漁場へ動き、網が上がり、水揚げ量が数字で出る
- 船と船の間に**契約の帯**を引く。CATCH_LIMIT / BUYOUT / MUTUAL_AID / SOUNDING_EXCHANGE で色を変え、エスクローが積まれると実線に、違反すると赤く切れる
- 時化のフェーズで画面が暗転し、船体限界を超えた船が故障する
- 燃料計を各船に付ける。**尽きた船は港に戻って動かなくなる** — 硬い予算が絵で分かる

**フェーズ割り。** `01 · SET SAIL → 02 · CONTRACT → 03 · GALE → 04 · RESULT`、15 秒。

**絵の作り方。** 参照アリーナはラスタ画像（2.4MB PNG）を使っているが、Ocean Commons は**手書きの SVG 情景**にする。海・船体・魚群・網・霧はコードで描けるので、画像生成の工程が要らず、資源量や霧の濃さをデータから直接動かせる。塗りの質感が欲しくなったら、あとからラスタに差し替えても上の構造は変わらない。

### 54.4 10 分の制約

「待ち時間も遊ぶ時間も 10 分が限界。ポケモンの Kaggle くらい」という要件は、次で満たす。

- LLM 対戦は裏で走らせる（実測 69〜125 秒/seed）
- **リプレイは 15 秒**。見るのに待たせない
- 固定エージェント同士の練習対戦はブラウザ内で即座（1 試合 1 ミリ秒未満）

---

## 55. やることの全部 — 実行順

§53 のルール差し替えと §54 のフロントエンドを、依存順に並べる。**§53.8 の停止規則が最優先で、これに反したらそこで止める。**

### 第 1 部 — ルールの差し替え（エンジン）

1. `Sounding` 型を `types.ts` に追加し、`Observation.stocks` を `soundings` に差し替える
2. エンジンで測深記録を生成する。自分の操業 → `FISHED`、他船の水揚げからの推定 → `OBSERVED`
3. `Boat.fuelBudget` を追加。`transition` で `effort * fuelPerEffort + zone.travelFuel` を消費し、残量で切り詰める。尽きた船は出港できない
4. 既存 5 エージェント（broker / greedy / opportunist / cautious / enforcer）と `tunableAgent` / `takerAgent` を新しい観測に対応させる。`bestZone` は現在量ではなく測深記録から期待値を組む
5. 契約に `SOUNDING_EXCHANGE` を追加
6. `llm-agent.ts` のプロンプトを新しい観測に合わせる。**seed も隠し状態も漏らさない**ことをテストで担保
7. 掃引つまみ `OCEAN_PRESSURE` / `OCEAN_GROWTH` / `OCEAN_BACKGROUND` を削除。§52 で焼き込んだ 3 倍も一度戻す

### 第 2 部 — 停止規則の判定（1 回だけ）

8. 燃料予算を **1 回だけ**掃引して決める
9. `scripts/monotonicity-ocean-commons.ts` を回す。**3 軸すべて内点・優位 3% 以上・ばらけ 40% 以上・max|ρ| < 0.8**
10. 落ちたらパラメータには触らず、ここで停止して報告する。通ったら次へ

### 第 3 部 — 既存の検証を通す

11. Phase 0 の 10 基準（`simulate-ocean-commons.ts`）。**単調性の後に測る** — 順序を逆にしたのが §52 までの遠回りの一因
12. ユニットテスト。決定論とリプレイのハッシュ一致、情報漏洩なし、燃料の切り詰め、測深記録の生成
13. `scripts/solve-ocean-commons.ts` の全探索。隠し情報の下で単一設定が勝ち続けないことの確認

### 第 4 部 — フロントエンド

14. `oceanCommonsManifest` / `oceanCommonsManifestHash` / `publicOceanCommonsScenario()` を輸出
15. `arenas.ts` に登録（`kind: "ocean"`、`status: "Practice"`）
16. `arena-adapters.tsx` にアダプタ追加
17. `OceanCommonsWorkbench` を §54.2 の節構成で作る
18. `OceanVoyageStage`（§54.3 のリプレイ）。霧・契約の帯・燃料計・時化
19. `globals.css` に必要なスタイル
20. Playwright でスクリーンショットを撮り、他アリーナと並べて見劣りしないか確認

### 第 5 部 — 記録

21. Plan10 に結果を追記
22. `Docs/plans/ocean-commons-merge.md` を更新（Codex への引き継ぎ）
23. コミット。**Push はしない**（指示を待つ）

### 触らないもの

`packages/rescue-room`、`apps/api`、`apps/web` の既存アリーナ、Codex が作業中のファイル（`rescue-room-workbench.tsx`、`globals.css` の既存規則、`STATUS.md`、`design-qa.md`）。`globals.css` は追記のみで既存規則を書き換えない。

## 56. ルールを差し替えた結果 — 2/3 で、停止規則に従って止めた

§53 の 2 つのルール変更を実装した。

### 56.1 実装したもの

**隠された海。** `Observation.stocks` を廃止し、`soundings: readonly Sounding[]` に差し替えた。生成は `match.ts` の `soundingsFor()` 1 箇所に集約されており、ここを通らない限りどの数字もエージェントに届かない。

- `FISHED` … 自分が働いた漁場。正確
- `OBSERVED` … 他船の水揚げから推定。**容量の 1/10 に丸めた帯**でしか分からない
- `SHARED` … `SOUNDING_EXCHANGE` 契約の相手から。正確

`Observation.history` も差し替えた。`RoundRecord[]` は全漁場の `stocksBefore`/`stocksAfter` を持つので、そのまま渡すと裏口から海が全部漏れる。`BoatRoundMemory[]` は自分の操業記録と、**他船がどこへ行き幾ら揚げたか**だけを持つ。後者が唯一の推論経路になる。

エージェント側は `believedStock()` を新設し、最新の測深記録を成長曲線で現在まで前進させて期待値を組む。**その間に誰が獲ったかは分からない** — これが不確実性の本体で、記録が古いほど広がる。

**硬い燃料予算。** `Boat.fuelBudget` を季節通しで配る。`transition` が `travelFuel + effort * fuelPerEffort` を引き、足りなければ effort を切り詰め、空なら `OUT_OF_FUEL` で出港できない。全開約 4 ラウンド分に対し季節は 7〜10 ラウンド。**全ラウンド全開は誰にも不可能で、どのラウンドが勝負かを、残り何ラウンドか分からないまま決めることになる。**

`SOUNDING_EXCHANGE` を契約種別に追加。魚でも金でもなく知識を動かす唯一の契約で、**相手が自分の行っていない海にいたときだけ価値がある。**

掃引つまみ 3 つ（`OCEAN_PRESSURE` / `OCEAN_GROWTH` / `OCEAN_BACKGROUND`）は削除した。

### 56.2 停止規則の判定 — 落ちた

燃料予算を 1 回だけ掃引した（120 seed）。判定 3 軸は livelihood / restraint / cooperation。

| 燃料 | livelihood | restraint | cooperation | 通過 | max\|ρ\| |
| --- | --- | --- | --- | --- | --- |
| 0.4x | 端 | 端 | 内点 +49.9% | 1/3 | 0.198 |
| **0.55x** | 端 | **内点 +22.8%** | **内点 +70.2%** | **2/3** | 0.211 |
| 0.7x | 端 | 内点 +0.3% | 内点 +55.0% | 1/3 | 0.252 |
| 0.85x | 内点 +8.6% | 端 | 内点 +44.7% | 2/3 | 0.393 |
| **1.0x** | **内点 +8.3%** | 端 | **内点 +35.3%** | **2/3** | 0.516 |
| 1.3x | 内点 +13.6% | 端 | 内点 +36.9% | 2/3 | 0.570 |

**どの値でも 3/3 に届かない。最良は 2/3。** しかも落ちる軸が入れ替わる — 燃料が少ないと livelihood が端（漁に出る余裕がなく抑制が強制される）、多いと restraint が端。**livelihood と restraint は燃料に対して逆を向いている。**

§53.8 の停止規則は「3 軸すべて。1 回限り。落ちたらパラメータには触らずルールを捨てる」だった。**従って、ここでパラメータ調整を止める。** つまみは削除し、燃料は原理的に導いた値（全開約 4 ラウンド分）で確定した。§50〜52 で 3 度繰り返した「落ちた基準に合わせて回し続ける」を、今回はしない。

### 56.3 それでも前より良くなったこと

- **独立性が劇的に改善した。** max\|ρ\| は §51 の 0.612 から 0.211〜0.516 へ。特に livelihood〜restraint が 0.073、livelihood〜cooperation が 0.089 — ほぼ無相関で、3 軸が本当に別のことを測っている
- **cooperation の優位が +35〜70%** と大きい。隠された海では、相手が持つ情報に値段が付く
- ソルバー側の優位（エンジンの数式を持ち、全漁場の現在量を見て argmax を取る）が構造的に消えた。§50.1 の「電卓に暗算で挑ませていた」不公平は無くなった
- 期末の海が容量の 27〜30% に戻った（§52 の 0.5〜5% から）。全滅する荒野ではなくなった

### 56.4 この状態で何と呼べるか

**競技としては未証明。** 3 軸のうち 1 つは依然として端に最適があり、その軸では上手さが分かれない。`arenas.ts` には `status: "Practice"`、`reward: "No practice reward"` で登録する（§54.1 の判断どおり）。**Demo competition にはしない。**

一方で「Mission が世界を動かす」ことを見せる装置としては十分に成立している。§53.9 に書いたとおり、72-Hour Disaster Response も *LLM > ソルバー* を証明してはいない。次はフロントエンドを作り、実際に見て判断する。

## 57. フロントエンド — 絵になった

§54 の計画どおり実装した。`/arenas/ocean-commons` で動いている。

### 57.1 統合

3 箇所だけで、既存アリーナ 5 本と同じ形に収まった。`packages/ocean-commons/src/manifest.ts` が `oceanCommonsManifest` / `publicOceanCommonsScenario()` を輸出し、`arenas.ts` に 1 エントリ、`arena-adapters.tsx` に 1 アダプタ。ルートは `[slug]/page.tsx` から自動で生える。

### 57.2 リプレイ — 図表ではなく場面

`voyage.ts` の `toVoyage(log, viewpoint)` が対戦記録を場面の列に変換し、`ocean-voyage-stage.tsx` が SVG で描く。参照アリーナはラスタ画像を背景に敷いているが、こちらは海・船体・魚群・網・霧をすべてコードで描いた。資源量や霧の濃さをデータから直接動かせるためで、塗りの質感が要るならあとからラスタに差し替えても構造は変わらない。

画面にあるもの：

- **漁場が地図として並ぶ。** 保護区は破線の柵で囲う
- **魚影の密度が資源量。** 崩壊した漁場の魚は赤い
- **船体が漁場の間を動く。** 網が上がると水揚げ量が数字で出る。竜骨の下の帯が季節の残り燃料で、尽きると港から動かなくなる
- **船と船の間に契約の帯**が架かる。種別で色が変わり、エスクローの残額が線の太さになり、違反すると破線に切れる
- **時化のラウンドは画面が暗転**し、隅に `GALE · BANK SHUT` のバッジが出る

そして他のどのアリーナとも違う要素：

- **霧。** 誰も測っていない海は暗いまま描かれ、ラウンド 1 では Offshore bank が `never sounded` と表示されて真っ暗になる。視点は 1 隻に固定されるので、**その船が知っていたことだけが見える。** 隠された海というルールが、説明ではなく絵で伝わる

最初に作った水位タンク 3 本の版と比べて、何が起きているか分かるようになった。§54.3 の目的は達した。

### 57.3 ページの流れ

ユーザーが述べた「パラメータか Prompt を入れる → イラストが動く → 勝敗 → 賞金」に対応させた。

| 節 | 中身 |
| --- | --- |
| THE WHOLE GAME IN ONE PICTURE | 読み方の凡例 → リプレイ → 数値タイル 4 枚 |
| 01 · THE MISSION | 何を守り何を諦めるのか |
| RULES IN 30 SECONDS | 海は見えない / 燃料は季節予算 / 契約はエスクロー / 判定はエンジン |
| 02 · THE VALUE MARKET | 3 軸の説明。合算しないと明記 |
| 03 · WRITE A MISSION | **Mission のテキスト入力**、方針 3 択、seed 選択 |
| YOUR VALUE RESULT | 3 軸の着地点と、季節の長さ・生存数・残燃料 |
| WHAT THIS ARENA DOES NOT CLAIM | 2/3 しか通っていないことを明記 |

練習対戦はブラウザ内で即座に終わるので、値を変えると結果がすぐ変わる。**10 分の制約は問題にならない。**

### 57.4 別実装との衝突

作業中に `ocean-commons-workbench.tsx` が別実装へ書き換わっていた。サーバー側で対戦を解決する設計は優れているのでその発想と `reciprocatorAgent` の採用、読み方の凡例は取り込み、次の 2 点を戻した。

1. 表示軸が `stewardship` と `resilience` で、**どちらも判定 3 軸から退役済み**だった（§51.3、§56）
2. 使っている CSS クラスが `globals.css` に 1 つも定義されておらず、無スタイルになっていた

`Docs/plans/ocean-commons-merge.md` に詳細を書いた。

### 57.5 現在の状態

- テスト 40 件 PASS、型検査クリーン、secret-scan PASS、`globals.css` は末尾追記のみ
- 単調性ゲート **2/3**。`status: "Practice"`、報酬プールなし
- **Push はしていない**

### 57.6 残っていること

- **第 3 軸（restraint）が端のまま。** §56.2 のとおり livelihood と燃料に対して逆を向いており、パラメータでは両立しない。競技にするならここ
- `SOUNDING_EXCHANGE` は型と契約検証は入れたが、**スクリプトのエージェントがまだ提案しない**。測深記録を売買する駆け引きは実装の続きが要る
- LLM 判定（`judge-ocean-commons.ts`）は新ルールで未実行。プロンプトは書き換え済み
- 賞金の節（他アリーナの 07 VALUE ALLOCATIONS / 09 ETHEREUM SETTLEMENT）は未実装。競技として成立していない段階で価値配分を見せるのは早い

## 58. フロントエンドを他アリーナと同じ水準にする

### 58.1 いま何が足りないのか

§57 で作ったページは、独自の `ocean-*` クラスで一から組んだ。動きはするが、**他のアリーナと見た目も構造も揃っていない。** 72-Hour Disaster Response を読み直すと、既存アリーナは共通の CSS 語彙を共有していた。

| 共通クラス | 役割 | `globals.css` に定義 |
| --- | --- | --- |
| `competition-shell` | ページ全体の枠 | あり |
| `competition-nav` | 節を渡り歩く固定ナビ | あり |
| `competition-build` | 戦略を組む作業台 | あり |
| `competition-scoreboard` | 3 軸の着地点 | あり |
| `competition-leaderboard` | 基準戦略との比較表 | あり |
| `competition-revisions` | 提出の履歴 | あり |
| `competition-settlement` | 決済の証拠 | あり |
| `lever-explanation` | 「この操作が何を動かすか」 | あり |
| `live-preview-metrics` | 触ると即座に変わる数値 | あり |
| `evidence-chain` | ハッシュの連鎖 | あり |

**これらを使えば、既存アリーナと同じ見た目が実装なしで手に入る。** 独自クラスで組んだのは判断ミスだった。

### 58.2 やること

**A. 共通語彙へ載せ替える**

`ocean-workbench` を `competition-shell ocean-competition` に。節は `competition-*` を使い、Ocean 固有の見た目だけ `ocean-*` で上書きする。リプレイ台（`ocean-map` とその中身）は据え置き — ここは Ocean 固有で、他に同等物がない。

**B. 固定ナビを付ける**

参照アリーナは `Mission / Rules / Value pools / Build strategy / Disaster replay / Allocations` の帯を上部に固定している。Ocean は `Mission / Rules / Three values / Write a mission / Voyage replay / Landscape`。長いページで現在地が分かるようにする。

**C. 節番号を振り、順序を揃える**

参照アリーナは `01 · THE MISSION` から `09 · ETHEREUM SETTLEMENT` まで通し番号。Ocean も同じ体裁にする。

**D. 基準戦略との比較表（`competition-leaderboard`）**

3 つの方針を同じ seed で走らせ、3 軸を並べる。**どれも全部では勝てない**ことが一目で分かる表にする。これが「合算しない」という主張の実演になる。

**E. 解の地形（frontier）**

3 つの方針＋自分の着地点を 2 軸の散布図に落とし、Pareto Frontier に残るものを強調する。`packages/shared` の `computeOutcomeFrontier` が既にある。

**F. 価値配分の節（`value-allocations`）**

3 つの価値それぞれが「どの方針を支持するか」を示す。報酬プールは `0 FDT` のプレースホルダ。**競技として未証明なので金額は出さない**（§56.4）。

**G. 操作が何を動かすか（`lever-explanation` / `live-preview-metrics`）**

方針を選ぶと、走らせる前に「この選択は BUY / RESTRAINT のどこに効くか」を出す。参照アリーナの `Affects DELIVER.` と同じ役割。

**H. リプレイ台の仕上げ**

- ラウンド間で船が滑らかに移動する（現在は瞬間移動）
- 契約が結ばれた瞬間に帯が伸びる
- 網が上がる動き
- モバイルで潰れないこと

**I. 決済の証拠（`competition-settlement` / `evidence-chain`）**

manifest hash、シナリオ hash、transcript hash を鎖として見せる。他アリーナと同じ体裁。

**J. レスポンシブと検証**

360px 幅まで確認。Playwright で他アリーナと並べて撮り、見劣りしないか確認する。

### 58.3 やらないこと

**パラメータ調整はしない。** §56 の停止規則は生きている。第 3 軸が端にあることも、`SOUNDING_EXCHANGE` が発火しないことも、UI の問題ではないので今夜は触らない。§57.6 の残件として置いておく。

## 59. 再開用 — いまの状態と、次にやること

**2026-09-11 深夜。context 上限で中断。リセット後はここから読めば続けられる。**

### 59.1 いまの状態

`/arenas/ocean-commons` は動いている。型エラー 0、HTTP 200、テスト 40 件 PASS。

直前に §58 の「共通語彙へ載せ替える」を実施した：

- `ocean-commons-workbench.tsx` を全面書き換え。`competition-shell` / `competition-scoreboard` / `competition-nav` / `competition-build` / `competition-leaderboard` / `value-allocations` / `competition-settlement` / `lever-explanation` / `live-preview-metrics` / `evidence-chain` を使用
- 節を 01〜07 の通し番号に。固定ナビを追加
- 3 方針を**同じ seed で全部走らせて比較表にする**実装を追加（`onFrontier` で Pareto 判定）
- 価値配分の節を追加（報酬は `0 FDT` 固定）
- `globals.css` の末尾に新クラスの定義を追記

**未確認：この載せ替え後のスクリーンショットをまだ撮っていない。** 見た目が他アリーナと揃ったかは目視できていない。**リセット後の最初の作業はこれ。**

### 59.2 次にやること（優先順）

1. **スクリーンショットで確認する。** `/arenas/ocean-commons` と `/arenas/emergency-supply` を同じ幅で撮って並べ、見劣りする箇所を潰す。特に `competition-nav` の固定表示、`competition-scoreboard` の並び、`leaderboard-row` の桁揃え
2. **モバイル（360px / 768px）で確認。** リプレイ台が潰れないか、比較表が読めるか
3. **リプレイ台の仕上げ**（§58.2-H）。船の移動は CSS transition を入れたが未確認。契約の帯が伸びる動き、網が上がる動きは未実装
4. **`competition-revisions` 相当**（試した方針の履歴）を足すか判断する。他アリーナにはある
5. **`SOUNDING_EXCHANGE` を発火させる**（§57.6）。型と検証は入っているが、スクリプトのエージェントが提案しないので**隠された海の目玉である情報取引がまだ一度も起きていない**。`agents.ts` の `brokerAgent` あたりに、測深記録が古い漁場があるとき交換を提案する枝を足す
6. 第 3 軸が端にある問題（§56.2、§59.3）

### 59.3 第 3 軸について分かったこと（重要・未記録だった）

3 方針を実測した結果：

| 方針 | 残燃料 | 諦めた漁獲 | restraint |
| --- | --- | --- | --- |
| Fill the hold (effort 1.0) | 0 | **0** | 0% |
| Work the season (0.6) | **0** | 19〜76 | 0〜109% |
| Hold back (0.2) | 265/227/138 | 172〜228 | 8〜76% |

**effort 0.6 でも燃料を使い切る。** 総漁獲を決めているのは燃料予算であって effort ではなく、effort は「使う速さ」しか変えていない。したがって現在の restraint は実質「**燃料を余らせたか**」しか測っていない。

これは §50.5 で退役させた stewardship 軸（＝何もしない船が満点）と**同じ失敗を別の形で繰り返している**。

直すなら、抑制を「どれだけ獲らないか」ではなく **「どこで・いつ獲るか」**の問題にする必要がある。燃料は使い切ったうえで、痩せた漁場を避ける・保護区に近づかない、という選択が「諦めた漁獲」として数えられる形。いまは effort を下げる以外に諦める手段がない。

**ただしこれは設計変更なので、UI が仕上がってから着手する。**

### 59.4 触ってはいけないもの

Codex が並行作業中。`packages/rescue-room`、`apps/api`、`apps/web/src/components/rescue-room-workbench.tsx`、`Docs/STATUS.md`、`design-qa.md`、`openapi/`。

**`globals.css` は Codex も未コミットの変更を持っている。** コミットするときは自分の追記分だけを staging に載せること（前回は `git hash-object -w` + `git update-index --cacheinfo` で分離した）。

### 59.5 コミット状況

`6908264 feat: rebuild Ocean Commons around a sea nobody can see` まで済み。**§58 の載せ替えは未コミット。Push は一度もしていない。**

## 60. §58 を実施した — 共通の家具に載せ、読みを売れるようにした

### 60.1 共通語彙への載せ替え（§58.2-A/B/C）

`ocean-commons-workbench.tsx` を全面書き換え。`competition-shell` / `competition-scoreboard` / `competition-nav` / `competition-build` / `competition-leaderboard` / `competition-revisions` / `value-allocations` / `competition-settlement` / `lever-explanation` / `live-preview-metrics` を使用し、節を 01〜08 の通し番号に。Ocean 固有のスタイルは航海台とその霧だけに絞った。

スクリーンショットで参照アリーナと比較し、スコアボード帯・ナビ帯・節番号・タイルが同じ体裁になったことを確認した。

### 60.2 解の地形（§58.2-D/E）

**3 方針を同じ seed で全部走らせ、Pareto 判定して表にする実装を入れた。** 実測でこうなる：

| 方針 | livelihood | restraint | cooperation | 判定 |
| --- | --- | --- | --- | --- |
| Work the season | 432 | 0% | -0.080 | On the frontier |
| Fill the hold | 106 | 0% | 0.000 | **Beaten on all three** |
| Hold back | 150 | 66% | 0.090 | On the frontier |

2 つが frontier に残り 1 つが全軸で負ける。**「合算しない」を主張ではなく実演にできた。** 価値配分の節でも軸ごとに支持される方針が変わる。

### 60.3 SOUNDING_EXCHANGE が初めて発火した（§57.6 の残件）

型と検証はあったのに**どのエージェントも提案しないので一度も起きていなかった**。隠された海という前提が play では未検証だった。

最初の実装は「誰も読んでいない漁場」を探しつつ「先ラウンドそこにいた船」を相手に要求していて、**条件が自己矛盾**していた（誰も行っていない海の読みは誰にも売れない）。25 季節で 0 件。

売れるのは**精度**だった。他船の水揚げを見て得た推定は容量 1/10 の帯でしかなく、その船は正確な数字を持っている。broker が「先ラウンドその漁場を働いた船」に帯の格上げを買いに行くようにした。**25 季節で成立 8 件、相手拒否 3 件。**

テストを 2 本追加（提案が実際に出ること／`SHARED` の読みが契約外の船に渡らないこと）。42 件 PASS。

### 60.4 リプレイの仕上げ（§58.2-H）

- 船体がラウンド間を滑って移動する（CSS transition）
- **網が上がる動き**を追加。数字が変わるだけだったものが水揚げに見える
- **契約が結ばれた瞬間に線が描かれる**（`fresh` フラグ＋ stroke-dashoffset アニメ）。締結の瞬間はこれまで不可視だった
- `prefers-reduced-motion` で全て停止

### 60.5 モバイル（§58.2-J）

360/390/768px で横スクロールなしを確認。5 列の比較表は 1 列に積み、**列見出しを各値に降ろす**（`::before`）。これがないと数字が 3 つ並ぶだけで意味を失う。

参照アリーナと同条件で溢れを計測したところ、溢れているのはスコアボードの横帯のみで、**参照アリーナの方が大きく溢れている**（858px 対 786px）。共通コンポーネントの挙動なので同等水準と判断した。

### 60.6 まだやっていないこと

- **第 3 軸が端にある**（§56.2、§59.3）。effort を下げる以外に「諦める」手段がないのが原因。設計変更なので未着手
- LLM 判定を新ルールで未実行
- `SOUNDING_EXCHANGE` は broker のみが提案するので、ページの編成では 8 季節に 1 回程度

## 61. 参照の船を直した — 2/3 のまま、ただし中身は良くなった

### 61.1 何が壊れていたか

`takerAgent` を**保護区に入れない**設計にしていた（§51.2）。理由は「参照が乱獲すると相手の残酷さを測ることになる」だったが、これが致命的だった。

保護区を避ける方針（`reserve: "never"`）の entrant は、参照とほぼ同じ行動を取る。結果**「諦めた漁獲」がほぼ 0 になり**、restraint はどの方針でも 0% か、分母が消えて発散するかのどちらかだった。§59.3 の「effort を下げる以外に諦める手段がない」の正体はこれ。

参照は**全部獲る船**であるべきだった。保護区を荒らす参照に対して、荒らさない entrant は本当に何かを諦めている。そしてその抑制が報われるかは**他の 4 隻が結局荒らすかどうか**に依存する — それがこの軸の存在理由そのものである。

### 61.2 直した結果

| effort | 諦めた漁獲 | 残った魚 | efficacy |
| --- | --- | --- | --- |
| 0.2 | 241 | 196 | 0.787 |
| 0.4 | 166 | 126 | 0.884 |
| 0.6 | 113 | 74 | 0.849 |
| 0.8 | 82 | 44 | 0.880 |
| 1.0 | 62 | 13 | 0.736 |

諦めた量が 241 → 62 と単調に減り、両端が低く中間が高い形になった。**分子も分母も意味のある値になった。**

判定スクリプトの背景も、実際に出荷する編成（`reciprocatorAgent` を含む）に揃えた。旧来の背景は `reciprocatorAgent` が存在する前のもので、**誰もプレイしない世界を測っていた。**

### 61.3 3/3 に見えたが、揺らぎだった

120 seed で **3/3 PASS** が出た（livelihood +4.3%、restraint +7.5%、cooperation +88.6%）。しかし **260 seed で測り直すと restraint は端に戻る。**

| seed 数 | livelihood | restraint | cooperation | 判定 |
| --- | --- | --- | --- | --- |
| 120 | 内点 +4.3% | 内点 +7.5% | 内点 +88.6% | 3/3 |
| **260** | 内点 +4.1% | **端** | 内点 +86.0% | **2/3** |

§50.3 で自分が指摘した「seed 数が足りないと平坦な軸が内点に見える」罠に、また掛かるところだった。**結論は 2/3 のまま。**

### 61.4 それでも改善している

| 指標 | 修正前 | 修正後 |
| --- | --- | --- |
| 軸の独立性 max\|ρ\| | 0.510 | **0.221** |
| Phase 0 基準 | 7/10 | **8/10** |
| #2 単一Policy支配 | 23.0% FAIL | **8.5% PASS** |
| #5 協定の代償 | 6.2% FAIL | **40.6% PASS** |
| #7 独立性 | 0.276 | **0.141** |

残る未達は #4（協定が stewardship を改善：-3.3%）と #6（Escrow 倍増で違反が**増える**：-30.5%）。#6 が負に転じたのは新しい発見で、未調査。

### 61.5 restraint を内点にするには

まだ「どれだけ獲らないか」の軸である。effort を下げる以外の「諦め方」— 痩せた漁場を休ませる、保護区に近づかない、時化の後に一巡遅らせる — が漁獲差として現れる必要がある。参照を直したことでその素地はできたが、entrant 側にその選択肢を与える設計変更が残っている。

**ただしパラメータをいじる形では解かない。** §53.8 の停止規則は生きている。

## 62. UI を揃える — 持ち込んだ色と重複した規則を捨てる

### 62.1 何がズレているか（実測）

プラットフォームの地は**中性の黒 `#080a0d`**、面が `#0d1013`、文字が**温白 `#f4f1e8`**、補助が `#aeb4b7`、罫が `#292d31`。アクセントは **lime `#c7ff45` と orange `#ff7849` の 2 色だけ**。

Ocean Commons の航海台には、そこに無い色を持ち込んでいた：

| 持ち込んだ色 | 用途 | 問題 |
| --- | --- | --- |
| `#071a26` / `#0d3247` / `#05121b` | 海と漁場 | 地がティール。サイトは中性の黒 |
| `#6fd3ff` | 燃料計・相互扶助 | シアンはパレットに無い |
| `#7ff0c8` / `#9fd4ee` / `#7fa9bf` | 魚・ラベル | 青緑系はパレットに無い |
| `#d59bff` | 保護基金 | 紫はパレットに無い |
| `#ffd166` | 測深記録の取引 | 黄はパレットに無い |

**航海台だけが別のサイトのように見える。** これが「デザインが変わっている」の正体。

加えて `.ocean-competition {` が**二重定義**されていた（作業中に追記を重ねたため）。カスケードの重複は事故のもとなので潰す。

### 62.2 やること

**A. 海をプラットフォームの地から作り直す。** ティールをやめ、`#080a0d` / `#0d1013` の系列で水と漁場を組む。**霧はもともと「読まれていない水」を意味するので、地の黒に寄せる方がむしろ正しい。**

**B. 魚と計器を lime に寄せる。** 魚影は `--lime`、崩壊した漁場は `--orange`。サイトが既に持つ 2 色で足りる。

**C. 契約の帯は 5 種類の区別が要る。** 新しい色相を足さず、`--lime` / `--orange` と**罫と補助色の濃淡**で分ける。区別がつく最小限に抑える。

**D. 見出しは共通の型に任せる。** 自前の `clamp()` を捨て、既存アリーナと同じ字送りに揃える。

**E. 重複規則を削除する。** `.ocean-competition` の二重定義、共通クラスが既に定義している宣言の再掲を消す。

**F. 参照アリーナと同一幅で並べて検証する。** 1280 / 768 / 390px。

### 62.3 変えないもの

霧・船体・網・燃料計・契約の帯という**構造**は変えない。§57 で「棒グラフではなく場面」にした部分は成果なので、色だけを揃える。

## 63. Mission 入力を本物にする

### 63.1 なぜこれが最優先なのか

ページで散文を書かせておいて、実際に走るのは 3 つのプリセット方針のどれか。**「Mission が世界を動かす」というこの設計の中心が、練習対戦に接続されていない。** 書いた文章は現状どこにも渡っていない。

これが無い限り、このアリーナは「パラメータ入力フォーム」と区別がつかない。そして §49 で **Mission は実測で効くレバー**だと分かっている（3 軸を一貫して動かす。固定パラメータには不可能）。第 3 軸の問題とは独立に実装でき、**副産物として「新ルール下で LLM はどうか」が同時に答えられる**（これは現在まったくの未検証）。

### 63.2 既存アリーナの作法に従う

Rescue Room が同じことを既にやっている。経路は:

```
ブラウザ → POST /v1/... → apps/web の route handler → frontier-api → apps/api の index.ts
```

`/v1/rescue-room/commander-evaluations` を雛形にする。そこにある要素はすべて必要:

- **レート制限**（10 分あたり 3 回）。LLM 呼び出しは課金されるので、これが無いと誰でも財布を空にできる
- **実行体の注入**（`this.rescueRoom.commander ?? runOpenAi...`）。テストで本物を呼ばずに済む
- **型付きエラー**。未設定は 503、タイムアウトは 504、実行失敗は 502
- **`OPENAI_API_KEY` はサーバー側のみ。** ブラウザには絶対に出さない

### 63.3 作るもの

**`/v1/ocean-commons/seasons`**（POST）

入力は `{ mission, seed }`。`mission` は長さ上限を設ける（プロンプト注入で際限なく課金させられないため）。

処理は 1 季節分:

1. `generateScenario(seed, { vary: true })`
2. 0 番席に `llmAgent`（Mission をシステムプロンプトに載せる）、残り 4 席は出荷編成の rivals
3. `runMatch` → `evaluateMatch`
4. 3 軸（livelihood / restraint / cooperation）を算出。restraint と cooperation は反実仮想の再生が要る
5. `toVoyage(log, seat.id)` を返す

**戻り値には隠し状態を含めない。** `voyage` は視点付きで霧が掛かっているので安全だが、`actualShare` は季節終了後の開示用なので、そのまま返してよい（季節は終わっている）。

**UI 側**: 「Sail with your mission」ボタン。押すと進行表示 → 完了でリプレイと 3 軸が差し替わる。プリセット 3 方針の即時対戦はそのまま残す。

### 63.4 制約と、そのための設計

実測 **69〜125 秒/季節**、API 課金あり。これは練習対戦の即時性（1 ミリ秒未満）とは別物なので、**混ぜない**:

- プリセット方針 = 即座。触って世界の反応を見る用
- Mission = 待つ。自分の言葉が何をするかを見る用

待っている間もページは操作可能にし、何を待っているかを明示する。

### 63.5 やらないこと

- 第 3 軸には触らない（§61.5 の課題は別途）
- パラメータ調整はしない（§53.8 の停止規則は生きている）
- 結果を保存しない。練習であり、ランキングは無い

## 64. Mission 入力を実装した — 実測 2.9 分

### 64.1 作ったもの

**`sailSeasonWithMission()`**（`packages/ocean-commons/src/season.ts`）。0 番席に Mission を読む LLM エージェント、残り 4 席は出荷編成の rivals。3 軸・航海・モデルの応答記録・トークン使用量を返す。

反実仮想の 2 本（cooperation 用と restraint 用）は**スクリプト方策で走らせる**。モデルで再実行すると課金が 3 倍になるうえ、それは反実仮想ではなく別の季節になってしまう。モデルが実際にどう振る舞ったか（effort の使用率・保護区侵入の有無・契約成立数）から最も近い設定のスクリプト船を立てて比較している。

**`POST /v1/ocean-commons/seasons`**。Rescue Room の `commander-evaluations` を雛形にした：

- レート制限 10 分 3 回。**課金される呼び出しなので、これは支出管理**
- 実行体の注入（テストで本物のモデルを呼ばない）
- 公開 seed 以外は 400、Mission は 2,000 文字上限
- 未設定 503 / タイムアウト 504 / 失敗 502

`OPENAI_API_KEY` を読むのは `openai-agent.ts` の 1 箇所のみ。UI 側に参照は無い。API テストで**レスポンスに `OPENAI` の文字列が現れないこと**も検証した。

### 64.2 所要時間の見積もりが間違っていた

§63.4 で「69〜125 秒」と書いたが、実測は **2.9 分と 5.6 分**。2 回測って倍近く違う。

```
POST /v1/ocean-commons/seasons 200 in 2.9min
POST /v1/ocean-commons/seasons 200 in 5.6min
```

モデルがどれだけ考えるかはこちらの制御下に無いので、**所要時間は動くものとして扱う**しかない。1 季節あたりの呼び出しは 14〜20 回（1 ラウンドにつき交渉と操業で 2 回、季節は 7〜10 ラウンド）で、ラウンドは前のラウンドに依存するため並列化もできない。

見積もりが外れた理由は、その数字が判定スクリプト（`judge-ocean-commons.ts`）のもので、**あちらは 4 並列で走らせていた**から。1 季節を直列で走らせると 3 倍近くかかる。UI の文言も「約 1 分半」と書いてしまっていたので、実測値に直した。

数分の待ちに対して無効化されたボタンだけでは、止まっているのと区別がつかない。経過秒数を出し、その間もページを操作可能なままにした（seed の切り替えや即時プレビューは動く）。

**この長さは「10 分以内」という要件の内側だが、余裕は無い。** 2 回試せば上限に届く。

### 64.3 即時対戦と混ぜていない

- **プリセット 3 方針** … ブラウザ内で即座（1 ミリ秒未満）、無料。世界の反応を見る用
- **Mission** … 3〜6 分、課金あり。自分の言葉が何をするかを見る用

リプレイは「最後に生成された季節」を表示し、どちらの季節かをラベルで明示する。

### 64.4 まだ分かっていないこと

新ルール下で **LLM が固定方策より良いのか**は、これで初めて測れる状態になっただけで、まだ測っていない。§49 の判定（3 軸すべてで負け）は旧ルール・全可視の海でのものなので、隠された海では前提が変わっている可能性がある。

## 65. 判定手順の事前登録 — 隠された海で LLM は固定方策に勝てるか

**測る前に書く。** §61.3 で 120 seed の 3/3 を 260 seed が否定したとき、私は結果を見てから測り方を変えていた。それを繰り返さないために、対戦相手・seed 数・閾値をここで固定し、**走らせた後は一切動かさない。**

### 65.1 なぜ測り直すのか

§49 の判定（gpt-5 は 3 軸すべてで固定方策に負ける）は**旧ルールの結果**である。あの世界では全漁場の在庫が毎ラウンド全員に配られており、対戦相手の `tunableAgent` はエンジンの数式を持って argmax を取っていた（§50.1）。**電卓に暗算で挑ませていた。**

隠された海ではその優位が構造的に消える。固定方策も測深記録からしか推定できない。前提が変わった以上、§49 は再測定なしには引用できない。

### 65.2 世界が変わったことの証拠（無料の全探索、200 seed）

| 指標 | 旧世界 | 隠された海 |
| --- | --- | --- |
| 最頻勝者の勝率 | 51〜61% | **7〜15%** |
| 勝者の種類数（60 設定中） | 11〜23 | **28〜51** |
| 練習 seed の最良が未見 seed で | 1 位 | **8 位 / 7 位 / 4 位** |
| Pack 間の順位相関 | ρ=0.92〜0.99 | **ρ≈0.50** |

**固定設定が転移しなくなった。** ただしこれは「状況判断が効く」とも「結果が運に支配されている」とも読める。**どちらかは、状況を読めるエージェントが勝てるかどうかでしか分からない。**

### 65.3 事前登録する手順

- **対戦相手**: 練習 seed 0-99 で選んだ軸ごとの最良設定。実測で `livelihood: e0.4 always generous` / `restraint: e0.4 always fair` / `cooperation: e0.4 always fair`
- **背景艦隊**: 出荷編成（broker / greedy / opportunist / reciprocator）
- **seed 数**: **16**。§49 は 12 だったが、Pack 間 ρ が 0.99 から 0.50 に落ちた以上、seed 分散が大きい。それでも検出力は高くない
- **座席**: model と固定方策が同じ seed・同じ背景・同じ天候で同じ席に座る
- **検定**: Wilcoxon 符号順位、両側、p<0.05
- **Mission**: `judge-ocean-commons.ts` の既定文（全エントラント共通）
- **モデル**: gpt-5、reasoning effort は low（§47 で medium は改善しないと確認済み）

### 65.4 結果の読み方（先に決めておく）

| 結果 | 意味 |
| --- | --- |
| model がどれかの軸で有意に勝つ | 隠された海は状況判断に報いている。§49 は旧世界の性質だった |
| すべて NO EFFECT | 固定設定が転移しないのは**運**であって、読む価値があるからではない |
| model が有意に負ける | 隠された海でもモデルは不利。プロンプトか設計の問題 |

**2 番目が出た場合、アリーナは競技として成り立たない。** その結論も受け入れる。

### 65.5 やらないこと

落ちたからといって seed 数・対戦相手・背景を変えて再測定しない。**1 回だけ走らせ、出た数字をそのまま §66 に書く。**

## 66. 判定結果 — 3 軸すべて NO EFFECT

§65 で事前登録した手順のまま、16 seed で 1 回だけ走らせた結果。

### 66.1 数字

| 軸 | model の中央値 | 固定の中央値 | 勝率 | p 値 | 判定 |
| --- | --- | --- | --- | --- | --- |
| livelihood | 368.1 | 278.7 | 8/16 | 0.266 | NO EFFECT |
| restraint | 0.402 | 0.784 | 6/16 | 0.851 | NO EFFECT |
| cooperation | 0.000 | 0.000 | 3/16 | 0.053 | NO EFFECT |

model の漁場選択  coastal 58%  offshore 33%  nursery 9%
model が Pareto Frontier に残った seed  **12/16**

### 66.2 事前登録した読み方の適用

§65.4 で「すべて NO EFFECT なら、固定設定が転移しないのは**運**であって読む価値があるからではない」「その場合アリーナは競技として成り立たない」と先に書いた。**その結果が出た。**

**Ocean Commons は競技として成立していない。** 隠された海は固定設定の転移を壊したが、壊れた先にあったのは読み取れる構造ではなく分散だった。

### 66.3 §49 との違い（弁解ではなく事実として）

| | §49（全可視の海） | §66（隠された海） |
| --- | --- | --- |
| livelihood | LOSES p=0.005 | NO EFFECT p=0.266 |
| 第 2 軸 | LOSES p=0.002 | NO EFFECT p=0.851 |
| cooperation | LOSES p=0.019 | NO EFFECT p=0.053 |
| Frontier 残存 | 7/12 (58%) | 12/16 (75%) |

**負けなくなった。** §50.1 の不公平（対戦相手がエンジンの数式を持ち全在庫を見て argmax を取る）が消えた分は効いている。だが「負けない」は「勝つ」ではない。

### 66.4 検出力について（言い訳にしない）

n=16、Pack 間 ρ≈0.50 の世界なので検出力は低い。**小さな効果があっても見逃しうる。** §65.3 で走らせる前にそう書いた。

だが §65.5 で「落ちても seed 数・相手・背景を変えて再測定しない」と先に決めた。**通るまで回すのが §50〜52 でやった過ちで、それを繰り返さないための事前登録だった。** 効果があると主張したい側が、別に事前登録した大きな試行で示すべきであって、私がここで seed を増やすのは筋が違う。

### 66.5 cooperation 軸は依然として壊れている

model も固定方策も中央値 0.000。両者ほぼ契約していない。§49.5 で指摘した「0 における段差」は隠された海でも直っていない。**3 軸のうち 1 つは、そもそも何も測れていない。**

### 66.6 途中で出したバグ

判定は 16 seed を走り切った直後、最後の Pareto 計算で落ちた。`oceanMetrics` が退役した `stewardship` をキーに要求したままだったため。**モデル呼び出しは消費済み**だったが、生スコアが `judgement.json` に保存されていたので再実行せずに検定できた。

`toOutcomePoint` が `outcomes.stewardship` を直接読んでいたのも同じ原因。restraint は cooperation と同じく反実仮想が要るので、両方を引数で受け取る形に直した。

### 66.7 ここから

競技として成立させるなら、**分散を減らすのではなく、読み取れる構造を足す**しかない。いま足りないのは「状況を読んだ者だけが得をする経路」であって、seed を増やすことではない。

第 3 軸の作り直し（§61.5）も、この結論の下では優先度が下がる。**1 つの軸を直しても、3 軸すべてが運に支配されているなら競技にはならない。**

## 67. §66 の結論を撤回する — 推論規則の方が間違っていた

### 67.1 指摘

> 運Gameの要素をいれちゃだめ？ 嵐っていつ起きるか分からないし。完全な勝負より、バックギャモンとかポーカーの方が面白くない。運も実力のうち。運の割合もよるけどね

**この指摘で §66 の誤りが見えた。** ポーカーは 1 ハンドがほぼ運で、繰り返すと実力が出る。**私の n=16 の検定をポーカーにかければ、同じく NO EFFECT が出る。** 16 ハンドで上級者と初心者は区別できない。

つまり §65.4 で事前登録した読み方 —「すべて NO EFFECT なら運である」— は、**推論規則そのものが誤っていた。** 「n=16 で検出できない」と「効果が存在しない」は別の主張である。測定は正しく、解釈の規則が間違っていた。

**§66.2 の「Ocean Commons は競技として成立していない」を撤回する。**

### 67.2 効果量で測り直す（既存データ、追加費用ゼロ）

同じ 16 季節の対データから、1 季節あたりの差と必要な試行数を出した。

| 軸 | 1 季節あたりの差 | 効果量 d | 80% 検出に必要な季節 | 実際に回した |
| --- | --- | --- | --- | --- |
| livelihood | **+72.1** | **0.375** | **56** | 16 |
| restraint | +0.099 | 0.097 | 842 | 16 |
| cooperation | −0.061 | −0.507 | 31 | 16 |

**livelihood にはモデルの優位が存在する。** 1 季節 +72 DemoUSD、d=0.375。運の混じるゲームとしてはむしろ大きい部類で、ポーカー上級者の 1 ハンドあたりの優位はこれよりはるかに小さい。**検出に 56 季節必要なところを 16 しか回していなかった。**

一方 cooperation はモデルが**劣る**方向に d=−0.507。契約を結ばなさすぎる。

### 67.3 運と実力の比率（120 seed × 60 設定 = 7200 試合、無料）

| 軸 | seed（運） | 方策の主効果 | seed×方策の交互作用 |
| --- | --- | --- | --- |
| livelihood | 38.3% | 7.7% | **53.9%** |
| restraint | 35.2% | 3.4% | **61.5%** |
| cooperation | 19.7% | 3.1% | **77.2%** |

**エンジンは決定論的なので残差はゼロ。** 同じ seed と同じ方策は常に同じ結果になる（リプレイのハッシュ一致でテスト済み）。したがって最後の列は雑音ではなく**純粋な交互作用**である。

意味するところ：

- **固定方策が取れるのは主効果の 3〜8% だけ**
- **残る 54〜77% は「どの方策が良いかは季節による」** — 状況を読める者にしか取れない

§65.2 で見た「固定設定が転移しない」の正体はこれだった。運ではなく**文脈依存**である。

### 67.4 状況判断の上限

季節ごとに後知恵で最良設定を選んだ場合と、単一の最良固定設定の比較：

| 軸 | 最良の固定設定 | 季節ごとの後知恵最良 | 差 |
| --- | --- | --- | --- |
| livelihood | 386.6 | 524.9 | **+36%** |
| restraint | 0.893 | 1.978 | **+122%** |
| cooperation | 0.075 | 0.288 | **+286%** |

**後知恵なので全部は取れない**（嵐は事前に読めない）。これは上限であって到達可能値ではない。だが「1 つの設定が全部に答える」世界では断じてない。

### 67.5 正しい結論

Ocean Commons は**運の重いスキルゲーム**である。バックギャモンやポーカーと同じ構造で、指摘のとおりそれは欠陥ではない。

- 運（seed 主効果）: 20〜38%
- 固定方策の実力: 3〜8%
- **状況判断の余地: 54〜77%**
- gpt-5 が現に取れている分: livelihood で d=0.375、cooperation では負

### 67.6 ここから変わること

**A. 1 季節を勝敗の単位にしない。** 1 季節はコイン投げに近い。§67.2 のとおり livelihood で 56 季節が必要。**「1 試合 = 複数季節」に変える**のが正しい。バックギャモンのマッチポイント制と同じ発想。

**B. cooperation を直す。** モデルが固定方策より**明確に劣る**唯一の軸で、しかも効果量が最大（d=−0.507）。両者とも中央値 0.000 という §49.5 の段差も残っている。**3 軸で唯一「壊れている」と言えるのはここ。**

**C. 第 3 軸（restraint）の優先度は下がる。** d=0.097 で差が出ないが、交互作用は 61.5% あり後知恵上限は +122%。**構造は豊かなのに誰も取れていない**状態で、軸の定義が悪いというより「読む手段が足りない」可能性が高い。

### 67.7 自分の誤りについて

§65 で手順を事前登録したのは正しかった。**間違えたのは、検出力を計算せずに閾値だけ決めたこと。** 「n=16 で NO EFFECT なら効果なし」と書いた時点で、効果量がどれくらいなら見えるのかを計算していなかった。

事前登録は「結果を見てから規則を変えない」ためのものだが、**規則そのものが誤っていれば、誤りを固定するだけになる。** 今回それをやった。

## 68. ゴールを決める、そして出来ていないことの棚卸し

### 68.1 なぜゴールが要るか

指摘のとおり、結論が出ないまま測定と定義を繰り返してきた。完全性を追うと終わらない。**終わりの条件を先に決める。**

### 68.2 ゴール

> **/arenas/ocean-commons を開いた人が、2 分で何のゲームか分かり、1 季節を物語として見終え、自分の選択で結果が変わるのを確認できる。そしてページに書いてあることが、測定した事実を超えない。**

ランキングも賞金も競技証明も要らない。**「面白い」と「嘘がない」だけ。**

### 68.3 達成条件（6 つ、うち 3 つは済）

| # | 条件 | 状態 |
| --- | --- | --- |
| 1 | ページの主張が測定結果と一致している | **未** — §67 で撤回した主張が残っている |
| 2 | 1 季節が物語として読める | 済（§ 直近のキャプション実装） |
| 3 | 選択を変えると結果が変わるのが見える | 済（方策 3 択・seed 切替・即時再計算） |
| 4 | 結果がコイン投げに見えない | **未** — 1 季節が単位のまま |
| 5 | 交渉が見える（断られたものも含めて） | **未** — 成立した契約しか描いていない |
| 6 | 壊れていない（lint / 型 / テスト / ビルド） | 済 |

**4 つ揃えば終わりにする。** 5 と 6 を満たしたうえで 1・4・5 を片付ける。

### 68.4 出来ていないこと（全部）

**A. ページが事実と食い違っている（最優先）**

- 価値配分の節に「3 軸のうち 2 つしか通らない、3 つ目は端に最適があるので上手さを分けない、だからランキングも賞金も無い」と書いてある。**§67 でこの読み方ごと撤回した。** 実際は交互作用が 54〜77% あり、livelihood ではモデルに d=0.375 の優位がある。**いま書いてあるのは古い結論。**

**B. 体験として足りない**

- **1 季節が勝敗の単位。** §67.2 のとおり検出に 56 季節要る世界で、1 季節の結果を見せられても実力が効いた実感が出ない
- **却下された交渉が見えない。** 20 季節で 12 件断られているのに、画面に出るのは成立した契約だけ。交渉が一方通行に見える
- **Mission 実行が 3〜6 分。** 短縮できない（各ラウンドが前に依存）。2 回試すと 10 分制約に届く

**C. 分かっているが直していない仕組み**

- **cooperation 軸でモデルが固定方策より劣る**（d=−0.507、最大の効果量）。両者とも中央値 0.000 で、§49.5 の「0 における段差」も残存。3 軸で唯一「壊れている」と言える
- **restraint 軸に差が出ない**（d=0.097）。ただし交互作用 61.5%・後知恵上限 +122% なので、軸の定義より「読む手段が足りない」可能性
- **`SOUNDING_EXCHANGE` が 20 季節に 4 件。** 隠された海の目玉だが、broker しか提案しない
- **#4「協定が stewardship を改善」と #6「Escrow 倍増で違反減少」が Phase 0 基準で未達。** 特に #6 は担保を厚くすると違反が**増える**（−30.5%）という未調査の異常

**D. そもそも作っていない**

- 賞金・価値配分の実体（`0 FDT` のプレースホルダのまま）
- オンチェーン決済（証拠の節はあるが決済は無い）
- 複数エントラントの対戦・ランキング
- 結果の保存（訪問中のみ、リロードで消える）

### 68.5 今夜やること

68.3 の未達 3 つ（1・4・5）を片付ける。**C と D には手を付けない。** C はゲームの中身の話で、D は競技として成立させる話であり、どちらも「面白いかどうか」を判断するのに必要ない。

## 69. ゴールへの進捗

§68.3 の達成条件のうち 2 つを片付けた。

### 69.1 条件 1（ページの主張が事実と一致）— 済

価値配分の節に「3 軸のうち 2 つしか通らない、3 つ目は端に最適があるので上手さを分けない、だからランキングも賞金も無い」と書いたままだった。**§67 でこの読み方ごと撤回している。** 差し替えた：

> 一季節が決めるものは少ない。7,200 季節を測ると、引きが結果の 20〜38%、固定方策が 3〜8%。残る 54〜77% は「どの方策がどの季節に合ったか」で、そこは水を読む船長にしか届かない。季節ごとに後知恵で選べば最良の単一方策を 36〜286% 上回る。だからここでの一つの結果は、競走よりポーカーの一手に近い。

### 69.2 条件 4（結果がコイン投げに見えない）— 済

**1 季節 → 7 季節のマッチに変えた。** スクリプト対戦は 1 試合 1 ミリ秒未満なので、7 季節でも体感は即座のまま。

表には中央値と**「7 季節中 N 勝」**を併記した。これが効く：

| 軸 | 季節の取り合い | 読み方 |
| --- | --- | --- |
| livelihood | 2 / 3 / 2 | **ほぼ三つ巴＝引き** |
| restraint | 1 / 1 / **5** | **Hold back の実力** |
| cooperation | **4** / 1 / 3 | Work the season の癖 |

**「7 季節中 5 勝」は実力、「2 対 3 対 2」は引き。** 画面を見るだけで区別がつくようになった。§67 の発見（運と実力の比率）が、説明ではなく数字として出ている。

### 69.3 残り（条件 5）

**却下された交渉が見えない。** 20 季節で 12 件断られているのに、画面に出るのは成立した契約だけ。交渉が一方通行に見える。

### 69.4 作業中に出した不具合

`python` の文字列置換が一致せずに無言で失敗する事故を、この作業だけで 2 回起こした（キャプションの `termsOf` 二重定義、表の列が差し替わらない）。**どちらもブラウザで見て初めて気づいた。** 一致しなければエラーになる編集手段を使うべきで、以後そうする。

## 70. ゴール達成 — 6 条件すべて

§68.2 のゴール：

> /arenas/ocean-commons を開いた人が、2 分で何のゲームか分かり、1 季節を物語として見終え、自分の選択で結果が変わるのを確認できる。そしてページに書いてあることが、測定した事実を超えない。

| # | 条件 | 状態 |
| --- | --- | --- |
| 1 | ページの主張が測定結果と一致 | 済（§69.1） |
| 2 | 1 季節が物語として読める | 済 |
| 3 | 選択を変えると結果が変わる | 済 |
| 4 | 結果がコイン投げに見えない | 済（§69.2、7 季節マッチ） |
| 5 | 交渉が見える（断られたものも） | **済** |
| 6 | 壊れていない | 済 |

### 70.1 条件 5 の中身

`RejectedProposal` は `COUNTERPARTY_REJECTED` という理由しか持っておらず、**誰が誰の何を断ったかが残っていなかった**。断られた提案そのものを記録に含め、`VoyageRefusal` として季節に流し、キャプションで読み上げるようにした。

結果、交渉の全局面が画面に出る：

```
R1 Kaiyo and Hokuto agree to pool money for restraint.     合意
R2 Hokuto pays Kaiyo 23 to trade readings.                 支払
R3 Kaiyo broke its word to Hokuto. The escrow goes back.   違反
R4 Isana turned down 23 from Hokuto.                       却下
R5 Kaiyo pays Isana 220 to leave a ground alone.
```

**Hokuto が記録を買い、裏切られ、同じ条件を別の船に持ちかけて断られる。** 同じエンジン、同じデータで、以前は「The fleet is at sea」だけだった。

### 70.2 ここで一区切りにする

ゴールは「面白い」と「嘘がない」だった。両方満たしたので止める。

**残っているものは §68.4 に列挙済み**で、いずれも競技として成立させる話（cooperation 軸の欠陥、restraint の差、賞金・決済・ランキング）。**面白いかどうかを判断するのに必要ないと判断して手を付けていない。**

判断材料は揃った。次に進むかどうかは、実物を見てからでよい。

## 71. 出来ていないことの一覧（決定版）

§68.4 を現状に合わせて作り直したもの。**判断基準は「面白さに効くか」「次に役立つか」**で、完全性のためだけの項目は下に置いた。

### A. 面白さに直接効く（未着手）

| # | 内容 | なぜ問題か | 規模 |
| --- | --- | --- | --- |
| A1 | **Mission 実行が 1 季節だけ**。プリセットは 7 季節マッチなのに | 同じ画面で片方だけコイン投げ。自分の Mission の結果が良くても悪くても引きかもしれず、比較が成立していない | 中（7 季節 = 21〜42 分・課金 7 倍。現実的には 3 季節程度が上限） |
| A2 | **`SOUNDING_EXCHANGE` が 20 季節に 4 件** | 隠された海の目玉。broker しか提案しないので、ほとんどのプレイヤーは一度も見ない | 小 |
| A3 | **結果が保存されない** | リロードで試した記録が全部消える。「前の Mission と比べる」ができない | 小〜中 |

### B. 中身が壊れている（未着手・要判断）

| # | 内容 | 測定値 | 規模 |
| --- | --- | --- | --- |
| B1 | **cooperation 軸でモデルが固定方策に劣る** | d=−0.507（3 軸で最大の効果量）。両者とも中央値 0.000 で §49.5 の「0 の段差」も残存 | 大（軸の再設計） |
| B2 | **restraint 軸に差が出ない** | d=0.097。ただし交互作用 61.5%・後知恵上限 +122% なので、軸ではなく「読む手段」の問題の可能性 | 大 |
| B3 | **Escrow を倍にすると違反が増える** | Phase 0 #6 が −30.5%。担保を厚くするほど約束が破られるのは直感に反する。**原因未調査** | 小（調査）〜中（修正） |
| B4 | **協定が stewardship を改善しない** | Phase 0 #4 が −3.3%（閾値 ±5%） | 中 |
| B5 | **LLM の優位が本物か未確認** | livelihood で d=0.375 だが、検出に 56 季節必要なところ 16 しか回していない | 中（課金 3.5 倍） |

### C. そもそも作っていない（競技として成立させる話）

| # | 内容 |
| --- | --- |
| C1 | 賞金プールの実体（`0 FDT` のプレースホルダのまま） |
| C2 | オンチェーン決済（証拠の節はあるが決済は無い） |
| C3 | 複数参加者の対戦・ランキング・リーダーボード |
| C4 | 参加/提出フロー（他アリーナにある join・submit が無い） |

### D. 体裁

| # | 内容 |
| --- | --- |
| D1 | 節が 10 個。他アリーナは 12〜14 で、「価値の分散がどう働くか」を教える節が無い |
| D2 | `judge-ocean-commons.ts` に退役した `stewardship` を指すコメントが 1 行残っている |

### 71.1 私の推奨順

**A1 → A2 → B3。**

A1 は「自分の Mission が良かったのか運だったのか分からない」という、体験の芯にある不整合。A2 は隠された海という目玉が見えないまま終わる問題。B3 は小さい調査で、しかも**直感に反する事実**なので、放置すると測定全体の信頼性に関わる。

**B1・B2 は大きい。** 軸の再設計になるので、実物を見て「続ける価値がある」と判断してからにすべき。

**C は競技化の話**で、面白いかどうかの判断には要らない。

### 71.2 触っていないもの

`packages/rescue-room`、`apps/api` の Rescue 関連、`Docs/Plan11.md`、`README.md` は Codex の担当。現在も Codex が作業中で、私の push（`89b3113`）の上にコミットが積まれている。

## 72. A1・A2・B3 を片付けた

### 72.1 A1 — Mission も複数季節に

Mission 実行を **3 季節のマッチ**にした。プリセットが 7 季節なのに Mission だけ 1 季節では、結果が引きか実力か判別できず比較にならなかった。

**季節ごとに別のリクエストにした。** マッチ全体で 9〜18 分あり、単一の HTTP 要求を open にしておく長さではない。1 季節ずつ返るので、途中で失敗しても既に走った季節は画面に残る。レート制限は 3→6/10 分（＝2 マッチ）に上げた。

画面には「Season 2 of 3」と経過秒数、終了後は中央値と**季節ごとの明細**を出す。季節同士がどれだけ離れているかが、そのまま引きの大きさである。

### 72.2 A2 — 測深記録の取引を当たり前にする

broker だけが提案していたので **20 季節に 4 件**。隠された海の目玉を、ほとんどの訪問者が一度も見ない状態だった。

提案を `soundingOffer()` に切り出し、`cautiousAgent`（持続可能な取り分を知りたい船）と `reciprocatorAgent`（艦隊の動きを読む船）にも持たせた。

**結果：20 季節に 20 件、18/20 の季節で発生。**

### 72.3 B3 — 「担保を厚くすると違反が増える」の正体

原因は**私が入れたバグ**だった。`settleRound` は `CATCH_LIMIT` 以外をすべて「全面停船」として扱う。`SOUNDING_EXCHANGE` を契約種別に足したとき、ここを更新していなかった。**測深記録を交換した漁場で漁をすると違反判定される。** A2 で発火頻度を上げたので被害が拡大していた。

`CATCH_LIMIT` と `CONSERVATION_BUYOUT` だけが漁で破れる契約である、と明示して修正：

| | 修正前 | 修正後 |
| --- | --- | --- |
| 80 季節の違反数 | 69 | **9** |
| 違反率（0.5x → 1x → 2x） | 31.2% → 35.6% → 39.2% | **1.2% → 4.2% → 5.7%** |

**大半が幻の違反だった。**

残った 9 件を調べると、**超過率の中央値は 3%、全件が 25% 以内**。つまり不正ではなく**わずかな読み違い**である。隠された海では在庫を推定で見ているので、上限すれすれを狙って超えることがある。

### 72.4 #6 は基準側の前提が違う

修正後も違反率は担保とともに上がる（1.2% → 5.7%）。ただし**その意味が変わった**。

基準 #6 は「担保を厚くすれば裏切りが減る」という前提で書かれている。しかしこの世界の違反は**裏切りではなく誤認**であり、**担保では抑止できない**。担保が厚いほど契約が増え、契約が増えるほど誤認の機会が増える。

これは直す対象というより、**隠された海という設計から出る帰結**である。基準の方が旧世界の想定のまま残っていた。

### 72.5 現在

Phase 0 **8/10**（#4 と #6 が未達）。テスト 42 件 PASS。

## 73. 入力を作り直した（①〜⑤）

「input しょぼくない？他は Json でだせるし。パラメータ調整もできます」への対応。承認された 5 手順を全部実行した。

### 73.1 提出物の形が変わった

これまで入力は **プリセット 3 択**だった。ボタンが 3 つ、つまり提出できるものが 3 通りしかない。他のアリーナは JSON を出せてパラメータも動かせるのに、ここだけ実質何も選べていなかった。

`packages/ocean-commons/src/entry.ts` に `OceanEntry` を定義し、提出物を 4 つの部分にした。

| 部分 | 中身 | 誰が強制するか |
| --- | --- | --- |
| `name` | 戦略名（80 字） | — |
| `mission` | 船長への常設指示（2,000 字） | モデルが読む |
| `wallet` | 所持金・1 契約上限・季節上限・**許可する契約 5 種** | **マッチループ**が強制 |
| `sailing` | 労力・保護区・契約の出し方 | 台本エージェント |

**wallet が要だった。** これは元の設計書にあったのに、実装されたまま一度も露出していなかった。全季節が `defaultWalletPolicy` で走っていたので、「エージェントに何を許すか」という設計の半分が固定かつ不可視だった。

航海ダイヤルは結果を数 % しか動かさない（§67）。wallet はゲームの形そのものを変える — `CONSERVATION_BUYOUT` を許可リストから外せば、**自制を買う手段が消える**。

### 73.2 何通りになったか

フォームだけで **98,762,112 通り**（3 通りから）。JSON エディタはスライダーの刻みに縛られないのでさらに多い。`oceanEntrySpaceSize()` はフォーム側だけを数える — 控えめな方を公称値にした。

スライダーの `step` は `OCEAN_WALLET_STEPS` から取るようにしたので、**公称値と実際の操作子がずれない**。

### 73.3 3 つのタブ

他のアリーナと同じ `submission-mode-tabs` 語彙で、**エントリービルダー / JSON エディタ / ファイル読み込み**。3 つは同じ一つの物を編集する — ダイヤルを動かせば JSON に出るし、ファイルを落とせばダイヤルが動く。

`checkOceanEntry()` は throw せず**失敗を全部返す**。半端なエントリーを、最初の 1 個ではなく問題を全部並べて書き手に返せる。

### 73.4 提出が本物になった

`/v2/sandbox/participants/register` と `/v2/sandbox/submissions` に `ocean-commons-v1` を追加。他のアリーナと同じ経路である。

採点は `evaluateOceanEntry()`（`submission.ts`）。**公開された 12 seed 全部**で走る。ブラウザの練習は自分で選んだ季節なので、それは練習でしかない。

実測（開発サーバー経由、12 季節 × 3 リプレイ）：

| | 結果 |
| --- | --- |
| 所要 | **85 ms** |
| 再現性 | 同じエントリー → 同じ hash（`0x0ab6b571…`） |
| wallet が効くか | 許可リストを空に → cooperation 0.00160 → **0.00024** |
| 壊れた入力 | 500 ではなく `correctness: false` + 失敗 11 件 |

サーバー側 hash がローカル probe と**完全一致**した。

### 73.5 盤面

自分のエントリーが**参照 3 種に対する 4 人目**として走る。参照はデフォルト wallet で走る — アリーナ側の物差しであって、他人の提出物ではない。

### 73.6 残っていること

- 見出し「03 · WRITE A MISSION」は、入力がミッションだけだった頃の文言。いまは提出物全体を作る場所なので、**文言を変えるか要判断**（勝手に直していない）。
- 提出はサンドボックス保管（再起動で消える）。

## 74. C2 を片付けた — 実際に決済した

§73.6 の後で判明したこと：`arenas.ts` は `funding: { state: "funded" }` と書いていたが、**settlement の FDT 残高は 0** だった。30,000 FDT はデプロイヤーに mint されただけで、プールには入っていなかった。`supportOutcome` は支援時に `transferFrom` する設計なので、誰かが呼ぶまでプールは空である。**サイトが事実と違うことを書いていた**（書き換えたのは私）。

ユーザーの明示的な許可を得て、実際に記録・拠出した。

### 74.1 記録したデータ

`scripts/ocean-reference-match.ts` が生成。公開参照エントリー 4 種を、提出と同じ **12 seed** で走らせた実測値である。

| エントリー | livelihood | restraint | cooperation | 季節取得 L/R/C |
| --- | ---: | ---: | ---: | --- |
| Work the season | 269.82 | 1.0425 | **0.00160** | 3 / 3 / **8** |
| Fill the hold | **306.08** | 0.0000 | 0.00000 | **5** / 3 / 2 |
| Hold back | 260.06 | 0.6720 | −0.00027 | 3 / **5** / 3 |
| Closed wallet | 254.88 | 0.5043 | 0.00024 | 3 / 2 / 6 |

**Closed wallet** は Work the season と航海設定が同一で、許可契約だけ空にしたもの。wallet がマッチループで強制されていることの実演として入れた。

**符号化**：契約は `uint256` しか持たない。livelihood・restraint は非負なので ×10⁶。cooperation は反事実との差なので負になりうる。**+0.5 のオフセット**を足してから ×10⁶ した。定数オフセットは単調なので、契約が行う唯一の比較（支配関係）を変えない。

### 74.2 送信した 9 件（Sepolia）

`scripts/settle-ocean-match.sh`。全件 status 0x1。

| | tx |
| --- | --- |
| recordEntry ×4 | `0x5b9a871b…` `0xceb71c7b…` `0xf2cf429b…` `0x2e3b50ac…` |
| sealMatch | `0x378af3be…` |
| approve | `0x2771608 9…` |
| supportOutcome ×3 | `0x1ad10a1d…` `0x40d69c91…` `0x639d79db…` |

matchId `0x0890e7fe…`。

### 74.3 結果 — プールが割れた

契約が**自分で**支配関係を計算し、4 件中 **2 件**をフロンティアに残した（Work the season と Fill the hold）。Hold back と Closed wallet は Work the season に 3 軸すべてで負けている。

拠出先：

| プール | 軸 | 支持先 | 額 |
| --- | --- | --- | --- |
| 0 | livelihood | **Fill the hold** | 10,000 FDT |
| 1 | restraint | **Work the season** | 10,000 FDT |
| 2 | cooperation | **Work the season** | 10,000 FDT |

**2 対 1 で割れた。** 最も多く水揚げした船は、何も差し出さず何にも署名していないので、1 軸しか満たさない。ランキングがあればこの不一致は平均されて 1 人の勝者に潰れていた。**このアリーナが主張していることは、ランキングでは言えない。** 実際に割れたので、主張が実演になった。

検証：残高 30,000 FDT、`sealedMatch` true、`seasonsInMatch` 12、`frontierOf` が 2 件返す。

### 74.4 受取人について

受取人はデプロイヤー自身にした。参照エントリーには第三者の作者がいないからである。**第三者に支払ったわけではない**ので、そう書いてある。プールが割れたことの実演であって、賞金の支払いではない。

### 74.5 これで `state: "funded"` は事実になった
