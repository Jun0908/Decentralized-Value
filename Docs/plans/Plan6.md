# Frontier Protocol Plan 6 — 72-Hour Disaster Response

更新日: 2026-09-08  
状態: Hackathon demo実装済み（scheduled tournament境界は未実装）  
対象: Emergency Supply Arenaのゲームルール、評価、イラスト、Final Entry、報酬

## 実装結果

- 新版: `/arenas/emergency-supply`、`disaster-response-v2`、`frontier:plan6`
- 旧版フォールバック: `/arenas/emergency-supply-classic`、`emergency-supply-v1`、`frontier:plan5`
- 新版はStrategy v2、3公開Scenario、4 committed instant-final Scenario、3評価軸、4 Award、Revision、Final Entry、Sepolia demo settlementを実装した
- イラスト、Scenario tab、Event timeline、地域別充足barにより、障害と対応結果を画面で確認できる
- scheduled tournamentに必要な締切、Final Entry lock、非公開Scenario保管は意図的に未実装で、画面とAPIではinstant demoと明示する

## 1. Plan 6の目的

現在のEmergency Supplyは計算自体は正しいが、ユーザー体験としては「5社へ数字を割り振るフォーム」に見える。災害、配送の失敗、住民への影響、勝敗の理由が見えず、一度触っただけではゲームの意味を理解しにくい。

Plan 6では、現在のArenaを次のゲームへ作り直す。

> 72時間の災害対応を生き残る配送戦略を作り、費用、回復力、公平性の異なる価値で競う。

ユーザーは固定された1回の配分ではなく、災害状況に応じて行動する配送戦略を提出する。提出後、Evaluatorが複数の災害シナリオを再生し、どれだけ多く、安く、公平に支援物資を届けられたかを評価する。

完成時には、Judgeが最初のイラストと一文を見るだけで、次の内容を理解できること。

```text
災害が起きる
  → 道路や港が止まる
  → 参加者の配送戦略が迂回する
  → 届いた量、費用、地域格差を評価する
  → 異なる価値を実現した複数の勝者へ支払う
```

## 2. 現在のArenaから変える理由

現在のルール:

- 5社へ合計1,000 kitsを割り振る
- 5 supplier failureと4 route failureを順番に評価する
- Total Costを最小化する
- Worst-case Deliveryを最大化する
- Pareto Frontierへの独占的な貢献量でRewardを決める

この仕組みには次の問題がある。

- 災害が画面上で起きず、数字の意味を感じられない
- すべての事故が公開済みで、静的な配分だけでも答えを探せる
- 提出するものがアルゴリズムではなく、5つの数字だけになっている
- Pareto FrontierとHypervolumeを理解しないと勝敗が分からない
- 現在は参加者が少ないため、実質的な競争にならない
- Rewardの理由を一文で説明できない

Plan 6は旧版を置き換えず、`/arenas/emergency-supply-classic`へ完全なフォールバックとして保存する。新版は別Evaluator、別API、別Redis namespaceで実装し、PrivyとSepolia settlement adapterだけを共有する。

## 3. 新しいゲームの一文

### 72-Hour Disaster Response

> 港、道路、倉庫が予告なく停止する72時間。限られた予算で、すべての地域へ支援物資を届ける配送戦略を作れ。

プレイヤーが考えることは、単なる配分ではない。

- どこから仕入れるか
- どの経路で運ぶか
- 障害発生後にどこへ迂回するか
- 在庫をどの地域へ優先するか
- 費用と配送量をどう両立するか
- 遠い地域や小さい地域を置き去りにしないか

## 4. 一目で理解させるイラスト

イラストは装飾ではなく、ゲーム説明の中心として扱う。長い説明を読まなくても、絵の中だけで「何を作り、何が壊れ、どう勝つか」が分かる必要がある。

### 4.1 最初に見せるメインイラスト

横長の一枚絵で次を表現する。

