# Ocean Commons — Merge Notes

**宛先:** `main` で作業しているエージェント（Codex / 計画9 Rescue Room 担当）
**ブランチ:** `arena/ocean-commons`
**作成日:** 2026-09-10
**状態:** Phase 0 完了（判定 `PIVOT`）。Web UI・API への接続はまだ行っていない

計画10 Ocean Commons は、計画9 Rescue Room と**並行して**別のworktreeで開発されました。この文書は、その成果を `main` へ取り込むときに必要な情報だけをまとめたものです。

## 1. 衝突しないこと

このブランチは**新規ファイルしか作っていません**。計画9が触る共通接続ファイルには一切変更を加えていないため、`git merge arena/ocean-commons` は衝突しないはずです。

意図的に**変更しなかった**ファイル:

```text
apps/web/src/lib/arenas.ts
apps/web/src/lib/arena-adapters.tsx
apps/api/src/index.ts
apps/runner/src/index.ts
packages/sdk/src/index.ts
openapi/frontier-v1.yaml
package.json
README.md / Docs/README.md / Docs/STATUS.md
packages/contracts/
```

例外は `pnpm-lock.yaml` です。新規workspace packageを追加したため、importerエントリが1つ増えます。衝突した場合はマージ後に `pnpm install` を再実行すれば解消します。

## 2. 追加されるファイル

```text
packages/ocean-commons/
  package.json                  @frontier/ocean-commons
  tsconfig.json
  src/types.ts                  海・船・契約の型
  src/rng.ts                    決定論的PRNG (mulberry32)
  src/scenario.ts               Zone / Fleet / Weather Sequence 生成
  src/engine.ts                 transition(state, actions, scenario)
  src/negotiation.ts            proposal検証 / escrow / 遵守判定 / settlement
  src/agents.ts                 Observation / Wallet Policy / Baseline 5種
  src/match.ts                  Match Loop、Wallet Policy 強制
  src/evaluator.ts              独立Outcome / 反実仮想 / Pareto / Hash
  src/index.ts
  src/index.test.ts             19テスト

scripts/simulate-ocean-commons.ts   Phase 0 判定Runner

Docs/Plan10.md                  設計と Phase 0 結果
Docs/plans/ocean-commons-merge.md   この文書
```

依存は `@frontier/shared` と `viem` のみで、いずれも既存パッケージが使っているものと同じです。

## 3. 計画9と重複しているプリミティブ

両Arenaは次を独立に実装しています。**Phase 0 の段階では意図的に共通化していません**（計画10 §27、および計画9 §18の「最初から全面的に抽象化しない」方針に従う）。

| プリミティブ | Ocean Commons の実装 | Rescue Room 側 |
| --- | --- | --- |
| Agent Wallet / 支出権限 | `agents.ts` の `WalletPolicy`、強制は `match.ts` | Budget Ledger |
| Escrow (lock / release / refund) | `negotiation.ts` | Service Escrow |
| 構造化 Proposal / Accept | `types.ts` の `Proposal` / `ProposalResponse` | Service Order / Evidence Receipt |
| 決定論的 transition + Replay | `engine.ts` / `evaluator.ts` | `transition` / Transcript |
| Scenario Generator + Seed | `scenario.ts` | Episode Generator |
| 統合しない独立Outcome | `evaluator.ts` の `oceanMetrics`（3軸） | 3 Outcome |

**両方が Phase 0 を通過した時点で、2つの実装を比較して共通基盤を抽出することを提案します。** 第一候補は `packages/shared` へ `escrow` と `agent-wallet` を追加する案です（計画10 §27）。

先に片方だけで抽象化すると、もう片方の要件が反映されないまま固定されます。特に **Escrow の意味論が両者で異なる**点に注意してください。

- Rescue Room: サービス提供に対する対価（成果物と引き換え）
- Ocean Commons: **不作為**に対する対価（何もしないことを買う）。遵守判定はEngineの測定値で行い、違反時は残額を支払者へ返還する

## 4. Phase 1 で共通接続ファイルへ入れる差分

計画9が着地したあとに適用します。**まだ適用していません。**

- `apps/web/src/lib/arenas.ts` — `arenaRegistry` に `ocean-commons` エントリを追加（配列末尾への追記のみ）
- `apps/web/src/lib/arena-adapters.tsx` — Ocean Commons Workbench への fail-closed adapter
- `apps/runner/src/` — `ocean-commons-runner.ts` を追加し、`index.ts` から登録
- `openapi/frontier-v1.yaml` — `/v1/ocean-commons` を追加
- `package.json` — `@frontier/ocean-commons` を依存に追加（現在 `scripts/` からは相対パスで読んでいるため未追加）
- `Docs/STATUS.md` — Phase 0 の判定結果を記録
- `Docs/arenas/ocean-commons.md` — Arena仕様（Phase 1で作成）

## 5. 確認方法

```bash
pnpm --filter @frontier/ocean-commons typecheck
npx vitest run packages/ocean-commons          # 19テスト
npx tsx scripts/simulate-ocean-commons.ts 200  # Phase 0 判定、約5秒
```

Simulationは §21 の GO 条件10項目を機械的に判定して `GO` / `PIVOT` を出力します。閾値は測定前に `Docs/Plan10.md` へ固定してあり、実測値に合わせて動かしていません。

## 6. 現時点の判定と未解決事項

**PIVOT（10項目中9項目 PASS）。** 詳細は `Docs/Plan10.md` §32。

未達は #6 のみです。Conservation Fund の導入で #4 は基準を満たしました（0.5% → 5.8%）。#6 は「機構が働かない」ではなく、基金によってEscrowが潤沢になり離脱が起きなくなったため**感度を測定できない**という状態です。詳細と対処案は §32.4 / §32.6。

この判定は Ocean Commons 側の設計問題であり、計画9 Rescue Room には影響しません。
