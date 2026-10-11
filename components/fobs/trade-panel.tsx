"use client";

// The buy/sell panel — the real, non-custodial trade path.
//
//   quote → review → your wallet APPROVES + SENDS the swap → verify on-chain
//   (server)         (browser / wallet)                      (server)
//
// You see the live price, fee, price impact and minimum received from a real
// quote before any wallet action. Then your wallet approves the spend leg (once)
// and broadcasts the swap on BNB Chain — that broadcast is the authorization.
// This app never holds your key. Live only: if the Binance Web3 API is not
// configured the routes return 503 — we never fake a fill or an on-chain figure.

import { useMemo, useState } from "react";
import type { Asset } from "@/lib/types";
import type { TradeQuote } from "@/lib/rfq";
import { money, price as fmtPrice, pct, qty } from "@/lib/format";
import { providerLabel } from "@/lib/assets-registry";
import { placeTrade } from "@/lib/trade-client";
import { useFobsAddress, ConnectWalletButton } from "@/components/connect-wallet-button";

/** The quote, shown before the wallet is asked to act. Every figure is live from
 *  the aggregator — an em dash when it didn't return one, never a fabricated number. */
function QuoteBreakdown({ quote, side }: { quote: TradeQuote; side: "buy" | "sell" }) {
  const rows: [string, string][] = [
    [side === "buy" ? "You receive" : "You sell", `${qty(quote.estimatedQuantity)} tokens`],
    ["Price", fmtPrice(quote.price)],
    ["Est. fee", money(quote.feeUsd)],
    ["Price impact", pct(quote.priceImpactPct)],
    ["Min received", quote.minReceived === null ? "—" : `${qty(quote.minReceived)} tokens`]
  ];
  return (
    <div className="quote" style={{ marginTop: 12, borderTop: "1px solid var(--hairline, #e3e2dc)", paddingTop: 10 }}>
      <p className="muted">Live quote via {quote.vendorName}. Review before your wallet signs.</p>
      <dl style={{ marginTop: 6, display: "grid", gridTemplateColumns: "1fr auto", rowGap: 4, columnGap: 12 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: "contents" }}>
            <dt className="muted">{k}</dt>
            <dd className="num tabular-nums" style={{ textAlign: "right", margin: 0 }}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function TradePanel({ symbol, variants }: { symbol: string; variants: Asset[] }) {
  const address = useFobsAddress();

  const [providerId, setProviderId] = useState(variants[0]?.provider ?? "ondo");
  const asset = useMemo(
    () => variants.find((v) => v.provider === providerId) ?? variants[0] ?? null,
    [variants, providerId]
  );

  const [side, setSideRaw] = useState<"buy" | "sell">("buy");
  const [amount, setAmountRaw] = useState("500");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<TradeQuote | null>(null);
  const [done, setDone] = useState<{ status: string; txHash: string | null } | null>(null);

  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0;
  const estQty = valid && asset?.price ? value / asset.price : null;

  // Any change to the order invalidates a prior quote — you must re-review before
  // signing, so the transaction always matches what was shown.
  const setSide = (s: "buy" | "sell") => { setSideRaw(s); setQuote(null); setError(null); };
  const setAmount = (a: string) => { setAmountRaw(a); setQuote(null); setError(null); };
  const changeProvider = (p: string) => { setProviderId(p); setQuote(null); setError(null); };

  // Review — fetch a real quote so cost and price are shown before any wallet action.
  async function review() {
    if (!address || !asset) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/trade/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, symbol, side, amountUsd: value, provider: asset.provider })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not quote the order");
      setQuote(data.quote as TradeQuote);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not quote the order");
    } finally {
      setBusy(false);
    }
  }

  // Approve (if needed) + broadcast the swap, then let the server verify on-chain.
  async function signAndSubmit() {
    if (!address || !asset || !quote) return;
    setBusy(true);
    setError(null);
    try {
      const result = await placeTrade({ address, symbol, side, amountUsd: value, provider: asset.provider });
      setDone({ status: result.status, txHash: result.txHash });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Trade failed");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <aside className="panel trade-panel">
        <h3>{done.status === "confirmed" ? "Your trade is in" : `Order ${done.status}`}</h3>
        <p className="figures">
          {side === "buy" ? "Bought" : "Sold"} {money(value)} of {symbol}
        </p>
        {done.txHash ? (
          <p className="muted">
            <a href={`https://bscscan.com/tx/${done.txHash}`} target="_blank" rel="noreferrer">
              View on BscScan
            </a>
          </p>
        ) : (
          <p className="muted">Order authorized — awaiting on-chain settlement.</p>
        )}
        <button className="secondary" onClick={() => { setDone(null); setQuote(null); }}>
          Trade again
        </button>
      </aside>
    );
  }

  return (
    <aside className="panel trade-panel">
      <h3>Trade {symbol}</h3>
      <p className="muted">
        {asset?.price != null
          ? `${providerLabel(asset.provider)} · ${fmtPrice(asset.price)} per token`
          : "Price not read yet — try again in a moment"}
      </p>

      {variants.length > 1 ? (
        <div className="preset-pills" style={{ marginTop: 8 }}>
          {variants.map((v) => (
            <button
              key={v.provider}
              type="button"
              className={`preset${v.provider === providerId ? " active" : ""}`}
              onClick={() => changeProvider(v.provider)}
            >
              {providerLabel(v.provider)}
            </button>
          ))}
        </div>
      ) : null}

      <div className="segmented" style={{ marginTop: 12 }}>
        <button className={`buy${side === "buy" ? " active" : ""}`} onClick={() => setSide("buy")}>
          Buy
        </button>
        <button className={`sell${side === "sell" ? " active" : ""}`} onClick={() => setSide("sell")}>
          Sell
        </button>
      </div>

      <label className="muted" htmlFor="trade-amount" style={{ marginTop: 12, display: "block" }}>
        {side === "buy" ? "You pay (USD)" : "You sell (USD)"}
      </label>
      <div className="amount-field">
        <span className="amount-prefix">$</span>
        <input
          id="trade-amount"
          className="input amount-input"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={amount.length > 0 && !valid}
        />
      </div>

      <div className="preset-pills">
        {[100, 250, 500, 1000].map((preset) => (
          <button
            key={preset}
            type="button"
            className={`preset${value === preset ? " active" : ""}`}
            onClick={() => setAmount(String(preset))}
          >
            ${preset >= 1000 ? `${preset / 1000}K` : preset}
          </button>
        ))}
      </div>

      {valid && asset?.price && !quote ? (
        <p className="quote muted">
          ≈ {qty(estQty)} {symbol} tokens at {fmtPrice(asset.price)} · before fees
        </p>
      ) : amount.length > 0 && !valid ? (
        <p className="danger" style={{ fontSize: 12 }}>Enter an amount greater than 0.</p>
      ) : null}

      {quote ? <QuoteBreakdown quote={quote} side={side} /> : null}

      {error ? <p className="danger">{error}</p> : null}

      {address ? (
        !quote ? (
          <button
            className={`button ${side}`}
            disabled={!valid || busy || !asset}
            onClick={review}
            style={{ marginTop: 12, width: "100%" }}
          >
            {busy ? "Quoting…" : `Review ${side}`}
          </button>
        ) : (
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <button
              className={`button ${side}`}
              disabled={busy}
              onClick={signAndSubmit}
              style={{ width: "100%" }}
            >
              {busy ? "Waiting for your wallet…" : `Sign & ${side === "buy" ? "buy" : "sell"} ${money(value)}`}
            </button>
            <button className="secondary" disabled={busy} onClick={() => setQuote(null)} style={{ width: "100%" }}>
              Edit order
            </button>
          </div>
        )
      ) : (
        <div style={{ marginTop: 12 }}>
          <ConnectWalletButton className="fobs-button-primary block w-full text-center" />
        </div>
      )}

      <p className="muted" style={{ marginTop: 10 }}>
        Fobs quotes and routes the order; your wallet approves and sends it on BNB Chain. This app never holds your key.
      </p>
    </aside>
  );
}
