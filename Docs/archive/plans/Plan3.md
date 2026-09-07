# Frontier Protocol Plan 3 — Practice Arena から Frontier Market へ

更新日: 2026-09-07  
参照: `Docs/frontend-whitepaper-gap.md`、`Docs/Value_Decentralization_Whitepaper_JP.pdf`、`Plan2.md`

## 1. Plan 3 の目的

現在の2つのArenaは、ユーザー入力を同じ条件で実測し、正しさを確認してPareto Frontierと比較できる。この部分は維持する。

次に必要なのは、White Paperのすべてを一度に画面へ足すことではない。まず以下の因果関係を、1本の実動フローとして成立させる。

```text
Sponsorが解決したいValue Tensionを公開する
  → BuilderがArtifactを提出する
  → 同じContext・Evidence Levelで測定する
  → Frontierをどれだけ拡張したか計算する
  → 拡張への報酬配分を説明できる
  → AttestationとSettlementで結果を確定する
```

Plan 3の到達点は、単なる「Paretoグラフ付き練習サイト」ではなく、**可能領域を広げた貢献へ資金を配る仕組み**がユーザーに伝わり、少なくとも1つのChallengeで端から端まで検証できる状態とする。

## 2. 差分分析に対する判断

### 今すぐ埋める差分

1. Frontier Contributionが計算・表示されていない
2. Sponsor、Reward Pool、期間、評価条件がChallengeとして表現されていない
3. ContextとEvidence Levelが比較条件として扱われていない
4. White Paperの用語とポジショニングがユーザー導線から見えない
5. 「新しいArenaを追加しやすい」という説明が、評価器の実装まで自動生成されるように読める

### Plan 2の後半として実装する差分

- World IDまたは代替IdentityによるParticipantの一意性
- 複数Revisionと1 Participant・1 Final Entry
- 非公開Final Workload
- 複数Runner Attestation
- Challenger、Dispute、Bond、Slashing
- Sepolia上のReward Poolと最終Settlement

### 今回のCritical Pathから外すもの

- 9ロールすべての専用画面
- 6つのSocial Frontierを同時に追加すること
- Mainnetで価値を持つToken
- Ledger実機を必須にすること
- ENSv2やBazanticをプロダクト成立の必須条件にすること
- 3軸以上を同時表示する高度な3Dチャート

機能が無い状態を表示だけで補わない。署名、複数Runner、Token送金、Evidence Levelなどは、実データが存在する場合だけ成立済みとして表示する。

## 3. 実装順序

### Phase 0 — 現在の主張を正確にする

- [x] Arena一覧の「Registryから生成される」という説明を修正する
  - 表示メタデータと静的URLはRegistryから生成される
  - 新しい問題形式にはEvaluator Adapterの実装が必要
- [x] TopへWhite Paperの中心メッセージを短く追加する
  - Prediction Marketは「何が真実か」に資金を払う
  - Frontier Marketは「何が可能かを広げること」に資金を払う
- [x] `/glossary` を追加し、Value Tension、Hard Constraint、Artifact、Context、Outcome Vector、Pareto Frontier、Frontier Contribution、Evidence Levelを高校生でも分かる文章で説明する
- [x] Practice、Open、Final Evaluation、Settledを明確に区別し、未実装状態をOpenやFundedと表示できない型にする

完了条件:

- UIの説明と実装の範囲が一致する
- 初見ユーザーが「普通のランキング」「Kaggle」「Prediction Market」との違いを説明できる

### Phase 1 — Frontier Contributionを実測する

最優先。まず2軸で正しく実装し、その後n軸へ一般化する。

### 1.1 MetricとContextの計算仕様

- [x] Metricごとに `direction`、`unit`、`lowerBound`、`upperBound` をChallenge Manifestで宣言する
- [x] 値を0〜1へ正規化する共通関数を `packages/shared` に実装する
- [x] 範囲外、同値、ゼロ幅、Minimize / Maximize混在時の規則を固定する
- [x] Hypervolumeのreference pointをManifestに固定し、結果を見てから変更できないようにする
- [x] Contributionの意味を2種類に分ける
  - `frontierExpansion`: Candidate追加前後のHypervolume増分
  - `exclusiveContribution`: 最終FrontierからCandidateを除いたときに失われるHypervolume
