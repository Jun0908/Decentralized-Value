# Bazantic: Rescue Practice local readiness

現在の対象は、既存の非課金 Rescue Doctrine Practice API を使う [Recipe](recipe.md) と、Recipe の有無だけを変える [A/B 比較基盤](experiments/README.md) です。

実装済みなのはローカルの検証基盤です。Gateway の登録・有効化・実接続、外部 AI による比較実行、Recipe による改善、スポンサー賞の応募資格は、この検証では証明しません。以前の `mcp-tools.json` は別の汎用・課金 Evaluation の対応表であり、今回の Rescue Recipe のツール登録ファイルではありません。

## ローカル確認

Repository ルートから実行します。

```powershell
pnpm exec vitest run bazantic/experiments/ab-harness.test.ts
pnpm exec tsx scripts/verify-bazantic-readiness.ts
```

検証スクリプトは公開 Recipe とプロセス内 API 形状 Fixture／実際の決定的 Doctrine Evaluator を使い、事前指定の先頭 2 Episode × 2 Seed × A/B の全件要約を JSON で標準出力します。`--full` を付けると要求・応答・Tool 履歴を含む全 Report を出力します。ファイル保存・上書き、`.env`／秘密鍵の読取、HTTP、AI、Gateway、RPC、送金は行いません。Fixture のプリセット切替は人工的な入力差で、AI が Recipe を読んで判断した結果ではありません。

現行 SDK には `arenas.get` → `arenas.downloadStarter` → `evaluations.practice` という同じ非課金経路があります。SDK／CLI の生成契約や HTTP 検証は別タスクで保守し、この基盤は変更しません。プロセス内 Fixture の成功と実 HTTP／Gateway／公開デプロイの成功は別です。

## 実連携前に残るもの

1. アカウント、username、参加区分／応募条件を人間が確認する。
2. 承認された公開 HTTPS API／OpenAPI を固定し、3 操作の実 Gateway tool 名、非課金設定、Context header 転送を確認する。Gateway URL／Service ID／Recipe ID を推測しない。
3. 同じモデル・設定・初期会話・ツール権限・API Snapshot・Episode・Seed の独立 A/B セッションを準備する。実 AI の呼出し費用は Practice API の非課金性とは別に承認が必要。
4. 失敗・同等・悪化を含む全試行、入出力／Recipe Hash／ツール履歴を保存する。実モデル ID・Gateway の出所と証跡は別に検証する。
5. 公開前に秘密情報を確認し、必要な動画／提出物を人間が準備する。勝利や採択を保証しない。

詳細は [認証・応募条件](../Docs/sponsors/MANUAL_ACTION_REQUIRED.md) を参照。アカウント操作、登録、Push、公開、課金はこのローカル検証の権限に含みません。
