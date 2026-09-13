# Plan9 — 情報購入の価値を調べる比較実験

2026-09-12。**設計とローカルの設計Hash生成まで。実AI比較は未実行。** 既存の有料AIデモが固定戦略に負けた事実は変更しない。

## 何を調べるか

「AIが払った」と「払って得た分析に価値があった」は別の問い。まず購入先選択ではなく、固定したPulse Monitorの分析を利用する効果を調べる。

| Arm | 購入・時間・残高 | Commanderへ渡す分析 | 比較で分かること |
| --- | --- | --- | --- |
| A: analysis-visible | 固定の購入Prefix | 同Episodeの専門家分析あり | 分析を使える場合 |
| B: analysis-withheld | Aと同じ購入Prefix | 分析本文を伏せる | A対Bで分析内容の効果 |
| C: no-purchase | T+0、購入なし、全予算 | 分析なし | A対Cで購入コスト・時間も含む全体差 |

Always Pause / Never Pauseも同Episodeで別途再計算する。CをBの代用にすると情報・費用・時間が同時に変わるため、情報そのものの効果とは呼べない。無理に複数WinnerやAIの勝利を作らない。

## 結果を見る前に固定するもの

生成コマンド:

```sh
pnpm exec tsx scripts/prepare-rescue-information-study.ts
```

公開Practiceの**全35 Episode**を現在の掲載順で固定し、各1反復・3 Armsを記載する。既知の公開データなので未知Finalではない。「まだ見ていないScenarioを選んだ」とも主張しない。初回の設計Hashは`0x4c692fc8182664117950b575b32bfafd5ad20f81cdf783a87dfc136ceb8c5013`。

- 既存Practice / Manifest / Commander Context、データVersion、提案Model設定、Playbook、Service仕様、独立3軸を束ねる。
- A/Bの分析はEpisodeごとに一度だけ作って共有し、別Episodeから流用しない。
- 各Arm最大3判断、追加購入・Patchなし、最後は既存SimulatorでT+60まで進める。完全なインシデント対応能力の評価ではない。
- 同じPromptを使い、任意の分析欄だけを変える。各Arm・各Turnは独立したモデル呼出し。過去Armの会話や出力を渡さない。
- 実行順はEpisode順にA→B→C、B→C→A、C→A→Bを交替する。Model Seedの再現性は仮定しない。
- 全試行枠を残す。失敗・中断・予算停止を欠測として明示し、成功したRunだけで割合を計算しない。

この設計Hashはローカルの設計同一性のみ。公開時刻の証明、受付Freeze、実行コードや全Promptの最終commitmentではない。後者はRunner実装後・最初の有料呼出し前に別途固定する。

## 情報漏れを防ぐ実装条件

既存の継続デモ入力をそのまま使って`paidAnalysis`だけ消す方法では不十分。`publicView.serviceReceipts`や`source: SERVICE`のObservationが別経路で診断を伝え得る。

将来の実験用入力投影では、**A/B/CすべてからSimulatorのService診断を除き**、Aだけに実専門家の分析欄を付ける。費用・時刻・Action履歴・Protocol由来の観測は残す。True State、Episode定義、公開Episode ID、各種Hash、他Armの結果をモデルへ渡さない。Episode IDと全Hashは評価・監査側だけが保持する。公開情報そのものから推測できることは防げないため、秘密Finalの保証とは分ける。

A/Bは同じ購入直後状態から分岐し、その後の判断による状態差は許す。実推論の待ち時間をゲーム内時間へ換算しない。実行時間・Token・実モデル費用は運用指標として別記する。実分析の壁時計上の納品とSimulator内の納品は異なることも明示する。

## 集計とGO / PIVOT

1. **技術Gate:** 全予定枠の記録、入力漏洩テスト、A/Bの購入Prefix一致、記録Actionの全Replay一致、不正Actionの拒否。通らなければ性能比較を採用しない。
2. **観測結果:** 正しく完了した同Episodeのペアだけで3軸の差分・支配／トレードオフ／同等を表示。必ず全35枠・完了数・失敗数も併記する。総合Weighted Scoreは作らない。
3. **解釈:** AがBより良ければ、固定購入後にその分析が役立った事例。AがCにも良ければ、そのEpisodeでは費用を含めた価値があった可能性。1反復の結果を統計的優位や一般化の証明にしない。
4. **次の判断:** 差がなければ、分析が観測の言い換えに留まるか、選択肢・制限が効果を隠していないかを調べる。条件変更は新Versionの別実験にし、旧結果を残す。短い継続デモの結果だけでArena全体をGO / PIVOTしない。

現状の専門家はCommanderと同じ公開観測を解釈するsidecarであり、独占的な新しいTelemetryを取得するわけではない。この試験はまず「有料の追加解釈」の価値を測る。新しい有償データを持つServiceの設計・一般化・未知Finalでの競技性は次段階。

## 費用と残作業

全設計の最大枠は専門家35呼出し＋Commander315呼出し＝350呼出し。これは**実行指示や予算承認ではない**。生成コマンドに実行flagはなく、承認済み呼出し数・支出は0、送金0と記録する。今回はAIを呼んでいない。

- [x] 比較条件と全公開Episodeの設計Hashを作る。
- [x] 全Episodeの保持・Hash再現・設計改ざん・非実行境界のテスト。
- [ ] モデル用の情報投影、両Arm Runner、漏洩・部分失敗・Action Replayテスト。
- [ ] 最終コード・Promptの固定、残予算と費用上限の確認。
- [ ] 実AI比較、全結果の分析。
- [ ] 別分布・未知Finalへの拡張。
