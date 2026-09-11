# Frontier SDK・CLI 開発計画

作成日: 2026-09-11

状態: 設計段階。今回はMarkdownの計画書のみを作成します。SDK、CLI、使い方のWebページはまだ実装・公開していません。本文のコマンド、配布名、SDKメソッドは提案であり、そのまま利用できる現行仕様ではありません。

配置予定: `Desktop/SDK-Decentralized-Value/`

使い方ページの設計と原稿案: [USAGE-PAGE.md](./USAGE-PAGE.md)

## 1. 目的と成果物

既存Arenaへ戦略・Doctrineを提出するための開発キットを作ります。参加者が手元で編集し、入力検証、公開Practice、比較、提出、提出版の選択、Webでの結果確認まで進められる体験を目指します。

| 成果物         | 役割                                         | 初期範囲                        |
| -------------- | -------------------------------------------- | ------------------------------- |
| CLI            | 人と開発用AI Agentがターミナルから参加       | 最優先                          |
| TypeScript SDK | CLIと自作Agentが同じAPI契約を利用            | CLIと共通で開発                 |
| Starter Kit    | 有効な戦略、スキーマ、固定した評価条件を取得 | Disaster Response、Rescue Room  |
| Agent用Skill   | 条件の読み方、Practice、比較、提出操作を案内 | CLIの仕様確定後                 |
| 使い方ページ   | 初回参加、コマンド、SDK、トラブル対応を案内  | CLIと同時に公開できる状態にする |

コマンド名は `frontier`、配布名は `@frontier/cli` と `@frontier/sdk` を仮称とします。名前の利用可能性、公開先、バージョンは公開前に確認します。

任意のGitHubプロダクトを受け付けるホスティング、任意コードのリモート実行、独自の学習基盤は初期範囲に含めません。対象は既存Arenaが受け付ける戦略・Doctrineです。

## 2. 参考にした製品

| 参考              | 確認した機能                                                 | 採用する考え方                                        |
| ----------------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| Kaggle CLI        | 大会検索、入力取得、提出、採点待ち、履歴、提出ファイル再取得 | 提出IDを軸にした参加と追跡                            |
| Hugging Face CLI  | リビジョン指定、実行ジョブの状態確認、CLI用Skill             | Artifactの版と評価実行を区別し、Agentにも使い方を配布 |
| Polymarket公式CLI | 公開情報はウォレットなしで閲覧、表・JSON出力、状態照会       | 閲覧から始められ、人とAgentが同じ操作を使う           |
| Kalshi公式SDK     | Python・TypeScript SDK、OpenAPIを基準とするクライアント      | API契約を正本にしてSDKとCLIの不整合を防ぐ             |

Frontierでは各指標の改善・悪化、支配関係、Value Poolの評価理由を比較の中心に置きます。CLIが独自の加重総合点を作ってはいけません。

## 3. 現在の本体と実装境界

確認した本体: `Desktop/Decentralized-Value-main/`

実装開始時に、本体の `AGENTS.md`、`Docs/STATUS.md`、`Docs/PRODUCT.md`、`Docs/ARCHITECTURE.md`、`Docs/INTEGRATIONS.md`、対象Arenaの仕様、OpenAPI、近接するコードとテストを再確認します。以下は2026-09-11の確認結果です。

| 対象              | 現在の境界                                                                  | 必要な作業                                            |
| ----------------- | --------------------------------------------------------------------------- | ----------------------------------------------------- |
| `packages/sdk`    | privateな `@frontier/sdk` 0.2.0。基本評価APIと一時保存sandboxのクライアント | 公開配布、型付き操作、認証、エラー、提出操作を整える  |
| Disaster Response | Practice、認証付き参加・提出履歴・Final Entry選択APIがある                  | CLI認証を接続し、既存の保存APIまで一巡させる          |
| Rescue Room       | DoctrineとAI PlaybookのControlled Practice APIがある                        | 初期版はDoctrine Practice。提出保存は本体の追加実装後 |
| 認証              | 認証付きAPIはPrivyトークンを要求する                                        | ブラウザとCLIを結ぶ認証方式と本体側検証が必要         |
| `/v2/sandbox`     | process-localで永続保存ではない                                             | 正式な提出保存の代用にしない                          |
| Hidden Final      | 正式競技の基盤は未完成                                                      | SDKの完成と本番大会の完成を混同しない                 |

本体の型、ハッシュ、評価ルールを手作業で複製しません。既存SDKを再利用・抽出し、共有スキーマを配布可能にするか、OpenAPIから生成した型を用います。移行後も正本を一つに保ち、本体と独立フォルダに別々のSDKを育てないこと。

## 4. 初期リリースの利用フロー