```text
左: 物資を持つSupplierと倉庫
中央: 港、鉄道、道路、空路でつながる配送Network
中央上: 嵐や地震で港と道路の一部が停止
右: 複数の避難地域と必要な支援物資
強調: 参加者の戦略が別ルートへ迂回し、物資を届ける
```

イラスト付近に置く文字は最低限とする。

- `72 HOURS`
- `LIMITED BUDGET`
- `ROUTES WILL FAIL`
- `KEEP EVERY REGION SUPPLIED`

### 4.2 ゲーム中に見せる3状態

同じ地図とイラストを使い、状態変化が分かるようにする。

1. **Before disaster** — すべての経路が使える
2. **Disruption** — 港、道路、Supplierなどが停止する
3. **Your response** — 提出した戦略が迂回し、各地域へ配送する

### 4.3 結果イラスト

結果では数値だけでなく、地図上で次を確認できるようにする。

- 届いた地域は緑
- 不足した地域は赤または警告色
- 使用した配送経路
- 停止した施設と経路
- 最も悪かった災害シナリオ
- 他の戦略と違った判断

### 4.4 表現の方向性

- サイト全体の黒、白、ライムグリーンを維持する
- NotebookLMの説明図のように、人物、物資、地図、経路の関係を簡潔に描く
- 写真ではなく、統一感のあるインフォグラフィック型イラストを使う
- 小さな文字を大量に入れない
- イラストを見ただけで操作対象と結果の因果関係が分かる構図にする
- PCとMobileで意味が失われないよう、必要なら同じ内容の横長版と縦長版を用意する

## 5. Challengeの基本設定

### 5.1 世界

- 時間: 72時間
- 支援対象: 複数の地域またはShelter
- 供給元: Supplier、Warehouse
- 配送経路: Port、Rail、Road、Air
- 制約: 予算、在庫、輸送容量、移動時間
- 障害: Supplier停止、Route閉鎖、Warehouse停止、需要増加

具体的な地域数やシナリオ数はEvaluatorを実装しながら調整してよい。ただし、Judgeが3分以内に違いを確認できる規模にする。

### 5.2 Public Training Data

参加者へ事前に公開する。

- 地域ごとの必要量と期限
- Supplierの価格、在庫、処理能力
- Routeの輸送時間、容量、費用
- 公開災害シナリオ
- Sample Strategy
- Submission Schema
- Evaluatorの基本ルール

### 5.3 Hidden Final Scenarios

最終評価には、公開Training Dataとは異なる災害シナリオを使う。

- Final Scenario Setは提出前にHashをCommitする
- 締切までは内容を非公開にする
- 評価終了後にScenario Setを公開する
- 同じStrategyと同じScenario Setから、誰でも同じ結果を再現できる
- Demoでは短時間で終わる決定的なScenario Setを使う

Hidden Scenarioを実装できるまで、公開版を`Practice`として表示する。公開シナリオだけの状態をFinal Tournamentとは呼ばない。

## 6. ユーザーが提出するもの

Plan 5の`5つの数字`から、状況に応じて配送を決める`Strategy`へ変更する。

概念上のInterface:

```ts
decide({
  hour,
  remainingBudget,
  inventory,
  regionalDemand,
  availableSuppliers,
  availableRoutes,
  previousDeliveries
}) => ShipmentDecision[]
```

Strategyは、各時間またはEvent発生時に次の配送判断を返す。

```json
{
  "from": "warehouse-east",
  "to": "shelter-3",
  "route": "rail-west",
  "kits": 120
}
```

初期実装では安全に実行できる範囲のStrategy形式を選んでよい。JSON Rules、制限付きTypeScript、Pythonなど、実装可能性を確認して決める。任意コードを受け付ける場合は、隔離されたRunner、時間制限、Memory制限、Network無効化が必要になる。

Starter Kitには最低限、次を含める。

```text
disaster-response-starter/
  challenge-manifest.json
  network.json
  training-scenarios.json
  sample_strategy.*
  submission-schema.json
  README.md
```

## 7. 評価ルール

### 7.1 Correctness Hard Gate

次に違反した提出は勝敗計算へ入れない。

