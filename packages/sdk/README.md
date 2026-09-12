# Frontier SDK

現在のモノレポを正本とする Node.js 22 以降向けの TypeScript SDK です。`@frontier/sdk` / `@frontier/cli` は private workspace package であり、npm 公開済みではありません。

初めてRescue APIを使う場合は[外部AI開発者向け手順](../../Docs/RESCUE_AGENT_QUICKSTART.md)を参照。`pnpm exec tsx scripts/verify-rescue-practice-onboarding.ts http://localhost:3000`で接続・Starter・Practice・Hashを段階別に検査でき、認証要求や402では自動支払いせず停止します。リポジトリルートで実行する検証ツールであり、SDKの新しい公開メソッドではありません。

## 現在の対応範囲

- Disaster Response: Arena 発見、Starter の SHA 検証、Context 固定 Practice、同じ Context の比較、認証付き提出・履歴・Final Entry 選択。
- Rescue Room: 決定論的な単一 Episode の Doctrine Practice と比較。保存・Final Entry は未対応です。
- Ocean Commons の AI Season、永続 Job、Sponsor 接続の公開契約は後続の Plan12 対象です。汎用の旧 SDK メソッドがあることを、型・実行時検証付き対応と同一視しません。

```typescript
import { FrontierClient, compareRuns, verifyRescueDoctrinePracticeIntegrity } from "@frontier/sdk";

const client = new FrontierClient({ baseUrl: "http://localhost:3000" });
const manifest = await client.arenas.get("rescue-room");
const input = {
  arenaId: "rescue-room" as const,
  artifact: manifest.artifact.sample,
  episodeId: manifest.episodes[0]!.id,
  context: manifest.context,
};
const run = await client.evaluations.practice(input);
const integrity = verifyRescueDoctrinePracticeIntegrity({ request: input, run });
console.log(run.values, run.resultHash);
console.log(integrity.verification); // "hash-consistency", not evaluator replay or payment
// compareRuns(run, anotherRun) rejects incompatible origins, episodes or contexts.
void compareRuns;
```

`runId` は SDK が作るローカル ID であり、永続サーバー Job ID ではありません。ゲーム内 credits は token や実支払いではなく、Practice は Reward 対象ではありません。正当性は比較の前提であり、独立した評価軸を一つの総合点に集約しません。

## Rescue Doctrineの独立Hash照合（明示実行）

`verifyRescueDoctrinePracticeIntegrity({ request, run })`は純粋関数の追加境界です。既存`evaluations.practice`の動作・応答・公開APIを変更せず、必要な呼び出し側だけが明示的に使います。Evaluator、OpenAI、RPC、Wallet、ネットワーク接続は使用しません。

- `request`には**実行前に別途保持した**Artifact、Episode、Contextを渡します。応答の内容をそのまま期待値にコピーしないでください。
- 対応は`rescue-doctrine-v0`、`rescue-doctrine-interpreter-v0`、`rescue-practice-pack-2026-09-v0`の単一Episode Practiceです。AI Playbook、追加のService継続Demo、Final、未知Versionには転用できません。
- 元Artifactの名前のtrim、認可Service／Action集合の辞書順整列を正規化し、Service Priorityの順序は保持します。v0には省略可能な既定値はなく、必須Field欠落を補完しません。これはHash用の構造・正規化であり、Doctrineの業務ルールを再実行するものではありません。
- Artifact、Evaluation、Outcome、Transcript、Payment Evidenceの各Hashを再計算し、提供された入力があるOrder／Action／Receipt／Deliverable／AcceptanceのHashと相互参照も確認します。SDKの`values`、`correctness`、Episode、Context、Metric方向との食い違いも拒否します。
- 非有限値、Getter、循環参照、未知Field／Version、改ざん、不一致は`FrontierError`として失敗し、入力値や秘密情報をErrorへ転記しません。Legacy Rescueの`canonicalProtocolJson`を使用し、新しいRequest／Result V2 Hashへ変更しません。

成功Reportの`integrityVerified: true`は**Hashの整合性のみ**です。`evaluatorReplay`、`correctnessVerified`、`signatureVerified`、`paymentVerified`、`commitmentPreimagesVerified`は常に`false`。Context／Manifest／Episode／Service Manifest／Public ViewのDigestは対応を照合しますが、与えられていない元データを復元して正しさを証明しません。整合的に捏造したBundleを真正な測定結果と認定する機能ではありません。`runId`、日時、Origin等も測定結果Hashの外側です。

EvaluatorによるReplayは引き続き別段階です。ローカル検証は`pnpm exec vitest run packages/sdk/src/rescue-integrity.test.ts`、既存APIとの比較・Replayは`pnpm exec tsx scripts/verify-rescue-submission-api.ts`を使用します。[SDK sample](examples/rescue-practice.ts)は取得後にこの整合性検証を呼び、Reportを明示します。

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
