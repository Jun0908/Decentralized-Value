# Calldata Arena 改善計画

## 初回ミッションと公開確認 — 2026-09-13

測定→Minimum reuseを50から100へ変更→再測定の初回ミッション。実結果から送信+3,028 gas／復元−4,124 gasを表示し、2軸のTradeoffを説明。

- [x] 画面上のクリック回数ではなく実Runから学習進捗を判定。学習バッジをScore・報酬に使用しない。
- [x] 1440 / 390pxで新ミッションを完走。実Run前・編集後・不正入力・別Contextを区別。既存ArenaからのCSS干渉を避け、操作色も検査。
- [x] Web build、変更範囲Lint、全体TypeScriptテスト821成功／11skip。進捗判定の新規テスト3件を含む。
- [x] 先行Commit `033a73c` の既存Practiceは公開HTTPSで検証済み。[公開確認の詳細](PUBLIC_VERIFICATION_2026-09-13.md)。

新ミッションは今回のローカル実装で、まだPush／Deployしていない。確認: <http://127.0.0.1:3014/arenas>。検証コマンド: `pnpm exec tsx scripts/verify-first-missions.ts http://127.0.0.1:3014`。画像・結果は `.frontier/first-mission-qa/`。

## 一目で分かるイラスト — 2026-09-13

- [x] 冒頭に専用イラスト `apps/web/public/images/calldata-packing-story.png` を追加。
- [x] データを梱包→小さいPackage→正しい復元という比喩で、Rule選択と2ガス軸のTradeoffを説明。画像内のタイル数は実Batchの測定値ではない。
- [x] PCは絵＋説明の2列、Mobileは画像を切らず縦積み。文字を絵に重ねずHTMLとして表示。
- [x] 1440 / 390pxで読込み、3段階説明、Console error 0、横Overflowなしを確認。Web build・既存Arena登録テスト3件・変更範囲ESLint成功。

表示は共通 `arena-intro-story.tsx` から対象3Arenaのみ。イラストは概念説明でありEvidenceではない。画像生成の方式・保存先・最終Promptは[素材記録](ARENA_ILLUSTRATIONS.md)。確認手順: `pnpm exec tsx scripts/verify-arena-stories.ts http://127.0.0.1:3014`。画面: `.frontier/arena-story-qa/`。評価処理・API・公開Deploymentは変更していない。Push未実施。

更新日: 2026-09-12。担当範囲は Calldata package・専用UI・内部API・本Plan・Arena仕様のみ。

## 目的と受け入れ条件

3種類のCodecを選ぶ画面を、公開Batchの特徴から圧縮形式を選ぶRule Artifactを編集・実測・比較できるPractice Workbenchへ進める。

- [x] `calldata-rules-v1`を厳格に検証し、Recipient再利用率・Action数の条件とFallbackを編集できる。
- [x] Action → Packing → Encoded bytes → Decoder → 同一Digestの関係を、Batchごとの具体的な証拠で示す。
- [x] 固定済みSolidity RuntimeをCancun EVMで実行し、EIP-2028 Calldata gasとDecoder execution gasを独立に計測する。
- [x] 各BatchのDigest一致と空・不正入力の拒否をhard gateにする。実行失敗をFrontierへ含めない。
- [x] 同じContextのStandard ABI baseline・直前Revisionと比較する。Contextを変えた比較は混ぜない。
- [x] Artifact・Context・実測EvidenceをJSONとして取得できる。
- [x] 正常・不正Artifact、再現性、ルール順序の意味、比較点の順序不変、旧Evaluator互換を決定論テストで確認する。
- [x] 専用CSS Moduleを使い、lime背景は濃色文字、Desktop/Mobile・Consoleの確認結果を記録する。

## 実装の境界

Ruleはチェックイン済み3Codecの選択条件であり、任意ソースコードのコンパイル・Sandbox実行ではない。選択はBatch全体の公開特徴で決定し、そのホスト側選択コストはEVM gasへ算入しない。Codecを自動判別するOnchain Dispatcherも追加しない。

