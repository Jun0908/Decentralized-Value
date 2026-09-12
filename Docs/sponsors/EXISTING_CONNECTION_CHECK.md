# 既存Sponsor設定の接続確認 — 2026-09-12

**同日後続の更新:** 本文は最初の読取Snapshot。本人依頼後、Bazanticの404は無料3ルート追加で解消し、HTTP / MCP評価とローカル再現一致まで成功。Recipeもdraft保存済み。[最新結果](BAZANTIC_RESCUE_LIVE.md)。CREの再試行はOrganization取得エラーではなくRPC未設定で停止。ENSv2 ETHRegistryのBlock 11687758では親所有者が本人提示アドレス`0x5A6A8964B044fdf18920ac4af64c18e88792261D`と一致した。以下の「未確認」「変更なし」は初回確認時点を指す。

本人からENS作成済み・Bazantic設定済みの連絡を受け、既存設定を読み取り確認した。新規登録、既存設定の上書き、権限変更、推論、支払い、チェーン取引、デプロイは行っていない。秘密値・CLIのアカウント情報・MCP Session / Conversation IDは保存しない。

## 結果

| 対象 | 確認できたこと | まだ通らないところ |
| --- | --- | --- |
| Chainlink CRE | CLI 1.33.0の`whoami --non-interactive`は成功。通常環境とSimulation用に環境変数を絞った環境の両方で確認 | 通常SimulationはOrganization情報取得時のCredential validationで失敗。公式Runtimeの評価結果は未取得 |
| Bazantic | CLI 0.8.0の認証成功。既存`Frontier Protocol` Gatewayはactive、MCP有効。設定URLは一覧のendpointUrlと一致、Service IDはslugと一致 | MCPの`getCliArena(id=rescue-room)`は404。公開APIへの直接GETは200 |
| ENS | Sepoliaの`frontierdemo.eth`でResolverを取得。使用viemは2.56.3 | 親のAddressと、親／`runners.frontierdemo.eth`の`frontier.runners`はnull。所有・ENSv2移行・委任権限・実Runner認可は未確認 |

登録の存在と、アプリで使えることを分ける。以前の「ログイン要求で停止」「ENS未設定」は以前の確認時点の記録であり、今回の状態はこの資料を優先する。

## CRE：再ログインではなくOrganizationの確認

実行した公式コマンドは`workflow simulate rescue-envelope --target local-simulation --non-interactive --trigger-index 0 --env <generated/public-fixture.env>`。公開Fixtureのみ使用し、`--broadcast`は使用していない。

実際の失敗段階は`unable to retrieve organization info`。CLIはアカウントのセットアップが未完了の可能性と数分後の再試行を案内している。ただし、このエラーだけでOrganizationが未作成とは断定できず、サービス側の問題も未切り分け。

既存`verify-cre-rescue.ts`は`authentication required`を先に照合するため、今回も「認証がない」と分類する。**生成Reportのその文言を、未ログインの証拠として使わない。** 生の認証エラー出力は公開しない。通常Simulationが停止したため、この確認ではConfidentialを追加実行していない。

次の対応：本人が既存CREアカウントのDashboardでOrganizationを開けるか確認。開けない場合はセットアップ状態／サポートを確認する。新Organization作成、Deploy Access申請、Wallet Linkは今回実行しない。[公式アカウント案内](https://docs.chain.link/cre/account/creating-account)

## Bazantic：MCP接続とAPI転送を分ける

- 登録一覧の正確なGateway URLに対する`/mcp`で、initialize、initialized、tools/listが成功。Serverは`Frontier Protocol` / `v0.19.0`、64 Tools、追加ページなし。
- `getCliArena`、`downloadRescueRoomStarterKit`、`evaluateRescueRoomDoctrine`の公開Schemaを確認した。
- 実際に呼び出した業務Toolは非課金Manifest取得の`getCliArena`だけ。MCP自体は応答するが、その結果は`isError: true`、API転送先へのGETが404。
- 同じRescue Manifestを[既存公開API](https://web-rho-seven-d6te7t3f0y.vercel.app/v1/cli/arenas/rescue-room)へ直接GETすると200 / JSON。したがって、Gatewayの接続先・ベースパス・転送設定の点検が次の切り分け。どの設定値が原因かは未確定。
- `BAZANTIC_SERVICE_ID`は登録一覧の内部IDではなくslugに一致していた。これを誤設定と断定しない。
- CLIにRecipe一覧コマンドはない。`BAZANTIC_RECIPE_ID`が環境変数にないことだけで、公開Recipe不存在とは判断しない。Dashboardで既存RecipeのURL / Versionを確認する。

`baz curl`は402自動支払い機能があるため使っていない。標準HTTPで、認証・支払Headerなし、redirectなしで確認した。AI Commander、注文、支払い、認証Toolは呼び出していない。Gateway / Recipeの更新は変更内容を確認してから行う。

## ENS：同じBlockでの読取Snapshot

- Chain ID：`11155111`、Block：`11687106`。
- 親名：`frontierdemo.eth`。
- Resolver：`0xbc7300c2f72C8CFEd5066626A9De082B4695FE3e`。
- 親名のAddress：`null`。
- 親名の`frontier.runners`：`null`。
- `runners.frontierdemo.eth`の`frontier.runners`：`null`。
- `ccipRead: false`での限定読取。Offchain Gatewayの動作は検証していない。

`packages/ens-adapter`の発見処理は`runners.<親名>`の`frontier.runners`配列を読み、各RunnerのAddress、role、capabilities、url、version、statusを検査する。今回のSnapshotではこの入口を取得できていない。親Addressのnullだけを失敗原因と断定するものではない。

使用viemは公式の読取対応下限2.35.0を上回る。ただし対応LibraryやResolverの存在だけでは、名前のENSv2移行・所有・認可の証明にならない。[公式ENSv2対応案内](https://docs.ens.domains/web/ensv2-readiness/)

次の対応：本人が作成した名前がこの親名・Sepoliaで合っているか、既存管理画面と照合する。所有／権限と実Runnerの公開URL・Signerを確定してから、必要レコードと変更範囲を決める。再登録や既存Resolver変更を先行しない。

## 残作業の順序

1. CREのOrganization状態を本人が確認する。取得可能になってから通常／Confidential Simulationを再検証する。
2. Bazanticの既存Gatewayの接続先・Path設定を確認し、必要な修正を合意する。修正後、Manifest → Starter → 非課金Practice → Hash照合を通す。
3. ENSの既存名・所有権・実接続対象を確認して、必要なレコード／権限変更だけを合意する。
4. その後にスポンサー固有の実演・比較・証跡へ進む。今回の接続確認をスポンサー要件達成とは説明しない。

今回は外部接続の読取確認と文書更新であり、アプリ実装、全体テスト、公式CRE成功、実Recipe比較、ENS権限操作の完了報告ではない。
