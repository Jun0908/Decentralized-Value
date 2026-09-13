# DV-ver2 / SDK・CLI 統合記録

更新日: 2026-09-11

## 統合方針

`Decentralized-Value` の履歴と最新実装を正本にし、無関係な履歴を `--allow-unrelated-histories` で強制結合せず、機能差分を三方向統合した。

- 統合元の正本: `2e1e5f7`（Rescue Room payment foundation）
- アプリ参照スナップショット: `DV-ver2` の `101e13f`
- SDK・CLI参照スナップショット: `SDK-Decentralized-Value` の `f84d825`
- 統合作業ブランチ: `integrate/dv-ver2-sdk-cli`
- 統合作業worktree: `C:\Users\j_kaw\Desktop\DV-integration`

`DV-ver2` のアプリ差分は、内容が最も近い正本側の `be18b30` を共通基準として適用した。これにより、その後のOcean Commons修正とRescue Room Paymentsを保持したまま、CLI/API/UI差分を取り込んだ。

## 取り込んだもの

- CLI用Device認証、scope、one-time exchange、失効・取消処理
- Disaster Responseの冪等な提出、履歴、download、Final Entry選択
- CLI manifest、response schema、OpenAPI契約と生成スナップショット
- `/docs/cli`、`/cli/authorize`、`/submissions/[id]`
- Redis互換読み取りと回帰テスト
- `packages/sdk` 0.3.0と`packages/cli` 0.3.0
- GitBook用Whitepaper原稿と図版
- SDK・CLIの設計資料

SDKとCLIは外部tarballではなく、`@frontier/shared`を正本とするprivate workspace packageへ変更した。`build:tooling`はshared、SDK、CLIの順に再現可能な成果物を生成する。

## Rescue Roomとの統合調整

Rescue Room Starter Kitに追加済みの`payment-contract.json`をCLIの安全なZIP allowlistへ追加し、初期化時に公開Payment契約として展開するようにした。ゲーム内creditとtoken、simulatedとpaidの区別は維持する。

## 意図的に取り込まなかったもの

- 失敗画面を含む大量のSDK/CLI検証スクリーンショット
- 配布済みtarballなど再生成可能なbinary artifact
- 統合時だけ必要だったroot handoff文書と一時的なAGENTS追記

構造化されたローカル検証結果だけを`artifacts/sdk-cli-verification/stack-report.json`へ再生成した。実アカウント、公開環境、npm publish、Sepolia送金は使用していない。

## 統合後の検証

- `pnpm build:tooling`
- `pnpm typecheck`
- `pnpm test:ts`: 375 passed / 11 skipped
- `pnpm verify:cli`: 5 complete local-only workflows
- `pnpm --filter @frontier/web build`
- `pnpm exec eslint .`
- Home、CLI Guide、CLI Authorize、Saved Submission、Rescue Roomを含む6つのdesktop/mobile browser check

未実施なのはFoundryが必要なcontract test、実Privy認証、実Redis移行、npm公開、公開環境へのdeployである。
