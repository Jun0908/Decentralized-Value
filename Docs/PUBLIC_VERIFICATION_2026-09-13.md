# 公開サイト・提出リンクの確認 — 2026-09-13

## Subsequent production review — scope clarification

This report verified pages, deterministic practice, proof handling, and saved evidence, not public AI inference. A later read-only check confirmed `commanderAvailable: false`, missing Ocean discovery, `/rescue-room` returning 404, and stale Sepolia showcase metadata. The user also supplied an Ocean AI configuration/duration and generated-bundle lint review. See the [confirmed findings, remaining checks, and repair plan](PRODUCTION_READINESS_2026-09-13.md). Earlier successful checks remain valid within their stated scope; they are not an all-features production-readiness approval.

対象: <https://web-rho-seven-d6te7t3f0y.vercel.app>。ローカルPreviewとは別に、実HTTPSで確認した。

## 公開コードとの対応

- Push済みCommit: [`033a73c`](https://github.com/Jun0908/Decentralized-Value/commit/033a73cc77d045affb3c2703c42313c6e2c4ca69)。下段3ArenaのPractice・イラストを含む。
- GitHub commit statusの`Vercel`は`success`。[Deployment status](https://vercel.com/jkawai0908-9469s-projects/web/43ktWN1dv4GhVbnhMxDNSynPKy5P)。公開ページでも同機能と画像を確認した。
- Vercelコネクターの接続アカウントではProject一覧を取得できなかったため、管理APIによるProduction aliasのCommit照合・Runtime logs監査は未実施。上記GitHub statusと実際の公開動作を根拠にする。
- この確認後に追加する初回ミッション・文書修正はローカル変更。別途Push／Deploy確認するまでは公開済みと扱わない。

## 実行確認

| 対象 | 確認内容 | 境界 |
| --- | --- | --- |
| Calldata | PC1440 / Mobile390。実EVM測定、Rule変更、前回比較、Context変更、Evidence DownloadとHTTP結果のHash一致 | 任意参加者コード実行、Ethereum送信ではない |
| Microgrid | 同2画面幅。Policy変更、実行、3軸比較、Replay再計算、JSON、Classic切替 | 学習用の決定論的Simulation。実電力網ではない |
| Secret Gate | 同2画面幅。実Proof生成→受理→同一ProofのHTTP409拒否。Receiptが`durable-redis`を明示。4Proof生成・検証も成功 | 今回の利用でRedis経由の受理／拒否を確認。Redis再起動・複数Region競合・長期運用の保証ではない。競技はPIVOT |
| 3イラスト | 同2画面幅。実画像読込、縦横比、3段階説明、横Overflowなし | 概念図をEvidenceと扱わない |
| Home / Arena一覧 / 上段3Arena / Sponsor / 英語提出画面 | 同2画面幅で計14画面、HTTP200、Console error 0、横Overflowなし | 上段3Arenaは入口の表示検証。全課金操作の実行確認ではない |
| Sponsor JSON | ENS / CRE / Bazanticの各DownloadがCommit済みJSONと一致、PC / Mobile計6Download | 保存済み実行記録。撮影時に取引や推論を再実行しない |
| 公開Rescue API→SDK | Manifest・Starter・2回のDoctrine評価を含む6実HTTPすべて200。Starter Hash・SDK Integrity・反復Result一致 | 非課金の公開Practice。署名認証、実支払い、本番Final、実参加者の成功ではない |

下段3ArenaはConsole error 0・禁止配色0・横Overflowなし。Secret Gateの意図したHTTP409のConsole通知は、各画面幅1件ずつ正常な拒否として別計数した。追加AI推論・送金は0。Secret Gateの公開グループへ検証用の使い捨てPublic commitmentを2件登録し、各1回のProofを消費した。秘密Identityは保存・公開していない。

## 再現コマンドとローカル証跡

```powershell
pnpm exec tsx scripts/verify-arena-labs.ts https://web-rho-seven-d6te7t3f0y.vercel.app --public-practice
pnpm exec tsx scripts/verify-arena-stories.ts https://web-rho-seven-d6te7t3f0y.vercel.app --public-practice
pnpm exec tsx scripts/verify-public-submission.ts
pnpm exec tsx scripts/verify-rescue-practice-onboarding.ts https://web-rho-seven-d6te7t3f0y.vercel.app
```

最初のコマンドは使い捨てGroup登録・Proof消費を行う。課金・送金は行わない。再実行はRate limitや実Storeの状態に影響するため、無制限に回さない。

ローカル画像と結果: `.frontier/arena-public-qa/`、`.frontier/arena-public-story-qa/`、`.frontier/public-submission-qa/`。これらはGit除外のQA記録で、公開Evidenceの代用にはしない。`verify-public-submission.ts`の記録時刻は2026-09-12T23:41:21Z（日本時間9月13日）。

## 残る提出判断

- 最新の英語提出文: [SUBMISSION_COPY_EN.md](SUBMISSION_COPY_EN.md)。3スポンサーの実装・Evidence・未完成範囲を更新。
- 音声入り最終動画の公開URL・閲覧権限・応募フォーム送信は未確認。
- スポンサー選択は本人指定のENS / Chainlink / Bazantic。賞の細分類、参加Track、審査期間の開始Commit、本人貢献は本人の確認事項。
- 当日の追加コードはこの公開検証対象Commitとは別。未知Final、第三者市場、Hosted Recipe、live TEEを完成済みにしない。
