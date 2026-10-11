"use client";

// The price top-nav — a scrolling marquee of LIVE market prices, ported from
// arcus's TopBar tickers and themed to fobs. It is strictly honest: prices come
// from /api/assets (Binance Web3, live-only). When the venue is unreachable
// (e.g. geo-blocked) we show a quiet status, never a fabricated figure. The
// marquee is pure CSS and pauses on hover / stops under prefers-reduced-motion.

import { useEffect, useState } from "react";
import { price as fmtPrice, pct } from "@/lib/format";

type Row = { symbol: string; price: number | null; change24h: number | null };

export function PriceTicker() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/assets", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        const assets = Array.isArray(d?.assets) ? d.assets : [];
        setRows(
          assets.map((a: Row) => ({ symbol: a.symbol, price: a.price, change24h: a.change24h }))
        );
      })
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, []);

  // Only tokens with a real price belong on the tape; duplicate the set so the
  // CSS translateX(-50%) loop is seamless.
  const live = (rows ?? []).filter((r) => r.price != null);
  const track = live.length ? [...live, ...live] : [];

  return (
    <div className="ticker-bar" role="status" aria-label="Live market prices">
      <span className="ticker-tag">
        <span className="pulse" aria-hidden />
        Live
      </span>
      <div className="ticker-view">
        {live.length ? (
          <div className="ticker-track">
            {track.map((r, i) => {
              const dir = r.change24h == null ? "flat" : r.change24h >= 0 ? "up" : "down";
              return (
                <span className="tk" key={`${r.symbol}-${i}`}>
                  <span className="sym">{r.symbol}</span>
                  <span className="px">{fmtPrice(r.price)}</span>
                  <span className={`chg ${dir}`}>{pct(r.change24h)}</span>
                </span>
              );
            })}
          </div>
        ) : (
          <span className="ticker-empty">
            {rows == null
              ? "Loading live prices…"
              : "Live prices resume when the venue is reachable."}
          </span>
        )}
      </div>
    </div>
  );
}
