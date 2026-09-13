# Plan9 / Plan11 / Plan12 並行実装

開始日: 2026-09-11

ユーザー承認に基づく並行作業。3計画全体の完了ではなく、独立して検証できる最初の実装バッチから進める。

## 共通ルール

- 起点は`b1f2350`。各担当は専用worktree / branchだけを編集する。
- 統合先の未コミット変更、既存の`DV-ocean` worktree、Ocean開発には手を加えない。
- API入口、root package / lockfile、共通Docsは統合担当だけが編集する。
- 各担当は限定したファイルをローカルcommitし、差分・テスト結果・未完成の境界を報告する。
- 統合担当が起点との差分と対象ファイルを確認してから取り込み、統合先で再検証する。
- Push、公開、外部登録、送金、Wallet作成、有料AI実行、実ネットワークへのContract書き込みはこのバッチに含めない。
- Game Result、署名検証、オンチェーンcommitment、実支払いを別々に扱う。存在しないEvidenceを補わない。

## 担当と所有ファイル

| 担当   | Worktree / branch                              | 所有範囲                                                | 初回の完了条件                                                                                         |
| ------ | ---------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Plan9  | `DV-plan9-payments` / `codex/plan9-payments`   | Rescueの新Payment Policy module・test、必要なexport     | 固定宛先・Order・Context・予算・期限を検証し、送信前Intentを作る。秘密鍵・RPC不要でnegative testが通る |
| Plan11 | `DV-plan11-evidence` / `codex/plan11-evidence` | sharedの新Evaluation Envelope・test・export             | 旧Hashを変えずRequest / Result / Execution Evidenceを分離。改ざん・対応違いを拒否                      |
| Plan12 | `DV-plan12-tooling` / `codex/plan12-tooling`   | 契約同期・配布検証script、専用test、SDK資料・生成物     | 既存SDK資産を再利用し、生成差分と配布物を検証する                                                      |
| 統合   | 現在の`Decentralized Value`                    | 接続adapter・統合test、package scripts / lockfile、Docs | 実Rescue評価を共通Envelopeに接続し、各担当の結果と既存API / SDKを回帰確認                              |

## 最初に固定する接続境界

1. **Plan9 → 共通Evidence**: Service購入と支払いは既存Order / Action / Manifest / ReceiptのHashを使う。Game OutcomeとResult Hashを支払い状態に応じて書き換えない。
2. **Plan11 → API / SDK**: version付きResultはContext・Artifact・Evaluator・独立Outcome・Episode根拠を含む。時刻、Job ID、Tx hashは別のExecution Evidenceへ置く。既存API応答へはまだ差し込まない。
3. **Plan12 → API**: 現行API / OpenAPIと公開Schemaを正本とする。元SDKリポジトリは生成・配布検証の再利用元であり、二重管理する正本にしない。
4. **Final / CRE**: Snapshot / Roundは共通契約で参照できても、実際の権限確認・Freeze・CRE実行を完了扱いにしない。公式CRE環境での互換性Gateは別途必要。
5. **Payments**: 今回は制限付き送信準備のローカル検証。永続的な予算予約、署名、送信、confirmations、Receipt / Balance確認が未接続なら`paid`にしない。

## 検証と進捗

- [x] 既存変更・worktreeの確認と、3つの専用worktreeの作成。
- [x] 3担当への実装範囲・禁止操作・所有ファイルの割当。
- [x] 各担当の単体テスト・型検査。
- [x] 統合先への差分取り込みと接続テスト。
- [x] 契約生成差分、SDK / CLI回帰、関連lint / typecheck。
- [x] `Docs/STATUS.md`と各Planへ実装済み境界・残件を反映。

最初のバッチにはUI変更を含めない。画面で使えるようになったことと、接続前の安全な部品ができたことを分けて報告する。

## 第1バッチの統合結果

元の担当commit:

- Plan9: `121c0865bbf0a3bb660ee47c7f19b7a966338673`
- Plan11: `2f885506bd56f7db8a8023c96b1dd82c013f4e05`、レビュー修正`b81372c83cd9dd9bd0e11f5e8535c3bbc2ffe4d4`
- Plan12: `d952a620ca7984d4e1811417aca47a46c667c418`

統合先では他作業の未コミット変更を保持したまま、対象ファイルの差分だけを取り込んだ。上記commitをmainへ一括cherry-pickしたわけではなく、初回報告時点では統合変更を作業ツリーに残した。別作業がmainを`9c02131`まで進めた後もテストを再実行した。後続のPush依頼では、最新mainとの差分を確認し、トップページ文言と並行実装基盤を別commitで保存する。Plan12 worktreeの検証用package / lockfile差分は、統合担当による依存更新とは別に未コミットで残っている。

| 検証                                               | 結果                                                                             |
| -------------------------------------------------- | -------------------------------------------------------------------------------- |
| `pnpm build:tooling`                               | shared / SDK / CLI成功                                                           |
| `pnpm typecheck`                                   | 全workspace成功                                                                  |
| `pnpm test:ts`                                     | 453 passed、11 skipped（opt-in Redis）                                           |
| `pnpm contracts:cli:check` / `contracts:sdk:check` | 無書換えチェック成功                                                             |
| `pnpm verify:cli`                                  | ローカルfixture accountによる既存5 workflow成功                                  |
| `pnpm verify:packages`                             | 空consumerで現物tarballのESM / SDK / NodeNext / CLI確認成功                      |
| `pnpm verify:rescue-envelope`                      | Node 22.22.1、browser-target bundle / V8、Bun 1.2.21で同一Result。CREは`not-run` |
| `pnpm --filter @frontier/web build`                | 成功                                                                             |
| 変更コードのESLint / Prettier / `git diff --check` | 成功                                                                             |
| `pnpm security:scan`                               | tracked file検査成功。未追跡ファイルまで検査するコマンドではない                 |
| Foundry / 実Redis / 公式CRE / 実決済 / Linux実機   | 今回未実行                                                                       |

全テストと複数buildを同時実行した際、既存CLI HTTPテスト2件が5秒timeoutになった。重い検証が終わった後、timeout設定やassertionを緩めず`pnpm test:ts`を単独再実行して全件成功した。また初回にSDK dist未生成を検出したため、CIには`build:tooling`を先頭に追加した。

独立レビューでは、ローカルArtifactの検証・実行で値を読み直す問題を単一の正規化snapshotで修正した。新Envelopeの文字列順序もlocale依存からコード単位順へ修正し、両方に回帰テストを追加した。署名・送信・実CRE検証ができたというclaimは追加していない。

## 次の実装単位

1. Plan9: 永続Atomic予約とTransaction Adapterを分離して設計・テスト。実Wallet / Deploy / Fundingは別途設定と実行範囲を確認する。
2. Plan11: 公式CRE CLI / runtimeで1 Episodeの互換性Gateを実行し、結果が一致してからHidden pack / ENS / dispatchへ進む。今回のNode / Bun結果でGateを代替しない。
3. Plan12: Oceanの既存HTTP入力・応答をOpenAPI / runtime Schemaへ接続し、Registryの共通化と永続AI Jobを別変更に分ける。

次のバッチでも同じファイルを複数担当へ渡さず、API入口・新共通Schema・lockfileの変更順を統合担当が管理する。