1. 公開Arenaを探し、指標、入力形式、上限、対応操作を確認する。
2. Starter Kitを取得し、評価コンテキストをローカルに固定する。
3. 戦略を編集し、ローカルで形式と検証可能な制約を確認する。
4. 公式APIで公開Practiceを実行し、結果と再現情報を保存する。
5. 同じ条件の結果を比較し、各指標の改善・悪化を確認する。
6. 認証し、提出対応Arenaへリビジョンを保存する。
7. 保存済み提出IDを指定し、Final Entryに使う版を選ぶ。
8. Webの結果画面、Replay、提出履歴へ移動する。

Disaster Responseで提出までのフローを完成させます。Rescue RoomはPracticeまでを公開し、本体の保存APIができた段階で提出を有効化します。Final Entry選択は、締切による不可逆なロックやオンチェーン確定とは区別します。

## 5. コマンド案

| コマンド                                             | 挙動                                            |
| ---------------------------------------------------- | ----------------------------------------------- |
| `frontier arenas list`                               | 公開Arena一覧と対応状態                         |
| `frontier arenas inspect <arena>`                    | 指標、方向、単位、入力形式、Context、制約、上限 |
| `frontier init <arena>`                              | Artifact、スキーマ、設定、Context情報の取得     |
| `frontier check`                                     | ローカル入力検証。正式な採点・提出はしない      |
| `frontier practice [--episode <id>] [--wait]`        | 固定Contextの公開Practiceを公式APIで実行        |
| `frontier runs list` / `inspect <id>`                | ローカルに保存したPractice結果の一覧・詳細      |
| `frontier compare <run-a> <run-b>`                   | 比較可能性を検証し、指標と支配関係を表示        |
| `frontier auth login` / `status` / `logout`          | 認証と認証状態管理                              |
| `frontier submit`                                    | 対応ArenaへArtifactをリビジョンとして保存       |
| `frontier submissions list` / `inspect <id>`         | サーバーに保存された自分の提出を取得            |
| `frontier submissions download <id> --output <file>` | 実際に保存されたArtifactを取得                  |
| `frontier entry select <submission-id>`              | 自分の保存済み提出をFinal Entryとして選択       |
| `frontier open <run-or-submission-id>`               | 実在するWeb結果画面へ移動                       |

共通オプションは `--help`、`--version`、`--json`。JSONモードでは機械可読な結果をstdoutに、進捗はstderrに分けます。入力、認証、非対応操作、Context不一致、通信失敗、待機タイムアウトを区別する安定したエラーコードを定義します。

`--wait`は同期APIでも利用でき、結果取得時に終了します。非同期ジョブ機能がないArenaに、架空のジョブIDやキャンセル機能は作りません。ローカルRun IDとサーバーのEvaluation IDを区別します。

以前の案の提出メモ `-m` は、現在のDisaster Response提出スキーマに対応フィールドがないため初期コマンドには含めません。追加するときは本体の保存モデルとOpenAPIも変更します。

## 6. データと整合性

| 対象        | 意味                                                                 |
| ----------- | -------------------------------------------------------------------- |
| Artifact    | 正規化した戦略・DoctrineとArtifact Hash                              |
| Context     | evaluator、dataset、constraints、metrics、evidence条件とContext Hash |
| Run         | 特定Artifactを特定条件で評価した記録。Episodeなども保存              |
| Submission  | サーバーに保存された参加者のリビジョン                               |
| Final Entry | 競技に用いる保存済み版の選択。変更可能性はサーバーに従う             |
| Evidence    | 結果Hash、公開可能なReplay、署名・確定・支払いの実証情報             |

設定案は `frontier.json`、固定条件は `frontier.lock.json`、ローカル結果は `.frontier/runs/`。認証情報はこれらに含めません。ローカル絶対パスなどが正規化Artifact Hashへ入らない設計にします。

- コンテキスト更新は明示的に扱い、古い結果との比較を無条件に継続しない。
- 公開Frontierとの比較には対象スナップショットも記録する。貢献度や配分見積もりは参加者集合に依存する。
- クライアント申告の成績を正式結果として採用せず、サーバーの公式評価器で検証・再計算する。
- 同一操作の再送は同じIdempotency Keyを使う。通信タイムアウトを未保存と決めつけない。
- 人間もAgentも同じ提出上限・評価条件を使い、CLI経由で制限を回避しない。

## 7. 認証と本体側の追加作業

ブラウザで既存アカウントへログインし、短時間の認可交換からCLI用の認証情報を取得する案を検討します。CLI用トークンを導入する場合は、本体APIにも検証、権限範囲、有効期限、失効が必要です。Privy対応だけでCLI認証が完成しているとは扱いません。

公開閲覧とローカルcheckは認証不要を基本にします。Practiceはサーバーの認証・レート制限方針に従います。

