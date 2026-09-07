# Frontier Protocol Plan 4 — Finalist Readiness

更新日: 2026-09-07
基準: 公開Topページ、Arena一覧、Emergency Supply実測フローのJudge監査

実装状況（2026-09-07）: Milestone 1・2とSubmission Packageのコード／文書部分を実装。Reward Contract、wallet manifest署名、Explorer Evidence UIを実装し、Sepolia Demo Tokenの供給、allocation commit、RewardPaid、残高増加まで実行済み。Durable Storage、World ID、最終大会、Demo動画収録は未完了であり、公開UIでもDemo payoutとTournament settlementを区別する。

## 1. 結論

現在のプロジェクトは、思想・独自性・評価技術は強い。一方で、Topページだけでは次の5点を一度に理解できない。

1. 誰がChallengeを作るのか
2. Builderは何を提出するのか
3. 何が公平に測定されるのか
4. Frontierを拡張すると何を得られるのか
5. なぜEthereumが必要なのか

現状の推定評価は72/100。Finalist候補として強く見せる目標は85/100以上とする。最優先はArenaを増やすことではなく、Emergency Supplyを使った一本の完全な体験を完成させること。

```text
Topで仕組みを理解
  → 60秒Demoを開始
  → 割当を変更
  → APIが9障害ケースを実測
  → Before / After Frontierを表示
  → ContributionでRewardを決定
  → Sepolia Reward Poolから送金
  → Explorerでtransactionを検証
```

## 2. 現在の強み

- 「一つのweighted scoreで勝者を決めない」という主張が明確
- Emergency Supplyは、高校生でも費用と耐障害性の対立を理解できる
- ユーザー入力をAPIが毎回再計算しており、画面演出だけではない
- Context、Hard Constraint、Evidence Level、result hashが表示される
- Before / After HypervolumeとExclusive Contributionが実装されている
- CalldataとMicrogridにより、Ethereum用途と3軸拡張性を証明できる
- UIの視覚品質と一貫性は高い

## 3. 現在の重大な弱点

### 3.1 Topが思想から始まり、プロダクトの動作が見えない

`One score should not decide everything.` は思想として強いが、プロダクト説明ではない。Hero内に具体的なChallenge、入力、測定結果、Reward、Ethereum transactionが存在しない。

### 3.2 最も強いWOWが深い場所に埋まっている

`You expanded the possible area by 0.88%.` が現在の最も強い画面だが、Topから2クリック、長いスクロール、評価実行を経ないと見られない。

### 3.3 操作開始までの距離が長い

Arena詳細はMissionとMetricを丁寧に説明しているが、入力フォームがファーストビューより大幅に下にある。Judgeは短時間で触るため、説明より先に動作可能な状態を見せる必要がある。

### 3.4 Ethereumが必須である理由を実動作で証明できていない

現状の公開体験は、Web2の最適化Dashboardでも成立して見える。Challenge commitment、Final result、Reward allocation、送金のうち、少なくとも一つの完全な経路をSepolia上で検証可能にする必要がある。

### 3.5 三つのArenaが同格に見え、主役が弱い

Arena追加能力は強みだが、最初から三つを同じ強さで説明すると、何を必ず見てほしいのかが曖昧になる。Emergency Supplyを主役にし、他の二つは拡張性の証明として扱う。

## 4. P0 — Topページを一発で理解できる構成へ変更する

### 4.1 Heroの役割

Heroだけで以下を回答する。

- Product: 複数の価値を別々に測定するCompetition Protocol
- Sponsor: 問題、制約、評価軸、Reward Poolを公開する
- Builder / AI Agent: Solutionを提出する
- Protocol: 同じContextで測定し、Frontier Contributionを計算する
- Ethereum: ルールと結果を固定し、Rewardを中立に分配する

### 4.2 推奨コピー

Eyebrow:

```text
OPEN COMPETITION PROTOCOL FOR MULTI-OBJECTIVE PROBLEMS
```

Headline:

```text
Build cheaper and more resilient systems—without hiding tradeoffs in one score.
```

Product sentence:

```text
Sponsors publish problems with multiple goals. Builders and AI agents submit solutions.
Frontier rewards every valid solution that expands what is possible.
```

Primary CTA:

```text
Run the 60-second live demo
```

Secondary CTA:

```text
See how rewards are calculated
```

### 4.3 Hero内の視覚証拠

Hero右側に小さな実測Previewを置く。

- X軸: Procurement cost / lower is better
- Y軸: Worst-case delivery / higher is better
- Baseline A、Baseline B、Your solution
- Before 46.22%
- After 47.10%
- New possibility area +0.88%
- `Deterministic result · Evidence L0`

静的なイラストではなく、Emergency Supplyの実際のfixtureと同じ数値を使用する。HeroからDemoを開始すると、同じ数値の入力フォームへ移動する。

### 4.4 Hero直下のProof Strip

```text
9 failure cases tested · deterministic result hash · public evaluation context · 3 independent arenas
```

Sepolia transactionが存在するまでは `Live on Sepolia`、`Funded`、`Paid` を表示しない。

### 4.5 Topページの新しい順序

1. Hero + Before / After Preview
2. Sponsor → Builder / Agent → Evaluator → Rewardの4段図
3. Emergency Supplyの60秒Live Demo
4. Why Ethereum / 検証可能なhashとtransaction
5. Calldata・Microgridを「More frontiers」として表示
6. Trust、Evidence、GitHub
7. 現在の未実装状態

### 4.6 削減するもの

- Heroと重複する長い思想説明
- ファーストビューを消費する過大な見出しと余白
- Primary CTA付近のGlossaryリンク
- Top上での三つのArenaの同格表示
- 実測より先に出る抽象的なプロトコル用語

### P0完了条件

- [ ] 初見ユーザー5人のうち4人が10秒以内に「複数軸のCompetition Protocol」と説明できる
- [ ] 10秒以内にSponsor、Builder、Protocolの役割を説明できる
- [x] Topの最初の900px以内に実測値、Before / After、Primary CTAが見える
- [x] Primary CTAから1クリックで操作可能なEmergency Supply入力へ到達する
- [x] 60秒以内に入力変更、評価、Contribution確認まで完了できる
- [x] 390px幅でもHeadline、Preview、CTAが順番通り読める

## 5. P0 — Emergency SupplyをGolden Pathにする

### 5.1 ファーストビューの再構成

Arena詳細の最初の900px以内へ以下を配置する。

- 一文のMission
- Cost / Worst-case deliveryの2軸
- 三つのExample Strategy
- 五つの割当入力
- `Evaluate allocation` ボタン

Challenge lifecycle、Manifest、長いContext説明は評価フォームの下、または折りたたみへ移動する。

### 5.2 評価後の順序

1. Correctness Pass / Fail
2. Total CostとWorst-case Delivery
3. `You expanded the frontier by X%`
4. Before / After Frontier
5. Reward amount
6. Failure Evidence
7. Context hashとresult hash
8. Sepolia transaction

### 5.3 Agent Competition Replay

同じ公開Contextへ三つのAgentが順番に提出したReplayを用意する。

```text
Agent A: 最安値を改善
Agent B: 耐障害性を改善
Agent C: Aより高く、Bより弱いためDominated
Final Frontier: AとB
Reward: AとBのExclusive Contributionで配分
```

これはKaggleやPrediction Marketとの差を説明ではなく動作で見せるWOW Momentにする。

### Golden Path完了条件

- [x] 初期値が有効で、最初のクリックで必ず測定結果が出る
- [x] 入力を変更すると結果、Frontier、Contribution、result hashが変わる
- [x] invalid inputではReward previewが0になる
- [x] Agent A、B、Cの結果が同じEvaluatorを通る
- [x] Replay結果が提出順に依存しない
- [x] APIレスポンスと画面表示が一致する

## 6. P0 — Ethereum上の一本の完全な経路

World IDや全機能を同時に完成させる必要はない。Finalist Demoではwallet-onlyでもよいので、以下を実際にSepoliaで動かす。