- 存在しないSupplier、Warehouse、Routeを使用しない
- 在庫、Route容量、車両容量を超えない
- 残り予算を超えない
- 閉鎖中の経路を使用しない
- 無効な個数や負数を返さない
- 実行時間とMemory上限を守る
- すべての決定を同じ公開Interfaceから返す

### 7.2 独立した評価軸

一つの総合点へ混ぜない。

| 評価軸 | 方向 | 意味 |
| --- | --- | --- |
| Procurement & Delivery Cost | 最小化 | 仕入れと輸送に使った総費用 |
| Worst-case Delivery | 最大化 | 最も悪い災害でも期限内に届いた物資量 |
| Regional Fairness | 最大化 | 最も不足した地域が、必要量の何%を受け取れたか |

必要なら後から、配送時間、Carbon、安全性などの独立軸を追加できる。ただしPlan 6の最初の実装では、画面と説明が複雑にならない範囲に留める。

### 7.3 シナリオ評価

各Strategyを同じScenario Setで実行する。

```text
Strategy
  × Scenario 1: East Port closed
  × Scenario 2: Main road destroyed
  × Scenario 3: Supplier shortage
  × Scenario 4: Demand spike
  × ...
```

各Scenarioについて、費用、期限内配送数、地域別充足率、違反、重要Eventを保存する。Worst-case指標は全Scenarioの最悪結果から計算する。

## 8. 勝者とReward

ユーザーが理解できる4つの賞を用意する。

| Award | 勝利条件 | Reward例 |
| --- | --- | ---: |
| Resilience Winner | Worst-case Deliveryが最大 | 2,500 FDT |
| Efficiency Winner | 必要な配送基準を満たした中でCostが最小 | 2,500 FDT |
| Fairness Winner | 最悪地域の充足率が最大 | 2,500 FDT |
| Frontier Winner | 既存解にない有効なTradeoffを最も広げた | 2,500 FDT |

同じ提出が複数のAwardを獲得してよい。同率の場合の分割規則はChallenge Manifestへ明記し、決定的に計算する。

Pareto FrontierとHypervolumeはFrontier Winnerの計算に使えるが、最初の説明には出しすぎない。ユーザーにはまず、`何を改善したため、どのAwardを取ったか`を表示する。詳しい計算根拠は展開可能なEvidenceとして確認できるようにする。

Reward Poolの配分はChallenge開始前に固定し、後から運営者が変更できないようにする。

## 9. ゲームの流れ

```text
1. Missionのイラストを見る
2. Public Training DataとStarter Kitを取得する
3. Sample Strategyを実行する
4. 自分のStrategyを変更する
5. 公開ScenarioでPractice Runする
6. StrategyをSubmissionとして保存する
7. Revisionを改善する
8. 一つのRevisionをFinal Entryに選ぶ
9. Hidden Final Scenariosで一斉評価する
10. 4つのAwardとFrontierを確定する
11. Ethereum上へResultをCommitする
12. 勝者のWalletへRewardを支払う
```

Judge向けDemoでは、時間を待たずに小さなFinal Scenario Setを実行し、災害発生、迂回、評価、支払いまでを一度に再生できるようにする。

## 10. 結果で必ず説明すること

結果画面では、単に数字を並べず次の順で説明する。

1. 何が壊れたか
2. Strategyがどう対応したか
3. どの地域に何個届いたか
4. どこで不足したか
5. 費用はいくらだったか
6. 他のStrategyより何が優れていたか
7. どのAwardまたはFrontierへ入ったか
8. Rewardがいくらになったか

説明例:

> East Portが12時間目に閉鎖しました。あなたのStrategyはRail Westへ320 kitsを迂回し、最悪地域の充足率を61%から84%へ改善しました。Costは増えましたが、今回最も公平な配送となったためFairness Winnerです。

## 11. Ethereumを使う意味

Ethereumはゲーム処理そのものではなく、運営者が結果を後から書き換えられないために使う。

