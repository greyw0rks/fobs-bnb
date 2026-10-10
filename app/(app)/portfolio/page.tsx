"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import type { PortfolioView, FeedTrade, WalletBalance } from "@/lib/types";
import { money, price as fmtPrice, pct, qty, ago, shortHash, txUrl, tokenUrl } from "@/lib/format";
import { useFobsAddress, ConnectWalletButton } from "@/components/connect-wallet-button";

export default function PortfolioPage() {
  const address = useFobsAddress();
  const [data, setData] = useState<{ portfolio: PortfolioView; trades: FeedTrade[]; walletBalances?: WalletBalance[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/portfolio?address=${address}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [address]);

  if (!address) {
    return (
      <div className="card soft" style={{ maxWidth: 480 }}>
        <h1 className="trade-title">Your portfolio</h1>
        <p className="muted">Connect your BNB wallet to see your positions, P&amp;L and trade history — all from real on-chain activity.</p>
        <div style={{ marginTop: 12 }}>
          <ConnectWalletButton />
        </div>
      </div>
    );
  }

  const p = data?.portfolio;

  return (
    <div className="stack">
      <header>
        <h1 className="trade-title" style={{ fontSize: 22 }}>Portfolio</h1>
        <p className="muted">Positions and P&amp;L derived from your real trades. Nothing here is invented.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total value" value={money(p?.totalValueUsd ?? null)} />
        <Stat label="Cost basis" value={money(p?.totalCostUsd ?? 0)} />
        <Stat
          label="Unrealized P&L"
          value={money(p?.totalPnlUsd ?? null)}
          tone={p?.totalPnlUsd == null ? undefined : p.totalPnlUsd >= 0 ? "up" : "down"}
        />
      </div>

      <div className="fobs-surface p-5">
        <h2 className="text-sm font-semibold" style={{ marginBottom: 12 }}>Holdings</h2>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : !p || p.holdings.length === 0 ? (
          <p className="muted">No positions yet. <Link href={"/markets" as Route} className="link">Find something to trade →</Link></p>
        ) : (
          <div className="stack">
            {p.holdings.map((h) => (
              <Link key={h.symbol} href={`/stocks/${h.symbol}` as Route} className="row" style={{ borderTop: "1px solid #efeee9", paddingTop: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{h.symbol}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{qty(h.quantity)} @ avg {fmtPrice(h.avgPrice)}</div>
                </div>
                <div className="text-right">
                  <div className="num" style={{ fontSize: 13 }}>{money(h.valueUsd)}</div>
                  <div className="num" style={{ fontSize: 11, color: h.pnlPct == null ? "#9b9c95" : h.pnlPct >= 0 ? "#23845b" : "#c94c4c" }}>
                    {pct(h.pnlPct)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Allocation holdings={p?.holdings ?? []} total={p?.totalValueUsd ?? null} />

      <WalletBalances balances={data?.walletBalances} loading={loading} />

      <div className="fobs-surface p-5">
        <h2 className="text-sm font-semibold" style={{ marginBottom: 12 }}>Recent trades</h2>
        {!data || data.trades.length === 0 ? (
          <p className="muted">No trades yet.</p>
        ) : (
          <div className="stack">
            {data.trades.map((t) => (
              <Link key={t.id} href={`/trade/${t.id}` as Route} className="row" style={{ borderTop: "1px solid #efeee9", paddingTop: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {t.side === "buy" ? "Bought" : "Sold"} {t.symbol}
                  </div>
                  <div className="muted" style={{ fontSize: 11 }}>{ago(t.createdAt)}</div>
                </div>
                <div className="text-right">
                  <div className="num" style={{ fontSize: 13 }}>{money(t.amountUsd)}</div>
                  {t.txHash ? (
                    <a className="muted" style={{ fontSize: 11 }} href={txUrl(t.txHash)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                      {shortHash(t.txHash)} ↗
                    </a>
                  ) : (
                    <span className="chip">{t.status}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Allocation({ holdings, total }: { holdings: PortfolioView["holdings"]; total: number | null }) {
  // Allocation is only honest when we can price every position — otherwise the
  // percentages wouldn't sum against a real whole. When total value is unread we
  // simply don't show a breakdown rather than invent weights.
  const priced = holdings.filter((h) => h.valueUsd !== null);
  if (total === null || total <= 0 || priced.length === 0) return null;
  const rows = [...priced]
    .map((h) => ({ symbol: h.symbol, valueUsd: h.valueUsd as number, weight: ((h.valueUsd as number) / total) * 100 }))
    .sort((a, b) => b.valueUsd - a.valueUsd);
  const bar = ["#3175c6", "#23845b", "#c08a17", "#8a63d2", "#c94c4c", "#3aa0a0", "#9b9c95"];
  return (
    <div className="fobs-surface p-5">
      <h2 className="text-sm font-semibold" style={{ marginBottom: 12 }}>Allocation</h2>
      <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
        {rows.map((r, i) => (
          <div key={r.symbol} title={`${r.symbol} ${r.weight.toFixed(1)}%`} style={{ width: `${r.weight}%`, background: bar[i % bar.length] }} />
        ))}
      </div>
      <div className="stack">
        {rows.map((r, i) => (
          <div key={r.symbol} className="row" style={{ fontSize: 12 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: bar[i % bar.length], display: "inline-block" }} />
              {r.symbol}
            </span>
            <span className="num tabular-nums">{r.weight.toFixed(1)}% · {money(r.valueUsd)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WalletBalances({ balances, loading }: { balances?: WalletBalance[]; loading: boolean }) {
  // On-chain balances read straight from the wallet via ERC-20 balanceOf. These
  // carry no cost basis, so we show quantity + live value only — never P&L.
  if (loading || !balances || balances.length === 0) return null;
  return (
    <div className="fobs-surface p-5">
      <div className="row" style={{ marginBottom: 12 }}>
        <h2 className="text-sm font-semibold">Wallet balances</h2>
        <span className="chip">on-chain</span>
      </div>
      <p className="muted" style={{ fontSize: 11, marginBottom: 8 }}>
        Read directly from your wallet on BNB Chain. No cost basis on-chain, so no P&amp;L here.
      </p>
      <div className="stack">
        {balances.map((b) => (
          <a
            key={b.contractAddress}
            href={tokenUrl(b.contractAddress)}
            target="_blank"
            rel="noreferrer"
            className="row"
            style={{ borderTop: "1px solid #efeee9", paddingTop: 10 }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{b.symbol}</div>
              <div className="muted" style={{ fontSize: 11 }}>
                {qty(b.quantity)} {b.tokenSymbol} · {b.providerLabel} ↗
              </div>
            </div>
            <div className="text-right">
              <div className="num" style={{ fontSize: 13 }}>{money(b.valueUsd)}</div>
              <div className="muted num" style={{ fontSize: 11 }}>{fmtPrice(b.price)}</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="fobs-surface p-5">
      <div className="muted" style={{ fontSize: 11 }}>{label}</div>
      <div className="num" style={{ fontSize: 22, fontWeight: 600, color: tone === "up" ? "#23845b" : tone === "down" ? "#c94c4c" : undefined }}>
        {value}
      </div>
    </div>
  );
}
