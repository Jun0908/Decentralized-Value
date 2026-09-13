# Chainlink CRE — Rescue Evaluator互換性検証

最終確認: 2026-09-12 09:33 UTC以降。**通常・Confidentialの公式Simulationが成功し、Nodeと全Envelope・既存Hashが一致した。秘密Packもsecret input経由で実行し、Receipt一致とReveal Replayが成功。**

[最新Evidence](../deployments/chainlink-cre-private-pack.json)・[撮影手順](SPONSOR_DEMO_RECORDING.md)。これはLocal simulationであり、live TEE attestation・ネットワークDeploy・onchain commitment・本番Finalではない。

修正点: Sepolia RPC設定、Windowsの空白を含むパスでのSDK直接コンパイル、短い相対WASM path、280 Episodeの初期計算遅延化、protobufが扱えないnullをJSON境界へ移動、V8 / QuickJSでのASCII key collation一致。公開Fixtureの旧Node Hashは保持した。

以下は成功前の準備・認証停止の履歴。現在のローカルSimulationを撮影するために人間が再ログインする必要はない。

## 今できたこと

- Windows公式CRE CLI **v1.33.0**を`.frontier/tools/cre-1.33.0/`に限定導入。公式GitHub ReleaseのSHA-256と一致し、`version`の実行に成功した。システムPATHは変更していない。
- 独立Workflow packageにCRE TypeScript SDK **1.20.1**を固定し、Bun **1.2.21**で依存をインストール。rootのpackage.json / pnpm-lock.yamlは変更していない。Install scriptは実行していない。
- 実際のRescue Doctrine evaluatorと既存Evaluation Envelopeをbundleし、公開Practiceの1 EpisodeをNodeで実評価するfixture生成器を追加。
- 公式`handler`と`handlerInTee`の2経路を用意し、WorkflowのTypeScriptチェックが成功。
- 公式`cre workflow simulate`を両方のtriggerで実行したが、**どちらもCLI exit 1、`CRE_AUTHENTICATION_REQUIRED`**。WASMコンパイル・QuickJS実行前に停止した。

[検証状態JSON](../../workflows/chainlink-cre/evidence/compatibility-status.json)にVersion、checksum、Node結果Hash、両Simulationの失敗状態を記録した。個別の再実行レポートは`workflows/chainlink-cre/rescue-envelope/generated/`へ生成し、Gitには入れない。

## 以前の認証準備（履歴）

1. Chainlink CRE accountがなければ人間が作成する。
2. Repository rootで次を実行し、ブラウザでログインを完了する。

   ```powershell
   & '.frontier/tools/cre-1.33.0/bin/cre_v1.33.0_windows_amd64.exe' login
   ```

3. Confidential WorkflowsのPrivate Beta利用権限を確認する。通常のCLIログイン、Deploy access、Confidential accessは別の条件。今回の失敗からBeta権限の有無までは判断できない。

この作業では登録・ログイン・アクセス申請・デプロイ・送金を行っていない。CLIはログイン情報を持っていなかった。現在のCLIが表示する`CRE_API_KEY`の代替認証は、今回設定・使用していない。再現scriptは環境の秘密キーを子プロセスへ渡さず、既存CLIログインを使う設計である。

残り2日の判断では、**ログインと必要アクセスを早期に確保できないなら、Confidential賞の完成を前提にせず、他の実証を優先する**。

## 再現手順

Repository rootの依存は既にセットアップされている前提。

```powershell
# 1. 公開fixture生成。これはNodeでありCRE成功ではない。
pnpm exec tsx scripts/verify-cre-rescue.ts

# 2. 独立Workflow依存と型チェック
Push-Location workflows/chainlink-cre/rescue-envelope
bun install --frozen-lockfile --ignore-scripts
bun run typecheck
Pop-Location

# 3. 通常handler: 公式CLIでローカルSimulation
pnpm exec tsx scripts/verify-cre-rescue.ts --simulate

# 4. Confidential handler: 同じ公開fixtureをSecret API経由で受け取る
pnpm exec tsx scripts/verify-cre-rescue.ts --simulate --confidential
```

再現scriptは`--broadcast`を一切付けず、RPC、HTTP、LLM、Contract書込capabilityを使わない。実行前に実証用の公開fixtureだけを含む専用env fileを生成し、Repository rootの`.env`をCREへ読ませない。失敗時のCLI生ログやアカウント情報は保存せず、理由コードへ分類する。