- Challenge ManifestのHash
- Public DataとFinal Scenario SetのCommitment
- Evaluator Version
- SubmissionとFinal EntryのHash
- Final Result Root
- AwardごとのRecipientとReward
- Reward PoolのEscrow
- 支払いTransaction

評価計算はOffchainで行い、再現可能なEvidenceと最終結果をEthereumへCommitする。

Judgeへ伝える中心メッセージ:

> The organizer cannot change the rules, hidden test set, winners, or rewards after seeing the submissions.

## 12. 現在の機能から再利用するもの

- Privy Google / Email / Wallet認証
- Embedded Wallet
- Participant登録
- Upstash Redisによる永続保存
- Submission ID、Revision、Input Hash、Result Hash
- Final Entry選択
- Shared Pareto / Contribution計算
- Sepolia Reward PoolとDemo Token
- RewardPaid Transaction表示
- Arenaの黒、白、ライムグリーンのVisual Identity

## 13. 作り直すもの

- 静的なSupply Allocationを72時間のStrategy Simulationへ変更
- 5つの数字だけのSubmission SchemaをStrategy Artifactへ変更
- 9件の固定Failureだけでなく、時系列Eventを持つScenarioを追加
- 公開PracticeとHidden Final Evaluationを分離
- 結果へ配送Map、Event Timeline、地域別充足を追加
- Reward理由を4つのAwardとして明確化
- Hypervolume中心の説明を、Awardと具体的な改善理由中心へ変更
- 最新Revisionと選択したFinal Entryの評価対象を一致させる

## 14. 実装順序

### Milestone 1 — Game Specification

- [ ] Network、Region、Supplier、Route、Demand、EventのSchemaを決める
- [ ] 72時間Simulationの時間単位とDecision Timingを決める
- [ ] 3つの評価軸とHard Gateを固定する
- [ ] 4つのAwardと同率規則をManifestへ記載する
- [ ] Sample Strategyと期待結果を作る

### Milestone 2 — Deterministic Evaluator

- [ ] 同じ入力から同じ結果を返すSimulation Engineを作る
- [ ] Public Training Scenariosを評価する
- [ ] ScenarioごとのEvent、配送、費用、地域充足を記録する
- [ ] Correctness、3軸、Pareto、Award候補を計算する
- [ ] Context HashとResult Hashへ必要な情報を含める

### Milestone 3 — Submission and Runner

- [ ] Strategy Artifact Schemaを実装する
- [ ] Starter Kitを更新する
- [ ] Practice Runと正式Submissionを分離する
- [ ] Strategy実行方式に必要な安全境界を実装する
- [ ] RevisionとFinal Entryを新Evaluatorへ接続する
- [ ] LeaderboardとSettlementが同じFinal Entryを使うよう修正する

### Milestone 4 — Illustrations and Replay

- [ ] メインのNetworkイラストを作る
- [ ] Before Disaster、Disruption、Responseの状態を作る
- [ ] 実際のEvaluator Eventから配送Animationを再生する
- [ ] 最悪Scenarioを地図とTimelineで説明する
- [ ] DesktopとMobileで一目で意味が伝わることを確認する

### Milestone 5 — Hidden Final and Awards

- [ ] Final Scenario Setを作る
- [ ] Scenario Set Commitmentを生成する
- [ ] Final Entryだけを一斉評価する
- [ ] 4つのAwardを決定的に計算する
- [ ] Result公開後にScenarioと評価を再現可能にする

### Milestone 6 — Ethereum Settlement

- [ ] Challenge、Scenario、Evaluator、Final ResultをCommitする
- [ ] 4つのAward配分からAllocation Rootを生成する
- [ ] Sepoliaで受取WalletへRewardを支払う
- [ ] Award理由、Transaction、残高増加を同じ結果へ表示する
- [ ] 二重支払いと結果の差し替えを拒否する

## 15. Test

### Simulation

- 同じContext、Strategy、Scenarioから同じ結果になる
- 閉鎖中のRouteを使えない
- Inventory、Capacity、Budgetを超えられない
- Event発生前後で使用可能なNetworkが正しく変わる
- 配送時間とDeadlineが正しく反映される
- 地域別の配送合計と全体合計が一致する

