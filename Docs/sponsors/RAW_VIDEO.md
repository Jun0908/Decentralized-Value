# Sponsor Raw動画 — Playwright録画

2026-09-12。本人指定により、追加文字・字幕・タイトル・音声・演出・カット編集なし。アプリにもともとある文字や開発サーバー表示はそのまま。PC再起動・既存サーバー停止なし。

## スポンサー別（1本あたり約1分32秒）

短い区間を引き延ばしたものではなく、Playwrightで各章を個別に撮り直した。概要→実行済み証跡の詳細→実際にDownloadした公開JSON→概要へ戻る。新しい送金・推論はしない。

- ENS: [MP4](<D:/Codex/Engllish Presentation/assets/video/sponsors-2026-09-12/ens-raw.mp4>) / [元WebM](<D:/Codex/Engllish Presentation/assets/video/sponsors-2026-09-12/ens-raw.webm>)
- Chainlink CRE: [MP4](<D:/Codex/Engllish Presentation/assets/video/sponsors-2026-09-12/cre-raw.mp4>) / [元WebM](<D:/Codex/Engllish Presentation/assets/video/sponsors-2026-09-12/cre-raw.webm>)
- Bazantic: [MP4](<D:/Codex/Engllish Presentation/assets/video/sponsors-2026-09-12/bazantic-raw.mp4>) / [元WebM](<D:/Codex/Engllish Presentation/assets/video/sponsors-2026-09-12/bazantic-raw.webm>)

本人指示により個別動画6ファイルを動画制作Repositoryの上記フォルダへ移動済み（2026-09-12）。全ファイルで移動前後のSHA-256一致を確認。既存の動画・設定は上書きしていない。検査JSON・撮影ログ・スクリーンショットは元の`.frontier/handoff/sponsors-individual-2026-09-12/`に残す。

各動画1920×1080、25fps、H.264。`video-qa.json`を各フォルダへ保存。1〜2分の尺・音声なし・全編デコードをExport時に検査する。

再録: `pnpm exec tsx scripts/record-sponsor-individual.ts ens`（`cre` / `bazantic`も対応）。書き出し: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/export-sponsor-raw.ps1 -Sponsor ens`。既存動画は上書きしない。

## 以前の3社まとめ版

- [編集用MP4](../../.frontier/handoff/sponsors-raw-2026-09-12/sponsor-demo-raw.mp4)
- [Playwright元動画WebM](../../.frontier/handoff/sponsors-raw-2026-09-12/sponsor-demo-raw.webm)
- [動画検査結果](../../.frontier/handoff/sponsors-raw-2026-09-12/video-qa.json)

1分57.84秒、1920×1080、25fps。MP4はH.264、約13.3MB。WebMから形式変換のみで、冒頭のページ読み込みも削っていない。全編デコードと抽出フレームを検査済み。録画中のconsole errorは0。

内容: `/sponsors/demo`の冒頭→ENSカードと取引一覧→CRE概要とCommitment詳細→Bazantic比較とTool／入力詳細→Evidence Download。実行済み証跡ページの操作録画であり、撮影中の新しいAI呼出し・送金・CRE実行はない。

`.frontier/`はGit対象外。リンクはこのPCのローカル素材を指す。字幕やナレーションは必要に応じて後から本人が編集する。

再録: `pnpm exec tsx scripts/record-sponsor-demo.ts --record`。MP4化: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/export-sponsor-raw.ps1`。既存MP4は上書きせず停止する。