1. Wallet接続と署名
2. Challenge Manifest hashを固定
3. Final EntryまたはDemo Entryを確定
4. Final result rootとReward allocationを確定
5. Reward PoolへDemo Tokenを供給
6. `commitAllocation`
7. `distribute` または参加者の `claim`
8. transaction hash、Event、送金前後残高を表示

### Contract安全条件

- 同じChallenge allocationの二重commitを拒否する
- 同じRewardの二重受取を拒否する
- Reward合計がPool残高を超えない
- 失敗したbatch送金はclaim可能にする
- Wallet、amount、result rootが公開Evidenceと一致する
- Mainnet価値を持たないSepolia Demo Tokenであることを明示する

### Ethereum完了条件

- [x] 公開ページからSepolia Explorerを開ける
- [x] Contract address、transaction hash、block number、Eventを表示する
- [x] 対象WalletのDemo Token残高が実際に増える
- [x] ページ再読込後もDurable Storageから同じEvidenceを復元できる
- [x] transactionが無い状態を `Paid` と表示しない

## 7. P1 — Judge向け信頼証拠

- [x] TopまたはDemo結果からArchitecture Diagramへ1クリックで移動できる
- [x] `Reproduce this result` から同じAPI requestまたはcurlをコピーできる
- [x] Context、dataset、constraints、metrics、resultのhash関係を図示する
- [x] 実行済みTest数と最終CI commitを表示する
- [x] Source、Evaluator、Contract、DeploymentへのGitHubリンクを用意する
- [x] AIをどこに使用し、人間が何を設計・判断したかREADMEへ明記する
- [x] Hackathon開始前のコードと期間中の変更を明確にする

Git履歴は継続して小さな単位で残す。巨大な最終commit一つにまとめない。

## 8. P1 — 4分Demo構成

```text
0:00–0:20  一つのscoreが価値判断を中央集権化する問題
0:20–0:50  Emergency Supplyの費用と耐障害性
0:50–1:40  割当を変更し、9障害ケースを実測
1:40–2:20  Before / Afterと0.88% Contribution
2:20–3:10  Sepolia Reward Poolから送金、Explorer確認
3:10–3:40  Calldataと3軸Microgridへの拡張
3:40–4:00  なぜEthereumが必要か
```

説明用Slideは最大3枚とし、画面操作を中心にする。待ち時間は動画編集で除く。

## 9. 実装順序

### Milestone 1 — First 10 Seconds

- Top Heroのコピーと構成変更
- Before / After Preview
- Emergency SupplyへのDeep Link
- HeroとArena詳細の縦方向圧縮
- Desktop / Mobile確認

### Milestone 2 — 60 Second Demo

- Arena入力をファーストビューへ移動
- 結果への自動スクロール
- Reproduce request
- Agent A / B / C Replay
- Error、loading、invalid状態確認

### Milestone 3 — Ethereum Proof

- Sepolia deploy
- Wallet署名
- Allocation commit
- distribute / claim
- Explorer Evidence UI
- Durable Storage

### Milestone 4 — Submission Package

- 4分Demo動画
- Architecture Diagram
- README冒頭のJudge向け説明
- AI利用範囲と期間中の実装履歴
- Partner Prizeごとのload-bearing integration説明

## 10. やらないこと

Finalist Demo完成前は、以下を優先しない。

- 四つ目以降のArena
- Mainnet Token
- 高度な3D chart
- ENSを必須にすること
- Ledger実機対応
- Sponsorごとの詳細Dashboard
- 全Evidence Levelの実運用
- 装飾目的のアニメーション追加

## 11. 最終判定基準

以下の質問すべてに、公開Demoだけで答えられる状態を完成とする。

- これは何か: 複数目的CompetitionとReward Protocol
- 誰が使うか: Sponsor、Builder、AI Agent
- 何を提出するか: 制約を満たすArtifactまたはSolution
- どう測るか: 同じContextとEvaluatorで各軸を独立測定
- 誰が勝つか: 他の解に全軸で負けないFrontier上の解
- いくら受け取るか: Exclusive Contributionに基づく配分
- なぜEthereumか: ルール、結果、Rewardを一者に依存せず検証・分配するため
- 本当に動くか: 入力変更、result hash、Sepolia transactionで検証できる
