# SDK・CLIの使い方ページ: 設計と原稿案

作成日: 2026-09-11

状態: 公開前の原稿です。CLI、SDKメソッド、パッケージ、ページURLは提案であり、現在利用可能という意味ではありません。公開時に各例を実装・動作確認済みの内容へ置き換えてください。

配置予定: `Desktop/SDK-Decentralized-Value/`

開発計画と実装境界: [README.md](./README.md)

## 1. ページの目的と構成

初めての参加者には最短のPractice手順、繰り返し使う参加者にはコマンドとエラーの参照を提供します。本体Webの仮ルートは `/docs/cli`。既存DocsとArenaの参加導線から到達できるようにします。

| 順序 | セクション         | 読者が行うこと                     |
| ---- | ------------------ | ---------------------------------- |
| 1    | SDK & CLI          | 対象と利用可能な操作を把握         |
| 2    | 対応Arena          | Practiceのみか、提出も可能か確認   |
| 3    | インストール       | 対応OSと公開済みバージョンで導入   |
| 4    | 最初のPractice     | サンプル取得、編集、検証、評価     |
| 5    | 結果比較           | 指標別の変化と比較条件を確認       |
| 6    | 認証と提出         | リビジョン保存、Final Entry選択    |
| 7    | TypeScript SDK     | 自作スクリプト・Agentから利用      |
| 8    | AI Agent           | SkillとJSON出力を利用              |
| 9    | コマンド参照       | オプションと入出力を確認           |
| 10   | 状態・トラブル対応 | 失敗や未対応の理由と次の操作を確認 |

SDK説明は初期段階では同じページ内のセクションにします。既存サイトのデザインと言語に合わせ、この日本語原稿だけを理由に多言語基盤を追加しません。本文、目次、コード例を中心とする文書ページにします。

## 2. 導入と対応表の原稿

> FrontierのSDKとCLIから戦略を検証し、公開Practiceを実行し、対応Arenaへ提出できます。人が操作する場合も自作Agentを使う場合も、同じ評価条件と提出ルールが適用されます。

公開時は導入の直後に実装済みバージョンと対応表を置きます。

| Arena             | 初期リリースで目指す操作                    | 公開条件                               |
| ----------------- | ------------------------------------------- | -------------------------------------- |
| Disaster Response | Practice、比較、提出、履歴、Final Entry選択 | CLI認証と提出フローの確認後            |
| Rescue Room       | 決定論的DoctrineのPractice、比較            | Doctrine経路の確認後。提出保存は別段階 |

この表は公開予定の表です。実装していない機能を利用可能とは表示せず、本体APIが示す対応状態と一致させます。

## 3. インストールの原稿

以下のパッケージ名は仮称・未公開です。

```bash
npm install --global @frontier/cli
frontier --version
frontier --help
```

公開前にパッケージ名、公開バージョン、対応Node.js、Windows/macOS/Linuxの手順を確定します。未公開のインストールコマンドを動作するQuickstartとして掲載しません。本体モノレポのcloneを必須にしない配布を目指します。

## 4. 最初のPracticeの原稿

以下は予定コマンドです。Disaster Responseを最初の例にします。

```bash
frontier arenas list
frontier arenas inspect disaster-response
frontier init disaster-response
```

> 指標、制約、利用上限を確認し、Starter Kitを取得します。initで作られる設定には、今回の評価条件が記録されます。

| 生成ファイル案         | 内容                    |
| ---------------------- | ----------------------- |
| `strategy.json`        | 編集するサンプル戦略    |
| `strategy.schema.json` | 入力形式                |
| `frontier.json`        | ArenaとArtifactの設定   |
| `frontier.lock.json`   | 固定Contextとバージョン |

ファイル名は実装時に確定し、既存ファイルを無断で上書きしない仕様にします。

```bash
frontier check
frontier practice --wait
```

> strategy.jsonを編集したらcheckで入力を検証します。practiceは公式の公開Practice評価を実行し、Run IDと指標別の結果を返します。ローカルの形式検証だけで正式な成績が決まるわけではありません。

結果にはRun ID、Artifact Hash、Context Hash、指標の値・方向・単位、Correctness、結果状態を表示します。数値やスクリーンショットは、固定サンプルの実行結果で作ります。架空の成績を実測として掲載しません。

Rescue RoomのDoctrine手順は別の短い例にします。

```bash
frontier init rescue-room
frontier check
frontier practice --episode <公開EpisodeのID> --wait
```

公開ページではプレースホルダーを実在する公開Episodeに置き換え、コピーして使えるようにします。AI Playbookの推論経路はDoctrineと区別し、対応した段階で費用・利用条件を記載します。

## 5. 比較と結果確認の原稿

```bash
frontier runs list
frontier runs inspect <run-id>
frontier compare <run-a> <run-b>
```

> compareで各指標の改善・悪化と支配関係を確認できます。異なる評価条件の結果は、同じ競技結果として比較できません。

比較表は指標名、方向、単位、A、B、差分で構成します。総合順位を作らず、一方が安価でも別の指標で劣る場合にはトレードオフを表示します。

