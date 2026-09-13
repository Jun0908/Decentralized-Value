# Plan9 / Plan11 / Plan12 — 人間不在時の次回作業案

作成日: 2026-09-12。計画記載後、ユーザーの「それらを実行してください」で開始。現在の成果物と検証範囲は[RESCUE_HANDOFF.md](../../../hackathon/submission/RESCUE_HANDOFF.md)を参照。

目的は、残り2日の提出準備を進めること。約3時間の人間不在を想定するが、以下の全項目を3時間で完了すると約束するものではない。次の実行指示後、上位から小さな単位で完成・検証し、時間内に残ったものは未完了として渡す。

## 1. 優先順位と担当Plan

| 順位 | Plan / ID | まだないもの・次回作業 | 人間なしで進められる範囲 | 完了の証拠 |
| --- | --- | --- | --- | --- |
| 1 | Plan9 / R9-1 | 英語の提出画面と短い英語台本 | 日本語版を維持した英語版、約2分のナレーション原稿、秒数別の画面操作表を作成 | PC / Mobile表示、説明と実Evidenceの一致、台本の読み上げ想定時間 |
| 2 | Plan9 / R9-2 | 声を載せる前の無音デモ動画 | 完成した英語画面を実操作で収録。閲覧・記録表示のみで推論・送金は再実行しない | 720p以上、尺・再生・画面の可読性、秘密情報なし。動画と台本を同じ順序で渡す |
| 3 | Plan12 / A12-1 | 最新Rescue提出経路の独立起動・実HTTP検証 | 秘密ファイルのない隔離ディレクトリで公開Replayを再現。ローカルWebを実HTTPでSDKから呼び、Practice結果を検証 | 起動手順、HTTP結果、Outcome / Hash一致、必要条件と失敗時の説明 |
| 4 | Plan12 / A12-2 | SDK本体での独立Hash検証 | 検証scriptだけにある照合を、対象Rescue Practiceを明示した再利用可能なSDK検証境界へ整理。互換性と配布依存を検査 | 改ざん・別Artifact / Context拒否、正常Fixture、公開API / SDK型の整合 |
| 5 | Plan11 / S11-1 | CRE秘密入力・Reveal検証のローカル前段 | 現在の公開Fixtureとは別に、小さな非本番Packのcommit → 検査 → 評価 → reveal → 再現をローカル実装・テスト | Pack / 順序 / salt / Context改ざん拒否、同じ結果、公開出力への秘密混入なし。公式CRE成功とは表示しない |
| 6 | Plan11 / S11-2 | Bazantic比較実験の実行準備 | 既存Recipeを実装済み非課金APIへ合わせ、Recipe有無以外を固定する比較harnessと記録形式をローカル準備 | 注入fixtureで正常 / 失敗 / 同等結果を保存。実Gateway・実モデル比較は未実行と表示 |
| 7 | 全Plan | 提出用引継ぎ資料の仕上げ | 実装済み範囲、未完成機能、既存 / 今回変更、再現command、動画ファイル、必要な人間操作を一枚に整理 | リンク切れ・claim・秘密検査。人間の貢献は本人確認欄を残す |

優先1〜3が第一目標。4以降は上位の検証が終わってから着手する。引継ぎメモは作業中も更新し、下位の開発を優先して素材の受け渡しを遅らせない。スポンサー応募を最優先に変更する場合は、応募先と認証の準備後にS11-1 / S11-2の順番を見直す。

## 2. 完了済みを作り直さない

- Plan9: 実Commanderの専門家選択、別モデル呼び出しによる納品、5 rUSD-DEMO支払い、別注文返金、購入後の3判断、Outcome / 独立Pool Preview、日本語提出画面は実装済み。新たな購入や支払いは不要。
- Plan11: 共通Envelope、ローカルEvaluator接続、Node / Bun照合、公式CRE CLI導入、通常 / Confidential handlerの骨組みは実装済み。公式Simulationは認証で停止している。「未着手」ではなく「着手済み・外部条件待ち」。
- Plan12: 契約生成、配布物の空consumer検証、Rescue Operator用Job / HTTP / SDK / CLI、公開Replay、SDKからAPI adapterへの注入12リクエスト検証は実装済み。A12-1はその再実装ではなく、最新提出経路の隔離起動と実HTTPを埋める。
- 旧Planの未チェック欄には後続節で一部対応済みの項目がある。開始前にコードと最新実装記録を再確認し、既存の機能を重複作成しない。

## 3. 人間の確認・操作が必要で、不在中に完了できないもの

