# Plan 7 — 15-Second Disaster Replay

**Status:** Implemented and locally verified on 2026-09-09.

---

# Plan 7 Extension — Value Pools

**Status:** Implemented and locally verified on 2026-09-09. The 15-second replay remains unchanged.

## 目的

現在の72-Hour Disaster Responseを、単なる複数目的の物流最適化ではなく、複数の主体が異なる価値へ資金を出し、異なる解決策が同時に報酬を受け取るゲームへ進化させる。

AIは各価値に対する戦略を最適化できる。しかし、社会がどの価値を支持し、いくら資金を出すかには一つの正解を置かない。

```text
複数のValue Funderが異なる価値へ資金を出す
                    ↓
Builder / AIが物流戦略を提出する
                    ↓
同じEvaluatorが独立したOutcomeを測定する
                    ↓
各Value Poolが自分のルールで報酬を配る
                    ↓
異なる戦略が、異なる理由で同時に報酬を得る
```

## 変更しないもの

- 5社のSupplier、4本のRoute、4地域
- 予算、予備在庫、購入順位、地域配送方針
- 3つの公開Scenarioと4つのCommitted Final Scenario
- 15秒の配置 → 障害 → 復旧 → 地域結果Replay
- Cost、Worst Delivery、Worst-region Coverageの独立測定
- Correctness Gate、Pareto Frontier、Result Hash
- Login、Revision、Final Entry、Redis保存、既存のSepoliaデモ境界

物流シミュレーションを作り直さず、その上の「価値の所有者」と「報酬の流れ」を変更する。

## 4つの初期Value Pool

現在の4 Awardsを、資金提供者、価値の宣言、判定ルール、予算を持つ独立したValue Poolとして扱う。

| Value Pool | 価値の宣言 | 判定 | Demo予算 |
| --- | --- | --- | ---: |
| Global Relief Fund | 最悪の災害でも最大量を届けたい | Worst Delivery最大 | 2,500 FDT credits |
| Donor Efficiency Pool | 公開された制約を守る解の中で支出を減らしたい | 正しいStrategyのCost最小 | 2,500 FDT credits |
| Local Communities Pool | 最も支援されない地域を取り残したくない | Worst-region Coverage最大 | 2,500 FDT credits |
| Frontier Expansion Pool | 既存解にない有用な選択肢を増やしたい | 正のExclusive Frontier Contribution | 2,500 FDT credits |

画面では「運営が決めた4部門」ではなく、「異なる主体が資金を置いた4つの価値」として、戦略作成前に表示する。

## 報酬ルール

- 総合点と総合優勝者を作らない。
- Resilience、Efficiency、Fairnessは、それぞれ別Poolの独立判定として維持する。
- Exact tieでは、そのPool予算を決定的な方法で等分する。
- Frontier Expansion Poolは一人の総取りをやめる。
- 正のExclusive Frontier Contributionを持つ全Final Entryへ、貢献量に比例してPool予算を配る。
- 各Poolの配分合計は、そのPool予算を超えてはならない。
- Submission順序によってFrontier membership、contribution、配分額が変化してはならない。
- Practice credits、Preview、Committed、Paidを混同しない。

Frontier Poolの基本式：

```text
entry reward =
  pool budget
  × entry exclusive contribution
  ÷ all positive exclusive contributions
```

端数処理後も合計がPool予算と一致するよう、残余はResult Hashによる決定的順序で配る。

## 30秒で伝えるユーザー体験

### 1. 複数の価値を見る

ゲーム開始時に4つのValue Poolを表示する。各CardにはFunder、価値の宣言、判定条件、予算を短く表示する。

### 2. 戦略を作る

現在のStrategy Builderをそのまま使う。ユーザーは特定のPoolを狙っても、複数を同時に狙ってもよい。

### 3. 災害を見る

現在の15秒Replayで、安い経路への集中、経路障害、復旧購入、地域間の差を見せる。

### 4. 価値別の結果を受け取る

単一Scoreの代わりに、次を最初に表示する。

