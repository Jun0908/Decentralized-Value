# Plan — Secret Gate の実証ウォークスルー改善

## 一目で分かるイラスト — 2026-09-13

- [x] 冒頭に専用イラスト `apps/web/public/images/secret-gate-membership-story.png` を追加。
- [x] 閉じた秘密の金庫→Membership Proof→入場Gate、再使用拒否を一枚で示す。秘密は送らずPublic commitmentのみ登録する説明を添える。競技PIVOTは保持。
- [x] PCは絵＋説明の2列、Mobileは画像を切らず縦積み。文字を絵に重ねずHTMLとして表示。
- [x] 1440 / 390pxで読込み、3段階説明、Console error 0、横Overflowなしを確認。Web build・既存Arena登録テスト3件・変更範囲ESLint成功。

表示は共通 `arena-intro-story.tsx` から対象3Arenaのみ。イラストは概念説明でありEvidenceではない。画像生成の方式・保存先・最終Promptは[素材記録](ARENA_ILLUSTRATIONS.md)。確認手順: `pnpm exec tsx scripts/verify-arena-stories.ts http://127.0.0.1:3014`。画面: `.frontier/arena-story-qa/`。評価処理・API・公開Deploymentは変更していない。Push未実施。

## 目的と判断（2026-09-12）

Secret Gate は「秘密を送らずにグループ所属を証明し、同じ資格では一度だけ通過する」実 Semaphore V4 デモとして改善する。Latency / Memory 競技は **PIVOT を維持**する。4 戦略 × 2 試行、32 Proof の検証成功は暗号学的動作の根拠であり、測定競技の成立根拠ではない。事前 CV 上限 0.15 に対して最大 Latency 0.595 / Memory 0.331 だった。

今回は独立価値を成立させるためだけの合成スコアや、並列数だけで自明に攻略できる架空の競技を追加しない。実証 UI と設定の構造的効果を優先する。公式大会、ランキング、Value Pool、Reward は閉じたままとする。

## 今回の実装対象と受入条件

- [x] ブラウザの秘密 → 公開 commitment → 8 人の合成 group → proof → Gate の図と段階表示。待機・実行・完了を色だけに依存せず区別する。
- [x] Identity 作成、登録、実 proof 生成 / 検証、同一 proof の再送による拒否を、明示的に一段ずつ操作できる実装。実ブラウザ操作検証は下記に分離。
- [x] Identity secret を画面・Evidence・API に出さない。保存は opt-in、ローカル保存削除と失敗時の説明を用意する。
- [x] 並列数 1–4、artifact loading、Worker lifecycle の意味と代償を常時説明。4 件の割り当て図は構造だけを表し、予測時間・予測メモリではない。
- [x] 実 proof 4 件の進行を可視化。集計に使った設定と観測を Evidence として確認できる。p95 は 4 件では最大完了時間と同じであると説明する。
- [x] Artifact prefetch を含むバッチ開始からの時間を記録し、ブラウザメモリ推定を OS RSS と混同しない。観測値でランキングしない。
- [x] API 検証や nullifier 防御は変更しない。キャンセル・失敗・二重実行・2 分の Worker timeout を扱い、成功の捏造をしない。Gate 送信後のキャンセルを取り消しと表示しない。
- [x] 専用 CSS Module、明示的な前景 / 背景、キーボード focus、mobile stack、reduced-motion 対応。
- [x] 全 16 設定の構造・不正パラメータ・p95 の決定論テスト。チェックイン済み WASM / zkey を明示した実 proof テスト含め 7 件成功。変更範囲 ESLint、Secret Gate / Web 型検査成功。
- [x] 統合buildとdesktop / mobile / 実proofブラウザー操作を確認した。型検査初回は並行作業中のCalldata routeの型不一致で停止したが、修正後の再実行は成功。

## 実現性と保留

成立するのは、実際の匿名 membership と scope 固有の一度限り使用を理解できる **教育・実証 Arena**。参加者 uniqueness、personhood、production authorization は証明しない。合成 cohort の登録サーバは commitment と個別 root を知るため、実世界の追跡不可能性は主張しない。

