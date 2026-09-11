# Frontier SDK

現在のモノレポを正本とする Node.js 22 以降向けの TypeScript SDK です。`@frontier/sdk` / `@frontier/cli` は private workspace package であり、npm 公開済みではありません。

## 現在の対応範囲

- Disaster Response: Arena 発見、Starter の SHA 検証、Context 固定 Practice、同じ Context の比較、認証付き提出・履歴・Final Entry 選択。
- Rescue Room: 決定論的な単一 Episode の Doctrine Practice と比較。保存・Final Entry は未対応です。
- Ocean Commons の AI Season、永続 Job、Sponsor 接続の公開契約は後続の Plan12 対象です。汎用の旧 SDK メソッドがあることを、型・実行時検証付き対応と同一視しません。

```typescript
import { FrontierClient, compareRuns } from "@frontier/sdk";

const client = new FrontierClient({ baseUrl: "http://localhost:3000" });
const manifest = await client.arenas.get("rescue-room");
const run = await client.evaluations.practice({
  arenaId: manifest.id,
  artifact: manifest.artifact.sample,
  context: manifest.context,
});
console.log(run.values, run.resultHash);
// compareRuns(run, anotherRun) rejects incompatible origins, episodes or contexts.
void compareRuns;
```

`runId` は SDK が作るローカル ID であり、永続サーバー Job ID ではありません。ゲーム内 credits は token や実支払いではなく、Practice は Reward 対象ではありません。正当性は比較の前提であり、独立した評価軸を一つの総合点に集約しません。

認証は `auth.getHeaders` から注入します。CLI の device login / OS credential storage は [CLI README](../cli/README.md) を参照してください。秘密鍵や認証 token をソース・Artifact・ログに書き込まないでください。

## 契約生成と検証

リポジトリルートで実行します。別リポジトリのコピーや古い tarball は不要です。

```sh
pnpm contracts:cli
pnpm contracts:sdk
pnpm contracts:cli:check
pnpm contracts:sdk:check
pnpm exec vitest run tests/contract-tooling.test.ts tests/sdk.test.ts
pnpm verify:packages
```

`contracts:cli` が既存の公開 Schema から OpenAPI と CLI Schema snapshot を更新し、`contracts:sdk` がそれを SDK 型・request validator・決定論的 Fixture に接続します。request validator は API の Zod 宣言を AST から取り出し、`superRefine` による業務検証を維持します。生成ファイルは直接編集しません。

両方の `:check` は不足・差分を報告して失敗し、作業ファイルを変更しません。CRLF / LF の差だけは無視します。`generated/provenance.json` は直接入力の Hash と生成ツール版を記録します。評価器の全依存の証明や、オンチェーン署名の検証ではありません。CLI / Web のコマンド資料同期、全応答の runtime Schema 統合は後続です。

`verify:packages` は現在の shared / SDK / CLI を build → `pnpm pack` し、workspace 外の空の一時 consumer へ実 tarball を npm install します。現在の TypeScript / Node 型で NodeNext を型検査し、ESM import・fetch 注入による SDK 呼び出し・CLI help / version を検証します。依存の不足・ローカル参照残存・Version 不整合は成功扱いにしません。

第三者依存の取得には npm へのネットワーク接続が必要です。install の lifecycle scripts、npm publish、デプロイ、実 API への登録・提出・送金は実行しません。成果物・検証レポート・consumer は出力された OS 一時ディレクトリに残します。検証成功は npm 公開・本番認証・実決済・他 OS の動作保証を意味しません。

生成・配布検証は [元 SDK repository の f84d825](https://github.com/Jun0908/SDK-Decentralized-Value/tree/f84d82512c43d0dc2b34a416d9821691c774dd89/scripts) を現行モノレポへ移植しています。
