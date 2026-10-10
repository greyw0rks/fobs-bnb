import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { getAssetVariants } from "@/lib/assets";
import { getFeed } from "@/lib/feed";
import { TradePanel } from "@/components/fobs/trade-panel";
import { FeedCard } from "@/components/feed/trade-card";
import { PriceChart } from "@/components/fobs/price-chart";
import { WatchButton } from "@/components/fobs/watch-button";
import { providerLabel } from "@/lib/assets-registry";
import { price as fmtPrice, pct, tokenUrl, shortAddress } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  const [variants, feed] = await Promise.all([getAssetVariants(symbol), getFeed("for-you")]);
  if (variants.length === 0) notFound();

  const primary = variants[0];
  const activity = feed.filter((p) => p.trade?.symbol === symbol);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-w-0 stack">
        <div className="fobs-surface p-6">
          <div className="row">
            <div>
              <div className="muted" style={{ fontSize: 12 }}>{primary.name}</div>
              <h1 className="trade-title" style={{ fontSize: 28 }}>{symbol}</h1>
              <div style={{ marginTop: 6 }}>
                <WatchButton symbol={symbol} />
              </div>
            </div>
            <div className="text-right">
              <div className="num" style={{ fontSize: 24, fontWeight: 600 }}>{fmtPrice(primary.price)}</div>
              <div
                className="num"
                style={{ color: primary.change24h == null ? "#9b9c95" : primary.change24h >= 0 ? "#23845b" : "#c94c4c" }}
              >
                {pct(primary.change24h)} today
              </div>
            </div>
          </div>
          <PriceChart symbol={symbol} contractAddress={primary.contractAddress} />
        </div>

        <div className="fobs-surface p-6">
          <h2 className="text-sm font-semibold" style={{ marginBottom: 4 }}>Social activity</h2>
          <p className="muted" style={{ marginBottom: 12 }}>Real Fobs trades and posts on {symbol}.</p>
          {activity.length === 0 ? (
            <p className="muted">No {symbol} activity yet. Be the first — trade it on the right.</p>
          ) : (
            <div className="stack">
              {activity.map((p) => (
                <FeedCard key={p.id} post={p} />
              ))}
            </div>
          )}
        </div>

        <div className="fobs-surface p-6">
          <h2 className="text-sm font-semibold" style={{ marginBottom: 12 }}>Token metadata</h2>
          <div className="stack">
            {variants.map((v) => (
              <div key={v.provider} className="row" style={{ borderTop: "1px solid #efeee9", paddingTop: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{providerLabel(v.provider)}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{v.tokenSymbol ?? `${symbol}·${v.provider}`}</div>
                </div>
                <div className="text-right">
                  <div className="num" style={{ fontSize: 13 }}>{fmtPrice(v.price)}</div>
                  {v.contractAddress ? (
                    <a className="muted" style={{ fontSize: 11 }} href={tokenUrl(v.contractAddress)} target="_blank" rel="noreferrer">
                      {shortAddress(v.contractAddress)} ↗
                    </a>
                  ) : (
                    <span className="muted" style={{ fontSize: 11 }}>address pending</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>
            Tokenized stocks track a real company&apos;s price. Not for US persons at mint/redeem; KYC applies at the issuer.
          </p>
        </div>

        <Link href={"/markets" as Route} className="muted">← All markets</Link>
      </section>

      <TradePanel symbol={symbol} variants={variants} />
    </div>
  );
}
