# Chainlink CRE — Rescue Evaluator互換性検証

最終確認: 2026-09-12 JST。**通常・Confidentialとも公式CLIの認証で停止。CRE実行成功ではない。**

## 今できたこと

- Windows公式CRE CLI **v1.33.0**を`.frontier/tools/cre-1.33.0/`に限定導入。公式GitHub ReleaseのSHA-256と一致し、`version`の実行に成功した。システムPATHは変更していない。
- 独立Workflow packageにCRE TypeScript SDK **1.20.1**を固定し、Bun **1.2.21**で依存をインストール。rootのpackage.json / pnpm-lock.yamlは変更していない。Install scriptは実行していない。
- 実際のRescue Doctrine evaluatorと既存Evaluation Envelopeをbundleし、公開Practiceの1 EpisodeをNodeで実評価するfixture生成器を追加。
- 公式`handler`と`handlerInTee`の2経路を用意し、WorkflowのTypeScriptチェックが成功。
- 公式`cre workflow simulate`を両方のtriggerで実行したが、**どちらもCLI exit 1、`CRE_AUTHENTICATION_REQUIRED`**。WASMコンパイル・QuickJS実行前に停止した。

[検証状態JSON](../../workflows/chainlink-cre/evidence/compatibility-status.json)にVersion、checksum、Node結果Hash、両Simulationの失敗状態を記録した。個別の再実行レポートは`workflows/chainlink-cre/rescue-envelope/generated/`へ生成し、Gitには入れない。

## 人間に必要な操作 — 最優先

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