同じArtifactを別Episodeで実行した場合は別Runです。比較可能性はArenaのContextと評価契約で判定します。公開Frontierとの比較や配分見積もりには、比較対象のスナップショットとPracticeであることを表示します。

## 6. 認証と提出の原稿

```bash
frontier auth login
frontier auth status
frontier submit
frontier submissions list
frontier submissions inspect <submission-id>
frontier entry select <submission-id>
frontier open <submission-id>
```

> loginでブラウザ認証を完了すると対応Arenaに提出できます。submitは現在のArtifactをリビジョンとして保存し、entry selectは保存済みのどの版をFinal Entryに使うかを選びます。

| 操作・状態   | 意味                                 |
| ------------ | ------------------------------------ |
| check        | ローカル入力検証                     |
| practice     | 公開条件での評価                     |
| submit       | サーバーへのリビジョン保存           |
| entry select | 競技に使う保存済み版の選択           |
| committed    | 対応するオンチェーン確定の証拠がある |
| paid         | 送金・イベント・受取の証拠がある     |

Final Entryが変更可能か、締切で固定済みかはサーバーの状態に従います。選択しただけで不可逆にロックされた、または報酬が支払われたとは表示しません。

保存されたArtifactの再取得例も掲載します。

```bash
frontier submissions download <submission-id> --output submitted-strategy.json
```

## 7. TypeScript SDKの説明案

CLIと同じAPIを自作スクリプトから使います。以下は予定APIを示す擬似コードであり、現在の本体SDKのシグネチャとは異なります。

```typescript
import { FrontierClient } from "@frontier/sdk";

const client = new FrontierClient({ baseUrl, tokenProvider });
const arena = await client.arenas.get("disaster-response");
const result = await client.evaluations.practice({
  arenaId: arena.id,
  contextHash: arena.contextHash,
  artifact: strategy,
});
```

公開版は実装済みの型に合わせ、baseUrl、strategyの読み込み、必要な認証、エラー処理まで含む実行可能な例にします。未定義の変数やヘルパーを残したまま実行可能と説明しません。

本体提出スキーマへの変換はSDKのArenaアダプターが担当します。人の提出とAgentの提出のsourceMethodを正しく扱い、Agentの場合はAPIが要求するprovenanceを渡します。メタデータは報酬の加点要素ではありません。

## 8. AI Agentで使う説明案

```bash
frontier arenas inspect disaster-response --json
frontier practice --wait --json
frontier compare <run-a> <run-b> --json
```

Agentへの依頼例:

> このArenaの公開条件を読み、試行上限内で3案をPractice評価してください。指標ごとのトレードオフを説明し、提出候補を示してください。

SkillにCLIバージョン、公開API、制約、上限、エラーの読み方を含めます。Skillの追加・更新方法は実装後に掲載します。Bazantic Recipeは別の入口として案内し、同じ評価条件・参加ルールに従わせます。

## 9. トラブル対応

| 状況             | 案内する操作                                         |
| ---------------- | ---------------------------------------------------- |
| 入力形式不正     | フィールド位置、必要な型・範囲を確認しcheckを再実行  |
| 認証切れ         | auth statusで確認しloginで更新                       |
| Context不一致    | 固定条件とサーバー条件を確認。無言で更新・比較しない |
| Practice上限到達 | サーバーの待機時間と残り回数を確認                   |
| 提出非対応       | 対応状態を示す。Practice結果を提出済みに見せない     |
| 送信後の通信切断 | 状態照会・同じIdempotency Keyで再開                  |
| 待機タイムアウト | 結果IDがあれば状態照会。採点失敗や未保存と断定しない |
| 外部連携未設定   | 不足する連携と利用可能な操作を表示                   |

公開時に実装済みエラーコードを追記し、CLIの出力と対応させます。

## 10. ページUIと公開前チェック

desktopは本文と目次、mobileは折りたたみ目次を基本とし、既存Docsパターンを優先します。コードにコピーボタンを設け、成功・失敗を返します。Arenaを切り替える場合は対応状態・ファイル名・コマンドを同時に切り替えます。

OSで差がある箇所だけPowerShellとmacOS/Linuxを切り替えます。長いコードやHashでページ全体が横にあふれないようにします。Web結果リンクは実在する保存済み結果を指すこと。

- [ ] パッケージが実際に配布され、表示バージョンが一致する。
- [ ] 新規作業場所でQuickstartが通る。
- [ ] PowerShellでコピーしたコマンドが動く。
- [ ] SDK例が実装済み型でコンパイル・実行できる。
- [ ] コマンド一覧と `--help` が一致する。
- [ ] 対応Arena表とサーバー機能が一致する。
- [ ] 検証、Practice、提出保存、Final Entry、確定、支払いの説明が混ざらない。
- [ ] 秘密情報、非公開テスト、架空の成績が例に含まれない。
- [ ] desktop/mobile、キーボード操作、コードの可読性、console errorを確認する。
- [ ] Arena、ソース、配布物へのリンクが有効である。

CLI実装時に本体Web側でこのページを作成します。今回のMarkdown作成だけでは、ページ実装や公開まで完了した扱いにしません。
