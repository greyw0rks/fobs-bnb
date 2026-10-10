"use client";

// Watchlist view — the symbols the connected wallet has starred, hydrated with
// live prices from /api/assets. A watch is a bookmark, so we show only what is
// real: the live price (em dash when unread) and 24h change. No position, no P&L.

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import type { Asset } from "@/lib/types";
import { price as fmtPrice, pct } from "@/lib/format";
import { WatchButton } from "@/components/fobs/watch-button";
import { useFobsAddress, ConnectWalletButton } from "@/components/connect-wallet-button";

export default function WatchlistPage() {
  const address = useFobsAddress();
  const [symbols, setSymbols] = useState<string[] | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setSymbols(null);
      return;
    }
    setLoading(true);
    Promise.all([
      fetch(`/api/watchlist?address=${address}`).then((r) => (r.ok ? r.json() : { symbols: [] })),
      fetch(`/api/assets`).then((r) => (r.ok ? r.json() : { assets: [] }))
    ])
      .then(([w, a]: [{ symbols?: string[] }, { assets?: Asset[] }]) => {
        setSymbols(w.symbols ?? []);
        setAssets(a.assets ?? []);
      })
      .catch(() => {
        setSymbols([]);
        setAssets([]);
      })
      .finally(() => setLoading(false));
  }, [address]);

  if (!address) {
    return (
      <div className="card soft" style={{ maxWidth: 480 }}>
        <h1 className="trade-title">Watchlist</h1>
        <p className="muted">Connect your BNB wallet to star stocks and follow them here.</p>
        <div style={{ marginTop: 12 }}>
          <ConnectWalletButton />
        </div>
      </div>
    );
  }

  const watched = (symbols ?? []).map((s) => s.toUpperCase());
  const bySymbol = new Map(assets.map((a) => [a.symbol.toUpperCase(), a]));
  const rows = watched.map((s) => ({ symbol: s, asset: bySymbol.get(s) ?? null }));

  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <header>
        <h1 className="trade-title" style={{ fontSize: 22 }}>Watchlist</h1>
        <p className="muted">Stocks you&apos;re watching. Live prices only — a watch implies no position.</p>
      </header>

      <div className="fobs-surface p-5">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="muted">
            Nothing watched yet. <Link href={"/markets" as Route} className="link">Browse markets →</Link>
          </p>
        ) : (
          <div className="stack">
            {rows.map(({ symbol, asset }) => (
              <div key={symbol} className="row" style={{ borderTop: "1px solid #efeee9", paddingTop: 10 }}>
                <Link href={`/stocks/${symbol}` as Route} style={{ color: "inherit" }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{symbol}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{asset?.name ?? "—"}</div>
                </Link>
                <div className="row" style={{ gap: 14 }}>
                  <div className="text-right">
                    <div className="num" style={{ fontSize: 13 }}>{fmtPrice(asset?.price ?? null)}</div>
                    <div
                      className="num"
                      style={{
                        fontSize: 11,
                        color:
                          asset?.change24h == null ? "#9b9c95" : asset.change24h >= 0 ? "#23845b" : "#c94c4c"
                      }}
                    >
                      {pct(asset?.change24h ?? null)}
                    </div>
                  </div>
                  <WatchButton symbol={symbol} compact />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