### Evaluation

- Invalid StrategyはFrontierとAward対象外になる
- Cost、Worst-case Delivery、Regional Fairnessを独立して計算する
- Submission順によりParetoとAwardが変わらない
- Hidden Final ScenarioのCommitmentと公開後のDataが一致する
- 同率処理が決定的でReward総額を超えない

### Competition

- Practice結果はFinal Resultへ混入しない
- 最新Revisionではなく、選択したFinal Entryを最終評価する
- 他人のFinal Entryを選択できない
- Final開始後にEntryを変更できない
- 各Awardの勝利理由を人間が読める形で生成する

### Settlement

- Award結果とAllocation Rootが一致する
- Reward Poolを超えて支払わない
- 同じRoundを二重Settlementできない
- Transaction失敗を`PAID`と表示しない
- Recipient、Amount、Transaction、Eventが一致する

## 16. Definition of Done

次を公開Demoで確認できた時点でPlan 6を完了とする。

1. 最初のイラストと一文だけでゲームの目的を説明できる
2. Training DataとStarter Strategyを取得できる
3. Strategyを変更し、Practice Scenarioを再生できる
4. 災害発生と迂回判断がイラスト上で見える
5. StrategyをSubmissionとして保存できる
6. 複数RevisionからFinal Entryを選べる
7. Final EntryがHidden Final Scenariosで評価される
8. Cost、Worst-case Delivery、Regional Fairnessが計算される
9. 4つのAwardについて、誰がなぜ勝ったか分かる
10. ChallengeとFinal ResultのCommitmentを確認できる
11. AwardのRewardが受取Walletへ支払われる
12. EtherscanでTransactionを第三者が確認できる
13. 同じScenarioとStrategyから結果を再現できる

## 17. Plan 6で守る中心思想

このゲームの目的は、一つの総合点で全員を並べることではない。

- 最も安い解
- 最も災害に強い解
- 最も地域を公平に扱う解
- 新しいTradeoffを作った解

これらは異なる価値であり、一つだけを正解にしない。

> One score should not decide everything.  
> Different solutions can win for different public reasons.

そのうえで、ルール、評価Context、Final Scenario、勝者、Rewardを検証可能にすることがFrontier Protocolの役割である。

## 18. 現在の問題と次の改善

Plan 6のEvaluatorは実際に入力を再計算している。Presetを`Adaptive regional mesh`から`Budget Sprint`相当へ変更すると、確認時点では最悪時配送が`750 kits`から`174 kits`へ、Costが`$67,240`から`$45,208`へ変化した。固定された結果画像ではない。

一方、現在の画面だけでは操作方法、計算理由、Decentralized Valueとの関係が理解しにくい。次の改善では機能を増やす前に、この三点を解消する。

### 18.1 ログイン境界

ローカル環境に次の値がない場合、Privyは`Sign-in unavailable`になる。

- `NEXT_PUBLIC_PRIVY_APP_ID`
- `PRIVY_VERIFICATION_KEY`

ログインなしでもStrategy編集とPractice Simulationは利用可能とする。次の操作だけを認証後に限定する。

- Challengeへの参加
- Submission保存
- Revision履歴
- Final Entry選択
- Sepolia Reward受け取り

画面上では、Practiceがログイン不要であることと、どこからログインが必要になるかを明記する。ローカルDemoでも完全な導線を確認できるよう、Privy設定手順または安全なDemo認証方法を用意する。

### 18.2 パラメーター操作の改善

現在の操作は技術的には可能だが、次の問題がある。

- Reserve KitsとEmergency BudgetはSliderだけで、数値を直接入力できない
- Supplier順位は小さな`Up / Down`だけで変更する
- Regional PolicyのCardが操作可能に見えにくい
- 値を変えたとき、何が改善し何が悪化するかがその場で分からない
- Strategy編集とSubmission保存の認証境界が分かりにくい

次のUIへ変更する。