| 項目 | 必要なこと | 待っている間にできる準備 |
| --- | --- | --- |
| 参加Track / 応募資格 / 応募賞 | 本人Dashboardと既存コードの扱いを確認 | 提出説明の草案と既存 / 新規差分の候補整理 |
| CRE公式Simulation | 既存アカウントのログイン・利用権限。ログイン後も互換性・実行成功の検証が必要 | S11-1、失敗の分類、再開手順 |
| Bazantic実Gateway / Recipe | アカウント認証、利用するGateway / Recipe、課金条件の確認 | S11-2。402を自動支払いしない |
| ENSv2実認可 | Namespaceの所有・対象Wallet・Grant / Update / Revokeの範囲確定 | 既存adapterの差分整理。実Recordを勝手に変更しない |
| Push / Web公開 | 公開対象と実行承認 | ローカル検証と公開手順。最新URLが公開済みとは書かない |
| ナレーション・最終動画 | 本人の声で収録、音声を載せた最終動画の確認 | 無音動画・英語台本・タイムライン |
| 応募フォーム送信 | 本人による記載確認と送信 | コピー可能な提出文、証拠リンク、最終チェックリスト |

動画はユーザー希望の短い英語版とし、提出用の完成尺は約2分を目標にする。公式条件は2〜4分・720p以上・TTS / AI Voiceover不可のため、本人の声を使うツールでも合成音声なら条件適合を自動判断しない。実録の声を載せる方法を基本とする。[公式動画条件](https://ethglobal.com/events/ethonline2026/info/details)

## 4. 未着手だが、この短いバッチでは後回し

- Plan9: 永続Revision / Final Entry、未知Finalの受付・Freeze・複数Episode大会、Full Field、実大会報酬、第三者Service Market、追加購入 → Patch → Resumeの完全自律対応。
- Plan9: 情報購入あり / なしの対照実験、未知条件への一般化、複数実AI Runの競技性評価。既存Scenarioの成立性Simulationはあるが、今回の有料実AI継続デモの性能証明とは別。AIが勝つScenarioだけを後から選ばない。
- Plan11: 本番Hidden Finalの永続管理、CRE Live / TEE attestation、汎用Receiverの実commitment、ENS実Grant / Revoke、Bazantic有料実行。小さなローカル準備をこれらの完成と呼ばない。
- Plan12: 全Arena Registry統合、公開AI Job / Cancel / Events、Production DB / 複数ホスト、公開Final / Pool API、npm公開、Linux実機検証。
- Ocean関連のAPI・Schema・ゲーム変更は別作業の進行中。担当調整前に触れない。

## 5. 競合防止・成果物の受け渡し

- 開始時と終了時に`git status`を確認し、Claude Code等の差分を保護する。root package / lockfile / API入口 / 共通CSSの変更は必要最小限にする。
- 映像に使う実行は既存の公開Evidenceに固定する。AIが固定戦略に負けた結果、ProtocolはSimulation、PoolはPreviewという境界を維持する。
- 動画はGitへ大きなバイナリを無断追加せず、ローカルの明示した納品フォルダへ保存する。Web公開や外部ストレージへのアップロードは別扱い。
- コード変更時は関連テスト・型検査、UI変更時はPC / Mobile / Console / Contrastを確認する。失敗や未実施は引継ぎに残す。
- 最終的に「英語画面のローカルURL」「無音動画」「英語台本」「検証結果」「残る人間操作」をまとめる。計画時は未開始だったが、その後の実行指示で作業を開始した。

## 6. 実行結果 — 2026-09-12

このバッチで許可されたローカル作業は完了。Plan9 / Plan11 / Plan12全体の完成を意味しない。

| 対象 | 結果 |
| --- | --- |
| R9-1 | 英語画面、225語の台本、秒数別の操作表。PC / Mobile確認済み |
| R9-2 | 126.08秒・1440×900の無音MP4 / WebM、動画＋台本ZIP。本人音声は未収録 |
| A12-1 | 秘密ファイルなしの隔離コピーで公開Replay・起動・SDK実HTTPを検証 |
| A12-2 | SDKの明示的なHash整合性検証、改ざん拒否、配布tarball consumer検証 |
| S11-1 | 非本番秘密Packのcommit / reveal / replayと改ざんテスト。公式CREではない |
| S11-2 | 非課金A/B比較基盤、35テスト、固定4組のFixture検証。実Gateway / 実AI比較ではない |
| 引継ぎ | [素材・実行手順・残る人間操作](../../../hackathon/submission/RESCUE_HANDOFF.md)、[英語提出文の草案](../../../hackathon/submission/SUBMISSION_COPY_EN.md) |

追加モデル呼出し0、追加送金0。Push・Web公開・アカウント認証・ENS変更・応募送信は実行していない。別作業のOcean変更・共通CSS・scratchpadはこの変更へ取り込まない。
