# 103秒の本編デモ収録

対象は **72-Hour Disaster Response**。Rescue Roomやスポンサー個別動画とは別の本編素材です。字幕・音声は付けず、後から本人の英語ナレーションを重ねます。

## 実画面と操作

| 秒数 | 画面・操作 | 伝えること |
| --- | --- | --- |
| 0–8 | `http://127.0.0.1:3008/arenas/emergency-supply` の冒頭。イラストと3軸 | 災害時の配送戦略。Cost / Delivery / Regional coverageを独立に扱う |
| 8–20 | Balanceを選択。Backup inventoryを220→300 kits、Recovery budgetを18,000→22,000 USDへ変更 | 参加者が戦略を編集する。初期購入と復旧予算のトレードオフ |
| 20–40 | 実際のPractice APIを実行し、最悪シナリオの約15秒Replayを全編収録 | 配置→障害・損失→再調達→4地域の配送結果 |
| 40–56 | Measurement results | 同じ7シナリオから得た最大費用・最小配送数・最小地域カバー率。総合点なし |
| 56–74 | Value Allocations | 公開の参照戦略に対するPool別配分。今回の未提出Practiceが勝った画面ではない |
| 74–88 | `Verify committed evaluation evidence`を開く | Context hash / Final scenario commitment / Result hash |
| 88–103 | 事前ロードした[公開アプリの既存支払い証跡](https://web-rho-seven-d6te7t3f0y.vercel.app/architecture#reward-evidence) | Recorded on Sepolia、Allocation commitment、RewardPaid、Demonstration scope。最後3秒は静止 |

## 境界とFallback

- Practiceはローカルの実装済み決定的Evaluatorで測定する。外部AI inferenceは使わない。
- 3公開練習シナリオと4 committed instant-finalシナリオ。同時に開示するデモであり、未知のFinal大会の完了を主張しない。
- Value Allocationsは参照戦略の公開Evidenceに対する **デモcredits**。今回の編集戦略を提出・保存・決済しない。
- 最後のSepolia証跡は2026-09-07の別のreward-path demonstration。現在のPracticeに支払ったものでも、完了した公開大会でもない。
- 支払いの根拠は `Docs/deployments/sepolia-reward-demo.json`。`pnpm demo:check`でreceipt success、結果root、コントラクトコード、残高をread-only確認する。
- ローカル`/architecture`には公開支払い設定がないため、既存の公開アプリを事前ロードして使用する。撮影中はそのブラウザcontextをofflineにする。
- 公開アプリが読めない、txリンクが記録と一致しない、PracticeやReplayが失敗する場合は録画を停止する。Mockや新規送金には切り替えない。
- カメラ用CSSでsite header、Next開発インジケータ、Wallet接続パネルを除外。録画されないOSカーソルの代わりに実際のmousemoveへ追従するカーソルのみ描画する。結果・文言・アプリロジックは変更しない。
- ロード待ちと画角移動をカットし、実際のPlaywright動画を連結する。静止画のスライドショーではない。Replayは画角を整えてから実際のReplayボタンで先頭から再生する。

## 再収録

既存localhost:3000は停止・変更しません。今回3000番の応答がタイムアウトしたため、録画用にビルド済み同一アプリを127.0.0.1:3008で起動しました。PC再起動は不要です。

```powershell
pnpm demo:seed
pnpm demo:check
pnpm --filter @frontier/web build
# 別ターミナルで起動（3008が既に起動中なら不要）
pnpm --filter @frontier/web exec next start -p 3008 -H 127.0.0.1
# ffmpeg / ffprobe がPATHにない場合のみ、実行ファイルの絶対パスを指定
$env:FFMPEG_PATH = 'C:/path/to/ffmpeg.exe'
$env:FFPROBE_PATH = 'C:/path/to/ffprobe.exe'
pnpm exec tsx scripts/record-value-decentralization-demo.ts
```

再収録時は`VIDEO_OUTPUT_DIR`に新しい出力先を指定します。完成動画は上書きしません。

成果物は`artifacts/video-demo/`内のMP4、raw WebM、shot PNG、`practice-evaluation.json`、`recording.json`、`video-metadata.json`、`RECORDING_REPORT.md`です。生成動画をGitへ追加する必要はありません。

今回の採用素材は`artifacts/video-demo/take-4/`です。録画終了時のタイムスタンプと動画フレームの差を実画像で確認し、本編のカット位置を1.36秒早めました（H+0を先頭に残すため）。提出用MP4の実際の区間はルート出力先の`export-timing.json`を参照してください。既存素材だけを再書き出しする場合は、新しい出力先とともに次を指定します。

```powershell
$env:VIDEO_SOURCE_RECORDING = 'artifacts/video-demo/export-timing.json'
$env:VIDEO_MAIN_OFFSET_SECONDS = '0'
$env:VIDEO_OUTPUT_DIR = 'artifacts/video-demo/new-export'
pnpm exec tsx scripts/record-value-decentralization-demo.ts
```

この補正値は今回の録画に対するものです。新規収録では`VIDEO_SOURCE_RECORDING`と`VIDEO_MAIN_OFFSET_SECONDS`を外し、カット境界を再確認してください。

最終版は **102.80秒**。Runクリックの区間だけをrawの23.40秒から1秒へ微調整した値も、上記`export-timing.json`に保存済みです。

## 後入れ英語ナレーション

I will start with one strategy for delivering emergency kits across four regions. I will reserve more inventory for backup routes and keep an emergency recovery budget. Every strategy faces the same seven disruption scenarios.

Now one route fails. Some inventory is lost. The evaluator replays the exact purchases, arrivals, losses, recovery spending, and deliveries. It does not produce one total score.

Here are the three independent outcomes: maximum seventy-two-hour cost, worst-case delivery, and coverage of the least-served region.

These strategies make different tradeoffs. Budget Sprint receives the efficiency allocation. Resilience Mesh receives the resilience allocation. Fair Reach receives the community allocation. None is the universal winner.

The context hash commits the rules and scenarios. The result hash commits this strategy and its measured outcomes.

Finally, Ethereum records the allocation commitment and a completed Sepolia demonstration payment. The chain did not choose which value was better. It makes the final commitment and payment auditable.