なお、**WASM用Javy toolchainは未セットアップ**。SDKの現行実装はWindows Javyを通常`USERPROFILE/.cache/javy/`に導入するため、今回のworkspace限定tool install範囲では実行していない。認証解消後の初回コンパイル時に、Javyの導入先・ダウンロード・公式整合性確認も別途確認する。TypeScriptチェック済みというだけでWASMコンパイル成功とはしない。

CLI v1.33.0には`cre compile` commandは存在しなかった。SDKのコンパイラ入口は`cre-compile`だが、今回はJavyによるWASM生成を実行していない。`--skip-type-checks`や`--limits none`で検査を回避しない。

## Workflowの内容

| 経路 | 入力 | 実行すること | 現在の検証状態 |
| --- | --- | --- | --- |
| Trigger 0 / `handler` | config内の公開Doctrine・Episode | 既存Rescue evaluator実行、Envelope生成、Node結果との一致検査 | 認証で停止 |
| Trigger 1 / `handlerInTee` | `getSecret(RESCUE_PUBLIC_FIXTURE)`で読む同じ公開fixture | 同じ実計算と結果一致検査 | 認証で停止 |

Confidential経路のfixtureは**意図的に公開データ**である。秘密取得APIの互換性を確かめる準備であって、本物のhidden Finalではない。configにも比較用入力があるため、このfixtureに機密性はない。

`evaluatorBundleHash`は生成した既存evaluatorのJavaScript moduleを識別する。CRE Workflow全体のWASM Hash、TEE attestation、DON署名ではない。将来実行が成功した場合も、ローカルSimulationの成功からLive TEE attestationへ自動昇格させない。

既存adapterが返す`executionMode: local`、`creVerified: false`等は変えず、その外側に`handlerKind`と公式Simulationの測定状態を置く。旧Rescue outcome・transcript Hash、Practice APIの返却形式は変更しない。

## 成功条件と未実装

公式Simulationの成功は、CLI exit 0だけでは不十分。再現scriptはWorkflowの返却objectが存在し、handler種別・bundle Hash・**Envelope全体がNode結果と一致**したときだけ`simulation.state: passed`にする。未知の出力形式や途中停止は成功扱いしない。成功側のCLI返却形式はまだ実環境で確認できていないため、認証解消後にparserも確認が必要。

未完了:

- Javy / WASM compile、公式QuickJS実行、通常・Confidentialの結果一致。
- 実際の機密input、Frozen Entries、hidden Final pack、commitment / reveal。
- Receiver Contract、DON署名、Forwarder認可、onchain commitment。
- Confidential Beta access、Live deployment、TEE attestationの取得・検証。
- `/sponsors/chainlink-cre`の専用画面。

現在claimできるのは「公式SDK対応Workflowと公開互換性fixtureを実装し、公式CLIでは認証不足を確認した」まで。Node/Bun、import、型チェックをCRE成功・TEE検証・Final大会完成と呼ばない。

## 公式資料