| 確認・追加する機能               | 判断                                                                |
| -------------------------------- | ------------------------------------------------------------------- |
| CLI認証と本体側検証              | 提出の必須条件                                                      |
| Arenaのmanifest/capabilities     | 既存APIを調査し、不足を本体契約へ追加。名前から対応操作を推測しない |
| 提出Artifact取得                 | 既存の認証付き履歴・詳細から復元可能か確認                          |
| Web結果リンク                    | 現行ルートを確認。不足する場合は保存済み結果の表示導線を本体に追加  |
| Rescue Room提出保存・Final Entry | 後続。利用可能になるまでCLIも非対応を返す                           |
| 非同期ジョブ管理                 | 後続。初期版から汎用ジョブ基盤を追加しない                          |

最初のRescue Room対象は決定論的Doctrineです。有料推論を伴うAI Playbookは、費用・回数上限を明示できる段階で追加します。

## 8. SDK・Agent・スポンサー

SDKは `arenas`、`evaluations`、`submissions`、`entries` を型付きで提供する案です。トークン取得とHTTPクライアントは注入可能にし、ブラウザ起動やCLI用ファイル操作はSDK本体へ持ち込みません。

Agent用SkillはCLIバージョンと対応させ、公開条件取得、Artifact作成、予算内のPractice、比較、提出の手順を教えます。追加・更新は利用者の明示操作にします。自然言語の説明や試行数を報酬の加点要素にはしません。

選定済みスポンサーはENS・Bazantic・Chainlinkです。

- ENSv2: 本体の評価者探索・認可を利用し、CLIに実際に検証した評価先と状態を表示。
- Bazantic: 同じAPI契約をMCP/Recipeから利用。別の採点ロジックを作らない。
- Chainlink CRE: 本体の非公開評価・結果確定の実装後、実行状態と証拠をCLI/SDKから取得。

外部未設定を成功扱いにせず、`measured`、`simulated`、`committed`、`paid` を区別します。Practice creditsやRescue Creditsをトークンとは説明しません。3社の統合全体を、初期CLI完成の前提にはしません。

## 9. 使い方ページ

本体Webに使い方ページを追加します。仮ルートは `/docs/cli` とし、実装時に既存ナビゲーションと命名に合わせます。[USAGE-PAGE.md](./USAGE-PAGE.md)を原稿とし、公開版には実装済みコマンドだけを掲載します。

必須内容は、対応Arena、インストール、初回Practice、認証・提出、比較、SDK例、Agent利用、状態、トラブル対応です。Arena画面からも対応する初期化コマンドへアクセスできるようにします。

## 10. 実装段階と完了条件

### Phase 1: 土台とPractice

- [ ] 本体とSDKの契約、共有コードの所有場所、公開方式を決定。
- [ ] Arena一覧・詳細、init、check、JSON出力を実装。
- [ ] Disaster ResponseとRescue Room DoctrineのPracticeを実装。
- [ ] Run保存、同一条件比較、Context不一致拒否を実装。

### Phase 2: 提出と使い方ページ

- [ ] CLI認証を本体APIまで接続。
- [ ] Disaster Responseで参加、提出、再送、履歴、再取得、Final Entry選択を確認。
- [ ] 保存済み結果をWebで開く導線を確認。
- [ ] Windows PowerShellとmacOS/Linuxの手順を確認。
- [ ] 使い方ページを実装し、desktop/mobileとconsole errorを確認。
- [ ] 新規作業ディレクトリで配布物だけを使いQuickstartを完了。

### Phase 3: Agentと対応Arena拡張

- [ ] SkillとBazantic Recipeの手順・入出力を整合。
- [ ] 本体のGateに沿ってRescue Roomの提出保存に対応。
- [ ] 必要になった段階でCI、非同期ジョブ、公開戦略共有を追加。

テストは形式不正、権限不足、同一Contextの結果一致、異なるContextの比較拒否、再送時の二重提出防止、タイムアウト後の照会、未対応操作拒否を中心にします。本体を変更する際は、そのAGENTSとDocs更新規則に従い、進行中のUX作業を保持します。

## 11. 公式資料

2026-09-11に確認した資料です。実装時には現行仕様を再確認します。

- [Kaggle Competitions CLI](https://github.com/Kaggle/kaggle-cli/blob/main/docs/competitions.md)
- [Hugging Face CLI](https://huggingface.co/docs/huggingface_hub/guides/cli)
- [Hugging Face CLI for AI Agents](https://huggingface.co/docs/hub/agents-cli)
- [Polymarket公式CLI](https://github.com/Polymarket/polymarket-cli)
- [Kalshi公式SDK](https://docs.kalshi.com/sdks/overview)
- [ETHOnline 2026賞条件](https://ethglobal.com/events/ethonline2026/prizes)
