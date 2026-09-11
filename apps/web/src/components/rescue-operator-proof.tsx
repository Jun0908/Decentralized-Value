import type { ReactNode } from "react";
import styles from "./rescue-operator-proof.module.css";

export interface RescueOperatorProofEvidence {
  verifiedAt: string | null;
  deployment: {
    tokenAddress: string;
    escrowAddress: string;
    commanderAddress: string;
  } | null;
  purchase: {
    serviceName: string;
    providerAddress: string;
    /** Human-readable six-decimal token quantities, not raw base units. */
    amount: string;
    commanderReason: string;
    observation: string;
    serviceSummary: string;
    recommendation: string;
    deliveryHash: string;
    receiptHash: string;
    acceptanceHash: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    estimatedModelCostUsd: number;
    fundingTx: string;
    deliveryTx: string;
    releaseTx: string;
    providerBalanceAfter: string;
  } | null;
  refund: {
    amount: string;
    fundingTx: string;
    refundTx: string;
    commanderBalanceAfter: string;
  } | null;
}

const recommendationLabels: Readonly<Record<string, string>> = {
  "continue-monitoring": "監視を続ける",
  "seek-second-opinion": "別の専門家の意見を取る",
  "consider-targeted-pause": "対象モジュールの一時停止を検討する",
  "escalate-to-commander": "Commanderに判断を戻す",
};

