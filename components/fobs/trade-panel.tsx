"use client";

// The buy/sell panel — the real, non-custodial trade path.
//
//   quote → SIMULATE → your wallet SIGNS → submit → poll
//   (server)          (browser)            (server)
//
// The order is simulated before your wallet is asked to sign, so you see the fee,
// price impact and minimum received — and any revert — up front. The server
// prepares and submits; your wallet produces the signature that authorizes the
// fill. This app never holds your key. Live only: if the Binance Web3 API is not
// configured the routes return 503 — we never fake a fill or an on-chain figure.

import { useMemo, useState } from "react";
import { useSignMessage, useSignTypedData } from "wagmi";
import type { Asset } from "@/lib/types";
import type { TradeQuote, TradeSimulation } from "@/lib/rfq";
import { money, price as fmtPrice, pct, qty } from "@/lib/format";
import { providerLabel } from "@/lib/assets-registry";
import { isTypedData } from "@/lib/order-signing";
import { useFobsAddress, ConnectWalletButton } from "@/components/connect-wallet-button";

type Sim = { quote: TradeQuote; simulation: TradeSimulation };

/** The simulate result, shown before the wallet is asked to sign. Every figure
 *  is live from the aggregator's pre-transaction simulate — an em dash when the
 *  aggregator didn't return it, never a fabricated number. */
function SimulationBreakdown({ sim, side }: { sim: Sim; side: "buy" | "sell" }) {
  const s = sim.simulation;
  const rows: [string, string][] = [
    [side === "buy" ? "You receive" : "You sell", `${qty(s.estimatedQuantity)} tokens`],
    ["Price", fmtPrice(s.price)],
    ["Est. fee", money(s.feeUsd)],
    ["Price impact", pct(s.priceImpactPct)],
    ["Min received", s.minReceived === null ? "—" : `${qty(s.minReceived)} tokens`],
    ["Network fee", money(s.gasEstimateUsd)]
  ];
  return (
    <div className="quote" style={{ marginTop: 12, borderTop: "1px solid var(--hairline, #e3e2dc)", paddingTop: 10 }}>
      {s.willSucceed === false ? (
        <p className="danger">Simulation failed{s.revertReason ? `: ${s.revertReason}` : " — this order would revert"}. It won't be sent.</p>
      ) : s.willSucceed === null ? (
        <p className="muted">Couldn&apos;t pre-simulate this order — figures below are from the quote. Review carefully before signing.</p>
      ) : (
        <p className="muted">Simulated on-chain — this order is expected to succeed.</p>
      )}
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
  const { signMessageAsync } = useSignMessage();
  const { signTypedDataAsync } = useSignTypedData();

  const [providerId, setProviderId] = useState(variants[0]?.provider ?? "ondo");
  const asset = useMemo(
    () => variants.find((v) => v.provider === providerId) ?? variants[0] ?? null,
    [variants, providerId]
  );

  const [side, setSideRaw] = useState<"buy" | "sell">("buy");
  const [amount, setAmountRaw] = useState("500");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sim, setSim] = useState<Sim | null>(null);
  const [done, setDone] = useState<{ status: string; txHash: string | null } | null>(null);

  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0;
  const estQty = valid && asset?.price ? value / asset.price : null;

  // Any change to the order invalidates a prior simulation — you must re-simulate
  // before signing, so the signature always matches what was simulated.
  const setSide = (s: "buy" | "sell") => { setSideRaw(s); setSim(null); setError(null); };
  const setAmount = (a: string) => { setAmountRaw(a); setSim(null); setError(null); };
  const changeProvider = (p: string) => { setProviderId(p); setSim(null); setError(null); };

  // Step 2 — quote + pre-transaction simulate. Shows cost and revert risk before
  // the wallet is ever asked to sign.
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
      if (!res.ok) throw new Error(data.error ?? "Could not simulate the order");
      setSim(data as Sim);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Simulation failed");
    } finally {
      setBusy(false);
    }
  }

  // Steps 3–4 — the wallet signs the simulated order, then the server submits it.
  async function signAndSubmit() {
    if (!address || !asset || !sim) return;
    if (sim.simulation.willSucceed === false) {
      setError(`Simulation failed${sim.simulation.revertReason ? `: ${sim.simulation.revertReason}` : ""} — not sending.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const quote = sim.quote;

      // The wallet signs the order — the authorization boundary. The live RFQ
      // returns a real order to sign: EIP-712 typed data (signed as typed data)
      // or a raw string. If neither is present we refuse to sign: a summary
      // string can't authorize a real fill, so sending one would be a fake trade.
      const orderToSign = quote.orderToSign ?? null;
      let signature: string;
      if (isTypedData(orderToSign)) {
        signature = await signTypedDataAsync({
          domain: orderToSign.domain,
          types: orderToSign.types as any,
          primaryType: orderToSign.primaryType as any,
          message: orderToSign.message as any
        });
      } else if (typeof orderToSign === "string" && orderToSign.length > 0) {
        signature = await signMessageAsync({ message: orderToSign });
      } else {
        throw new Error(
          "This order couldn't be prepared for signing — the aggregator returned no signable order. Not sending, since a summary signature can't authorize a real fill."
        );
      }

      const submitRes = await fetch("/api/trade/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          address,
          symbol,
          side,
          amountUsd: value,
          provider: asset.provider,
          userSignature: signature,
          quoteId: quote.quoteId ?? null,
          requestId: quote.requestId ?? null,
          vendor: quote.vendor ?? asset.provider
        })
      });
      const result = await submitRes.json();
      if (!submitRes.ok) throw new Error(result.error ?? "Trade failed");
      if (!result.status) throw new Error("Order submitted but the server returned no status.");
      setDone({ status: result.status, txHash: result.txHash ?? null });
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
        <button className="secondary" onClick={() => setDone(null)}>
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
        Amount (USD)
      </label>
      <input
        id="trade-amount"
        className="input"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <div className="preset-pills">
        {[100, 500, 1000].map((preset) => (
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

      {valid && asset?.price && !sim ? (
        <p className="quote muted">≈ {qty(estQty)} tokens before fees</p>
      ) : null}

      {sim ? <SimulationBreakdown sim={sim} side={side} /> : null}

      {error ? <p className="danger">{error}</p> : null}

      {address ? (
        !sim ? (
          <button
            className={`button ${side}`}
            disabled={!valid || busy || !asset}
            onClick={review}
            style={{ marginTop: 12, width: "100%" }}
          >
            {busy ? "Simulating…" : `Review ${side}`}
          </button>
        ) : (
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <button
              className={`button ${side}`}
              disabled={busy || sim.simulation.willSucceed === false}
              onClick={signAndSubmit}
              style={{ width: "100%" }}
            >
              {busy ? "Waiting for your wallet…" : `Sign & ${side === "buy" ? "buy" : "sell"} ${money(value)}`}
            </button>
            <button className="secondary" disabled={busy} onClick={() => setSim(null)} style={{ width: "100%" }}>
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
        Fobs simulates and routes the order; your wallet signs it on BNB Chain. This app never holds your key.
      </p>
    </aside>
  );
}