初期Reference Strategyでは、Global Relief Fundは`Resilience Mesh`、Donor Efficiency Poolは`Budget Sprint`、Local Communities Poolは`Fair Reach`を選ぶ。Frontier Expansion Poolは正の独占貢献に比例して複数Strategyへ配る。提出が加われば同じ公開ルールで再計算する。総合1位は表示しない。

## Fund a Valueデモ

強いデモとして、既存の4 Poolに加えて新しいValue Poolを1つ追加できるようにする。

最初の実装では、任意コードを実行させず、公開済みOutcomeから判定できる安全なTemplateを使う。

推奨する最初のTemplate：

```text
Protect a Region
- Funderが4地域から一つを選ぶ
- その地域の全Scenario中の最低Coverageを最大化する
- Pool名、価値の宣言、予算を設定する
```

JudgeデモではHighland Clinicを守るPoolを追加し、それまで報酬がなかった戦略に新しい報酬が発生する瞬間を見せる。

```text
新しい価値が追加される
        ↓
同じ提出物を同じEvidenceから再評価する
        ↓
総合順位を作らず、新しい受給戦略が現れる
        ↓
新しい価値に合う戦略へ新しい資金が流れる
```

これをValue Decentralizationの中心デモにする。

## データ境界

`ValuePoolManifestV1`相当のデータを追加する。

```text
- poolId
- challengeId
- funderLabel
- name
- valueStatement
- ruleType
- ruleParameters
- poolCredits
- contextHash
- status: PRACTICE | COMMITTED | FUNDED | PAID
- manifestHash
```

初期4 Poolも特別扱いせず、同じManifest形式で表現する。Value Poolのルールまたは予算が変わればManifest Hashも変わる。

## 実装範囲

1. ✅ 既存Award定義をValue Pool Manifestへ移す。
2. ✅ Leaderboard計算をPool別allocationへ変更する。
3. ✅ Frontier Poolをwinner-take-allから貢献比例配分へ変更する。
4. ✅ APIレスポンスへPool、allocation breakdownを追加する。
5. ✅ Strategy Builderの前にValue Pool Cardを置く。
6. ✅ 結果画面を「点数・総合順位」から「どの価値に認められたか」へ変更する。
7. ✅ Leaderboardを総合順位中心からSolution LandscapeとPool別配分へ変更する。
8. ✅ Template制の`Fund a Value`でProtect a Region Poolを1件追加できるようにする。
9. ✅ Pool manifest、判定、比例配分、端数、複数受給戦略のdeterministic testを追加する。
10. ✅ README、PRODUCT、ARCHITECTURE、DEMO、arena仕様、STATUSを実装結果に合わせて更新する。

## Settlement方針

最初のデモでは、既存のSepolia Reward Poolから参加者ごとの合計額を支払い、Result / allocation evidenceにPool別内訳を含める。4つの独立Contractから支払われたとは主張しない。

Pool作成がPracticeまたはPreviewの場合、実際に資金提供されたとは表示しない。独立したFunderがSepolia上で入金する機能は次段階とする。

## 完了条件

- Strategy作成前に、少なくとも4つの異なるFunder、価値、予算、判定条件が理解できる。
- 総合Scoreと総合優勝者がなくても、複数戦略が異なる理由で報酬を得ることが分かる。
- 少なくとも2つの対立する戦略が、同時に別のValue Poolから報酬を得る。
- Frontierへ正の独占貢献を持つ全Final Entryが比例配分の対象になる。
- Protect a Region Poolを追加すると、既存の評価Evidenceを使って新しい受給戦略が現れる。
- すべてのPool配分が決定的で、提出順序に依存せず、Pool予算を超えない。
- Pool rule、context、result、allocationのHash関係を確認できる。
- Demo creditsと実際のSepolia paymentを画面上で明確に区別する。
- 既存の15秒Replay、Revision、Final Entry、Classic fallbackを壊さない。

## 今回やらないこと

- 誰でも任意コードの評価関数を実行できる仕組み
- Mainnet上の実価値Token
- 完全PermissionlessなPool Contract Factory
- Governance、Dispute、Slashing
- 物流シミュレーション自体の全面的な作り直し
- AIを禁止すること

