# Rescue Room 実行・決済の縦断実装

開始: 2026-09-11。起点: `0df4122`。Plan9 / Plan12の次の実装単位。

## 承認と安全範囲

- ユーザーは並行実装、既存OpenAI APIキーの再利用、有料AI合計5米ドル以内、Sepolia合計1 ETH以内の検証を承認。
- 金額は上限であり目標ではない。専用の役割WalletとテストTokenを使い、少額で納品・支払い・返金を確認する。
- メインネット、外部公開、Git Pushは行わない。秘密鍵はローカルのGit除外領域だけに保存し、画面・ログ・Evidenceには出さない。
- 実ネットワーク操作と有料モデル呼び出しは統合担当だけが実行し、重複実行と予算の分散を防ぐ。
- 他担当のOcean変更、既存worktree、既存の資金・Contract設定は上書きしない。

## 分担

| 担当 | 専用worktree | 所有範囲 |
| --- | --- | --- |
| Payments | `DV-rescue-payment-executor` | 新Payment Executor / Store / Chain Adapterとテスト |
| Service Agent | `DV-rescue-service-runtime` | 新Service Request / Output / Agents SDK Runtimeとテスト |
| 永続ジョブ | `DV-rescue-durable-jobs` | 新Local Durable Job Store / Runnerとテスト |
| 統合 | 既存のmain作業ツリー | 接続、ローカル操作入口、検証Script、Docs、依存・export調整 |

## 最初に通す一連の動作

1. Commanderが公開観測と予算からService購入を選ぶ。
2. 既存SimulatorがActionを検証し、Order / Action / Manifest / Contextを固定する。
3. 永続ジョブとPayment Reservationを保存する。
4. 別のAIが依頼に対応し、参照元付きの構造化成果物を返す。
5. 納品の対応関係・形式・参照元を検証し、実行Evidenceを保存する。
6. Sepolia Escrowで資金拘束・納品記録・支払いを行い、Tx / Event / 残高を照合する。
7. 別Orderで未納品期限切れの返金を確認する。
8. 再試行・再起動後の追跡と二重実行防止を検証する。

## 完了を混同しない境界

- AIの成果物の形式検証は、Incident診断の正しさの証明ではない。
- 新Service成果物は既存SimulatorのReceiptやOutcomeを置き換えない。別の実行Evidenceとして残す。
- 運営が管理する別役割のAI / Walletによる実行は、独立した第三者Service Marketとは呼ばない。
- 単一ホストの永続ファイルStoreは、複数ホスト・serverless本番Storeではない。
- Tx送信、確認済みEscrow拘束、Providerへの支払い、返金は別状態。
- 不明な実行を自動で最初からやり直さない。照合待ちを表示して安全側で止める。
- この縦断実装だけでHidden Final / 公平な大会 / Pool報酬 / Sponsor連携の完成とはしない。

## 検証・引き継ぎ

- [x] 各担当の単体・異常系テスト。
- [x] ローカルの一連の実行、Store再オープン、重複依頼の検証。実ジョブ再実行も保存済み結果を返し、追加推論・送金なし。
- [x] ContractテストとSepolia事前検査。
- [x] 上限付き実AI呼び出し、実支払い・返金Evidence。
- [x] 既存型・API・SDK・CLI・ゲーム結果の回帰確認。
- [x] 実装済み / 実環境未検証 / 未実装の区別をSTATUSとPlanへ反映。

## 実行結果 — 2026-09-12 日本時間

最初の縦断実装は成功した。これは大会全体の完成ではない。

- Commanderが公開観測からPulse Monitorを選択。別の実OpenAI呼び出しで専門家の分析を購入した。
- Escrowへ5 rUSD-DEMOを預け、実成果物のHashを記録し、Providerへ5 rUSD-DEMOを送った。Providerの支払いBlock時点残高も5。
- 別注文では意図的に納品せず、期限後に5 rUSD-DEMOをCommanderへ返金した。返金Block時点のCommander残高は95。成功した注文の取消ではない。
- [公開Evidence JSON](deployments/sepolia-rescue-service-demo.json)には公開可能な観測・成果物・Hash・Tx・残高だけを保存。画面は`http://localhost:3000/rescue-room/operations`。現在の残高を常時取得する画面ではなく、検証日時付きの履歴スナップショット。
- 公開Evidence生成は記録済みAI出力でWorkflowを再構築し、Runtimeを含むReceipt Hash、Acceptance Hash、各Escrow Event、ERC20 Transfer、残高を照合する。新しい推論を再現する検証でも、診断の真実性を証明する仕組みでもない。

### 使用量

2026-09-11 15:39 UTCの読取照合時点。19件の成功Transactionを対象とした。

