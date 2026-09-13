# ETHOnline 2026 — 提出前に人間の確認・操作が必要なこと

## 最新状態 — 2026-09-13

本人から参加手続完了・スポンサー選択ENS / Chainlink / Bazanticを確認済み。ENS実認可／取消、CRE公式秘密Pack Simulation、Bazantic経由の外部AI呼出しは実証済み。GitHub Push、公開スポンサー画面、3 Evidence Downloadも確認した。[公開検証記録](../PUBLIC_VERIFICATION_2026-09-13.md)。最低Demoを動かすための再ログイン・ENS再取得・再送金は不要。

残る本人確認は、選択賞の細分類・登録Track・審査対象期間・実際の本人貢献・最終動画URL・最終応募送信。以下の9月12日の監査表にある「ログイン失敗」「未接続」は、その後解消した履歴であり、新たな操作依頼ではない。公式ルール引用は記載の確認日時のもので、今回の実装検証で再調査したものではない。

確認日: 2026-09-12（日本時間）。公式公開資料とローカル設定の読取監査。アカウント登録、名前取得、Gateway登録、送金、Push、Web公開、提出はこの監査では実行していない。

**同日再確認:** 本人から参加手続は完了済み、ENS作成済み・Bazantic設定済みとの連絡あり。CRE / BazanticのCLIログインは成功。CREは現在RPC設定不足で停止。ENS親所有者も本人提示アドレスと一致。Bazanticの404は修復し、無料HTTP / MCP評価成功・Recipe draft作成まで完了した。[最新の接続範囲](BAZANTIC_RESCUE_LIVE.md)。以下の初回監査表は過去Snapshotであり、再ログイン・再登録・Gateway URLの再提出を依頼する根拠にしない。本人は動画・提出操作の追加案内を不要と指定しているため、下記の一般チェックリストを繰り返し依頼しない。参加Trackや応募資格をAgentが独立確認したという意味ではない。

## 1. 最優先: 締切と参加資格

**最新実行更新:** CRE公式Simulation・秘密Pack Replay、ENSの実Key認可／取消、外部AIからBazantic MCPへの実評価が成功済み。[撮影手順](SPONSOR_DEMO_RECORDING.md)。この最低Demoに再ログイン・ENS再取得は不要。Hosted Recipe・live TEE・本番Finalの完了とは区別する。遠隔PCを再起動しない。