このExtensionの目的はAIを排除することではない。AIが解決方法を最適化できても、何を価値とし、どこへ資金を出すかを一つの主体が独占しないゲームを体験可能にすることである。

## 目的

Strategyを入力した後、何が起きて結果になるのかを約15秒の動きで見せる。

## 15秒の流れ

1. **0–3秒：初期配置**
   - Supplierから購入した物資を箱で表示
   - Emergency Budgetを金庫として表示

2. **3–6秒：災害発生**
   - 壊れたRouteを赤くする
   - 失われた箱を消して`520 kits lost`と表示

3. **6–10秒：自動復旧**
   - 別Supplierから箱を再配送
   - 使用したRecovery Budgetを表示

4. **10–15秒：結果**
   - 各地域のCoverageを表示
   - Cost・Worst Delivery・Worst Regionを表示

```text
East Port closed. 520 kits were lost.
270 kits were rerouted, but Highland received only 18%.

Cost $67,240 · Delivery 750 · Fairness 18.2%
```

## 画面

- 一画面にSupplier、Route、4地域を配置する
- 箱がRoute上を移動する
- 最悪のScenarioだけを自動再生する
- 他の6 Scenarioは小さな結果一覧だけにする
- `Replay`と`Improve strategy`を表示する

## 実装

1. ✅ Evaluatorから購入、喪失、再購入、地域配送のTraceを返す
2. ✅ Traceを供給網イラスト上の荷物とRouteへ接続する
3. ✅ 約15秒のAuto Replayを作る
4. ✅ 最後に3つの評価値と前回との差を表示する

## 完了条件

- 文字を読まなくても、配置→障害→再配送→結果が分かる
- 表示された箱数と費用がEvaluator結果と一致する
- 15秒以内に結果へ到達する
- 既存のSubmission、Reward、Classic版を壊さない

3D、ゲームエンジン、全Scenarioの動画化は行わない。

## 検証結果

- Worst Scenarioを自動選択し、15秒以内に初期配置→障害→再配送→結果へ到達
- `Replay`、Scenario切替、`Improve strategy`が動作
- 表示値はEvaluatorの`replayTrace`から取得し、East Port shutdownでは520 kits lost、270 kits rerouted、$18,000 recoveryを表示
- TypeScript tests: 79 passed
- Lint、workspace typecheck、Next.js production build: passed

---

# Plan 7 Extension — Rules, Strategy, and Agent Competition Clarity

**Status:** P0 implemented and locally verified on 2026-09-09. P1 and P2 remain planned.

## 解決する問題

現在の画面は、物資が移動した結果と報酬は見せられるが、参加者が次を理解しにくい。

- 何を達成すればよいのか
- 各パラメータがシミュレーションへどう影響するのか
- 前回の戦略から何が改善または悪化したのか
- なぜ特定のValue Poolから報酬を得たのか
- 人間またはAI Agentが何を工夫して競うのか

そのため、現状では「パラメータを適当に動かしたら、なぜか勝って報酬を得た」という体験になりやすい。

## 目標体験

参加者がFinal Entryを選ぶ前に、次の5点を自分の言葉で説明できる状態にする。

1. 72時間、7つの災害Scenario、72,000 USDという共通条件
2. Cost、Worst Delivery、Worst-region Coverageを別々に測る理由
3. 自分がどのValue Poolを狙い、どのtrade-offを選んだか
4. 変更したパラメータが、購入、喪失、復旧、地域配送へ与えた影響
5. 報酬額がどの公開ルールと比較対象から計算されたか

## 画面で必ず教えるルール

### シミュレーションの流れ

```text
72,000 USDを初期購入と緊急予算へ分ける
  → Primary orderで通常物資を購入する
  → Backup orderで予備物資を購入する
  → RouteまたはSupplierが停止し、未到着物資を失う
  → 残した緊急予算で利用可能なSupplierから再購入する
  → Region policyに従って期限内に4地域へ配送する
  → 7 Scenarioの最悪値から3つのOutcomeを確定する
```

