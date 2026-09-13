# 外部AI開発者向け — Rescue Practiceの最短手順

2026-09-12。対象は**非課金・単一Episode・決定論的Doctrine Practice**。AI推論API、実支払い、戦略のサーバー保存、Final Entryではない。SDKはモノレポ内のprivate packageであり、`npm install @frontier/sdk`を公開済みの導入方法として案内しない。

## 1. ローカルで起動する

Node.js 22以降、リポジトリ指定のpnpmを用意し、リポジトリルートで実行する。新しいコピーで行う場合も、秘密ファイルを共有する必要はない。

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:tooling
pnpm --filter @frontier/web exec next dev --hostname 127.0.0.1 --port 3000
```

既に3000番で起動しているなら、二重起動せず次へ進む。installには依存取得が必要になる場合がある。`--ignore-scripts`で自動lifecycle実行を省き、明示的なtooling buildでSDK / CLIを生成する。

## 2. 初回チェックを実行する

別ターミナルから次を実行する。

```sh
pnpm exec tsx scripts/verify-rescue-practice-onboarding.ts http://localhost:3000
```

このコマンドは次の順で検査する。

1. Public PracticeのManifestと非課金・非報酬の対応範囲。
2. Starter ZIPの取得とSHA-256一致。ZIPを展開・実行しない。
3. 取得したContextとEpisodeを固定してStarter Doctrineを評価。
4. SDKでArtifact・Evaluation・Outcome・Transcript・Payment EvidenceのHash整合性を確認。
5. 同じ入力をもう一度評価し、Hashと独立3軸が一致することを確認。

正常時は6 HTTPリクエスト、最後に`verified: true`、`repeatedHashMatch: true`を返す。失敗時は非ゼロ終了と`phase` / `code` / `nextAction`を返す。外部サーバーの生エラー・任意のdetailsは表示しない。APIキー、Wallet、環境変数を読み込まず、認証情報を送らない。推論・支払い経路は許可リストに含めず、自動リトライもしない。

公開後は、所有者が確認した**正確なHTTPS Origin**に置き換えられる。`/path`、query、fragment、URL埋込認証は渡さない。今回の成功はlocalhostだけであり、既存の公開URLに新実装が反映されたことを意味しない。

## 3. 自分の戦略を試す

[SDK example](../packages/sdk/examples/rescue-practice.ts)の`artifact`へ自分のDoctrineを渡す。最初はManifestの`artifact.sample`をコピーし、Starterが公開するSchemaの範囲だけ変更する。CLIの`check`とSimulationを混同しない。

```sh
pnpm exec tsx packages/sdk/examples/rescue-practice.ts http://localhost:3000
```

サンプルは詳細Evidenceも出力する。最初の接続診断だけなら、上のpreflightの方が短い。`context`と`episodeId`は実行前に保持し、返却された結果から「期待値」を作り直さない。比較する結果のOrigin・Context・Episodeを揃える。

| 数値 | 意味 | 望ましい方向 |
| --- | --- | --- |
| `totalUserLossUsd` | 架空Protocolで失われたユーザー資産 | 小さい |
| `servedProtocolDemandPpm` | 提供できた需要の割合。1,000,000が100% | 大きい |
| `netResponseSpendCredits` | ゲーム内の調査対応費用 | 小さい |

3軸を合算して勝者を決めない。`correctness: false`は比較・配分の対象外。`verified: true`は操作・Hash整合性の成功であり、戦略の強さや正しい診断の証明ではない。

## 4. 失敗時の対応

| Code | 対応 |
| --- | --- |
| `INVALID_ORIGIN` | サーバーのOriginだけを指定し直す |
| `AUTH_REQUIRED` / `PAYMENT_REQUIRED` | 停止。Public Practiceに鍵を渡したり、402へ支払ったりしない |
| `RATE_LIMITED` | 時間を置いて明示的に再実行。大量リトライしない |
| `CONTEXT_MISMATCH` | 新Manifestを取得し、新しい比較セットとして開始する |
| `STARTER_HASH_MISMATCH` | 取得したStarterを実行せず、配布側の整合性を確認する |
| `INTEGRITY_FAILED` / `REPEAT_MISMATCH` | 結果を採用せず、Evaluator / SDKの対応Versionを確認する |
| `REDIRECT_REJECTED` | リダイレクト先を自動追跡しない。管理者に最終Originを確認する |
| `TIMEOUT` / `UNAVAILABLE` | 起動・接続状態を確認する。Timeout時のサーバー完了状態は不明 |
| `UNSUPPORTED_MANIFEST` / `INVALID_RESPONSE` | 非対応モードや古いデプロイの可能性。Schema・Version・経路を確認する |

## 検証の限界

- SDKによるHash照合は、署名・実モデル由来・実決済・Evaluatorの真正性の証明ではない。
- 隔離してEvaluatorを再実行する手順は[引継ぎ](RESCUE_HANDOFF.md)を参照。
- モデルを何度呼び直しても同じ判断になるとは仮定しない。再現対象は記録済みActionからのSimulation。
- この入口にOperator用のBearer Token、秘密鍵、管理・送金機能を追加しない。
- ユニットテストは実API handlerへの注入fetch。実HTTP確認とは別に報告する。

```sh
pnpm exec vitest run scripts/lib/rescue-practice-preflight.test.ts
```