function ExplorerLink({
  value,
  kind = "tx",
  children,
}: {
  value: string;
  kind?: "tx" | "address";
  children: ReactNode;
}) {
  return (
    <a
      className={styles.explorerLink}
      href={`https://sepolia.etherscan.io/${kind}/${encodeURIComponent(value)}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <span aria-hidden="true"> ↗</span>
      <span className={styles.srOnly}>（Sepolia Etherscanを新しいタブで開く）</span>
    </a>
  );
}

function ProofStep({
  number,
  actor,
  title,
  children,
}: {
  number: string;
  actor: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className={styles.step}>
      <div className={styles.stepTop}>
        <span className={styles.stepNumber} aria-hidden="true">
          {number}
        </span>
        <span className={styles.actor}>{actor}</span>
      </div>
      <h3>{title}</h3>
      {children}
    </li>
  );
}

/** Read-only verified snapshot. The server loader owns validation and chain reconciliation. */
export function RescueOperatorProof({ evidence }: { evidence: RescueOperatorProofEvidence }) {
  const purchase = evidence.verifiedAt ? evidence.purchase : null;
  const refund = evidence.verifiedAt ? evidence.refund : null;
  const verifiedLabel = evidence.verifiedAt
    ? new Intl.DateTimeFormat("ja-JP", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Tokyo",
      }).format(new Date(evidence.verifiedAt))
    : null;

  return (
    <section className={styles.proof} aria-labelledby="rescue-proof-title" lang="ja">
      <header className={styles.hero}>
        <div className={styles.eyebrowRow}>
          <span className={styles.eyebrow}>RESCUE ROOM / PAYMENT PROOF</span>
          <span className={purchase ? styles.verifiedBadge : styles.pendingBadge}>
            {purchase ? "Sepolia支払いの検証記録" : "支払い証跡は未確認"}
          </span>
        </div>
        <h1 id="rescue-proof-title">
          {purchase ? (
            <>
              AIが、別のAIに
              <br />
              依頼して支払った。
            </>
          ) : (
            <>
              AIどうしの依頼と支払いを、
              <br />
              確かめる。
            </>
          )}
        </h1>
        <p className={styles.intro}>
          架空のProtocolで異常を観測したCommanderが、専門家AIの分析を購入する。
          「誰が判断し、何が届き、どこへ支払われたか」を、ひとつの流れで確認できます。
        </p>
        <p className={styles.snapshotNote}>
          {verifiedLabel ? (
            <>
              <time dateTime={evidence.verifiedAt!}>{verifiedLabel} JST</time>{" "}
              時点の検証済みスナップショットです。現在の残高や進行状況をリアルタイム表示する画面ではありません。
            </>
          ) : (
            "検証済みの記録が読み込まれるまで、送金や納品の成功は表示しません。"
          )}
          このページを見るだけでは、AI実行や送金は発生しません。
        </p>
      </header>

      {purchase ? (
        <section className={styles.purchasePanel} aria-labelledby="rescue-purchase-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>CASE 01 / 納品と支払い</p>
              <h2 id="rescue-purchase-title">購入したものは、専門家の「解釈」。</h2>
            </div>
            <div className={styles.amountBlock}>
              <span className={styles.amountLabel}>サービスへの支払額</span>
              <strong>
                {purchase.amount} <span>rUSD-DEMO</span>
              </strong>
              <span className={styles.amountNote}>金銭的価値のないテストトークン</span>
            </div>
          </div>

          <ol className={styles.steps} aria-label="AIへの依頼から支払いまでの4ステップ">
            <ProofStep number="01" actor="COMMANDER AI" title="専門家を選んだ">
              <p>自分だけで結論を出さず、{purchase.serviceName}に分析を依頼しました。</p>
              <div className={styles.decisionNote}>
                <span>依頼理由の記録</span>
                <p>{purchase.commanderReason}</p>
              </div>
            </ProofStep>
            <ProofStep number="02" actor="SEPOLIA ESCROW" title="代金を預けた">
              <p>
                {purchase.amount} rUSD-DEMOをEscrowへ移動。すぐに専門家へ渡さず、納品を待ちました。
              </p>
              <ExplorerLink value={purchase.fundingTx}>預け入れを確認</ExplorerLink>
            </ProofStep>
            <ProofStep number="03" actor="SPECIALIST AI" title="分析が届いた">
              <p>
                別のAI実行がEvidenceを解釈し、要約と次の行動案を返しました。納品Hashも記録しています。
              </p>
              <ExplorerLink value={purchase.deliveryTx}>納品記録を確認</ExplorerLink>
            </ProofStep>
            <ProofStep number="04" actor="SERVICE WALLET" title="対価が支払われた">
              <p>
                納品形式と参照元を検査した後、Escrowからサービス提供者のウォレットへ送金しました。
              </p>
              <ExplorerLink value={purchase.releaseTx}>支払いを確認</ExplorerLink>
            </ProofStep>
          </ol>

          <div className={styles.findings}>
            <article className={styles.observation}>
              <p className={styles.kicker}>COMMANDERが見ていたもの</p>
              <h3>最初から「正解」は見えていない。</h3>
              <p className={styles.evidenceText}>{purchase.observation}</p>
              <p className={styles.helpText}>
                専門家にも非公開のTrue
                Stateは渡していません。入力は公開情報と、許可された購入済みEvidenceです。
              </p>
            </article>
            <article className={styles.finding}>
              <p className={styles.kicker}>{purchase.serviceName}からの納品</p>
              <h3>何が分かり、次に何を提案したか。</h3>
              <p className={styles.evidenceText}>{purchase.serviceSummary}</p>
              <div className={styles.recommendation}>
                <span>提案</span>
                <p>{recommendationLabels[purchase.recommendation] ?? purchase.recommendation}</p>
              </div>
              <p className={styles.helpText}>
                これは分析結果であり、診断の正しさを保証するものではありません。提案を表示してもProtocol操作は実行されません。
              </p>
            </article>
          </div>

          <div className={styles.receiptStrip}>
            <div>
              <span className={styles.smallLabel}>受取先</span>
              <ExplorerLink value={purchase.providerAddress} kind="address">
                サービス提供者のウォレット
              </ExplorerLink>
            </div>
            <p>
              <span className={styles.smallLabel}>支払いBlock時点の受取先残高</span>
              <strong>{purchase.providerBalanceAfter} rUSD-DEMO</strong>
            </p>
            <p>
              <span className={styles.smallLabel}>AI API利用料の推定</span>
              <strong>${purchase.estimatedModelCostUsd.toFixed(4)} USD</strong>
              <span className={styles.helpText}>サービス対価・ネットワーク手数料とは別</span>
            </p>
          </div>

          <details className={styles.details}>
            <summary>技術的な証跡を見る：納品Hash・モデル・Token使用量</summary>
            <dl className={styles.hashList}>
              <div>
                <dt>Delivery Hash — 納品全体</dt>
                <dd>
                  <code>{purchase.deliveryHash}</code>
                </dd>
              </div>
              <div>
                <dt>Receipt Hash — 納品の受領記録</dt>
                <dd>
                  <code>{purchase.receiptHash}</code>
                </dd>
              </div>
              <div>
                <dt>Acceptance Hash — 受付検査の記録</dt>
                <dd>
                  <code>{purchase.acceptanceHash}</code>
                </dd>
              </div>
              <div>
                <dt>使用モデル</dt>
                <dd>{purchase.model}</dd>
              </div>
              <div>
                <dt>AI Token使用量（rUSD-DEMOとは別）</dt>
                <dd>
                  入力 {purchase.inputTokens.toLocaleString("ja-JP")} / 出力{" "}
                  {purchase.outputTokens.toLocaleString("ja-JP")}
                </dd>
              </div>
            </dl>
            <p className={styles.helpText}>
              Hashは記録の対応や改変を確認するための識別子です。Hashが存在するだけで、診断内容の正しさが証明されるわけではありません。
            </p>
          </details>
        </section>
      ) : (
        <section className={styles.emptyPanel} aria-labelledby="rescue-purchase-title">
          <span className={styles.pendingBadge}>未確認</span>
          <h2 id="rescue-purchase-title">AIへの依頼・納品・支払いの証跡は、まだありません。</h2>
          <p>
            Practiceのログやゲーム内残高だけでは、Sepoliaで実際に支払ったことにはなりません。検証済みのTransactionと納品記録が揃うと、ここに4ステップで表示します。
          </p>
        </section>
      )}

      <section className={styles.refundPanel} aria-labelledby="rescue-refund-title">
        <div>
          <p className={styles.kicker}>CASE 02 / 別の注文で返金を検証</p>
          <h2 id="rescue-refund-title">納品がなければ、どうなる？</h2>
          <p>
            {refund
              ? "こちらは意図的に納品を行わなかった、別注文のタイムアウト試験です。上の支払い成功例を取り消したものではありません。"
              : "別注文で意図的に納品を行わず、期限後に代金が戻ることを検証する項目です。支払い成功の証跡とは分けて扱います。"}
          </p>
        </div>
        {refund ? (
          <div className={styles.refundResult}>
            <span className={styles.refundBadge}>返金を確認</span>
            <p className={styles.refundAmount}>
              {refund.amount} <span>rUSD-DEMO</span>
            </p>
            <p>Escrowに預けた代金が、期限後にCommanderへ戻りました。</p>
            <div className={styles.linkRow}>
              <ExplorerLink value={refund.fundingTx}>この注文の預け入れ</ExplorerLink>
              <ExplorerLink value={refund.refundTx}>返金Transaction</ExplorerLink>
            </div>
            <p className={styles.helpText}>
              返金Block時点のCommander残高：{refund.commanderBalanceAfter}{" "}
              rUSD-DEMO。返金されるのは預けたトークンで、ネットワーク手数料ではありません。
            </p>
          </div>
        ) : (
          <div className={styles.refundResult}>
            <span className={styles.pendingBadge}>返金証跡は未確認</span>
            <p>返金のTransactionと受取証跡がないため、成功とは表示していません。</p>
          </div>
        )}
      </section>

      <aside className={styles.boundary} aria-labelledby="rescue-proof-boundary-title">
        <h2 id="rescue-proof-boundary-title">この実証で言えること・まだ言えないこと</h2>
        <div className={styles.boundaryGrid}>
          <div>
            <h3>検証対象は、AI実行とテストネット決済</h3>
            <p>
              Commanderと専門家を別々に実行し、ウォレットの役割も分ける設計です。ただし、すべて運営管理下の実証であり、独立した第三者が参加するService
              Marketではありません。
            </p>
          </div>
          <div>
            <h3>分析の購入であって、インシデント解決の証明ではない</h3>
            <p>
              専門家が行うのは与えられたEvidenceの解釈です。新しいオンチェーン監視や実Protocolへの操作は行わず、既存ゲームの決定論的な評価結果も変更しません。
            </p>
          </div>
          <div>
            <h3>テストトークンとゲーム内Creditは別</h3>
            <p>
              rUSD-DEMOはSepolia上のデモトークンで、米ドルとの交換価値はありません。PracticeのRescue
              Credits、AI APIのUSD利用料、Gas用Sepolia
              ETHとも別です。Final大会や報酬配分の完了を示す画面ではありません。
            </p>
          </div>
        </div>
      </aside>

      {evidence.deployment ? (
        <details className={styles.details}>
          <summary>この実証で使用するContractとCommanderのアドレス</summary>
          <dl className={styles.hashList}>
            <div>
              <dt>rUSD-DEMO Token</dt>
              <dd>
                <ExplorerLink value={evidence.deployment.tokenAddress} kind="address">
                  {evidence.deployment.tokenAddress}
                </ExplorerLink>
              </dd>
            </div>
            <div>
              <dt>Service Escrow</dt>
              <dd>
                <ExplorerLink value={evidence.deployment.escrowAddress} kind="address">
                  {evidence.deployment.escrowAddress}
                </ExplorerLink>
              </dd>
            </div>
            <div>
              <dt>Commander Wallet</dt>
              <dd>
                <ExplorerLink value={evidence.deployment.commanderAddress} kind="address">
                  {evidence.deployment.commanderAddress}
                </ExplorerLink>
              </dd>
            </div>
          </dl>
          <p className={styles.helpText}>
            ネットワークはEthereum Sepoliaです。この画面から送金する必要はありません。
          </p>
        </details>
      ) : null}
    </section>
  );
}
