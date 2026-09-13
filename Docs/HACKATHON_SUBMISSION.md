# ETHOnline 提出用スコープ — 最終仕上げ

更新: 2026-09-13。大会全機能ではなく、検証済みの一連の動作と再現手順を優先する。スポンサーは本人指定のENS / Chainlink / Bazantic。最新の[英語提出文](SUBMISSION_COPY_EN.md)と[公開確認記録](PUBLIC_VERIFICATION_2026-09-13.md)を提出時の基準にする。以下の実AI判断は9月12日の保存済み実行であり、今回再推論・再送金はしていない。

## 今回の提出用デモ

[公開英語デモ](https://web-rho-seven-d6te7t3f0y.vercel.app/rescue-room/submission/en) / [スポンサー実証](https://web-rho-seven-d6te7t3f0y.vercel.app/sponsors/demo)。表示は保存済みEvidenceであり、開くたびに送金する画面ではない。

1. 異常の公開観測から実AI Commanderが専門家を選ぶ。
2. 別の実AIが分析し、Sepolia Escrowから5 rUSD-DEMOを支払う（前回検証済み）。
3. その実成果物をCommanderへ戻す。今回の追加3手番はWAIT → WAIT → withdrawalsのPAUSE。
4. 記録行動で架空のProtocolをT+60までSimulationし、独立した3 Outcomeを計測する。
5. 同Episode・同Playbook制限の固定戦略と比較する。今回のAIは0 USD損失、71.1274%需要提供、5 Game Credits。何もしない戦略は0 USD、100%、0 CreditsでAIを支配した。
6. 同じ候補集合を3つの独立Poolが異なる軸で判断する。各100 Preview Creditsであり、実報酬ではない。

この結果を、AIが最強という話に変えない。「実際に支払える」と「その支出や対応に価値があったか」は別の問いであり、共有Evidenceからそれぞれ判断できることを示す。

## 境界

- これは既存購入Prefixを記録から再構築して継続した実証。購入を再実行したり同じ成果物へ二重払いしていない。
- 3手番上限で終了し、残り時間はSimulatorが進める。完全な自律調査・追加購入・Patch・Resumeの実証ではない。
- 実分析に加えて、既存Simulatorの公開レポートを使用する。レポートの推定Severityや分類は隠された真実ではなく、Simulation由来の不確かな情報。
- Protocol操作・損失USD・Game CreditsはSimulation。サービスのSepolia Token支払いは実取引。Pool配分はPreview。混同しない。
- 単発の公開Episode比較。分析を除いた対照実験や未知Final評価をしておらず、購入情報による性能改善・攻略耐性は未証明。
- Contextは`rescue-purchased-analysis-continuation-v1`。旧Practice／旧支払いEvidenceの結果を上書きしない。
- 公開JSONは保存済み実行のサマリー。別の公開Replay FixtureにEpisode・Playbook・購入Action・判断列・期待Outcomeを保存し、秘密ファイルなしでSimulatorの結果とPoolを再計算できる。全Runtimeを再検証する運営内部記録はGit除外領域に保存。公開ReplayはOpenAI実行や診断の真実性を暗号学的に証明するものではない。

## Plan別の進捗と提出前の残り

| Plan | 今回の対応 | 残り |
| --- | --- | --- |
| Plan9 | 実AIサービス購入・Sepolia支払い／返金、購入後3判断、Outcomeと独立Pool Preview | 初見ユーザー確認。未知Final・完全復旧・第三者市場は未完成 |
| Plan11 | ENSv2単一Key権限7取引、公式CRE秘密Pack Simulation、外部AIからBazantic MCP、公開証跡ページ | Hosted Recipe実行／公開・A/B、live TEEは未完成。選択賞との適合は別途本人確認 |
| Plan12 | 公開Rescue APIをSDKから6実HTTP、Starter・Hash・反復一致を9月13日に確認 | 外部実参加者、Linux、本番Job基盤、Final API、npm公開は未完成 |

スポンサーの最低実証は設定値だけではなく実行済みEvidenceに基づく。[撮影手順と実装リンク](sponsors/SPONSOR_DEMO_RECORDING.md)を参照。公式Simulationの成功をlive TEEや大会全体の完成へ拡張しない。参加資格と最終提出は本人の確認事項。

## 再現

```powershell
# 保存済み実AI判断のReplay。追加推論・送金なし。
pnpm verify:rescue:submission-replay

# 運営ローカルの内部Runtime照合と公開ファイル生成（.frontier記録が必要）
pnpm rescue:submission-demo

# 外部Agent向け既存APIをSDKから注入呼出しして検証。非課金。
pnpm verify:rescue:submission-api

# PC / Mobile、Evidence Download、導線、console / overflow
pnpm exec tsx scripts/verify-rescue-submission-ui.ts
```

新規推論を明示的に許可する初回のみ`pnpm rescue:submission-demo --execute-approved-ai`。共通の$5予算予約と排他Lockを使用する。記録不明の呼び出しを新しいLabelで再実行しない。今回の追加使用量は入力4,997 / 出力109 Token、料金推計$0.0011302。過去2呼び出しを含め推計$0.0016428、合計5呼び出し。新規チェーンTransactionは0。

## 現在の動画台本：英語・約2分

ユーザー指定により、収録用の原稿は[RESCUE_NARRATION_EN.md](RESCUE_NARRATION_EN.md)へ変更した。英語画面は`/rescue-room/submission/en`。無音操作動画に本人の実録音声を載せる。以下の日本語草案は過去の構成メモであり、今回の収録原稿ではない。

### 旧日本語草案（参考・収録対象外）

公式動画条件と本人Dashboardを最終確認し、人間の声で収録する。未撮影・未提出。

**0:00〜0:25 — 問い**

「何をもって良いとするかは、誰が決めるのでしょうか。多くの競技では、複数の価値が一つの重み付き点数に隠れています。Value Decentralizationでは、同じ評価結果を共有しながら、価値の選び方を独立させます。」

**0:25〜1:05 — AI同士の取引**

「Rescue Roomは、架空のEthereum Protocolの異常に対応するゲームです。Commanderには原因が見えません。専門家AIへ分析を依頼し、別のモデル呼び出しで成果物を受け取りました。こちらがSepoliaで5テストTokenを支払ったTransactionです。別注文の未納品返金も確認しています。」

**1:05〜1:40 — 納品後の判断**

「専門家は、原因は不明なので監視を続けると返しました。その分析と公開観測を受け、Commanderは2回待機し、出金モジュールだけを止めました。この短い実証は3手番で区切り、Simulatorを最後まで進めています。実際のProtocolを止めているわけではありません。」

**1:40〜2:20 — 不利な結果も隠さない**

「この回は資産損失がなく、AIの対応では約71%の需要を提供できました。しかし何もしない戦略は100%で、調査費用もゼロです。AIに払えたことと、その判断が良かったことは別です。私たちはAIが勝つように結果を変えません。」

**2:20〜2:50 — 独立した価値判断**

「資産保護では3者が同値、稼働率では何もしない戦略、費用では購入しない2者が選ばれます。同じEvidenceを使っていても、各Poolは自分の価値で支持を決めます。この配分はPreviewで、実報酬送金とは区別しています。」

**2:50〜3:10 — 再現と範囲**

「行動と観測のHashを記録し、同じ行動から同じ結果を再現できます。Agentは公開APIとSDKでPracticeできます。運営管理のAI・Walletによる実証で、第三者市場や未知Final大会は今後の範囲です。Measure once. Preserve the tradeoffs. Let values diverge.」

Sponsor連携が実証できた場合のみ、該当箇所とEvidenceを収録して台本を更新する。実証していない名称を実装済みとして追加しない。

## 提出前のチェック

- [ ] 本人の参加Track・応募賞・締切をDashboardで確認。
- [ ] イベント開始前の部分／期間内の新規部分を開始Commitと終了Commitで整理。開始Commitは本人確認待ち。
- [ ] AIの使用範囲を開示し、人間の企画・判断・検証への実際の貢献を本人が記述。貢献を捏造しない。
- [ ] 公開予定Commitの秘密検査、回帰確認、Push承認、必要ならWeb公開承認。
- [ ] 動画を人間の声で収録し、再生・尺・解像度とリンクを検査。
- [ ] 提出フォームの内容と添付Plan/仕様が実証範囲に一致。
- [ ] 最終提出を本人が確認する。Agentは今回フォーム送信・公開を実行していない。
