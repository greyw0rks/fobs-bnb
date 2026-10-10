import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { getTradeDetail } from "@/lib/trade-service";
import { providerLabel } from "@/lib/assets-registry";
import { money, price as fmtPrice, qty, ago, txUrl, tokenUrl } from "@/lib/format";
import { Avatar } from "@/components/avatar";

export const dynamic = "force-dynamic";

// Per-trade detail — the canonical page for a single trade (the social primitive).
// Every figure is the recorded on-chain result; a null renders as an em dash, and
// settlement is verifiable on BscScan. Nothing here is invented.
export default async function TradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trade = await getTradeDetail(id);
  if (!trade) notFound();

  const verb = trade.side === "buy" ? "Bought" : "Sold";

  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <Link href={"/feed" as Route} className="muted" style={{ fontSize: 12 }}>← Back to feed</Link>

      <article className={`card trade-card ${trade.side}`}>
        <div className="row">
          <div className="user">
            <Avatar name={trade.user.displayName} avatar={trade.user.avatarUrl} />
            <span>
              <strong>
                <Link href={`/profile/${trade.user.username}` as Route}>{trade.user.displayName}</Link>
              </strong>
              <br />
              <span className="muted">@{trade.user.username} · {ago(trade.createdAt)}</span>
            </span>
          </div>
          <Link href={`/stocks/${trade.symbol}` as Route} className="button fomo">
            Trade {trade.symbol}
          </Link>
        </div>

        {trade.content ? <p style={{ marginTop: 8 }}>{trade.content}</p> : null}

        <div className="trade-hero">
          <div>
            <h3 className="trade-title">
              {verb} <span className="num">{trade.symbol}</span>
            </h3>
            <p className="figures">
              {trade.quantity !== null ? `${qty(trade.quantity)} tokens` : "—"} at {fmtPrice(trade.price)}
            </p>
          </div>
          <div className="text-right">
            <span className="num trade-amount">{money(trade.amountUsd)}</span>
            <br />
            <span className="chip">{trade.status === "confirmed" ? "On chain" : trade.status}</span>
          </div>
        </div>
      </article>

      <div className="fobs-surface p-5">
        <h2 className="text-sm font-semibold" style={{ marginBottom: 12 }}>Order details</h2>
        <dl style={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: 8, columnGap: 12, fontSize: 13 }}>
          <Row k="Side">{verb.replace("ght", "y").replace("Sold", "Sell")}</Row>
          <Row k="Symbol">{trade.symbol}{trade.assetName ? ` · ${trade.assetName}` : ""}</Row>
          <Row k="Provider">{trade.provider ? providerLabel(trade.provider) : "—"}</Row>
          <Row k="Token">{trade.tokenSymbol ?? "—"}</Row>
          <Row k="Amount">{money(trade.amountUsd)}</Row>
          <Row k="Quantity">{trade.quantity !== null ? `${qty(trade.quantity)} tokens` : "—"}</Row>
          <Row k="Fill price">{fmtPrice(trade.price)}</Row>
          <Row k="Status">{trade.status}</Row>
          <Row k="RFQ order">{trade.orderId ?? "—"}</Row>
          <Row k="Transaction">
            {trade.txHash ? (
              <a href={txUrl(trade.txHash)} target="_blank" rel="noreferrer" className="link">View on BscScan ↗</a>
            ) : (
              "— (awaiting settlement)"
            )}
          </Row>
          <Row k="Token contract">
            {trade.contractAddress && !trade.contractAddress.startsWith("pending:") ? (
              <a href={tokenUrl(trade.contractAddress)} target="_blank" rel="noreferrer" className="link">On BscScan ↗</a>
            ) : (
              "—"
            )}
          </Row>
        </dl>
      </div>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="muted">{k}</dt>
      <dd className="num tabular-nums" style={{ textAlign: "right", margin: 0 }}>{children}</dd>
    </>
  );
}