新しいRule Artifact・Interpreter・Malformed Test・Runtime bytecode・Metricsを独自Context Hashに束縛し、既存`/v1/calldata-compression`のAPIと参照Evaluator Hashを維持する。内部`/api/calldata-lab`でPracticeを実行する。

Hidden Final、永続Revision保存、参加者認証、任意プログラム、オンチェーンCommit・報酬支払い、公開Deployは今回の対象外。Practice実測を競技運営の完成として扱わない。

## 実装・検証記録

- 着手時: 既存3CodecのRuntime測定・2種類の公開Context・Digest比較を確認。
- 実装済み: 0〜4件の優先順位付きRule、Action数1〜255・再利用率0〜100の整数制約、3CodecのFallback、4つの出発点、追加・削除・順序変更、JSON表示・Download。
- 実装済み: 内部APIはJSONを16 KiBまでStream読取し、未知のField・Codec・Context・範囲外を拒否。各要求で3ReferenceとCandidateの選択対象を実EVM計測し、Artifact単位の無制限Cacheは持たない。
- 実装済み: Batch別の元Action・選択理由・Packing図・正確なBytes・Zero/Nonzero別料金・実測Decoder gas・Digest一致・Malformed Testを表示。変更後は旧測定を明示し、次のRunで同Contextの直前Revisionとの差分を表示。
- 対象テスト: `pnpm exec vitest run packages/calldata-compression/src/index.test.ts packages/calldata-compression/src/lab.test.ts apps/web/src/app/api/calldata-lab/route.test.ts --maxWorkers=2`で **31件成功**。再現・Property順序・Rule順序・比較点順序・無効Artifact・Stream上限・返却Snapshotの変異隔離・旧3Codecの事前取得Result Hash一致を確認。
- 実測例: StarterはDictionary / Packed / Dictionaryを選択し、459 bytes、Calldata **5,172 gas**、Decoder **17,185 gas**。同ContextのABIは14,112 / 19,590。再利用率を100へ変更すると全BatchがPackedとなり8,200 / 13,061へ変わる。
- 既存参照EvaluatorのHash・Runtime bytecode・Compiler・Public APIを変更せず、Rule LabのContextにRuntime Hash・規則・Corpus・会計境界を別途固定した。空・短縮・末尾欠損・Dictionary範囲外Indexという公開Corpusの拒否であり、全不正入力の網羅証明ではない。
- Calldata package / Web Typecheck、変更範囲ESLint / Prettier check成功。専用CSS ModuleにPrimaryのlime＋dark、Secondaryのdark＋light、およびhover / active / disabled / focusを明示。
- 統合確認済み: Production build成功。最終統合時にAPIのError型分岐を分離し、型検査とAPIテストを再確認した。

## 完成画面と統合確認

確認用: <http://127.0.0.1:3014/arenas/calldata-compression>（ローカル専用。公開サイトへの反映・Pushは未実施）。

1440px / 390pxの実ブラウザーでStarter測定→再利用率100へ編集→再測定→Evidence Download→別Contextへ切替を操作した。Artifact Hashとガス値が変わり、同Contextの直前比較が表示され、Context変更で比較が消えることを確認。EVMは実HTTP APIで実行し、返却結果とDownloadのResult Hashが一致した。

画面・Console・横Overflow・禁止配色の確認に成功。Byte Journeyの確認画像は `.frontier/arena-labs-qa/calldata-journey-1440.png` / `calldata-journey-390.png`。統合コマンドは `pnpm exec tsx scripts/verify-arena-labs.ts http://127.0.0.1:3014`。全体TypeScriptテスト818成功・11skip、Workspace型検査、SDK / CLI契約差分チェックも成功した。

## 次の実装判断

今回の完成範囲は「自分のRuleを編集して実測するPractice」。公開Batchと既存3Codecは小さく、全探索を許しても未知Finalで判断が必要になるAI競技はまだ成立確認していない。次は初見ユーザーの理解確認、その後により広いEncoder / Decoder Artifactと隔離実行、Practiceとは別のFinal workloadを検討する。見た目が完成したことを大会のGOとしない。
