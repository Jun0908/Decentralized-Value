import type { Metadata } from "next";
import Link from "next/link";
import evidence from "../../../../../../Docs/evidence/deployments/rescue-submission-demo.json";
import replayFixture from "../../../../../../Docs/evidence/deployments/rescue-submission-replay.json";
import styles from "./submission.module.css";

export const metadata: Metadata = {
  title: "AIに払う。それで良くなった？ | Rescue Room",
  description:
    "実AIの雇用・分析・次の判断から、独立したOutcomeとValue Poolまでを確認する提出用デモ。",
};
const labels: Record<string, string> = {
  WAIT: "観測を続ける",
  PAUSE_MODULE: "対象モジュールを止める",
  PAUSE_PROTOCOL: "全体を止める",
  RESUME_MODULE: "対象を再開する",
  RESUME_PROTOCOL: "全体を再開する",
  CLOSE_INCIDENT: "追加対応を終了する",
};
const poolLabels: Record<string, string> = {
  loss: "資産を守る",
  availability: "利用を止めない",
  spend: "調査費用を抑える",
};
const number = (value: number) => new Intl.NumberFormat("ja-JP").format(value);

export default function RescueSubmissionPage() {
  const names = new Map(evidence.comparison.points.map((p) => [p.id, p.name]));
  return (
    <main className={styles.demo}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>RESCUE ROOM / SUBMISSION DEMO</p>
        <h1>
          AIに払う。
          <br />
          それで、本当に良くなった？
        </h1>
        <p className={styles.lead}>
          架空のProtocolに異常。Commanderは専門家AIの分析を購入し、対応を判断する。
          <br />
          結果は一つの点数ではなく、守れた資産・利用できたサービス・使った費用で見る。
        </p>
        <div className={styles.badges}>
          <span>実AIの記録</span>
          <span>Sepolia支払い確認済み</span>
          <span>Protocol操作はSimulation</span>
        </div>
        <p>保存済みの実行を読むデモです。閲覧で推論・送金は発生しません。</p>
        <Link href="/rescue-room/submission/en" lang="en">
          English demo →
        </Link>
      </header>

      <section aria-labelledby="purchase-title">
        <p className={styles.eyebrow}>01 / INFORMATION HAS A COST</p>
        <h2 id="purchase-title">分からないから、専門家に依頼する。</h2>
        <div className={styles.flow}>
          <article>
            <span>Commander AI</span>
            <h3>出金量と新規アドレスが増えた</h3>
            <p>原因も本当のSeverityも見えない。Pulse Monitorへ分析を依頼した。</p>
          </article>
          <article>
            <span>Sepolia Escrow</span>
            <h3>5 rUSD-DEMOを支払った</h3>
            <p>納品を記録し、Provider Walletへ移動。価値を主張しないテストTokenです。</p>
            <a
              href={`https://sepolia.etherscan.io/tx/${evidence.releaseTx}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              実際の支払いTxを見る ↗
            </a>
          </article>
          <article>
            <span>Specialist AI</span>
            <h3>「原因不明。監視を続ける」</h3>
            <p>断定せず、追加観測を提案。これは分析であり、診断の正しさの証明ではありません。</p>
            <details>
              <summary>納品の原文を見る</summary>
              <p>{evidence.specialistSummary}</p>
            </details>
          </article>
        </div>
      </section>

      <section aria-labelledby="response-title">
        <p className={styles.eyebrow}>02 / EVIDENCE RETURNS TO THE COMMANDER</p>
        <h2 id="response-title">受け取った分析から、次の判断へ。</h2>
        <p>
          購入済み分析を各手番の入力に含め、現在の公開観測と合わせて実AIが判断しました。途中のSimulator製レポートは、実AIの納品とは別の情報として明示しています。
        </p>
        <ol className={styles.flow}>
          {evidence.turns.map((turn) => (
            <li key={turn.turn}>
              <span>
                判断 {turn.turn} · Game T+{turn.gameMinute}
              </span>
              <h3>{labels[turn.action.type] ?? turn.action.type}</h3>
              <p>
                {"minutes" in turn.action
                  ? `${turn.action.minutes}分待って状況を見る。`
                  : "module" in turn.action
                    ? `対象：${turn.action.module}。全体停止ではなく、対象だけを停止。`
                    : "許可された範囲の操作。"}
              </p>
              <details>
                <summary>判断の記録</summary>
                <p>{turn.reasonCode}</p>
                <code>{turn.inputHash}</code>
              </details>
            </li>
          ))}
        </ol>
        <p className={styles.note}>
          3手番で打ち切り、その状態からGame
          T+60までSimulationを進めました。完全な自律復旧や、追加購入・Patch・Resumeまでの完了を示すものではありません。
        </p>
      </section>

      <section aria-labelledby="outcome-title">
        <p className={styles.eyebrow}>03 / MEASURE ONCE. PRESERVE THE TRADEOFFS.</p>
        <h2 id="outcome-title">支払ったAIが、必ず優れているとは限らない。</h2>
        <p>
          同じ公開Episode・権限・Simulatorで、記録済み行動と固定戦略を比較。今回は「購入せず何もしない」が他の2戦略を支配しました。結果をAIに有利になるよう置き換えていません。
        </p>
        <div className={styles.flow}>
          {evidence.comparison.points.map((point) => (
            <article key={point.id}>
              <span>
                {evidence.comparison.frontier.includes(point.id) ? "PARETO FRONTIER" : "比較対象"}
              </span>
              <h3>{point.name}</h3>
              <dl>
                <div>
                  <dt>ユーザー損失 ↓</dt>
                  <dd>{number(point.values.loss)} USD</dd>
                </div>
                <div>
                  <dt>需要を提供できた割合 ↑</dt>
                  <dd>{(point.values.availability / 10000).toFixed(2)}%</dd>
                </div>
                <div>
                  <dt>調査費用 ↓</dt>
                  <dd>{number(point.values.spend)} Credits</dd>
                </div>
              </dl>
              <p>操作の正当性：{point.correctness ? "PASS" : "FAIL"}</p>
            </article>
          ))}
        </div>
        <p className={styles.note}>
          USDは架空の資産損失、Creditsはゲーム内費用。実Token・API料金・ガス代とは別です。PASSは行動ルールの正当性であり、AIの診断精度ではありません。単発の比較はAIの性能評価や未知Finalではありません。
        </p>
      </section>

      <section aria-labelledby="pools-title">
        <p className={styles.eyebrow}>04 / LET VALUES DIVERGE</p>
        <h2 id="pools-title">同じEvidenceでも、支持の仕方は一つではない。</h2>
        <p>
          各Poolは一つの軸だけで判断します。正当性PASSの候補から最良値を選び、同値なら100 Preview
          Creditsを均等分配。端数はID順に割り当てます。3つの配分を合算した総合順位は作りません。
        </p>
        <div className={styles.flow}>
          {evidence.comparison.pools.map((pool) => (
            <article key={pool.key}>
              <span>{pool.name}</span>
              <h3>{poolLabels[pool.key]}</h3>
              <p>独立予算：100 Preview Credits</p>
              <ul>
                {pool.allocations.map((allocation) => (
                  <li key={allocation.id}>
                    {names.get(allocation.id)}
                    <strong>{allocation.credits}</strong>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <p className={styles.note}>
          配分は説明用Previewで、報酬のCommit・送金ではありません。この単純なPoolはPareto参加を必須にせず、選んだ軸の同値候補も支持します。大会用Poolとは別Versionです。
        </p>
      </section>

      <section>
        <h2>記録を検証する。戦略も、自分で試せる。</h2>
        <div className={styles.links}>
          <Link href="/arenas/rescue-room">戦略を編集してPracticeする →</Link>
          <Link href="/rescue-room/operations">支払い・返金の詳しい証跡 →</Link>
          <Link href="/docs/cli">Agent向けAPI / SDK / CLI →</Link>
        </div>
        <details>
          <summary>再現情報とEvidenceを開く</summary>
          <p>記録日時：{evidence.recordedAt} · Replay一致：確認済み</p>
          <p>Model：gpt-5.6-luna · 追加呼び出し：{evidence.usage.requests}回 · 追加送金：0件</p>
          <p>Context Hash</p>
          <code>{evidence.contextHash}</code>
          <p>Outcome Hash</p>
          <code>{evidence.outcome.resultHash}</code>
          <p>Evidence Hash</p>
          <code>{evidence.evidenceHash}</code>
          <p>
            公開データから再検証：pnpm verify:rescue:submission-replay（APIキー・秘密ファイル不要）
          </p>
          <a
            download="rescue-submission-demo.json"
            href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(evidence, null, 2))}`}
          >
            公開Evidence JSONを保存
          </a>
          <p>
            <a
              download="rescue-submission-replay.json"
              href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(replayFixture, null, 2))}`}
            >
              公開Replay入力を保存
            </a>
          </p>
        </details>
        <p className={styles.note}>
          運営管理のAI・Walletによる実証です。第三者Service Market、Hidden
          Final大会、参加者への報酬送金、ENS／Bazantic／CREの実連携完成は主張しません。
        </p>
      </section>
    </main>
  );
}
