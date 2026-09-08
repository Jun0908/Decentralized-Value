# Frontier Protocol Plan 5 — Emergency Supply Competition

更新日: 2026-09-08  
状態: Production接続済み・E2Eリハーサル待ち
対象: Privy認証、Emergency Supplyの参加・提出・評価・報酬

## 1. Plan 5のゴール

現在の公開サイトは、評価器を試せるDemoではあるが、ユーザーがCompetitionへ参加した体験にはなっていない。

Plan 5では、Emergency Supplyを一つの完成したCompetitionとして実装する。

```text
GoogleまたはEmailでログイン
  → Embedded Walletを取得
  → Challengeのルールを読む
  → Starter Kitを取得
  → Solutionを作る
  → submission.jsonを提出
  → 正しさと2つの評価軸を測定
  → 自分のSolutionがFrontierへ追加される
  → Final Entryを決める
  → Contributionに応じたDemo Rewardを受け取る
  → Sepolia Transactionを確認する
```

完成条件は、初めて訪れたユーザーが、自分のAccount、自分の提出物、自分の評価結果、自分のWalletへの支払いを一つの流れとして体験できること。

## 2. 現在とPlan 5後の違い

| 項目 | 現在 | Plan 5後 |
| --- | --- | --- |
| Account | 検出されたWalletを接続済みと表示 | PrivyでGoogle・Email・Wallet認証 |
| Wallet | Browser Walletの接続だけ | AccountごとのEmbedded Wallet、外部Wallet Link |
| Challenge | 説明と入力フォーム | ルール、賞金、締切、参加人数を持つCompetition |
| 作るもの | 画面で5つの数字を変更 | Starter Kitを使って提出ファイルを作成 |
| 提出 | Evaluateボタンのみ | Revisionを持つSubmissionとして保存 |
| 評価 | 一回の計算結果 | Correctness、2軸、Evidence、Frontier順位を記録 |
| 他参加者 | Agent Replayだけ | Seed Agentと実ユーザーを含むLeaderboard |
| Final Entry | なし | 複数Revisionから一つを選択 |
| Reward | 過去の支払い証拠 | ログイン中ユーザーのWalletへ新しいDemo Reward |
| 保存 | 一部がprocess-local | 再読込後も参加・提出・結果・支払いを復元 |

## 3. Productの中心体験

### 3.1 Competition Lobby

Emergency Supplyの入口で最初に表示するもの:

- Challenge名と一文のMission
- `OPEN / CLOSED / SETTLED`
- Demo Reward Pool
- 締切またはDemo Roundの残り時間
- 参加人数とSubmission数
- CostとWorst-case Deliveryの2軸
- `Join challenge` ボタン
- `Rules`、`Data`、`Evaluation`、`Leaderboard`

主CTAは`Evaluate allocation`ではなく`Join Emergency Supply`とする。

### 3.2 Rules

ユーザーが提出前に理解できる形で次を公開する。

- 1,000 kitsを5 suppliersへ割り当てる
- すべて非負の整数
- Supplier capacityを超えない
- 合計は必ず1,000
- Total procurement costは小さいほどよい
- Worst-case delivered kitsは大きいほどよい
- 5 supplier failureと4 route failureをすべて評価する
- Correctnessに失敗したSubmissionはFrontierへ入らない
- 一つのweighted scoreは使わない
- Frontier contributionに応じてRewardを配分する

評価Context、Vendor Data、Evaluator Version、Reward計算方法も同じ画面から確認できるようにする。

### 3.3 Starter Kit

KaggleのDatasetとSample Submissionに相当するStarter Kitを用意する。

```text
emergency-supply-starter/
  challenge-manifest.json
  vendors.json
  failure-scenarios.json
  sample_submission.json
  README.md
```

P0の提出物は`submission.json`とする。

```json
{
  "allocations": {
    "harbor-aid": 300,
    "northstar": 150,
    "inland-works": 300,
    "local-grid": 150,
    "airbridge": 100
  }
}
```

これはKaggleのCSV提出と同じ考え方である。ユーザーはPython、Notebook、AI Agent、手計算など好きな方法でSolutionを作り、最終成果物だけを共通形式で提出する。

GitHub URLとCommit SHAは任意のProvenanceとして追加できる。任意コードをRunnerで実行する機能は、同じSubmission interfaceを維持したまま後から追加できる設計にする。

### 3.4 Build and Submit

参加後のWorkspaceに次を置く。

- Starter Kit Download
- Browser上のJSON Editor
- `submission.json` Upload
- 5 supplierのVisual Editor
- Optional GitHub Repository / Commit SHA
- `Validate locally`
- `Submit for evaluation`
- Revision履歴

