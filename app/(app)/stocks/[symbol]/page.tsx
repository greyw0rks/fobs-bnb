import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { getAssetVariants } from "@/lib/assets";
import { getFeed } from "@/lib/feed";
import { getStockInfo } from "@/lib/stock-info";
import { TradePanel } from "@/components/fobs/trade-panel";
import { FeedCard } from "@/components/feed/trade-card";
import { PriceChart } from "@/components/fobs/price-chart";
import { NewsPanel } from "@/components/fobs/news-panel";
import { WatchButton } from "@/components/fobs/watch-button";
import { Reveal } from "@/components/fobs/motion";
import { providerLabel } from "@/lib/assets-registry";
import { price as fmtPrice, pct, compactUsd, tokenUrl, shortAddress } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  const [variants, feed] = await Promise.all([getAssetVariants(symbol), getFeed("for-you")]);
  if (variants.length === 0) notFound();

  const primary = variants[0];
  const { profile, market } = await getStockInfo(primary.contractAddress, symbol);
  const activity = feed.filter((p) => p.trade?.symbol === symbol);
  const chgDir = primary.change24h == null ? "flat" : primary.change24h >= 0 ? "up" : "down";
  const priced = variants.filter((v) => v.price != null).length;

  const companyName = profile?.underlyingFullName ?? primary.name;
  const num = (s: string | undefined) => (s != null && Number.isFinite(Number(s)) ? Number(s) : null);
  const fundamentals: [string, string][] = [
    ["52W high", fmtPrice(num(market?.high52W))],
    ["52W low", fmtPrice(num(market?.low52W))],
    ["Market cap", compactUsd(market?.marketCap)],
    ["P/E (TTM)", market?.peRatioTTM ?? "—"],
    ["P/B", market?.pbRatio ?? "—"],
  ];
  const hasFundamentals = market != null && fundamentals.some(([, v]) => v !== "—");

  return (
    <div className="min-w-0">
      <div className="term">
        {/* LEFT — token info (arcus TokenInfo placement) */}
        <Reveal className="term-col" delay={0}>
          <div className="tok-head">
            <div className="tok-eyebrow">{primary.name}</div>
            <h1 className="tok-title">{symbol}</h1>
            <div className="price-row">
              <span className="price-big">{fmtPrice(primary.price)}</span>
              <span className={`price-chg ${chgDir}`}>{pct(primary.change24h)} 24h</span>
            </div>
            <div style={{ marginTop: 12 }}>
              <WatchButton symbol={symbol} />
            </div>
          </div>

          <div className="term-sec">
            <h2 className="term-h">Market</h2>
            <div className="kv"><span className="k">Last price</span><span className="v">{fmtPrice(primary.price)}</span></div>
            <div className="kv"><span className="k">24h change</span><span className="v" style={{ color: `var(--${chgDir === "flat" ? "faint" : chgDir})` }}>{pct(primary.change24h)}</span></div>
            <div className="kv"><span className="k">Venues priced</span><span className="v">{priced} / {variants.length}</span></div>
            <div className="kv"><span className="k">Network</span><span className="v">BNB Chain</span></div>
          </div>

          <div className="term-sec">
            <h2 className="term-h">Tokenized by</h2>
            {variants.map((v) => (
              <div key={v.provider} className="kv">
                <span className="k">
                  {providerLabel(v.provider)}
                  {v.contractAddress ? (
                    <a className="muted" style={{ marginLeft: 6, fontSize: 11 }} href={tokenUrl(v.contractAddress)} target="_blank" rel="noreferrer">
                      {shortAddress(v.contractAddress)} ↗
                    </a>
                  ) : (
                    <span className="muted" style={{ marginLeft: 6, fontSize: 11 }}>address pending</span>
                  )}
                </span>
                <span className="v">{fmtPrice(v.price)}</span>
              </div>
            ))}
            <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
              Tokenized stocks track a real company&apos;s price. Not for US persons at mint/redeem; KYC applies at the issuer.
            </p>
          </div>

          <div className="term-sec">
            <NewsPanel symbol={symbol} company={companyName} price={primary.price} change24h={primary.change24h} />
          </div>

          {profile?.description || profile?.ceo || profile?.sector || profile?.industry || profile?.website ? (
            <div className="term-sec">
              <h2 className="term-h">About {companyName}</h2>
              {profile?.description ? (
                <p className="muted" style={{ fontSize: 12, lineHeight: 1.55, marginBottom: 10 }}>
                  {profile.description}
                </p>
              ) : null}
              {profile?.ceo ? (
                <div className="kv"><span className="k">CEO</span><span className="v">{profile.ceo}</span></div>
              ) : null}
              {profile?.sector ? (
                <div className="kv"><span className="k">Sector</span><span className="v">{profile.sector}</span></div>
              ) : null}
              {profile?.industry ? (
                <div className="kv"><span className="k">Industry</span><span className="v">{profile.industry}</span></div>
              ) : null}
              {profile?.website ? (
                <div className="kv">
                  <span className="k">Website</span>
                  <span className="v">
                    <a className="muted" href={profile.website} target="_blank" rel="noreferrer">
                      {profile.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")} ↗
                    </a>
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          {hasFundamentals ? (
            <div className="term-sec">
              <h2 className="term-h">Fundamentals</h2>
              {fundamentals.map(([k, v]) => (
                <div key={k} className="kv"><span className="k">{k}</span><span className="v">{v}</span></div>
              ))}
            </div>
          ) : null}
        </Reveal>

        {/* CENTER — chart + social activity (arcus ChartPanel placement) */}
        <Reveal className="term-col center" delay={0.06}>
          <div className="term-tabs">
            <span className="term-tab active">Price</span>
          </div>
          <div className="term-toolbar">
            <span className="price-big" style={{ fontSize: 20 }}>{fmtPrice(primary.price)}</span>
            <span className={`price-chg ${chgDir}`} style={{ paddingBottom: 0 }}>{pct(primary.change24h)}</span>
            <span className="muted" style={{ marginLeft: "auto", fontSize: 11 }}>{symbol} · BNB Chain</span>
          </div>
          <div className="term-pad" style={{ paddingTop: 4 }}>
            <PriceChart symbol={symbol} contractAddress={primary.contractAddress} />
          </div>

          <div className="term-sec">
            <h2 className="term-h">Social activity</h2>
            <p className="muted" style={{ marginBottom: 12, fontSize: 12 }}>Real Fobs trades and posts on {symbol}.</p>
            {activity.length === 0 ? (
              <p className="muted" style={{ fontSize: 12 }}>No {symbol} activity yet. Be the first — trade it on the right.</p>
            ) : (
              <div className="stack">
                {activity.map((p) => (
                  <FeedCard key={p.id} post={p} />
                ))}
              </div>
            )}
          </div>
        </Reveal>

        {/* RIGHT — trade panel (arcus SwapPanel placement) */}
        <Reveal className="term-col aside" delay={0.12}>
          <TradePanel symbol={symbol} variants={variants} />
        </Reveal>
      </div>

      <Link href={"/markets" as Route} className="term-back">← All markets</Link>
    </div>
  );
}
