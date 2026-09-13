# Bazantic × Rescue Room — 接続修復とRecipe下書き

確認日：2026-09-12。既存Gatewayの修復を本人から依頼されて実施。無料Practiceの接続は成功した。Recipeは下書き保存・読戻しまでで、公開・AI実行・比較実験は未実施。

## 動く入口

- Gateway：<https://kjrjolrzlra2zd7f7uycwazhya.bazgateway.com>
- MCP：<https://kjrjolrzlra2zd7f7uycwazhya.bazgateway.com/mcp>
- 既存Gateway ID：`5262972e-395c-41ac-8fe5-fd302b0327c0`。
- Service slug：`kjrjolrzlra2zd7f7uycwazhya`。既存URL・名前・IDは変更していない。

## 404の原因と修正

MCPのToolは最新のSpecから生成されていたが、Gatewayのルート表は旧15ルートのままだった。現行CLI 0.10.0の`gateway resync --json`相当の読取APIで、Specにある48ルートが未登録と確認。接続先URLの誤りではなく、**Specとルート表の不一致**だった。[公式CLIのresync説明](https://bazantic.com/docs/cli)

既存15ルート・料金を保存し、次の3ルートだけを`priceMillicents: 0`で追加した。管理APIのPATCHは200、読戻しで18ルートの完全一致を確認。

| 無料で追加したルート | MCP Tool | 用途 |
| --- | --- | --- |
| `GET /v1/cli/arenas/{id}` | `getCliArena` | Rescueの公開Context・Schema・Sample・Episode一覧 |
| `GET /v1/rescue-room/starter-kit` | `downloadRescueRoomStarterKit` | Starterの取得。今回のバイナリ検証はHTTP経由 |
| `POST /v1/rescue-room/doctrine-evaluations` | `evaluateRescueRoomDoctrine` | 公開Episodeの決定論的評価 |

一括resyncは実行していない。残り45ルートは意図的に追加していない。AI Commander、認証、登録、Final、Settlementをこの作業で有効にしない。旧ルートの課金を変更せず、今回の3ルート以外を無料とは説明しない。`getCliArena`のルートは共通の`{id}`形式だが、実呼出しは`rescue-room`のみ。

[変更前後のルート・料金と検証結果](../deployments/bazantic-rescue-route-repair.json)。CLI 0.10.0はnpm公開TarballのSHA-512を照合してGit除外の`.frontier/tools/`へ展開し、Sourceを確認した。グローバルCLI 0.8.0の上書きや認証情報の変更はしていない。

## 実際に検証できたこと

1. **Gateway HTTP：6要求すべて200。** Manifest、12,117 bytesのStarter、Starter SHA-256、同一Doctrineの2評価、SDK独立Hash検査、反復一致が成功。
2. **Gateway MCP：64 Toolsを取得。** `getCliArena`と`evaluateRescueRoomDoctrine`を2回、計3回のTool呼出しが成功。
3. **MCPの返却値全体が一致。** 同一Doctrine・Episodeの2回の返却JSONが一致し、さらにローカルの`evaluateRescueDoctrinePracticeEpisode`の全結果とも一致。SDKの独立Hash検査も成功。

確認Episode：`episode-fabafc1906b4`。評価Hash：`0x144c9a882f88b116019f963cf7c3d868527b27ea642ef7784cff4b10fc914df4`。

| 独立Outcome | 結果 | 方向 |
| --- | ---: | --- |
| User loss | 0 USD | 最小化 |
| Served protocol demand | 845,915 ppm | 最大化 |
| Response spend | 46 Rescue Credits | 最小化 |

[MCP検証Evidence](../deployments/bazantic-rescue-mcp-verification.json)。このRunはSample Doctrineを検証したもので、LLMが戦略を発案したRunではない。全64 Tools、MCP経由のStarterバイナリ表現、第三者AIクライアントのUIまでは検証していない。

ローカル回帰確認：`rescue-practice-preflight`、SDK `rescue-integrity`、Bazantic `ab-harness`の3ファイル・67テスト成功。保存JSON、旧15ルートの保持、無料追加3件、Recipe定義Hashとdraft状態も検査した。Web / Contract / Evaluatorの実装は変更しておらず、全体Buildの再検証ではない。

## 再現

Repositoryで次を実行する。ログイン、APIキー、Wallet不要。標準HTTPであり、402を自動決済しない。

```powershell
pnpm exec tsx scripts/verify-rescue-practice-onboarding.ts https://kjrjolrzlra2zd7f7uycwazhya.bazgateway.com
```

MCPでは上記Endpointでinitialize → initialized → tools/listを行い、`getCliArena`へ`id: rescue-room`を渡す。その返却ManifestのSample Doctrine、公開Episode、Context Hashを固定して、`evaluateRescueRoomDoctrine`へ次を渡す。

```text
requestBody: { episodeId: <公開Episode ID>, doctrine: <Sample Doctrine> }
X-Frontier-Context-Hash: <ManifestのcontextHash>
X-Frontier-Runtime-Context-Hash: <ManifestのruntimeContextHash>
```

Gatewayが返したConversation IDは同じ会話でのみ引き継ぎ、作成・公開しない。MCPの応答はHTTP StatusとJSONを含むText形式なので、MCPのHTTP 200だけでなくTool error・内部Status・JSONのContextとHashを確認する。認証・402・不正結果で停止し、別経路の成功をそのToolの成功に読み替えない。

## Recipe下書き

既存アカウントのRecipe一覧は0件・次ページなしだった。そのため、実際に動いた2 Toolだけを束ねた下書きを作成した。

- 名前：`Rescue Room Strategy Comparison`。
- Handle：`rescue-room-strategy-comparison`。
- 状態：`draft`。公開されていない。
- Model設定：`anthropic/claude-haiku-4.5`。設定のみで推論していない。
- Bound Tools：`getCliArena`、`evaluateRescueRoomDoctrine`。
- 入力：比較したい戦略方針と、任意の公開Episode ID。
- 内容：SampleをBaselineにして1つの変更案を作り、同じContext・Episodeで2案を比較。3軸を独立表示し、失敗・同等・悪化も残す。

[保存した定義](../../bazantic/rescue-strategy-recipe.json)と[読戻しEvidence](../deployments/bazantic-rescue-recipe-draft.json)。作成後のGETで全定義フィールドの一致を確認した。Output Exampleは未実行と明示した形式例であり、実測値ではない。[Recipe公式仕様](https://bazantic.com/docs/recipes)

次はRecipeの実AI試行と出力検証。現在の無課金接続確認に、その実行や公開は含めない。Recipe有無のA/Bを行う場合はPrompt・Model・Tool・Episodeなどを固定し、既存の実験harnessへ全Runを残す。

## 非主張・残る境界

今回はGatewayの無料API接続とローカル再現一致が成功した。新規Gateway、課金承認、送金、推論、Recipe公開、Web公開、Git Pushは実行していない。管理APIの認証と無料データAPIの無認証は別の経路であり、前者のTokenを後者へ転送しない。

Rescue Creditsはゲーム内残高。実Service支払い、ENS認可、CRE、未知Final、大会Reward、RecipeによるAI性能改善、スポンサー要件全体の達成は、この結果だけでは示さない。

## 更新: 実外部AI → Bazantic MCPが成功（2026-09-12 09:45 UTC）

上の無料接続確認後に実AIを実行した。既存RecipeのPromptを利用し、外部OpenAI Agent（gpt-5-nano）がManifest取得→Baseline評価→候補評価を行った。3 Tool内部HTTP 200、SDK Integrity・ローカル再評価・独立軸比較が成功。[公開Evidence](../deployments/bazantic-rescue-agent-demo.json)、[撮影ページと手順](SPONSOR_DEMO_RECORDING.md)。

調査予算90→60 Creditsの候補は、公開1 EpisodeでBaselineと全3軸同値。改善や一般化を主張せず、同点を保持。成功までの先行5試行は接続／構造化入力の失敗または不明としてignored Journalに保持。6成功例や事前固定A/Bではない。

宣言済みRecipe modelはHaikuのままで、今回author model overrideを明記した。**Bazantic-hosted Recipeは未実行・未公開、Gateway決済は未実施。** OpenAIモデル応答4回、入力9,358／出力1,492 tokens。最大予約$0.10×6回は保守的予算であり請求実績ではない。無制限再試行をせず、追加試行は別途確認する。
