# Raw tools vs Recipe: ローカル比較契約

`ab-harness.ts` の `runRecipeExperiment(config, recipe, { makeRunner, port })` が比較本体です。A は Recipe なし、B は同じリクエストに Recipe だけ追加します。Task／Prompt／Model／Settings／Tool 定義／API Identity・Snapshot／Manifest／Context／Episode／Seed／Tool 上限を固定し、各 Arm で新しい Runner を作ります。

各 Arm の前に同じ Manifest・Starter 検査を行うため、測定対象は「検証済み環境での Doctrine 選択・説明」です。初回の API 発見能力の比較ではありません。

`local-fixture.ts` は実際の公開 Evaluator をプロセス内で呼ぶ API 形状 Fixture で、HTTP／SDK Client／Gateway を経由しません。モデル名は `deterministic-fixture-not-an-ai-model`。Recipe の有無によるプリセット切替はテスト用の人工的な入力差で、AI 改善の Evidence には使えません。Seed は比較契約に保存しますが、この決定的 Fixture は乱数を使わず Episode ID がシナリオを指定します。

## 記録と判定

- 全 Episode × Seed の A/B 両方を残す。失敗除外、成功時だけの終了、best-of-N 選択はしない。
- Request／Response／Recipe／共有 Controls／Report の SHA-256 を保存。JSON はキーをコード単位で整列、Recipe は UTF-8 の実バイトを Hash 化する。Starter は Manifest の SHA-256 と照合する。
- 各 Tool の要求・応答 Hash、HTTP Status、成功した公開応答、最終回答・Doctrine を保存。失敗 HTTP Body／例外メッセージは秘密混入を避けるためコピーしない。不正な非 JSON 出力も失敗として残す。
- 最後の Doctrine を必ず評価し、API 応答全体を同じ公開 Evaluator で再計算して照合する。Context／Artifact／Hash 差し替え、Hash を残して Metric だけ変更した応答も比較に使わない。
- 正しさは Hard Gate。両方正しい場合だけ 3 軸を独立比較し、`a-dominates`／`b-dominates`／`equal`／`tradeoff` を返す。不正解を含む場合は `ineligible`、実行失敗は `not-comparable`。単一 Weighted Score は作らない。
- 401／402／403 は該当 Arm を停止する。自動認証・支払い・再試行はない。次の独立 Arm は自身の非課金 Preflight を行い、同じ拒否なら失敗として残す。

`rubric.json` は総合点を持たない確認一覧です。説明やツール使用の質は人間レビューが必要です。Outcome 比較だけで回答品質・Recipe 効果を証明しません。

## 安全境界

Injected Runner／Port は信頼できるローカルコードが前提で、時間・CPU・ネットワーク・費用・プロセスの Sandbox ではありません。Runner の隠れたネットワーク操作や会話状態は、この関数では制御できません。Tool 呼出しは await してください。Runner が未完了の Tool 呼出しを残して戻ると `INCOMPLETE_TOOL_CALLS` で失敗し、後から届く応答は証跡に反映しません。返却 Report は元の履歴から切り離して凍結します。ただし注入コードそのものの実行を強制終了する機能ではありません。Tool 回数上限はありますが、無限待ちを止めるプロセス実行期限は未実装です。

将来実 AI アダプタを注入しても Report は常に `injected-runner-local-readiness`、`liveGatewayVerified: false`、`realModelExecutionVerified: false` です。実モデル・Gateway の証跡は別途検証が必要です。入力 Prompt／回答に秘密を入れないでください。成功応答と最終回答は保存されるため、公開前には秘密情報のレビューが必要です。

## 実行

```powershell
pnpm exec vitest run bazantic/experiments/ab-harness.test.ts
pnpm exec tsx scripts/verify-bazantic-readiness.ts
```

後者は事前指定の先頭 2 Episode × 2 Seed について、全 Pair の Status／比較／Hash を標準出力します。`--full` を付けると生の要求・応答・Tool 履歴を含む全 Report を出力します（数 MB になる場合があります）。要約でも失敗・同等・悪化を省略しません。ファイル保存・登録・公開・送金はしません。実 Gateway／有料モデルでの A/B は未実施です。