Visual Editor、JSON Editor、Uploadはすべて同じ`EmergencySupplySubmissionV1`へ変換する。

画面で数字を変えるだけの場合でも、Submit時にはSubmission ID、Revision、Input Hash、Source Hashを持つ正式な提出として保存する。

### 3.5 Evaluation

Submit後に次の状態を実データに合わせて表示する。

```text
UPLOADED
  → VALIDATING
  → CORRECTNESS PASSED / FAILED
  → 9 FAILURE CASES MEASURED
  → FRONTIER CALCULATED
  → RESULT COMMITTED
```

人工的な待機Animationは入れない。同期評価ですぐ終わる場合でも、実際に完了したStepと結果を順番に表示する。

評価結果:

- Correctness
- Total Procurement Cost
- Worst-case Delivered Kits
- 9 Failure Outcomes
- Context Hash
- Input Hash
- Result Hash
- Pareto Frontier Status
- Dominatedの場合は、どのSubmissionに負けているか
- Exclusive Frontier Contribution
- Estimated Demo Reward

### 3.6 Frontier Leaderboard

単一順位ではなく、FrontierそのものをLeaderboardにする。

- X軸: Total Cost / lower is better
- Y軸: Worst-case Delivery / higher is better
- Seed Agent A、B、C
- ログイン中ユーザーのSubmission
- Frontier上のSubmissionを強調
- Dominated Submissionを薄く表示
- 各SubmissionのContributionとReward Preview
- 最近のSubmission Activity

ユーザーが新しいRevisionを提出すると、同じChart上で古いRevisionと新しいRevisionを比較できるようにする。

Prediction Marketのような動きを出すため、Reward Pool、残り時間、参加者、最近の提出、Frontier更新を同じCompetition画面に表示する。ただし、売買や賭けを追加するのではなく、Competitionの変化をリアルタイムに感じられる表現にする。

### 3.7 Final Entry

ユーザーはRevision履歴から一つを`Final Entry`に選ぶ。

- Final Entryは本人のSubmissionだけ選択可能
- RoundがOpenの間は変更可能
- Settlement開始後は固定
- UIに現在のFinal Entryを明示
- Final Entryが無い場合はReward対象外

Demo Roundでは、Judgeが待たずに体験できるよう`Finalize demo entry`を用意する。Production TournamentのDeadline処理とは状態を分ける。

## 4. WalletとPrivy

### 4.1 正しいログイン体験

Privyの入口は次の3つとする。

1. Google
2. Email
3. Existing Wallet

GoogleまたはEmailで初回ログインしたユーザーにはEmbedded Walletを作成する。MetaMaskなどの外部Walletは最初から必須にせず、必要ならAccountへLinkできる。

```text
Sign in with Google / Email
  → Privy authenticated user
  → Embedded Wallet created
  → Participant profile created
  → Emergency Supplyへ参加
```

### 4.2 接続済み判定

HeaderのAccount表示は`wallets.length`ではなく、Privyの`authenticated`状態を基準にする。

- Browser extensionが存在するだけではログイン済みにしない
- 前回の有効なPrivy Sessionがある場合だけSessionを復元する
- 復元中は`Restoring session...`と表示する
- ログイン後はEmailまたはGoogle名、短縮Wallet Addressを表示する
- LogoutとWallet Linkを提供する

### 4.3 Backend認証

Frontendから保護APIへPrivy Access Tokenを送る。BackendはTokenを検証し、次をServer側で確定する。

- Privy User ID
- Linked Email / Google Account
- Reward受取Wallet
- Challenge Participant ID

Clientから送られたWallet Addressだけを信用してParticipantやReward Recipientを作らない。

### 4.4 Walletを使う場所

Walletは飾りではなく、次の役割を持つ。

- Competition Participantの公開Recipient Address
- Final EntryとAccountの紐付け
- Demo Tokenの受取
- Reward claimまたは受取結果の確認

最初のDemoではRelayerがSepolia Gasを負担し、ユーザーへSepolia ETHを要求しない。RewardはユーザーのEmbedded Walletまたは選択したLinked Walletへ送る。

## 5. Durable Data

既存の`CompetitionSandboxStore` interfaceを活かし、永続Store Adapterを追加する。利用するDatabase Providerは交換可能にし、Domain Modelを特定サービスへ結合しない。

最低限保存するデータ:

### users

- Privy User ID
- Display Name
- Email Hashまたは必要最小限のProfile
- Created At

### wallets

- User ID
- Wallet Address
- Wallet Type: embedded / external
- Reward Recipient選択

### challenge_participants

- Participant ID
- Challenge ID
- User ID
- Wallet Address
- Joined At