戦略空間は 4 × 2 × 2 = 16 設定で有限。設定構造の全列挙は容易であり、現状から未知 Final での AI 判断競技が成立したとは言えない。固定戦略の優劣は端末 / cache / OS に依存するため UI のモデルで判定しない。

再開条件は別途、同一環境・十分な反復・事前条件の固定・Raw Evidence・安定性確認・非自明な独立 Outcome を揃えた feasibility 実験。今回の見た目改善は GO 条件を満たさない。

保留: 新 circuit、可変 group / scope、任意コード、AI inference、hidden Final、onchain gate / nullifier、Sepolia 送金、Reward、公式 Pareto 競技、production 強化。

## 変更範囲

`packages/secret-gate/**`、`apps/web/src/components/secret-gate-*`、本 Plan、`Docs/arenas/secret-gate.md` のみ。中央 API / routes / registry / global CSS / 依存関係は変更しない。

## 操作検証の引継ぎ

`/arenas/secret-gate` の `secret-gate-create` → `secret-gate-enroll` → `secret-gate-enter` → `secret-gate-duplicate` を実行する。`secret-gate-stages[data-phase]` は `idle` → `identity` → `enrolled` → `proving` → `verifying` → `entered` → `duplicate-rejected`。`secret-gate-duplicate-result` に HTTP 409 / NULLIFIER_ALREADY_USED が出ること、元 receipt が残ることを確認する。

`secret-gate-benchmark` で 4 Proof、`secret-gate-proof-progress` の全 verified、`secret-gate-benchmark-result` と `secret-gate-evidence` の設定 / Raw Observation を確認する。設定変更後に既存結果の設定が変わらないこと、Cancel で偽の成功を表示しないことも対象。

本番モードで Redis がない場合は fail-closed を維持する。ローカル検証用に既存の development MemoryStore と実 route handler を使った場合は、その証跡を live Redis / production の検証と呼ばない。今回 Secret Gate 担当による外部通信・AI 推論・送金・deploy・commit はない。

## 完成画面と実HTTP検証

確認用: <http://127.0.0.1:3014/arenas/secret-gate>（ローカル専用）。

1440px / 390pxでIdentity作成→Snapshot→実Semaphore Proof生成→実Verifierによる受理→同一Proof再送のHTTP409 / `NULLIFIER_ALREADY_USED`を確認した。元のReceiptは保持される。2並列で4Proofを生成・検証し、設定を3へ変更しても記録済み観測の設定が2のまま保持されることを確認。PIVOT表示も維持。秘密を送るHTTP Fieldはなく、成功確認にブラウザー応答のMockは使用していない。

画面は最終Production build、Gateの2つのPOSTは `scripts/preview-arena-labs.ts` のloopback専用開発プレビューが既存の実Route HandlerとMemoryStoreへ接続する。本番のRedis必須条件は変更していない。再起動で一度限りの使用記録が失われるため、公開大会や本番認証には使わない。AI・支払い等のPOSTはこのプレビューでは拒否する。

Console error 0（意図した重複拒否409の通知は別記録）、横Overflow・禁止配色0。画像は `.frontier/arena-labs-qa/secret-gate-stages-1440.png` / `secret-gate-stages-390.png`、統合結果は同ディレクトリの `report.json`。全体TypeScriptテスト818成功・11skip、Workspace型検査、最終Production build成功。キャンセル・2分timeoutの実ブラウザー待ち切り試験と実Redis再検証は今回未実施。

## ローカルプレビューの再起動手順

ビルド後、2つのターミナルで順に起動する。PC再起動や既存3000番サーバーの停止は不要。

```powershell
pnpm --filter @frontier/web build
pnpm --filter @frontier/web exec next start -p 3013 -H 127.0.0.1
```

```powershell
pnpm exec tsx --tsconfig apps/web/tsconfig.json scripts/preview-arena-labs.ts 3013 3014
```

検証: `pnpm exec tsx scripts/verify-arena-labs.ts http://127.0.0.1:3014`。3Arenaともこのプレビューで試せる。ポート使用中なら既存の起動済みプレビューを利用する。
