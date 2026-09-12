# スポンサーDemo撮り直し — 実行済みのものだけを見せる

更新: 2026-09-12。PCは1日遠隔操作中。**再起動・スリープ・ネットワーク変更・既存dev server停止をしない。**

## 開くページ

ローカル: <http://localhost:3000/sponsors/demo>

英語の3章、実取引リンク、3種のEvidence Download。表示は記録済みの実行結果であり、開くだけでAI推論・送金・新規CRE実行はしない。GitHubへのコード公開とWebのDeployは別。公開デモURLとして提出する前に、Deployment完了と公開URLでの表示を確認すること。

## 何が本当に動いたか

| Sponsor | 実行済み | 言ってはいけないこと |
| --- | --- | --- |
| ENSv2 | 所有名→API発見→公開Practice検証。単一Text Key認可・更新・取消。Sepolia 7取引 | 第三者Market完成、Service購入代金の支払い |
| Chainlink | 公式CRE通常・Confidential Simulation。秘密Pack→Receipt→Reveal→独立Replay一致 | live TEE認証、本番Final・onchain commitment完了 |
| Bazantic | 実外部OpenAI AgentがMCPでManifestと2評価を実行。SDKとEvaluatorで検証 | Bazantic-hosted Recipe実行、Recipe効果のA/B、AIが改善した |

この3つは別のIntegration実証であり、1本の完全な大会Workflowではない。従来の実AI納品・Sepolia Token支払いデモは`/rescue-room/submission`に別途ある。

## 撮影の順番（約1〜2分）

1. 冒頭を5秒。その後`1 · ENS discovery`を押す。名前と3カードを見せ、`Inspect the onchain steps`からgrantかrevokeのEtherscanを開く。
2. `2 · CRE evaluation`へ。3段階、`passed`、Commitmentを見せる。必要なら下記commandを録画し、公式Simulationの成功を見せる。新しい公開Demo PackとEvidenceを生成するため、提出用録画とJSONは同じ実行のものを使う。
3. `3 · AI via Bazantic`へ。予算90→60と3軸同値を見せる。これは失敗ではなく「結果を都合よく変えずに評価できた」接続デモ。一般的な性能比較の実験成功とは別。
4. `Inspect the AI calls and submitted strategy`を開き、3つのHTTP 200を見せる。Evidence Downloadで締める。

### English narration（約1〜2分）

Who gets to decide what better means? Value Decentralization keeps outcomes independent instead of hiding that decision in one weighted score.

These are three working integrations for Rescue Room, an AI incident-response arena.

First, ENS. Our existing name resolves a Rescue practice service. The owner delegated permission for just one text record. The delegate activated and paused the service, and paused discovery was rejected. We then revoked permission and verified that another write was rejected. These are real Sepolia transactions.

Second, Chainlink CRE. We committed a fresh scenario before execution and supplied the private pack through a secret input. The official CRE confidential simulation returned a salted receipt. Independent Node execution matched it, and explicit reveal enabled replay. This is local simulation, not a live TEE attestation or a completed Final tournament.

Third, Bazantic. A real external AI called Bazantic MCP to read the manifest and evaluate two strategies under the same context. It lowered the investigation budget from ninety to sixty credits. Both strategies produced equal outcomes here. We show that tie honestly, keeping user loss, availability, and spending separate. This is external AI using Bazantic MCP, not a hosted Recipe execution.

Measure once. Preserve the tradeoffs. Let values diverge.

## 再確認commands

Repository rootで実行。

```powershell
# ENSの現在の状態とAPIを再確認。秘密鍵不使用・追加送金0。
pnpm exec tsx scripts/verify-ens-rescue.ts

# 公開済み証跡の独立再計算。ネット接続・推論・送金不要。
pnpm exec vitest run scripts/lib/sponsor-demo-evidence.test.ts

# CREの新しいDemo Packを公式実行して明示Reveal。AI・送金なし。
pnpm exec tsx scripts/verify-cre-private-pack.ts --simulate --reveal

# 公開Fixtureの公式CRE互換性チェック
pnpm exec tsx scripts/verify-cre-rescue.ts --simulate
pnpm exec tsx scripts/verify-cre-rescue.ts --simulate --confidential
```

CREには既存CLIログイン・Bun・SDK依存・Sepolia RPCが必要。今回はすべて動作済み。秘密入力の一時ファイルは実行後に除去する。明示Reveal前の入力を録画しない。

ENSの`demo-ens-rescue.ts --execute`は再実行しない。既存Record／Journalを検出して止まる設計であり、撮影用は上のread-only commandを使う。Delegate gas用0.001 Sepolia ETHを送付済み。残額と鍵はignoredのローカル保管で、権限は取消済み。

Bazanticの実AI試行は6回の上限に達したため、自動再実行しない。各回$0.10の保守的予約、計$0.60。これは請求実績ではない。成功した6回目は4モデル応答、input 9,358 / output 1,492 tokens。先行5回の失敗／不明状態をローカルJournalに保持しており、性能実験の6成功例と数えない。追加試行は予算・Journalを確認して別途対応。Recipe公開・Hosted実行が必要なら、Gateway決済設定／Hosted実行の条件確認が別途必要。

## スポンサーに渡す代表GitHubリンク

提出時は以下のリンクがGitHubで開けることを確認する。Web画面のDeployとは別に、コードと記録済みEvidenceを参照できる。

- ENS: [専用Service discovery実装](https://github.com/Jun0908/Decentralized-Value/blob/main/packages/ens-adapter/src/rescue.ts)（実認可と取引は[scripts/demo-ens-rescue.ts](../../scripts/demo-ens-rescue.ts)を参照）。
- Chainlink: [秘密Packの公式Confidential handler](https://github.com/Jun0908/Decentralized-Value/blob/main/workflows/chainlink-cre/rescue-envelope/secret-pack/main.ts)。
- Bazantic: [外部AIからBazantic MCPへ接続する実装](https://github.com/Jun0908/Decentralized-Value/blob/main/apps/api/src/bazantic-rescue-agent.ts)。

証跡: [ENS](../deployments/ensv2-rescue-demo.json)、[CRE](../deployments/chainlink-cre-private-pack.json)、[Bazantic](../deployments/bazantic-rescue-agent-demo.json)。秘密鍵、API Key、署名済みraw transaction、非公開JournalはGitに含めない。
