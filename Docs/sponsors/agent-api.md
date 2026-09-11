# 外部Agent向けAPI — 非課金のRescue Practice入口

## 提出Demoで使える範囲

既存APIをそのまま利用して、**外部AgentがDoctrine JSONを渡す → 決定論的Practiceを実行する → 独立OutcomeとReplay Evidenceを取得する**経路がある。新しい公開APIや支払い権限は不要。

これは「Agentが作った方針を評価する入口」であり、サーバーに任意コードを実行させる入口ではない。認証、OpenAI APIキー、Wallet、Sepolia ETHは不要。この経路は有料モデル・実Token支払いを呼び出さない。既存の一般API制限は適用される。

| 操作 | 既存経路 | 内容 |
| --- | --- | --- |
| 発見・入力例 | `GET /v1/cli/arenas/rescue-room` | Context、独立Metric定義、Public Episode一覧、Doctrine Schema／sample、Capability |
| Starter取得 | `GET /v1/rescue-room/starter-kit` | 入力例・公開Scenario・Schema。SDKでmanifest掲載のSHA-256を照合可能 |
| Practice実行 | `POST /v1/rescue-room/doctrine-evaluations` | `{ episodeId, doctrine }`からOutcome・Action・Transcript・Payment Evidenceを返す |

公開契約は[`openapi/frontier-v1.yaml`](../../openapi/frontier-v1.yaml)。Doctrine入力は`RescueRoomDoctrineEvaluationInput`、成功応答は`CliRescuePracticeResult`として定義済み。SDKは既存の`FrontierClient.evaluations.practice`を使う。

## curlで再現する

以下はbash／WSL等で`curl`と`jq`を使う例。最初にローカルWebを起動し、`BASE`は実際に起動した同一Originに合わせる。公開ホスティング先の疎通確認・Deployはこの検証に含まない。

```bash
BASE=http://localhost:3000
curl --fail --silent --show-error "$BASE/v1/cli/arenas/rescue-room" -o rescue-manifest.json
jq '{episodeId: .episodes[0].id, doctrine: .artifact.sample}' rescue-manifest.json > rescue-request.json

# 必要ならrescue-request.jsonのDoctrineを編集する。未知のSchemaや追加Fieldは受理しない。
CONTEXT=$(jq -r '.context.contextHash' rescue-manifest.json)
RUNTIME=$(jq -r '.context.runtimeContextHash' rescue-manifest.json)
curl --fail --silent --show-error \
  -H 'Content-Type: application/json' \
  -H "X-Frontier-Context-Hash: $CONTEXT" \
  -H "X-Frontier-Runtime-Context-Hash: $RUNTIME" \
  --data-binary @rescue-request.json \
  "$BASE/v1/rescue-room/doctrine-evaluations" -o rescue-result.json

jq '{state, paymentState, doctrineHash, evaluationHash, outcome, replay, rewardEligibility}' rescue-result.json
```

両Context Headerを付け、取得したContextを固定する。サーバー側Contextが変わっていた場合は409で止める。勝手に新しいContextを取り直して同じ比較集合へ混ぜない。

## SDKで再現する

実行可能な[SDK専用sample](../../packages/sdk/examples/rescue-practice.ts)を追加した。Windowsでもモノレポのルートから次を実行できる。

```text
pnpm exec tsx packages/sdk/examples/rescue-practice.ts http://localhost:3000
```

中核となる既存SDKの呼び方は次のとおり。モノレポではsource importを使い、配布物ではbuild済みの`@frontier/sdk`からimportする。npm公開済みという意味ではない。

```ts
import { FrontierClient } from "@frontier/sdk";

const client = new FrontierClient({ baseUrl: "http://localhost:3000" });
const manifest = await client.arenas.get("rescue-room");
const run = await client.evaluations.practice({
  arenaId: "rescue-room",
  context: manifest.context,
  episodeId: manifest.episodes[0]!.id,
  artifact: manifest.artifact.sample, // 自分のDoctrine JSONへ差し替える
});

console.log(run.correctness, run.values, run.resultHash);
console.log(run.raw); // Recorded Actions、Transcript、Replay、Payment Evidence
```