### パラメータの意味

| Parameter | 決めること | 主なtrade-off |
| --- | --- | --- |
| Primary buying order | 災害前にどのSupplierから先に買うか | 単価、容量、到着時間、Route集中 |
| Backup & recovery priority | 予備購入と災害後の再購入順 | 安価な復旧と高速な復旧 |
| Reserve kits | 1,000 kitsのうち予備経路から事前購入する量 | 通常調達と経路分散 |
| Emergency budget | 72,000 USDのうち災害後まで残す金額 | 初期物資と復旧余力 |
| Region policy | 到着物資をどの地域へ先に配るか | 締切、総配送量、地域間の公平性 |

### 勝敗と報酬

- Correctnessは必須条件であり、Scoreの一部にはしない。
- Cost、Worst Delivery、Worst-region Coverageを一つの総合Scoreへ統合しない。
- Global Relief、Donor Efficiency、Local Communities、Frontier Expansionは別々の公開ルールで配分する。
- 「総合優勝」ではなく、複数の戦略が異なる理由で同時に報酬を得られる。
- Frontier Expansion Poolは、正のExclusive Frontier Contributionを持つFinal EntryへPool予算を比例配分する。

## 実装すること

### P0 — 操作前にルールを理解できるようにする

- [x] Strategy Builderの直前に、常時表示する`Rules in 30 seconds`を追加する。
- [x] Mission、共通条件、3 Metrics、Correctness Gate、4 Value Poolsを一画面にまとめる。
- [x] 「総合Scoreも総合優勝もない」ことを、操作開始前に明示する。
- [x] 3つのReference Strategyが何を優先し、何を犠牲にしているかを比較表示する。
- [x] 専門用語の詳細とHashは`Verify evidence`へ分離し、最初の説明を妨げないようにする。

### P0 — 各操作の因果関係を見せる

- [x] 各Parameterの横に「この値が購入・喪失・復旧・配送のどこへ効くか」を表示する。
- [x] Emergency budgetの変更時に、Initial budgetとの合計が常に72,000 USDであることを表示する。
- [x] Supplierの単価、容量、Route、到着時間を、並べ替え中にも比較できるようにする。
- [x] Parameter変更後のLive Forecastへ、増減値だけでなく原因を示す短い説明を追加する。
- [x] ランダム操作を促す曖昧な文言を減らし、変更前に予想できる説明へ置き換える。

### P0 — 実行後に「なぜ」を説明する

- [x] 保存済みRevisionのStrategyとOutcomeから、前Revisionとの差分をParameter単位で導出して並べて表示する。
- [x] `変更 → 購入の変化 → 障害時の損失 → 復旧 → Outcome`のDecision Traceを表示する。
- [x] 最悪Scenarioについて、配送できなかった主因を最大3件まで決定論的に表示する。
- [x] Cost、Worst Delivery、Worst-region Coverageの各値が、7 Scenarioのどこから決まったかを表示する。
- [x] 次の試行候補を、単一の正解ではなくtrade-off付きで提示する。

説明例：

```text
Emergency budgetを7,000 USD増やしたため、初期購入は減りました。
East Port停止後はAirbridgeから85 kitsを追加購入できました。
前回比: Cost +5,900 USD / Worst Delivery +70 / Worst Region +4.2pt
```

### P0 — 報酬理由を説明する

- [x] `Why this strategy received support`パネルを追加する。
- [x] Value Pool名、公開ルール、Pool予算、対象になったEvidence値、比較対象を表示する。
- [x] Frontier報酬では、Exclusive Contribution、全正Contribution合計、比例配分式、端数処理を表示する。
- [x] FDT獲得表示には、「総合優勝ではなく、公開ルールに合うtrade-offを追加したため」と理由を併記する。
- [x] Measurement Resultsの人間向け数値を先に表示し、`resultHash`は検証用情報として後段へ置く。

### P1 — 学習用Missionを追加する