### submissions

- Submission ID
- Participant ID
- Revision
- Artifact JSON
- Input Hash
- Source Hash
- GitHub URL / Commit SHA
- Submitted At

### evaluations

- Submission ID
- Correctness
- Metrics
- Failure Evidence
- Context Hash
- Result Hash
- Frontier Status
- Contribution

### final_entries

- Participant ID
- Challenge ID
- Submission ID
- Selected At
- Frozen At

### rewards

- Challenge ID
- Participant ID
- Recipient
- Amount
- Allocation Root
- Transaction Hash
- Status

再読込、Server restart、Vercel cold start後も同じ状態を復元できることを完了条件にする。

## 6. API

### Public

```text
GET /v1/challenges/emergency-supply
GET /v1/challenges/emergency-supply/starter-kit
GET /v1/challenges/emergency-supply/leaderboard
GET /v1/challenges/emergency-supply/activity
```

### Authenticated

```text
GET  /v1/me
POST /v1/challenges/emergency-supply/join
POST /v1/challenges/emergency-supply/submissions
GET  /v1/challenges/emergency-supply/submissions/mine
PUT  /v1/challenges/emergency-supply/final-entry
POST /v1/challenges/emergency-supply/demo-settlement
GET  /v1/challenges/emergency-supply/reward/mine
```

Submission APIはVisual Editor、JSON Upload、将来のSDKから同じSchemaを受け取る。

同じRequestの再送でSubmissionやRewardが二重作成されないようIdempotency Keyを使用する。

## 7. Sepolia Reward

### 7.1 Demo Round

Judgeが一回のDemoで確認できる専用Roundを用意する。

1. Seed Agent A、B、Cを登録
2. ユーザーがSolutionを提出
3. Final Entryを確定
4. Complete SetでFrontierとContributionを再計算
5. Result RootとAllocationを生成
6. `FrontierRewardPool.commitAllocation`
7. Relayerが`distribute`、またはユーザーが`claim`
8. User WalletのFDT残高増加を表示
9. 新しいEtherscan Transactionを表示

Default Sample SubmissionはFrontierに入る例にする。別のStrategyを提出してDominatedになった場合はReward 0と理由を表示し、架空の支払いは行わない。

### 7.2 Contract側で確認すること

- Challenge IDとDemo Round IDが一意
- 同じAllocationを二重Commitできない
- 同じRecipientへ二重支払いできない
- Pool残高を超えるAllocationを拒否
- Result Root、Recipient、AmountがDatabaseの最終結果と一致
- Transaction成功後だけUIを`PAID`にする

### 7.3 Demo UX

```text
Reward allocated: 1,240 FDT
  → Sending on Sepolia
  → RewardPaid confirmed
  → Wallet balance +1,240 FDT
  → View on Etherscan
```

Sepolia Demo Tokenに金銭的価値がないことは短く明示する。

## 8. 画面構成

### `/`

- 主CTAを`Enter the live Emergency Supply challenge`へ変更
- Emergency Supplyを開催中Competitionとして表示
- CalldataとMicrogridは`Protocol examples`または`Coming next`へ下げる

### `/arenas/emergency-supply`

- Competition Header
- Reward Pool / Deadline / Participants / Submissions
- Mission
- Rules / Data / Evaluation / Leaderboard
- Join CTA

### `/arenas/emergency-supply/submit`

- Starter Kit
- Visual Editor
- JSON Editor / Upload
- Validate
- Submit
- Evaluation Result
- Revision History
- Final Entry

### `/arenas/emergency-supply/leaderboard`

- Frontier Chart
- Submission Table
- Contribution
- Reward Preview
- Recent Activity

### `/account`

- Privy Profile
- Embedded / Linked Wallet
- Joined Challenges
- Submission History
- Reward History

## 9. 実装対象

### Frontend

- Privy ProviderをGoogle・Email・Wallet対応へ変更
- `authenticated`を使ったSession UI
- Account MenuとLogout
- Emergency Supply Competition Lobby
- Starter Kit Download
- Submission Workspace
- Evaluation ProgressとResult
- Frontier Leaderboard
- Final Entry選択
- Reward StatusとEtherscan Link

### API

- Privy Access Token検証
- User / Wallet binding
- Join、Submission、Final Entry、Leaderboard API
- Existing Emergency Supply Evaluatorとの接続
- Durable Store Adapter
- Settlement Orchestrator
- Idempotencyと二重Reward防止

### Contract / Settlement

- Plan 5用Sepolia Demo Roundの作成
- Reward Pool funding
- Allocation Root生成
- `commitAllocation`と`distribute`または`claim`
- Receipt、Event、Balance確認

### Documentation