- Sliderと数値入力欄を同期させる
- SupplierをDrag & Dropまたは大きな順位操作UIで並べ替える
- Policy Card全体をButtonとし、選択状態を文字と色の両方で示す
- `Reset`と3つのPresetを常に利用可能にする
- 編集中にCost、Worst-case Delivery、Worst-region Coverageの予測を更新する
- 各入力の横に短いTrade-off説明を置く
- 未ログイン時も編集・Practice操作をDisableしない

表示例:

```text
Emergency Budgetを増やす
  + 障害後に買い直せる
  - 災害前の調達予算が減る

Backup Reserveを増やす
  + 経路停止に強くなる
  - 高価なSupplierを使いやすくなる
```

### 18.3 現在のStrategy計算

総予算を`72,000 USD`、緊急復旧予算を`E`とする。

```text
Initial Budget = 72,000 - E
Primary Target = 1,000 - Reserve Kits
Reserve Target = Reserve Kits
```

Supplierごとの購入数は優先順位に従い、次で決める。

```text
Purchased Kits = min(
  Remaining Target,
  Supplier Remaining Capacity,
  floor(Remaining Budget / Unit Cost)
)
```

購入物資の到着時刻は次で決まる。

```text
Arrival Hour = Order Hour + Supplier Lead Time
```

あるScenarioでSupplierまたはRouteが`Event Hour`に停止した場合、停止対象の物資は次の条件で失われる。

```text
Arrival Hour < Event Hour  -> Survives
Arrival Hour >= Event Hour -> Lost
```

不足分は、停止したSupplierとRouteを除外し、`Emergency Supplier Order`と緊急予算に従って再購入する。

### 18.4 地域への配送方針

到着した物資は、締切前に到達でき、需要が残っている地域だけへ配る。

- `deadline-first`: Deadlineが最も近い地域を優先する
- `highest-need`: 残り需要が最も大きい地域を優先する
- `equalize-coverage`: `Delivered / Demand`が最も低い地域を優先する

`equalize-coverage`は最も不利な地域を先に引き上げるため、Plan 6におけるFairnessの中心となる。

### 18.5 三つの独立評価軸

7つのScenarioを実行し、次を計算する。

```text
Cost = max(Scenario Total Cost)

Worst-case Delivery = min(Scenario Delivered Kits)

Regional Fairness = min(
  Delivered Kits in Region / Demand in Region
  for every Region in every Scenario
)
```

Costは最小化、Worst-case DeliveryとRegional Fairnessは最大化する。平均値ではなく最悪ケースを使うことで、一部の災害や地域だけを見捨てたStrategyが高評価になることを防ぐ。

結果画面では数値だけでなく、次のDecision Traceを表示する。

1. 何が何時間目に停止したか
2. 何個の物資を失ったか
3. どのSupplierとRouteへ迂回したか
4. 各地域へ何個届いたか
5. どの判断がCost、Resilience、Fairnessへ影響したか

### 18.6 ParetoとDecentralized Value

運営者が次のようなWeighted Scoreを設定する方式は採用しない。

```text
Total Score = Cost x 50% + Delivery x 40% + Fairness x 10%
```

この方式ではWeightを決める運営者が、どの価値を優先するかを事前に決定してしまう。

Strategy AがStrategy BをPareto Dominanceするのは、次をすべて満たし、少なくとも一軸で厳密に優れる場合だけである。

```text
Cost(A) <= Cost(B)
Delivery(A) >= Delivery(B)
Fairness(A) >= Fairness(B)
```

安いStrategy、災害に強いStrategy、公平なStrategyを一つの順位へ圧縮しない。異なる価値を実現した解をPareto Frontierに残すことが、現在の`Decentralized Value`の中心である。

Frontier Contributionは、正規化されたCost、Delivery、Fairnessの3次元空間で計算する。

```text
Exclusive Contribution =
  Hypervolume with Candidate
  - Hypervolume without Candidate
```

これは単純な順位ではなく、Candidateが既存解にはなかった有効な選択肢をどれだけ増やしたかを表す。

### 18.7 AwardとReward