- [CLI Windows導入](https://docs.chain.link/cre/getting-started/cli-installation/windows) — 手動導入とchecksum確認。
- [CLI v1.33.0 Release](https://github.com/smartcontractkit/cre-cli/releases/tag/v1.33.0) — 2026-09-09公開。導入ガイドの推奨表示v1.32.0より新しいReleaseを実際に確認して固定した。
- [Workflow Simulation](https://docs.chain.link/cre/guides/operations/simulating-workflows) — CLI認証、ローカルWASM実行、`--broadcast`との区別。
- [Confidential Workflow TypeScript](https://docs.chain.link/cre/guides/workflow/using-confidential-workflows/making-workflow-confidential-ts) — `handlerInTee`、動的Secret取得、Private Beta。
- [Confidential SDK Reference](https://docs.chain.link/cre/reference/sdk/confidential-workflows-client-ts) — `TeeRuntime`とDONへ渡す情報の境界。
- [TypeScript Runtime](https://docs.chain.link/cre/concepts/typescript-wasm-runtime) — Javy / QuickJSとNode API非互換。

SDK semanticsは、上記資料と実際にインストールした`@chainlink/cre-sdk@1.20.1`の型定義・コンパイル入口で確認した。

## S11-1 — 秘密Pack / Revealのローカル前段（2026-09-12追記）

**非本番・ローカル準備のみ。公式CRE / TEE / 未知Final大会の成功ではない。** 認証で停止した公式CLIは再試行していない。

追加したもの:

- [`scripts/lib/rescue-secret-pack.ts`](../../scripts/lib/rescue-secret-pack.ts): 最大8 Episodeの小さなPackをcommit → 検査 → 既存Evaluatorで評価 → 明示的reveal → 再評価する純粋関数。
- [`scripts/lib/rescue-secret-pack.test.ts`](../../scripts/lib/rescue-secret-pack.test.ts): Pack全パラメータ、順序、salt、Context、Artifact、Generator、Metric、Service Catalog、Result、公開境界の改ざんと秘密混入を検査。
- [`scripts/verify-cre-secret-pack.ts`](../../scripts/verify-cre-secret-pack.ts): 新しい乱数で3 Episodeを作り、Reveal後の再現と、実際にHashしたbrowser-target JavaScript bundleをNode V8で実行した結果の一致を検査する。ファイル・秘密値は保存しない。

### 何をCommitするか

256-bit salt、Generator version、順序付きseed列と生成された**全Episodeパラメータ**、固定戦略Artifact、Evaluator version / code Hash、独立した3 Metricsの定義・方向・境界、Service Catalog、時間・判断回数・予算、集計versionを一つのdomain-separated commitmentに含める。packの変更を単なるseed一致で見逃さない。

評価は既存`evaluateRescuePolicy`を直接呼ぶ。損失・需要提供率・支出の集計やゲームを複製せず、既存のContext / Result Hashも変更しない。最小対象は`simple-adaptive`等の既存8固定戦略であり、真相を読む`oracle`と`seeded-random`は対象外。外部AI Artifact / Prompt / Model実行は未接続。

### 公開情報と秘密情報の分離

| 段階 | 公開してよい情報 | 秘密として扱う情報 |
| --- | --- | --- |
| Commit | salt付きPack commitment | salt、seed、全Pack、Artifact / Contextの内訳 |
| 評価後・Reveal前 | 上記commitment、salt付き評価commitment、非本番境界フラグ | Outcome、unsalted Context / Result / Episode Hash、全パラメータ |
| 明示的Reveal後 | 完全なPack・salt・評価結果を受取人に開示し再計算可能 | このPackにはもはや秘密性がない |

小さなScenario空間では、unsalted HashやOutcome自体も総当たり・推定の材料になる。したがって公開receiptはそれらも返さない。失敗は固定の理由コードにし、JSON parse error、assert差分、入力値、元例外を公開しない。

再現scriptはNode `crypto.randomBytes(32)`でsaltと各seedを作る。純粋関数はsaltの形式しか検査できないため、**256-bitの新規乱数を使い、再利用しない責任は呼出し側にある**。テスト用固定saltを実運用へ持ち込まない。

### 再現Command

```powershell
pnpm exec vitest run scripts/lib/rescue-secret-pack.test.ts
pnpm exec tsx scripts/verify-cre-secret-pack.ts
```

scriptは入力をメモリ内だけに保持し、意図的なRevealもメモリ内で行う。標準出力は公開receipt、bundle Hash、成功した検査のフラグのみ。毎回saltとseedを作り直すので、**別実行のcommitmentが変わるのは正常**。同じPack / salt / Artifact / Runtimeなら同じcommitment・結果になることは固定fixtureテストで検証する。

`evaluatorBundleHash`はこのローカル検査で実行したJavaScript bundleのHashであり、ホストやWASM / TEEの認証ではない。各APIの`runtime.codeHash`は信頼したホストから与える前提で、第三者が任意に宣言した値から正しいRuntime実行を証明できるわけではない。

### まだ解決していない境界

この一連の関数はstatelessであり、公開commitmentの時刻・先着性、同時受付、Freeze、Reveal日時を強制しない。公開receiptは事前に保存したものを比較に使う必要があり、Revealerが一緒に差し替えたreceiptを信頼してはいけない。今回のscriptは永続保存をしないので、別日に第三者が運営の変更不能性を検査する大会運用ではない。

運営ホストはPackの真相を読める。秘密保管・アクセス制御、Hidden Final用generatorの未学習性、複数参加者の同一Context、Final Entry Freeze、外部AI実行、CREへの秘密入力受渡し、公式Simulation、TEE attestation、Onchain commitment、報酬は引き続き未実装または外部条件待ち。今回の追加を、上の未完了項目全体の解消と扱わない。