- Emergency Supply Rules
- Starter Kit README
- Demo手順
- Trust Boundary
- 現在動いている範囲とProduction Tournamentとの差

## 10. 実装順序

### Milestone 1 — Account

- [ ] PrivyにGoogle・Email・Walletを表示（Email・Walletは有効、GoogleはPrivy Dashboard側の有効化待ち）
- [x] Email / Google UserへEmbedded Walletを作成
- [x] 検出Walletと認証済みUserを区別
- [x] HeaderへUserとWalletを表示
- [x] LogoutとSession復元
- [x] BackendでPrivy Tokenを検証

### Milestone 2 — Join and Persist

- [x] Emergency SupplyをOpen Competitionとして表示
- [x] UserがChallengeへJoin
- [x] ParticipantをDurable Storeへ保存
- [x] 再読込後に参加状態を復元するAPI/UI
- [x] Reward Recipient Walletを固定

### Milestone 3 — Build and Submit

- [x] Starter KitをDownload可能にする
- [x] Visual / JSON / Uploadを共通Schemaへ変換
- [x] Submission IDとRevisionを発行
- [x] Evaluationを実行して保存
- [x] Invalid Submissionの理由を表示
- [x] Revision履歴を表示

### Milestone 4 — Frontier Competition

- [x] Seed AgentとUser Submissionを同じEvaluatorで測定
- [x] Frontier Leaderboardを表示
- [x] Dominated理由を表示
- [x] ContributionとReward Previewを表示
- [x] New RevisionによるFrontier変化を表示
- [x] Final Entryを選択・保存

### Milestone 5 — Live Reward

- [x] Plan 5用Sepolia Reward Poolを準備
- [x] Final Result RootとAllocationを生成するAdapter
- [x] User WalletへDemo Tokenを支払うAdapter
- [x] Transaction Confirmationを待つ
- [x] RewardPaid Transactionと残高増加を表示
- [x] 二重Settlementを拒否
- [x] Etherscanから第三者が確認できるリンク

### Milestone 6 — Judge Demo

- [x] 初回訪問から支払いまで一つの導線を実装
- [x] Default Submissionで3分以内に完走できるUI
- [x] Dominated Submissionも説明可能
- [x] DesktopとMobile向けResponsive UIを実装
- [x] Local DesktopでConsole errorが0件
- [x] NetworkまたはRPC失敗時に正しいRecoveryを表示

## 11. Test

### Authentication

- Google / Email / Walletの各Login
- 未認証API拒否
- 不正Privy Token拒否
- 別UserのSubmission参照・変更拒否
- Browser Walletを検出しただけではログイン済みにならない

### Submission

- 合計1,000以外を拒否
- 負数、小数、未知Supplier、Capacity超過を拒否
- 同一入力は同一Result Hash
- 異なる入力は異なるInput / Result Hash
- Revision上限とIdempotency

### Frontier

- Submission順に依存しない
- Dominated EntryのContributionは0
- Seed AgentとUserを同じContextで比較
- Contextが異なるResultを混ぜない

### Settlement

- Allocation RootとDatabase結果が一致
- Pool不足を拒否
- 二重Commit、二重支払いを拒否
- Transaction失敗時は`PAID`にしない
- Etherscan Transaction、Event、Recipient残高が一致

## 12. Definition of Done

次を公開Productionで連続3回成功させる。

1. 新しいBrowser SessionでGoogleまたはEmail Loginができる
2. Embedded Walletが表示される
3. Emergency SupplyへJoinできる
4. Starter Kitを取得できる
5. `submission.json`を編集またはUploadできる
6. Submissionが保存される
7. Correctnessと9 Failure Casesが実測される
8. 自分の点がFrontier Chartへ追加される
9. Revisionを作りFinal Entryを選べる
10. Contributionに応じたRewardが計算される
11. 自分のWalletへSepolia Demo Tokenが届く
12. 新しいTransactionをEtherscanで確認できる
13. 再読込後もAccount、Submission、Result、Rewardが残る

この13項目を満たした時点で、Emergency Supplyを「実際に参加できるCompetition」と表現できる。

## 13. Plan 5後に残る拡張

Plan 5の設計をそのまま使い、後から次を追加できる。

- Python / TypeScript Strategy Runner
- Hidden Final Dataset
- Scheduled Deadline Settlement
- World IDなどの参加者重複防止
- SponsorによるChallenge作成
- Calldata Compression Competition
- Microgrid Dispatch Competition
- 複数Runner AttestationとDispute

Plan 5では、これらのためにEmergency SupplyのGolden Pathを遅らせず、まず一人のユーザーが作成・提出・評価・受取まで完走できる状態を完成させる。