Weighted Scoreの代わりに、10,000 FDT Demo Poolを異なる価値へ分ける。

| Award | 決定方法 | Pool |
| --- | --- | ---: |
| Resilience | Worst-case Deliveryが最大 | 2,500 FDT |
| Efficiency | Delivery 600 kits以上、Fairness 5%以上の中でCostが最小 | 2,500 FDT |
| Fairness | Regional Fairnessが最大 | 2,500 FDT |
| Frontier | Exclusive Contributionが最大 | 2,500 FDT |

一つのStrategyが複数Awardを獲得できる。同率Winnerがいる場合は、そのAward Poolを決定的に均等分割する。

画面では`Frontier`という抽象語だけを出さず、各Awardについて次を表示する。

- 誰が勝ったか
- どの数値が勝利条件を満たしたか
- 何FDT受け取るか
- 他のStrategyと何が違ったか

### 18.8 Ethereumと検証可能性

EthereumはSimulationそのものを実行するのではなく、運営者による結果と支払いの差し替えを防止するために使う。

```text
Challenge Rules / Scenario Commitment
  -> Selected Final Entry
  -> Deterministic Result Hash
  -> Award Allocation Root
  -> Sepolia RewardPaid Transaction
```

画面ではこのEvidence Chainを一続きに表示し、それぞれのHashが何をCommitしているかを説明する。

現在の正確な境界は次のとおり。

- Valuesは一つのWeighted Scoreへ集中させていない
- Evaluatorは同じ入力から同じ結果を再現できる
- Resultを含むReward Allocationと支払いはSepoliaで確認できる
- Evaluator実行は現在一つのServerが担当している
- Multi-verifier、Threshold Attestation、Disputeは未実装
- Instant DemoのFinal ScenarioはCommit後すぐ公開され、締切付きHidden Tournamentではない

現在の状態は次の一文で表現する。

> Values are decentralized, but evaluation execution is still operated by one server.

### 18.9 次の実装順序

1. ローカルPrivy設定を整え、JoinからRewardまで一人が完走できるようにする
2. Sliderと数値入力、Supplier順位操作、Policy選択を改善する
3. 編集中の3指標PreviewとTrade-off説明を追加する
4. ScenarioごとのDecision Traceを読みやすくする
5. Pareto DominanceとExclusive Contributionを簡単な図で表示する
6. Rule HashからSepolia TransactionまでのEvidence Chainを一画面へまとめる
7. その後、必要であれば複数Verifier、Attestation、Disputeへ進む

## 19. Section 18 implementation status（2026-09-08）

- [x] Practiceはログイン不要、保存・Final Entry・Rewardだけログイン必須であることを画面に明記
- [x] Reserve KitsとEmergency Budgetを、Sliderと数値入力の両方で変更可能にした
- [x] Supplier順位を、順位選択とUp / Downの両方で変更可能にした
- [x] Regional Policyの選択状態を、色と`SELECTED`表示で明確にした
- [x] `Reset`と3つのPresetを常時利用可能にした
- [x] 編集から250ms後に7 Scenarioを再計算し、Cost・Worst Delivery・Worst Region・Pareto判定を自動更新
- [x] ログインなしでPractice Simulationを実行し、Failure → Reroute → DeliveryのDecision Traceを表示
- [x] 3軸を合算しない理由、Pareto Dominance、Exclusive Contributionを画面上で説明
- [x] Rules / Final Entry / Result / Sepolia Allocation & PaymentのEvidence Chainを一画面で表示
- [x] 固定ナビゲーションから移動した際に見出しが隠れないよう調整
- [ ] ローカルの実Privyログイン。`apps/web/.env.local`へ`NEXT_PUBLIC_PRIVY_APP_ID`と`PRIVY_VERIFICATION_KEY`を設定後、Join → Submission → Final Entry → Rewardを再確認する

実Privy認証を偽装するフォールバックは作らない。認証情報がない環境でもEvaluatorとPracticeは完全に操作可能とし、Reward recipientに関係する操作だけをfail closedにする。