| 項目 | 結果 | 意味 |
| --- | ---: | --- |
| 実AI呼び出し | 2回 | Commander 1回、専門家1回。返金テストはAIを呼ばない |
| 入力 / 出力Token | 1,567 / 166 | 保存済みRuntimeの使用量 |
| AI料金推計 | $0.0005126 | 入力$0.20/M、出力$1.20/Mで計算。請求書ではない |
| Sepoliaガス代 | 0.003328678461839099 ETH | Deploy・管理・役割補充・サービス支払い・返金の合計 |
| 役割Walletへの移動 | 0.009 ETH | 3役割へ0.003ずつ。残高移動であり全額を費用消費したわけではない |
| 承認上限 | $5 / 1 Sepolia ETH | 上限は目標ではない。Mainnet使用なし |

AI料金の参照: [OpenAI gpt-5.6-luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna)。実行予算は1呼び出し50セントを保守的に予約し、最大10回。失敗・結果不明時も予約を解放しない。ETHはDeploy/補充側0.75、Executor側0.25の最大費用予約を分離している。

### ローカル操作

```powershell
# 状況・記録の確認だけ（推論・送金なし）
pnpm rescue:operator status
pnpm rescue:operator:server
pnpm rescue:jobs list
pnpm rescue:jobs get --job <job-id>

# RPC読取で証跡を再検証し、公開JSONを生成する
pnpm rescue:evidence:verify

# 有料操作を許可する場合のみ。既定のServerとは別プロセスを重複起動しない
pnpm rescue:operator:server --execute-approved-sepolia
pnpm rescue:jobs create --file <request.json>
pnpm rescue:jobs run --job <job-id>
```

作成用JSONは`{ "idempotencyKey": "unique-request", "request": { "schemaVersion": "rescue-service-workflow-request-v0", "episodeId": "public-episode-id", "playbook": { ... } } }`。Playbookは既存の正規化・検証を通す。作成だけでは実行しない。Server既定値は**実行無効**で、`run`は503を返す。起動時に生成するローカルBearerはCLIが自動読取し、引数や出力には出さない。

元の1件の再照会は`pnpm rescue:operator run --execute-approved-sepolia`でも保存済み結果を返す。`refund-test --execute-approved-sepolia`も既存返金Evidenceを再利用する。新規実行は別の明示的Jobで行い、結果不明Jobを新規キーで無条件に置換しない。

### 保管と復旧

- `secrets/rescue-operator-wallets.json`: 専用役割の秘密鍵。`secrets/rescue-operator-http.json`: ローカルBearer。`.frontier/rescue-operator/`: 永続Job、予算予約、署名済みTx Journal、内部Evidence。すべてGit除外。
- このPilotの秘密情報はローカルファイルであり、暗号化VaultやKMSではない。Windowsのアクセス制御と安全なバックアップが必要。Git除外だけで秘密保管が完成するわけではない。
- **これらを消して予算をリセットしたり、稼働中のディレクトリを別ホストへコピーして同時実行しない。** 予算・二重実行防止は保存済み履歴に依存する。
- ロックを自動期限切れ回収しない。残存Lockは旧プロセス停止・Receipt/Nonce/モデル実行状態を確認したうえで手動調査する。`needs-reconciliation`は自動リトライの許可ではない。
- 同じ署名済みTxは同じHashで照合・再送する。別Labelで未解決Nonceを置換せず停止する。返金期限後の遅延ReleaseはContractで拒否する。

### 検証済み範囲

- TypeScript全体: **619 passed / 11 skipped**（Redis opt-inは未実行）。
- Solidity全体: **49 passed**（並行担当のOcean 8件を含む。Rescueは13件）。Foundry v1.8.1をローカル検証に使用。
- Workspace Typecheck、Web production build、Tooling build、生成API契約の差分検査、隔離環境へのSDK/CLIパッケージインストール、既存CLI 5フローが成功。
- Local AnvilでDeployと再開を検証。2度目のDeployで追加Transactionなし。実Sepoliaの既存ジョブ再実行も追加Transaction/モデル呼び出しなし。
- Operator HTTP実接続: 認証なし401、Forwarded Host拒否403、既定Run無効503、公開DTOの内部実行Token除外を確認。
- Webは1440px/390pxで画面・Details開閉・既存ゲームからの遷移・横overflowなし・Console Error 0を確認。`pnpm verify:rescue:operator-ui`は有料APIや送金を呼ばない。
- 対象TS/TSXのESLint・Prettierと`git diff --check`を実施。全体`pnpm run ci`は完了扱いにしない。Foundryの全体format checkに既存Solidity整形差分があり、無関係なContractを一括整形していない。

### 次の実装単位（未完了）

1. 有料Serviceの成果物が意思決定へ戻る複数手番Workflow。今回の1回購入sidecarから、独立した評価Context/受入条件を定めて拡張する。
2. 外部AI参加者の保存・認証・提出と、Service Providerの独立参加・価格/品質/納品契約。現在は運営管理の限定経路。
3. 未知の複数Final Episode、事前Commit/Entry Lock、比較Context固定、公平性と攻略耐性のSimulation。
4. 同じFinal Evidenceに対する独立Value PoolのAllocationとRescue報酬Settlement。
5. 本番永続Store・複数ホスト実行・Secret Vault・運用監視、およびPlan11のSponsor実環境検証。

本バッチではGit Push、npm公開、Web外部デプロイを行っていない。
