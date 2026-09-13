# 提出用の変更一覧 — 確認用、応募期間の認定ではない

2026-09-12。ローカルGitの実在Commitとファイルを照合した。**イベント開始Commit・応募Track・期間内の人間の貢献は本人未確認**。以下の区間を応募期間だと解釈しない。Gitの日時だけで参加資格や制作時刻を証明しない。

## 直近のRescue実装をたどる区間

確認用の基準: `ae1e3a0079303fbc537301e829929602c80e4149`（`72e3027`の親）。確認済み終点: `5beb343`。これは実AI Service統合の直前から英語素材作成までの技術的区間。

| Commit | 区間内の主な追加 | 主な証拠・限界 |
| --- | --- | --- |
| `72e3027` | 制限付きCommanderによる依頼と、別モデル呼出しの専門家分析 | Service execution / agent tests。分析の診断精度は別 |
| `230fea7` / `6aef22f` | 単一ホスト永続Payment Executor、Journal再検証、期限後Release拒否 | Payment executor tests。複数ホスト・本番DBではない |
| `70bfafd` / `5c92386` | 認証付きloopback Job HTTP、Operator SDK / CLI | 公開参加APIではなく運営管理用 |
| `1d05f50` | 日本語の購入・返金Evidence表示 | UIから自動送金する機能ではない |
| `7fb651b` | 実AIの購入・Sepolia支払い・別注文返金を接続して検証 | [公開支払いEvidence](../../../evidence/deployments/sepolia-rescue-service-demo.json)。運営管理Wallet |
| `83d3225` | 購入後の3判断、Outcome・Pool Preview、公開Replay、CRE認証Gate | [記録](../../../evidence/deployments/rescue-submission-demo.json)。未知Final・実Pool報酬ではない |
| `5beb343` | 英語画面・動画台本、SDK Hash検証、秘密Pack・Bazanticのローカル準備 | [引継ぎ](../../../hackathon/submission/RESCUE_HANDOFF.md)。スポンサー実接続成功ではない |

## 基準Commitより前から存在するもの

上記基準のtreeで存在を確認したもの。新たな統合と、元からあった実装を区別する。

- Rescue Simulator / Doctrine / Practice: `packages/rescue-room/src/index.ts`。
- Payment Policy: `packages/rescue-room/src/payment-policy.ts`。
- Escrow / Demo Token Contract: `packages/contracts/src/RescueServiceEscrow.sol`、`RescueUSDDemo.sol`。
- 単一ホストJob Store: `apps/api/src/rescue-jobs.ts`。
- SDKの基本Client / Transport / Comparison、共通CLI・評価Envelope Schema。

したがって「直近の区間でEscrow ContractやSimulatorをゼロから作った」とは説明しない。既存Contractと実AI・運営Executor・Evidenceを接続した点がこの区間の追加。

## 同じ区間の別作業

Ocean Commonsの`3b7a947`、`f67a40d`、`2c05815`も同じmainの履歴に含まれる。Rescue担当の成果として帰属を付け替えない。Oceanを提出説明へ含める場合は、担当側のEvidenceと実装境界を別途確認する。

監査時の未Commit差分は共通CSSとscratchpad。これらは上のCommitに含まれておらず、こちらの追加コミットへ無断で含めない。

## 外出中の追加バッチ

`5beb343`以降、この文書と同じ追加コミットで行う範囲:

- Public Practiceの初回接続preflightと異常系テスト、[開発者向け手順](../../guides/RESCUE_AGENT_QUICKSTART.md)。
- [情報購入の対照実験設計](../../plans/rescue-information-study.md)と設計Hash生成。実AI比較ではない。
- この変更一覧とPlanの更新。既存動画・実支払いEvidence・ゲームの評価ルールは変更しない。

## 本人が確定した後の最終差分

```sh
# 下のSHAは監査用区間。イベント期間の根拠ではない
git log --reverse --oneline ae1e3a0079303fbc537301e829929602c80e4149..5beb343
git diff --stat ae1e3a0079303fbc537301e829929602c80e4149 5beb343
```

提出時は本人が確認した開始・終了Commitへ置き換え、公開Remoteに終了Commitが存在することを確認する。Pushは別指示。AI支援の記述は[英語提出草案](../../../hackathon/submission/SUBMISSION_COPY_EN.md)を使い、実際の人間の企画・判断・実装・検証の貢献は本人の事実確認を加える。