- [x] Baseline Artifactは比較には使うが報酬対象外として識別する

### 1.2 計算実装

- [x] 汎用Outcome Vector型とPareto判定を `packages/shared` に追加する
- [x] 2次元HypervolumeとContributionを整数または固定精度で決定論的に計算する
- [x] 入力順に依存しないことをテストする
- [x] SupplyとCalldataの既存結果へContributionを追加する
- [x] 同じArtifact、Context、Manifestから同じresult hashが得られるテストを追加する
- [x] 境界値、同一点、支配点、非支配点、不正Artifactのfixtureを追加する

### 1.3 UIのWOW Moment

- [x] 評価前Frontierと評価後Frontierを同じグラフで表示する
- [x] Candidateが新しく作った領域を色付きで表示する
- [x] `Frontier / Dominated` の二値だけでなく、拡張量とContribution比率を表示する
- [x] 「この解がなければ失われる領域」を平易な言葉で説明する
- [x] PracticeではRewardを送金せず、Manifestの仮想Poolを使った `Reward preview` と明記する

完了条件:

- Emergency Supplyの入力を変えると、費用・最悪時配送数・Frontier判定・拡張量がAPIで再計算される
- Calldata Compressionでも同一計算規則が使われる
- 手計算fixtureと実装結果が一致する
- DominatedまたはCorrectness失敗のArtifactのContributionは0になる

### Phase 2 — Challenge ManifestとSponsor体験を作る

Sponsor画面を先に飾るのではなく、評価器とUIの両方が読む不変のManifestを先に作る。

### 2.1 Challenge Manifest v2

- [x] `ChallengeManifestV2` を `packages/shared` に定義する
- [x] 以下をManifestの必須項目にする
  - Sponsor名・Wallet・説明
  - Value Tension
  - Artifact Typeと提出方法
  - Hard Constraints
  - n個のMetricと方向・単位・正規化範囲
  - Context一覧とversion
  - Evidence Level
  - Public / Final Workload commitment
  - Submission期間・Review期間
  - Reward Token、Pool、配分規則
  - Source visibility
- [x] Manifestをcanonical JSONへ変換し、`manifestHash` を生成する
- [x] Challenge開始後に変更できる項目と変更禁止項目を分ける
- [x] SupplyとCalldataをManifest v2へ移行する

### 2.2 Challenge詳細画面

- [x] `/challenges/[id]` にSponsor、期間、Pool、参加条件、Value Tension、Context、Evidence Levelを表示する
- [x] Challenge → Artifact → Evaluation → Attestation → Frontier → Settlementの6段を状態付きで表示する
- [x] Practice ArenaとFunded Marketを同じ見た目で混同しない
- [x] 未資金、未署名、未確定はそれぞれ明示する

### 2.3 Sponsor Console

- [x] SponsorがManifestを入力・Previewできる画面を作る
- [ ] Metric範囲とreference pointがContributionへ与える影響をPreviewする
- [ ] 危険な設定を検証する
  - Metric範囲が不正
  - Hard Constraintが空
  - Final Workload commitmentが無い
  - Reward総額と配分合計が不一致
- [x] Durable StorageとWallet署名が無い間は `Draft preview` に限定する
- [x] 実際に保存・署名・資金供給できるまで `Published` / `Funded` と表示しない

完了条件:

- 2つのArenaが個別ハードコードではなくManifestを通して共通Challenge UIへ表示される
- Sponsorが何に資金を出し、Builderが何を改善すべきか一画面で分かる
- Challenge開始後に評価範囲を都合よく変更できない

### Phase 3 — ContextとEvidence Levelを第一級オブジェクトにする

### 3.1 Context

- [x] Contextを `id`、`version`、説明、dataset hash、constraint hash、metric設定で管理する
- [x] 各Arenaへ最低2つの実データContextを用意する
  - Supply例: 通常輸送 / 港湾障害が多い条件
  - Calldata例: address重複が多いbatch / 重複が少ないbatch