- [ ] 初回利用時に、狙う価値を`低コスト`、`災害耐性`、`地域公平性`、`Frontier探索`から選べるようにする。
- [ ] 選択は案内だけに使い、EvaluatorやValue Poolへ隠れた重みを追加しない。
- [ ] `Budget Sprintより安くする`、`Route停止後も800 kits以上届ける`、`全地域50%以上を目指す`などのPractice Missionを用意する。
- [ ] Mission達成は学習用表示に限定し、FDTまたはValue Pool配分と混同しない。

### P1 — AI Agentが公平に参加できる入口を作る

- [ ] Strategy v2 Schema、Evaluator version、Training Scenario、Metric、ConstraintをMachine-readableに配布する。
- [ ] Starter Kitへ、評価APIの利用例、Baseline Agent、再現コマンドを追加する。
- [ ] Human UIとAI Agent APIが同じEvaluatorとContextを使用することをテストする。
- [ ] Practice APIの呼び出し上限とFinal Entry数を全参加者で揃える。
- [ ] Agent名、version、戦略の狙い、生成したStrategy JSON、Revision履歴をEvidenceとして保存する。
- [ ] 試行回数や説明文の長さ自体には報酬を与えず、測定されたOutcomeだけを配分根拠にする。

### P2 — 本番Agent Tournamentへ発展させる

- [ ] 静的なStrategy JSONに加え、災害発生後に判断するPolicy Artifactを設計する。
- [ ] 任意Participant Codeを受け入れる前に、隔離実行、CPU・時間・メモリ制限を実装する。
- [ ] 公開Training Scenarioと、Deadline後に開示するHidden Final Scenarioを分離する。
- [ ] Deadline、Final Entry Lock、参加者一意性、複数Runner Attestationを実装する。
- [ ] これらが揃うまでは、現在のInstant DemoをProduction TournamentまたはHidden Finalと表現しない。

## APIとデータ

- [ ] Evaluation responseへ、前Revisionとの`strategyDiff`と`outcomeDiff`を追加する。
- [ ] Scenario outcomeから導出できる決定論的な`explanation`を追加する。
- [ ] Leaderboard entryへ、各Poolの`qualificationReason`と`allocationFormula`を追加する。
- [ ] 説明文の根拠となる数値は必ずEvaluator結果から生成し、LLMだけに計算させない。
- [ ] Result Hash互換性を維持する。表示専用DerivativeをHash対象から外す場合はArena仕様へ明記する。
- [ ] OpenAPI、Arena仕様、PRODUCT、DEMO、STATUSを実装境界に合わせて更新する。

## 完了条件

- 初見の利用者が操作前に、共通条件、3 Metrics、4 Value Poolsを説明できる。
- すべてのParameterについて、何に効き、何を犠牲にし得るかが画面内で分かる。
- Simulation後、少なくとも1つのParameter変更とOutcome変化の因果関係が表示される。
- Final Entry選択後、各獲得Poolについて「なぜ対象になったか」と計算内訳を確認できる。
- 「勝った」という表現に頼らず、どの価値へどのEvidenceで貢献したかを理解できる。
- HumanとAI Agentの提出が、同一Context、同一制約、同一Evaluatorで比較される。
- DesktopとMobileでRules、Decision Trace、Reward Explanationを確認できる。
- Keyboard操作、Focus表示、Status読み上げ、Reduced Motionに対応する。
- Deterministic tests、API tests、typecheck、lint、production build、browser console checkが通る。

## 今回やらないこと

- 努力量やRevision回数そのものへの報酬
- Metricsを一つにまとめる隠れたWeighted Score
- LLMの自由文だけを根拠にした判定または配分
- 隔離実行なしの任意Agent Code受付
- Mainnet Tokenまたは金銭的価値の主張

## P0検証結果

- Deterministic explanation tests: 3 passed
- TypeScript tests: 83 passed
- Web typecheck、targeted ESLint、Prettier、Next.js production build: passed
- Desktop 1440pxとMobile 390pxでRules、Builder、responsive layoutを確認
- Headless ChromeでNext.js error overlay、Uncaught exception、TypeError、ReferenceErrorがないことを確認