SDKはmanifest、Context、Episode、Runtime、解釈するResponse項目を照合する。ただし**SDKがHashを返すことだけでは、そのHashを独立再計算した証明にはならない**。下記検証Scriptで別途ローカルEvaluatorと記録ActionのReplayを照合する。

## 独立OutcomeとEvidence

| SDK Outcome | 方向 | 意味 |
| --- | --- | --- |
| `totalUserLossUsd` | 小さいほどよい | 架空Protocolで失われた資産のモデル値 |
| `servedProtocolDemandPpm` | 大きいほどよい | Protocolが処理できた需要の割合 |
| `netResponseSpendCredits` | 小さいほどよい | 情報購入等に使ったゲーム内Credits |

`correctness`は評価前の必須条件。3軸を加重合計した総合点は作らない。`compareRuns`で比較できるのは同じOrigin、Episode、Context、Metric定義のRunだけ。

- `doctrineHash`: 正規化された入力Artifact。
- `evaluationHash`: Doctrine評価の結果・文脈・Evidence全体。
- `outcome.resultHash` / `outcome.transcriptHash`: Game Outcomeと記録されたEvent列。
- `paymentEvidence`: **ゲーム内Credits**のOrder／Receipt記録。オンチェーン送金の証明ではない。
- `replay`: 記録Actionから再構成した結果。モデル推論やChain of Thoughtの再現ではない。
- `state: simulated`、`strategyState: deterministic-rules`、`paymentState: game-credits`、`rewardEligibility.eligible: false`を保つ。

## 外部サービスなしの検証

```text
pnpm exec tsx scripts/verify-rescue-submission-api.ts
```

既存API handlerへFetchを注入し、SDKから実際のRequest／Responseを通す。ネットワークSocketは開かず、環境ファイル・APIキー・Walletを読まない。OpenAPIの経路／Schema参照、Starter SHA-256、同入力の結果一致、ローカルEvaluator、記録Action Replay、Artifact／Outcome／Transcript／Payment Evidence Hash、改ざん拒否、Context不一致409、不正入力400を確認する。許可した非課金経路以外へのRequestは失敗させ、モデル呼び出し数0を確認する。

この成功は「このリポジトリのAPI／SDKが接続できる」の証明であり、Vercelの現行公開版・外部ネットワーク到達性・第三者による独立実装の検証ではない。

2026-09-12の実行結果は`pass`。12件の注入Requestで正常系200、Context拒否409、不正入力400を確認し、モデル呼び出し・外部通信・実支払いはすべて0。最初のPublic Episode `episode-fabafc1906b4`ではOutcomeが`0 USD / 845915 ppm / 46 Rescue Credits`、Evaluation Hashは`0x144c9a882f88b116019f963cf7c3d868527b27ea642ef7784cff4b10fc914df4`だった。同一Contextの別Doctrineとの比較では一方が支配しても、その事実をそのまま返し、複数Winnerを作為的に作らない。

## 今回の入口に含めないもの

有料AIを呼ぶ`/v1/rescue-room/commander-evaluations`、Loopbackの`/operator/rescue/jobs`、実Token支払いは別経路。非課金Practiceから暗黙に呼び出さない。

RescueのSubmission保存／Final Entry、Unknown Final、外部Service Market、Production Job DB、Pool報酬は未完成。`/rescue-room/operations`と[Sepolia証跡JSON](../deployments/sepolia-rescue-service-demo.json)は別のOperator Pilotの実績であり、このAPIの各Practice Runが支払済みになるわけではない。ENS／Gateway／CREの実統合をこの入口だけで達成したとも扱わない。