**提出締切は2026-09-14（月）01:00 JST。** 公式表記は2026-09-13（日）12:00 EDT、UTCでは同日16:00。イベント全体の終了日と提出締切を混同しない。遅延提出は受理されない。最終的な本人Dashboard・運営告知も確認する。[公式開始案内](https://ethglobal.com/events/ethonline2026/info/start)

本人にしか確定できない事項:

- [ ] ETHGlobalへの参加承認、必要な参加手続、本人のチーム所属が完了しているか。
- [ ] 登録TrackはClassic / From Scratchか、Continuity / Extend Open Source / Ship a Featureか。
- [ ] 既存コードの扱いを登録Trackと照合する。Classicではイベント開始前のプロジェクト固有コードを持ち込めず、Continuityでは既存部分と期間内の新規部分を明示する。既存RepositoryというだけでContinuity資格を自動認定しない。[公式ルール](https://ethglobal.com/events/ethonline2026/info/details)
- [ ] 審査対象の開始Commitと終了Commit、期間内の変更一覧を確定する。古い実装を今回の成果として説明しない。
- [ ] Partner Prizes OnlyかFinalist併願かを本人が選ぶ。Partner選択は最大3社なので、ENS / Bazantic / Chainlinkを選ぶ場合は他社との入替が必要になる。[公式提出要領](https://ethglobal.com/events/ethonline2026/info/details)

参加Stakeが未完了なら、金額・ネットワーク・返却条件は本人Dashboardで確認する。今回承認済みの**SepoliaテストETH予算を、参加Stakeや実価値のある資金の支出許可と解釈しない**。

## 2. 動画は人間の声が必要

公式条件は**2〜4分、720p以上**。TTS / AI Voiceover、尺に合わせるための早回し、スマートフォンによる撮影は不可。待ち時間を編集で省くことは可能。[公式動画要領](https://ethglobal.com/events/ethonline2026/info/details)

- [ ] 人間がナレーションを収録する。画面収録・台本・編集準備はAgentが支援できるが、この条件をAI音声で代用しない。
- [ ] 冒頭で「共有Evidenceに対して独立した価値判断ができる」という目的を説明する。
- [ ] Rescueの実例を見せる: Commanderの判断 → Serviceの納品 → 5 rUSD-DEMO支払い → 別注文の返金。
- [ ] Sponsor連携は実行できたものだけ、操作と結果・証拠が結び付く形で見せる。
- [ ] 役割Walletは運営管理、テストTokenに金銭価値の主張なし、未知Final大会は未完成、と短く明示する。
- [ ] ローカル画面を収録した場合はローカルDemoと表示する。公開済みWebアプリの映像と取り違えない。
- [ ] 公開動画URLまたはDashboardへアップロードできる動画ファイルを用意し、再生・音声・尺を確認する。

AI利用箇所と人間の実質的な貢献を開示する。Spec駆動で使ったPlan・仕様・Prompt類も提出対象に含める。ただし秘密鍵・APIキー・個人情報を含む生ログは公開せず、秘密部分を除いた開発資料を準備する。[公式AI利用要領](https://ethglobal.com/events/ethonline2026/info/details)

## 3. Sponsorごとの応募条件と未確認事項

賞金額はPrize Poolの総額であり、このProjectの受給額や受賞資格を意味しない。

### ENSv2

| 候補 | 確認した条件 |
| --- | --- |
| Best Use of ENSv2 — $4,500 | SepoliaのENSv2を中核機能として使用。固定文字列だけのDemoは不可。機能するDemo、動画またはLive URL、公開Sourceが必要。 |
| Best Integration of ENSv2 into an Existing Project — $500 | Continuity限定。既存ProjectのTestnetへENSv2を意味のある形で統合する。 |

出典: [公式ENS Prize](https://ethglobal.com/events/ethonline2026/prizes/ens)

最小実連携の前提・人間確認:

- [ ] 使用する親Namespaceと所有者を確認する。`ENS_PARENT_NAME`の設定値があることは、登録・所有・ENSv2対応の証明ではない。
- [ ] そのNamespaceに対する操作権限、SepoliaのRegistry / Resolver、利用Walletを読取で確定する。無関係な既存名を勝手に変更しない。
- [ ] 親OwnerとService / Evaluator更新用Walletを分離し、必要なText RecordだけのGrant → 更新 → Revokeを許可する範囲を確定する。
- [ ] 名前解決した実Recordが、Service発見・認可・実行先選択などを実際に変えることを示す。名前ラベルの表示だけでは中核的連携と説明しない。
- [ ] Grant / Update / Revokeの成功と拒否を、Snapshot Block・Record・Receiptで記録する。`eth_call`で拒否された確認を実送信Txに見せない。

Permissioned ResolverではText Key単位の権限操作を公式仕様に合わせる。具体的なRegistry / Resolverの実在と権限を確認してから実装を接続する。[ENSv2 App Guide](https://docs.ens.domains/ensv2/tutorial-app-developers/)、[Permissioned Resolver](https://docs.ens.domains/ensv2/permissioned-resolver/)

### Bazantic

| 候補 | 確認した条件 |
| --- | --- |
| Help an Agent Use Your Hackathon Project — $1,000 | Continuity限定。同じTask / Prompt / Model / Settings / API Accessで、Recipeだけを変えた比較。入力・両結果・改善・動画が必要。 |
| Best Recipe that uses EthGlobal Hackathon Sponsor APIs — $1,000 | 自Projectと、Bazantic既存Serviceまたは別SponsorのServiceを組み合わせ、結果が両方に依存する動作を示す。 |
| Agentify a new API — $1,000 | イベント開始時にBazanticにも他Sponsor APIにも存在しなかったServiceを加え、両Serviceを使う再利用可能なRecipeを実演する。 |

いずれもBazanticアカウント、実際のGateway / Recipe、提出者を照合できる登録usernameが必要。各条件の詳細は[公式Bazantic Prize](https://ethglobal.com/events/ethonline2026/prizes/bazantic)を確認する。

最小実連携の前提・人間確認:

- [ ] 使用するBazanticアカウントのusername（登録EmailまたはGitHub Handle）を本人が確認する。EmailをGitに載せる必要はなく、提出フォームの必要欄へ記載する。
- [ ] この端末の`baz whoami`と`baz gateway list --json`はログイン要求で失敗した。既存アカウントでのログイン・端末認可は本人操作待ち。新規アカウントは勝手に作らない。
- [ ] Gateway URL / Service IDは設定あり。ただし現所有者・最新の公開状態・登録API仕様・認証Scope・価格は未確認。URLを名前から組み立てない。
- [ ] 実Recipe ID / Version / 内容HashをDashboardから取得する。ローカル`bazantic/recipe.md`は公開Recipeの存在証明ではない。
- [ ] 公開Practice APIとGatewayから見えるAPI契約を一致させ、同じ経路で実Tool呼出しを通す。Operatorの支払い・Admin操作は公開しない。
- [ ] `baz curl`は402応答に自動支払いするため、この監査では使っていない。必要ならToken / Chain / 単価 / 合計上限を別途確認する。Sepolia ETHの承認をUSDC支払い許可に流用しない。
- [ ] 比較賞を選ぶなら、Recipe以外の条件を固定し、失敗・同等・悪化を含む全Runを残す。既存の総額$5のAI予算残額内で実験を設計し、30Runなどの旧計画を自動実行しない。

### Chainlink

| 候補 | 確認した条件 |
| --- | --- |
| Best Confidential Workflow — $2,000 | 意味のあるConfidential TEE Handlerが秘密入力等を処理する。公式CRE CLIでのSimulation成功またはLive実行のEvidenceを提出できる。 |
| Best Chainlink-Powered Upgrade — $500 | Continuity限定。Chainlink連携がBlockchainのState Changeに寄与する。画面でデータを表示するだけでは不足。 |
| Automated Liquidation Protection Challenge — $500 | 専用の保護Workflowと公式Challengeへの期限内参加が必要。Rescueの支払いだけで参加したことにはならない。 |

出典: [公式Chainlink Prize](https://ethglobal.com/events/ethonline2026/prizes/chainlink)

- [ ] 最初はConfidential Workflowの**公式CLI Simulation**を到達目標とする。Node / Bun一致だけでは代替しない。
- [ ] インストール済CLIのVersionを固定し、Account / Organization / Simulation利用条件を確認する。CLIの実行ファイルがあるだけではログイン済みとは判断しない。
- [ ] Handlerが実際にContext検査・評価などの必要な処理を行い、秘密を公開ログに出さないことを示す。孤立したHello Worldを本体統合と呼ばない。
- [ ] SimulationのCommand / Log / Output Hash / Versionを保存し、ローカルReplayと照合する。
- [ ] LiveのConfidential Workflowは通常Deploy Accessとは別のPrivate Beta承認が必要。未承認なら申請は本人確認待ちとし、SimulationをTEE本番稼働と説明しない。[公式Access案内](https://docs.chain.link/cre/account/confidential-workflows-access)

## 4. ローカル環境の読取監査結果

秘密値・アカウント識別子・RPC URLは出力していない。値の有無は利用可能性や所有権の証明ではない。この表は監査時点のSnapshotであり、並行作業の完了後に担当者が更新する。

| 対象 | 2026-09-12に確認した状態 | 未確認の境界 |
| --- | --- | --- |
| `.env` | 存在。`.env.local`、`apps/web/.env.local`は未検出 | ローカル設定と公開Deploymentの設定は別 |
| `ENS_PARENT_NAME` | 値あり | 正規名・所有権・ENSv2 Registry / Resolver・Grant Evidence |
| `BAZANTIC_GATEWAY_URL` / `BAZANTIC_SERVICE_ID` | 値あり | 実Gateway一覧との一致、所有、現在のTool仕様 |
| `BAZANTIC_RECIPE_ID` / `BAZANTIC_USERNAME` / `BAZANTIC_API_KEY` | 値なし | CLIの別Credential形式の有無とアカウント登録状態は別問題 |
| `SEPOLIA_RPC_URL` / `DEPLOYER_PRIVATE_KEY` / `ETHERSCAN_API_KEY` / `OPENAI_API_KEY` | 値あり | 新用途への無制限な支出権限を意味しない |
| `CRE_ETH_PRIVATE_KEY` / `CRE_TARGET` / `CHAINLINK_API_KEY` | 調べた環境変数名では値なし | これらすべてが必須とは断定しない。公式CLIのAccount / Profile設定を別途確認 |
| `VERCEL_TOKEN` | 環境変数には値なし | CLI側の既存ログイン可否は未確認 |
| WebのVercel Project Link | `apps/web/.vercel/project.json`あり | 最新Commitが公開されたことは示さない |
| Node / pnpm / Bun | 22.22.1 / 11.24.0 / 1.2.21 | 本監査はBuildの再実行ではない |
| Bazantic CLI | `baz 0.8.0`、ログイン要求を確認 | username / Gateway一覧の取得は未完了 |
| ENS CLI | PATHでは未検出 | Library経由の実装可否・登録済みNamespaceとは別 |
| Foundry | PATH外の`.frontier/tools/foundry-v1.8.1/forge.exe`で1.8.1を確認 | 旧Planの未導入記載とは区別する |
| CRE CLI | PATH外の`.frontier/tools/cre-1.33.0/bin/cre_v1.33.0_windows_amd64.exe`で1.33.0を確認 | 認証・公式Simulation成功はこの監査では未確認 |
| GitHub Repository | `Jun0908/Decentralized-Value`は`gh repo view`でPUBLIC確認 | 未PushのCommit・作業ツリー変更は公開されていない |

監査時HEADは`7fb651b22a4fe36e1db64c465fbbe2bf4c497785`。これはRescue実AI支払い・返金統合時点であり、Sponsor連携を含む最終提出Commitではない。並行作業中の変更をこのCommitに含まれるものとして説明しない。

## 5. 提出までの優先順チェックリスト

以下はProject向けの実行順提案。すべてがSponsor公式の追加要件という意味ではない。

1. **資格と応募先を確定する。** 本人DashboardのTrackと、最大3社の選択を確認する。不明な資格は運営へ確認し、回答を残す。
2. **機能とEvidenceを固定する。** 動作したSponsor経路のみ採用し、再現Command、非秘密入力、Hash、Tx、限界をまとめる。完成していない連携は未完了と明記する。
3. **Sourceの提出版を確定する。** `git status`、差分、型・テスト・Build、秘密走査を確認してFinal Commit SHAを記録する。既存分と新規分の差分、AI利用、Plan / Prompt、必要なLicenseを揃える。
4. **Pushの明示承認を得る。** Repository自体は既に公開だが、作業完了はPush許可ではない。無断でPush・Force Push・タグ公開をしない。承認後、Remoteに提出Commitが存在することを確認する。
5. **Web公開の可否を確定する。** 承認後に提出CommitをDeployし、Judge用URLで画面・API・Evidence・Consoleを確認する。ローカルOperatorのBearer Credentialや送金機能をPublic Webへ載せない。
6. **人間の声で動画を完成する。** 未編集Raw収録に秘密値がないことを確認し、指定尺のDemoとSponsor実行箇所を用意する。
7. **提出フォームを本人が確認して送信する。** Repo / Commit / Demo / 動画URL、期間内の変更、AI利用、Sponsor説明、Bazantic username等の必要欄を埋める。送信後に受付済み画面とリンクを保存する。

完了を示す最小提出セット:

- [ ] 受付済みProject / Team / Trackと、選択したPartner一覧。
- [ ] 公開Repository URL、最終Commit SHA、既存部分からの変更一覧。
- [ ] Judgeが確認できるDemo URLまたは明確なローカル起動手順。
- [ ] 人間ナレーション付き2〜4分の動画。
- [ ] Sponsorごとの実行Evidenceと、未実行部分を区別した説明。
- [ ] 秘密を除いたPlan / Prompt / Architecture / 再現手順、AI利用・人間の貢献説明。

## 6. 表現上の停止条件

- ENSの設定値やMock成功だけで「ENS認可済み」と書かない。
- Recipe MarkdownやGateway設定値だけで「Bazantic経由でAgentが実行済み」と書かない。
- CLI導入やNode一致だけで「CRE / TEEで評価済み」と書かない。
- Operator管理の二つのAI呼出しを、独立第三者の公開Marketと表現しない。
- Sepoliaの実Service支払いを、未知Finalの大会報酬支払いと混同しない。
- 既存公開URLを、最新のローカル画面がDeploy済みである証拠として使わない。

人間の回答がなくても、ローカル実装・非秘密の再現資料・テスト・台本は進められる。アカウント登録、権限委譲、公開、提出などに新たな判断が必要な箇所は、仮の成功状態を作らず上記の未確認欄に残す。