- [x] Context Selectorを追加する
- [x] Frontier、Contribution、result hashをContextごとに完全分離する
- [x] 異なるContextの結果を同じFrontierで比較できないAPI検証を追加する

### 3.2 Evidence Level

- [x] Evidence Level 0〜4のschema、名称、必要Evidenceを定義する
- [x] 現在の2つのArenaをLevel 0として明示する
- [x] 同一Context・同一Evidence Level内だけでFrontier比較する
- [ ] Level badgeをArena、Challenge、Result、Artifactに表示する
- [x] Levelが上がるために不足しているEvidenceを表示する
- [ ] 実証されていないLevelをユーザー操作だけで選択できないようにする

完了条件:

- Contextを変えると入力データ、Frontier、Contributionが実際に変わる
- Level 0の結果がLevel 1以上として誤表示されない
- ContextまたはEvidence Levelが異なる結果は互いを支配しない

### Phase 4 — Arena追加を本当に拡張可能にする

### 4.1 型とAdapter

- [x] `slug` と `kind` の固定unionを廃止し、Manifest由来のstable IDへ移行する
- [x] `metrics` の2要素タプルを可変長Outcome Vectorへ変更する
- [ ] `EvaluatorAdapter` interfaceを定義する
  - input schema
  - public context loader
  - evaluator
  - evidence renderer
  - optional custom workbench
- [x] Arena固有のif分岐をAdapter Registryへ置き換える
- [x] 未知のAdapterは安全に `Unsupported evaluator` と表示する

### 4.2 n軸UI

- [x] 2軸の場合は現在の散布図を維持する
- [x] 3軸以上では任意の2軸を選べるselectorとOutcome tableを表示する
- [x] 選択中でない軸もPareto判定には含める
- [x] 軸の組み合わせを変えてもFrontier判定自体が変わらないことをテストする

### 4.3 Builder SDK

- [x] `packages/sdk` にManifest、Submission、Evaluation Evidenceの型付きclientを実装する
- [x] Challenge取得、提出準備、評価取得、hash検証をSDKから実行できるようにする
- [ ] 第三者Adapter用の最小templateと検証commandを用意する
- [x] 3つ目の小さなサンプルArenaをSDKとAdapterだけで追加し、拡張性を実証する

完了条件:

- カタログ追加だけならManifest登録のみでよい
- 新しい問題形式は共通画面を改修せずAdapter追加で実装できる
- 3軸以上でも計算と表示が破綻しない

### Phase 5 — Participant、提出、異議申立てを接続する

Plan 2のCompetition層を、上記ManifestとContributionモデルへ接続する。

- [x] Wallet接続とParticipant registration（Sandboxでは未署名のwallet-only）
- [ ] World ID / Allowlist / Wallet-onlyをChallenge単位で選べるIdentity Policy
- [x] 同一Challengeへの重複Participant登録防止
- [ ] Inline、Upload、GitHubのSource Adapter
- [x] Public、Delayed Public、PrivateのSource Policy（Privateは暗号化Storage実装まで拒否）
- [x] 複数Submission Revisionと1つのFinal Entry
- [ ] 締切後のFinal Entry freeze
- [ ] 提出履歴、評価履歴、残り回数、Final Entry選択UI
- [ ] 既存Dispute APIをManifest v2のChallengeへ接続する
- [ ] Result / Evidence画面からChallengeを開始できる導線を追加する

完了条件:

- 全員が同じ公開Contextと提出上限で繰り返し改善できる
- Final評価に使われるのは各Participantが締切前に選んだ1 Artifactだけ
- Private Sourceの内容を公開画面やログへ出さない

### Phase 6 — Attestation、Final Evaluation、Settlement

- [ ] 共通Evaluator Coreと隔離実行環境を作る
- [ ] Hidden Final Workloadをcommit-revealで管理する
- [ ] 全Final Entryを同一Context、同一versionで評価する
- [ ] 3 Runner一致または設定されたthresholdをAttestation条件にする
- [ ] Runner identity、signature、再実行結果をEvidenceへ含める
- [ ] ChallengeとDisputeの状態遷移を実装する
- [ ] Final Frontier、Contribution、Reward Allocationを確定する
- [ ] Sepolia Reward Poolからbatch送金し、失敗分はclaim可能にする
- [ ] Transaction hash、Event、Wallet残高変化をUIで確認できるようにする

