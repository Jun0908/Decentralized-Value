# 計画12 — Public API / SDK / CLI の不足と実装計画

作成日: 2026-09-11

状態: 実装開始。2026-09-11の並行実装第1バッチで契約生成・配布検証とCI接続を追加した。Ocean API・永続Job・新CLI操作はまだ未実装。パッケージ公開、外部登録、送金、デプロイは行っていない。現在の境界は§10を参照。

目的: Web画面でできることと、外部AI AgentがAPI / SDK / CLIから安全にできることの差を埋める。APIの契約を基準に、発見 → 候補作成 → Practice → 比較 → 保存 → Final Entry → Evidence確認までを接続する。

## 1. 結論

SDK / CLIをゼロから作る必要はない。別リポジトリの本体とテストは、すでにこのモノレポへ統合されている。一方、契約生成・独立配布の検証スクリプトには取り込み漏れがあり、API側にも新しいArenaと長時間実行を外部公開するための不足がある。

優先順位は次のとおり。

1. 別リポジトリにある生成・配布検証を取り込み、API・OpenAPI・SDK・CLIの差分をCIで検知できるようにする。
2. Arenaの発見と能力表示を共通化し、特にOcean Commonsの既存APIを契約化する。
3. AIを使う長時間実行を、永続Job・進捗取得・費用制限・再接続に対応させる。
4. SDK / CLIから新しいAPIを利用し、比較とEvidence検証まで完結させる。
5. Finalの保存・Freeze・評価・Allocationは計画9 / 10 / 11の実装境界と合わせて公開する。未実装の機能を先に利用可能と表示しない。

最初から全Arena・全操作を実装するのではなく、既存Disaster / Rescueの契約を壊さず、OceanのPracticeを追加するところから進める。

## 2. 調査対象と別リポジトリの扱い

調査基準:

- 統合先: `Decentralized Value` の `main`、`b1f2350` と調査時の作業ツリー。
- SDK元リポジトリ: [SDK-Decentralized-Value](https://github.com/Jun0908/SDK-Decentralized-Value)、`f84d82512c43d0dc2b34a416d9821691c774dd89`。
- API実装、OpenAPI、SDK / CLIの実装・テスト、契約生成スクリプト、関連する現行Docsを確認した。全テストの再実行や本番APIの疎通確認を完了したという意味ではない。
- 別作業による更新が進行中のため、実装開始時にはHEADと差分を再確認する。

| 対象                                              | 統合先の状態                                                  | 実装方針                                                |
| ------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------- |
| `packages/sdk` / `packages/cli`                   | 本体・ビルド設定は存在する                                    | 現行コードを拡張。旧リポジトリのコードで上書きしない    |
| `tests/sdk.test.ts`、`tests/fixtures/`、CLI tests | 統合先にも存在する                                            | 未実装扱いにせず、追加API・異常系・互換性のテストを足す |
| `scripts/sync-contract.ts`                        | 元リポジトリに存在し、統合先にはない                          | 現行モノレポのパス・依存・Schemaに合わせて移植          |
| `scripts/verify-package.ts`                       | 元リポジトリに存在し、統合先にはない                          | 配布物を別環境へインストールする検証を移植              |
| CLIコマンド資料の生成                             | 元リポジトリの生成処理と統合先のexport処理がある              | 一つの生成経路からCLI資料・Web資料を更新                |
| SDK利用ガイド                                     | 元リポジトリのREADMEに説明がある。統合先のSDK専用READMEはない | 現行構成に合わせて説明を取り込み、旧パス・旧手順を除く  |

元実装の参照: [契約同期スクリプト](https://github.com/Jun0908/SDK-Decentralized-Value/blob/f84d82512c43d0dc2b34a416d9821691c774dd89/scripts/sync-contract.ts)、[配布検証スクリプト](https://github.com/Jun0908/SDK-Decentralized-Value/blob/f84d82512c43d0dc2b34a416d9821691c774dd89/scripts/verify-package.ts)、[コマンド資料生成](https://github.com/Jun0908/SDK-Decentralized-Value/blob/f84d82512c43d0dc2b34a416d9821691c774dd89/scripts/export-reference.ts)。

推奨する正本は現在のモノレポ。外部SDKリポジトリを今後も配布用に維持する場合は、モノレポからの検証済みexportにする。二つのリポジトリでAPI型やSDK本体を別々に手修正しない。履歴全体の再Merge、旧lockfileのコピー、旧バージョンへの巻き戻しは本計画の作業に含めない。

## 3. 現在できることと具体的な不足

| 領域              | 現状                                                                    | 不足                                                                                          |
| ----------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| OpenAPI           | 63 paths / 63 operationsを定義。既存CLIの主要応答にはSchemaがある       | 静的確認では46 operationsに本文Schemaのない成功応答がある。Ocean Seasonは未掲載               |
| SDK型             | 現行OpenAPIのpathは生成型に存在する                                     | OpenAPIにない機能は型にも出ない。生成スクリプトが統合先にないため更新経路が閉じていない       |
| Arena発見         | `/v1/arenas`、CLI manifest、Web registryが別々にある                    | 一覧は複数Arenaを返すが、汎用detail / frontierは旧challenge中心。共通のID・能力・操作先が不足 |
| Disaster Response | 型付きPractice、認証、保存、提出履歴、Final Entry選択                   | 認証・永続Storeの構成に依存。選択とHidden FinalのFreezeは同義ではない                         |
| Rescue Room       | 型付きDoctrine Practice、別経路のAI Commander評価                       | CLI manifest上はPracticeのみ。AI Job、保存、Final公開契約は不足                               |
| Ocean Commons     | `POST /v1/ocean-commons/seasons` がmissionと公開seedからAI Seasonを実行 | OpenAPI、CLI manifest、SDKアダプター、Starter、永続Job・進捗取得がない                        |
| その他Arena       | Arena別のHTTP経路や旧SDK経路がある                                      | 統一CLI manifest / 型付きPracticeアダプターが全Arena分あるわけではない                        |
| 比較              | SDK / CLIにContextを確認する2 Run比較がある                             | 複数候補・固定比較集合・Pool別判断を調べる共通の読み取り体験が不足                            |
| 実行記録          | SDK / CLIはローカルRunを保存できる                                      | ローカルRun IDとサーバーJob IDが別物。切断後の再接続・証拠の独立検証を追加する必要がある      |

確認箇所: [`apps/api/src/index.ts`](../apps/api/src/index.ts)、[`cli-manifest.ts`](../apps/api/src/cli-manifest.ts)、[`packages/shared/src/cli.ts`](../packages/shared/src/cli.ts)、[`openapi/frontier-v1.yaml`](../openapi/frontier-v1.yaml)、[`packages/sdk/src/client.ts`](../packages/sdk/src/client.ts)。

上記の「本文Schemaなし」は、APIそのものが未実装という意味ではない。成功statusだけでは外部Agentが応答構造を判断できず、生成型による保証も弱いという不足である。

## 4. APIで実装すること

### 4.1 契約生成を閉じる — 最優先

- [ ] リクエスト・レスポンスの公開Schemaを、サーバー専用の認証・Store・秘密情報をimportしない共通境界へ整理する。
- [ ] 既存の`export-cli-contract.ts`と元リポジトリの`sync-contract.ts`を接続し、公開Schema → OpenAPI → SDK型・実行時検証 → Fixture / 資料の更新経路を一本化する。
- [ ] 元の同期処理はASTからZod定義・refinementを取り出している。移植時に`superRefine`等の業務検証を落とさず、生成物と実際のAPIの両方で同じ入力を検証する。
- [ ] 最初にSDKが利用する操作とOcean Seasonの成功・失敗Schemaを整備し、残りの公開操作には未整備一覧と完了条件を付ける。
- [ ] `operationId`、Context precondition、認証、Idempotency-Key、429、Jobの202応答をOpenAPIに明記する。
- [ ] SDKの手書きResponse Schemaも契約との一致を検査する。TypeScriptの型生成だけで実行時検証が済んだことにしない。
- [ ] CIでOpenAPIだけでなく、SDK生成物・Fixture・コマンド資料の差分も検知する。チェック実行が作業ファイルを黙って書き換えない方式を優先する。

現在の`contracts:cli:check`はOpenAPIと`openapi/generated`が対象であり、SDK生成物まで一括検証していない。まずこの不足を既存スクリプトの再利用で埋める。

### 4.2 Arena Registry / Capabilityを共通化する

現行CLIのArena IDは`disaster-response` / `rescue-room`の固定enumである。単に文字列へ緩めるだけでなく、能力と入力形式を明示する。

- [ ] `arenaId`、Web slug、challenge / round ID、Context、操作先の対応を一つのRegistryで管理する。
- [ ] 一覧・詳細・CLI manifest・SDK・Webが同じ登録情報を参照する。既存のURLは互換aliasとして維持する。
- [ ] `supported`と`available`を維持し、利用不可の理由を返す。認証済みでも未実装のFinalを利用可能にしない。
- [ ] `practice-deterministic`、`practice-ai`、保存、Final選択、Freeze、Evidence取得などを別Capabilityにする。
- [ ] 入力Schema、サンプル、評価軸の方向・単位、Hard Constraints、公開Episode、実行上限、認証、保存方式、費用の種類を公開する。
- [ ] 新しいmanifest / project / lockのSchema Versionと互換性を定める。未知Arenaは一覧表示できても、未対応Artifactを実行できることにはしない。

Oceanの最初の入力は既存APIの`mission`と許可された公開`seed`。任意コード実行やHidden seedの指定を新機能として混ぜない。Oceanの決定論的戦略入力も公開するなら、AI Seasonと別Capabilityとして計画10の仕様を使う。

### 4.3 Evaluation / Evidenceの共通Envelope

各ArenaのRaw Resultを廃止するのではなく、共通の外枠とArena別の型付きPayloadを持たせる。計画11の`EvaluationRequestV2` / `EvaluationResultV2` / `ExecutionEvidenceV1`と重複したHash体系を作らない。

| 区分           | 公開契約に含めるもの                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| 比較Context    | evaluator / data / constraints / metrics / aggregationのVersionまたはHash、Episode / pack、比較対象の範囲 |
| 入力           | Artifact Schema Version、正規化済みArtifact Hash、入力の取得・公開条件                                    |
| 決定論的Result | 正当性、違反理由、独立Outcome、Episode結果、Result Hash                                                   |
| 実行記録       | Job ID、実行方式、時刻、モデル・利用量、署名・Reportなどの検証根拠                                        |
| 状態           | simulated / measured、commitment状態、payment状態をそれぞれ独立して表す                                   |

- [ ] Oceanの`SeasonResult`をAPI Envelopeへ接続する。現行Season応答のトップレベルには共通Context / Result Hashがなく、他ArenaのRunと同様に保存・検証する契約が不足している。
- [ ] 同一入力・Context・記録済みActionから同じResult HashになるGolden Testを用意する。時刻・Job ID・Tx hashは決定論的Resultに入れない。
- [ ] AI inferenceの再実行とAction transcriptのReplayを区別する。同じPrompt / seedでもモデル出力の一致を保証しない。
- [ ] 観測・選択・購入・支払い・取得Evidence・状態遷移を記録する。内部Chain of Thoughtは収集要件にしない。
- [ ] mission、Prompt、Artifact、transcriptの公開範囲を定義し、所有者用と公開用の応答を分ける。Final前のHidden inputは公開レスポンスやエラーに出さない。
- [ ] Practice credits、モデル推論費用、Gateway料金、オンチェーンService支払い、Rewardを混同しない。既存の`rewardEligible: false`を根拠なく変更しない。

### 4.4 長時間AI実行を永続Job化する

現在のOcean SeasonはHTTPリクエスト内で完走を待つ。既存の汎用`/v1/evaluations`にもJobはあるが、メモリStoreと非同期dispatchが中心であり、そのまま永続AI Jobとして扱わない。

次のAPI群は新規契約の案であり、現在利用できるURLではない。最終URLは既存経路との互換性を確認して決める。

| 操作案                | 内容                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| AI Evaluation作成     | Context・入力・実行上限・Idempotency-Keyを検証し、202とJob取得先を返す                             |
| Job取得               | queued / running / succeeded / failed / cancelled / needs-reconciliation、進捗、結果参照、失敗分類 |
| Events取得            | cursor以降の観測・Action・Service結果を取得。最初はpolling、SSEは必要なら後続                      |
| Result / Evidence取得 | 完了結果と検証可能なBundleを取得。部分結果は完了結果と区別                                         |
| Cancel要求            | 今後の実行を止める要求。処理済み推論の無料化・巻き戻しを意味しない                                 |

- [ ] Job・入力Hash・Context・lease・進捗・費用予約を永続化し、HTTP handlerとworkerを分離する。
- [ ] owner + operation + Idempotency-Keyに入力Hashを結び付ける。同一要求は同一Job、同じKeyの別内容は競合エラーにする。
- [ ] worker重複実行、再起動、lease失効、timeout、Cancelと完了の競合をテストする。
- [ ] 外部モデルへの送信後に応答を失った場合は、二重課金しない保証を捏造しない。不明な状態を残し、無条件に再推論しない。providerの照会可否に応じて復旧方針を定める。
- [ ] モデル呼び出し回数・token・費用・同時Job数にサーバー上限を設け、並列要求でも上限を越えない予約処理にする。
- [ ] Finalでのcheckpoint / restartはRoundで事前固定する。良いモデル出力が出るまで再試行する経路を作らない。
- [ ] 従来の短い同期Practiceは維持する。新しい非同期応答を既存SDKへ突然返さない。

### 4.5 保存・Final・比較・Pool・Evidenceの読み取り

- [ ] 保存済みSubmissionを所有者確認付きで1件取得するAPIと、cursor付き一覧・Artifact exportを整備する。SDKが全履歴を取得して1件を探す構造から移行する。
- [ ] Final Entryの現在値・Revision・Round状態を取得できるようにする。選択変更には期待Version等の競合検知を用意する。
- [ ] 選択、締切、Freeze、評価、Reveal、Allocation、支払いを別の状態として公開する。Rescue / Oceanの保存・Finalはdomain側ができた段階で有効化する。
- [ ] FrontierとValue Poolの読み取りをArena Registryに接続する。既存計算を再利用し、比較集合Hash・Context・baseline・各Metricの方向を返す。
- [ ] 複数候補の比較では正当性を先に判定する。無効候補を「魅力的なTradeoff」として表示せず、Contextの異なる結果を同じFrontierに混ぜない。
- [ ] PoolごとのAllocation根拠とReceiptを調べられるようにする。Preview、commitment、実送金を明確に分ける。
- [ ] Evidence BundleにSchema、Artifact、Context、結果、transcript参照、署名 / Report / tx参照、検証手順を含める。公開できない部分は時期・権限で制御する。

複数Poolを一つのWeighted Scoreに変換するAPIは追加しない。オンチェーンcommitmentがあることと、評価計算の正しさが検証できることも別々に扱う。

### 4.6 認証・Error・Rate Limit・運用境界

- [ ] Web経由と単独API serverの構成差を整理する。現在はWeb側でidentity / durable Storeを接続しており、単独serverの起動だけで同じ機能が有効になるとは限らない。
- [ ] 必要な認証・Store・workerがないときはCapabilityとreadinessで明示する。設定不備を成功・支払済み・永続保存済みとして返さない。
- [ ] CLI device loginとSDKの認証注入を活用し、共通の低レベル認証契約を整備する。認証方式を増やすこと自体を目的にしない。
- [ ] Job、履歴、Artifact、非公開Evidenceにowner / scope検証を適用する。public Practiceと費用のかかるAI実行を同じ権限と上限で扱わない。
- [ ] `ErrorEnvelope`を統一する。入力不正、Context不一致、認証失敗、競合、上限、外部障害、内部障害を区別し、内部例外を一律400で公開しない。
- [ ] `Retry-After`、request ID、retry可否を定義する。Context変更時にSDKが勝手に新Contextで再提出しない。
- [ ] 一般APIのprocess内・IPベース制限と、認証側の永続制限を整理する。信頼するproxyを定義し、任意の`x-forwarded-for`だけで課金系の上限を回避できないようにする。
- [ ] manifestの`practiceRunsPerMinute`と実際の制限対象を一致させる。現状は一般GET等も共通の30回/分制限を消費し、AI側には別の制限がある。
- [ ] 入出力サイズ、モデル同時実行数、ログの秘密情報除去、API Version、OpenAPIのキャッシュ更新を検証する。
- [ ] Node SDK、同一originのWeb、外部browser利用の対応範囲を明記する。認証付きAPIに無条件のCORS許可を追加しない。

## 5. SDKで実装すること

現行の`FrontierClient`、Context lock、StarterのSHA検証、比較、送信内容照合、同一origin制約、timeout、Error分類を再利用する。

- [ ] 新manifestの発見・入力Schema・機能判定に対応し、Oceanの型付きPracticeを追加する。RescueのDoctrineとAI Commanderは別メソッドまたは明示modeにする。
- [ ] Job作成・状態取得・待機・Events・Result / Evidence取得・Cancelを追加する。待機timeoutはserver JobのCancelと同義にしない。
- [ ] Practice応答のArtifact Hashを要求内容から検証し、Resultも定義済みCanonical形式から照合する。現在のRaw Hashの読み取りを、独立検証済みという説明にしない。
- [ ] `entries.select`の返却IDと要求IDの一致をSDK自体で検証する。CLI側だけの確認に依存しない。
- [ ] 単一Submission取得、複数Run比較、Frontier / Poolの読み取りを追加する。サーバー側と同じ共有計算・Context制約を使う。
- [ ] Evidence検証結果は「型を読めた」「Hashが一致」「Evaluatorを再実行」「署名を検証」を分けて返す。
- [ ] 既存legacy APIは互換のため維持するが、`z.unknown()`と型キャストだけの応答を実行時検証済みとして扱わない。
- [ ] JSON応答にもサイズ上限・外部AbortSignal対応を整備する。既存ダウンロードのサイズ制限と安全なredirect処理を維持する。
- [ ] API originとpath prefixの契約を決める。現行modern経路の`/v1/...`とlegacyの相対経路ではbase pathの扱いが異なるため、prefix付きGatewayをテストする。
- [ ] Gateway対応で認証情報の任意origin転送を許可しない。Bazanticの認証・料金処理は計画11の実Gateway仕様に接続し、通常APIのBearer tokenと分離する。

`tests/sdk.test.ts`はすでにあるため、上記の改ざん・未知Arena・中断・互換性のケースを追加する。SDKの新メソッドを、裏側に存在しないAPIの薄いwrapperとして先行公開しない。

## 6. CLIで実装すること

現行の`init`、offline `check`、Context inspect / update、Practice、ローカルRun、2件比較、認証、再開可能なSubmit、Entry選択は残す。CLIの主目的は、外部AIが画面操作なしで候補を改善し、検証可能な記録を残すことである。

以下のコマンド名は追加案であり、現行コマンドの説明ではない。

| 追加・拡張案                               | 必要な体験                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| `arenas list / inspect`、`init`            | 新Arenaと能力・入力・費用を理解し、対応Starterを作成                           |
| `practice`                                 | 決定論的 / AIを明示し、必要なら202のJobを記録。`--wait`は実Jobの状態取得に接続 |
| `evaluations status / wait / download`     | 切断・CLI再起動後もserver Job IDから続ける                                     |
| `runs list / inspect`、`compare`           | local Runとserver Jobを混同せず、複数候補を同じContextで比較                   |
| `entry status`                             | 保存済み選択とRound / Freeze状態を確認                                         |
| `frontier inspect`、`pools list / inspect` | 一つの総合点ではなく、独立OutcomeとPoolごとの判断を見る                        |
| `evidence verify`                          | Bundleの整合性をoffline検証し、必要に応じて別段階の再実行・署名検証へ進む      |

- [ ] `--json`の応答Schema、標準出力 / 標準エラー、既存exit code、終了待機・timeout時の挙動を契約化する。
- [ ] `--json`を実行同意として扱わない。既存の`--yes`、immutable operation、Idempotency-Key、OS keyringを維持する。
- [ ] AI実行ではserver制限内の推論予算を明示する。実送金の承認とは分け、Practice実行から暗黙のオンチェーン支払いを発生させない。
- [ ] ローカルRunファイルの内容改変も検知できるようにする。Schemaが読めるだけで元Evidenceの完全性を保証しない。
- [ ] `check`は構文・ルール検証であってSimulationではないと維持する。複数Practiceの一括実行は、予算・並列数・部分失敗を扱える段階で追加する。
- [ ] CLI help、JSONコマンド定義、SDK example、WebのCLI資料を同じ変更で更新する。

## 7. 配布・CIで実装すること

- [ ] 元の`verify-package.ts`を現行バージョン・workspace構成に合わせて移植する。旧tarball名や旧依存Versionを固定で持ち込まない。
- [ ] SDK / CLI / 必要な共有packageをpackし、リポジトリ外の空のconsumerにインストールする。workspaceの依存解決に助けられた成功と区別する。
- [ ] ESM import、型定義、NodeNextの型検査、CLI起動を配布物から検証する。runtime依存の宣言漏れ、`workspace:`やローカルpathの残存も検出する。
- [ ] Windows / Linuxで重要経路を確認する。特にパス・ZIP展開・認証保存・JSON出力・再開処理を対象にする。
- [ ] API → SDK → CLIを実HTTPで通す既存`verify:cli`を拡張する。偽identityのローカル検証と、実認証・本番設定のsmokeを別Evidenceにする。
- [ ] SDK README、変更履歴、互換Version表、配布手順を整備する。npm公開・release作成は別の明示的な実行範囲とする。

## 8. 実装順と完了条件

| 段階 | 実装単位                             | 完了条件                                                                                            |
| ---- | ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| P0-A | 契約生成・配布検証スクリプトの移植   | 現行APIから生成でき、意図的な契約差分をCIで検出。空consumerでSDK / CLIが動く                        |
| P0-B | API / OpenAPI棚卸しとOceanの契約     | 既存Seasonの入力・成功・失敗を型化。対応外機能の一覧と理由が見える。既存2 Arenaの契約テストを維持   |
| P1-A | Registry / Context / Result Envelope | 同じArenaをAPI・SDK・CLIが発見し、ArtifactとContextを固定して独立Outcomeを保存できる                |
| P1-B | 永続AI Jobと費用・権限境界           | 切断・再起動・二重要求・worker障害をテスト。課金状態不明を隠さず、別ownerの結果を取得できない       |
| P1-C | SDK / CLIの端から端までの利用        | Ocean AI Practiceを起動 → 再接続 → 結果保存 → 同Context比較 → Evidence検証まで通る                  |
| P2   | 保存 / Final / Pool / Sponsor経路    | 計画9 / 10 / 11の実装済み境界だけを公開し、Freeze・評価・Allocation・支払いの根拠を別々に取得できる |

最小の到達点はP1-Cまで。OceanのAI実行が外部Agentから安全に使え、既存Disaster / Rescueが壊れず、モデル推論をやり直さずに記録済み結果を検証できることを目指す。Hidden Finalや実決済の完成は、このAPI整備だけで達成したとしない。

各段階で必要な検証:

- [ ] 既存SDK / CLI Fixture、API、認証、Context不一致、Submit再開の回帰テスト。
- [ ] malformed JSON、未対応mode、response shape不正、Hash不一致、認証失敗、429、timeoutの契約テスト。
- [ ] Job Storeの原子的な重複防止・権限・lease・費用予約を、実際に採用する永続Storeで検証。
- [ ] 同じAction transcriptのReplayで同じResult Hash。別Context比較の拒否、正当性ゲート、入力順に依存しないFrontier / Allocation。
- [ ] 旧クライアントの同期Practice、旧URL、既存の任意Context headerを壊さない互換テスト。新しいFinal契約では必要なpreconditionを必須にする。
- [ ] 生成物の再生成差分なし、型検査、関連テスト、配布物smoke。Webの資料・UIを変更した場合はbuildとdesktop / mobile確認も行う。

## 9. 他計画との分担と主な変更先

- **計画9**: Rescue Roomのゲーム・Commander・Service・Payments。計画12はそれらを外部から利用する契約を担当する。
- **計画10**: Ocean Commonsのゲーム・評価軸・Season・対照評価。計画12で評価ルールを独自に変更しない。
- **計画11**: ENS identity / permission、Bazantic Gateway、CRE Final、署名・commitment。計画12のAPI / SDK / CLIをその利用経路にする。
- **計画12**: 発見、入力、実行、履歴、比較、Evidence、認証・費用制限、生成・配布・互換性。

主な変更候補:

- `apps/api/src/index.ts`、`cli-manifest.ts`、`cli-response-schemas.ts`、`cli-auth.ts`、Store / worker境界。
- `packages/shared/src/cli.ts`と新しい公開Schema、`openapi/frontier-v1.yaml`、`scripts/export-cli-contract.ts`。
- 移植する`sync-contract.ts` / `verify-package.ts`、`packages/sdk`、`packages/cli`、`tests/sdk.test.ts`、関連Fixture・API tests・CLI tests。
- Web側のAPI構成とCLI資料。`apps/web/`の実装変更時には同ディレクトリの`AGENTS.md`にも従う。
- 実装境界が変わった段階で`Docs/STATUS.md`、公開手順が変わった段階で`README.md` / `Docs/INTEGRATIONS.md`を更新する。

API入口やlockfileは別作業と競合しやすい。実装開始時に担当範囲を確認し、まず契約・生成・テストの小さな変更から進める。他の作業中コードを変更せず、統合担当がroot package / lockfileと共通Docsを管理する。

## 10. 並行実装 第1バッチ — P0-A

2026-09-11。分担・統合記録は[`PARALLEL_IMPLEMENTATION.md`](PARALLEL_IMPLEMENTATION.md)を参照。

- [x] 元SDKリポジトリから契約生成・配布検証の考え方と実装を移植。現行モノレポを正本とし、旧OpenAPIの別コピーを作らない。
- [x] `contracts:cli:check`を無書換えに変更し、`contracts:sdk` / `contracts:sdk:check`を追加。実際のAPIのZod宣言をASTから抽出し、`superRefine`を保持する。
- [x] SDKのAPI型・Request Schema・Practice Fixture・直接生成元のprovenanceを再生成・検査する。
- [x] 古いRescue Fixtureを現行のHash付きOrder / Payment / Refund結果へ更新。既存APIやゲームの評価規則を変更したわけではない。
- [x] `verify:packages`でshared / SDK / CLIをpackし、workspace外の空consumerへ実tarballを導入。ESM import、SDK呼び出し、NodeNext strict、CLI help / versionを確認する。
- [x] SDKの外部runtime importに必要な`viem`依存の宣言漏れを修正。生成器`openapi-typescript`のVersionを固定する。
- [x] CIへ生成物・配布物の検証を接続。SDK distが必要な既存CLIテストに先立ち`build:tooling`を実行する。
- [x] [`packages/sdk/README.md`](../packages/sdk/README.md)とtoolingの回帰テストを追加。
- [ ] P0-B以降: Ocean応答Schema、Registry、永続Job、推論予算、SDK / CLIの追加操作。
- [ ] CLI / Webコマンド資料の同期、実認証、Linux実機の配布検証、npm公開。

生成物のcheckは不足・差分時に失敗するが、ファイルやディレクトリを作らない。provenanceは直接入力の追跡であり、全runtime依存の証明ではない。配布検証は第三者依存をnpmから取得するが、lifecycle script・publish・実Frontier APIへの操作は行わない。