完了条件:

- 全Final Entryの評価完了前にSettlementできない
- 同じAttestation、Evaluation、Payoutの二重実行を拒否する
- 最終Reward合計がPoolを超えない
- 実際のSepolia transactionが無ければ「送金済み」と表示しない

## 4. 実装済みマイルストーンと残作業

Phase 0〜1は完了し、Phase 2〜5のローカルで検証可能な縦切りも実装した。

1. `OutcomeMetric`、正規化範囲、reference pointのschema
2. 汎用Pareto判定、2D Hypervolume、Frontier Contribution
3. Supply / Calldataの両Evaluatorへの適用
4. API responseとresult hashへのContribution evidence追加
5. Before / After Frontierと拡張領域のUI
6. Reward previewは計算例として表示し、実送金ではないと明示
7. Topのポジショニング修正とGlossary
8. Arena拡張性について過剰な説明を修正
9. Unit、API、決定論、typecheck、build、browser flow test

追加実装として、2つのContextを持つSupply / Calldata、3軸Microgrid Arena、Adapter Registry、型付きSDK、提出Sandbox、決定論的Reward Allocation、Demo ERC-20とReward Poolコントラクトまで作成した。

ただし、プロダクトをまだ `Funded Frontier Market` とは呼ばない。World ID、Durable Storage、Hidden Final Workload、複数Runner Attestation、Sepoliaへの実デプロイ、送金transaction表示は外部設定または本番基盤を必要とし、未完了のチェックとして残す。Sandboxも「署名済み」「永続化済み」「一人一参加」とは表示しない。

## 5. Reward計算について先に固定するルール

White Paperの概念式をそのまま曖昧な実装にしない。

```text
eligibleWeight = normalizedExclusiveContribution
               × reproducibilityFactor
               × evidenceFactor

reward = distributablePool
       × eligibleWeight
       ÷ 全対象ArtifactのeligibleWeight合計
```

- `frontierExpansion` は評価時の分かりやすいWOW表示に使う
- 最終Rewardは提出順で有利にならない `exclusiveContribution` を使う
- Contributionが0、Correctness失敗、Baseline ArtifactはReward対象外
- Evidence Levelが違うArtifactを同じPoolで直接比較しない
- reproducibility / evidence係数の値はChallenge開始前にManifestへ固定する
- 端数処理と余りの扱いをManifestに固定する
- 対象者が0人の場合はSponsorへ返却するか次Roundへ繰り越すかを開始前に固定する

このルールはプロダクト判断を含むため、Contract実装前にtest vectorと文章仕様を確定する。

## 6. 維持する原則

- Hard Constraintを通過してからFrontier比較する
- 同じContext、version、Evidence Level以外を比較しない
- 同じ入力から同じOutcomeとresult hashを生成する
- weighted scoreで勝者を1人に潰さない
- 取得できないEvidenceを推測やfixtureで埋めない
- Practice結果、Reward preview、Sepolia settlement、本番運用を明確に区別する
- Sponsor連携は主役ではなく、「誰がどの可能領域に資金を出したか」を説明するために使う

## 7. Plan 3 全体の完了条件

- [ ] 1つ以上のChallengeに実在するSponsor設定と資金済みSepolia Poolがある
- [ ] 参加者が複数回改善し、Final Entryを1つ選択できる
- [ ] Final Workloadが締切前に秘匿され、事前commitmentと一致する
- [ ] 正しさ、Outcome Vector、Context、Evidence Level、Contributionを再計算できる
- [ ] Final FrontierとReward配分が提出順に依存しない
- [ ] Reward Tokenが対象Walletへ実際に送金される
- [ ] 送金transaction、Event、残高変化を公開画面から検証できる
- [x] 2つの既存Arenaが同じManifest / Adapter / Contribution基盤で動く
- [x] 第三者が共通UIを変更せず3つ目のArenaを追加できる
- [ ] UI上のすべての状態表示が実際のEvidenceと一致する
