"use client";

// The in-app agent. You ask; it reads real market + social + wallet context and
// PREPARES a trade. It never executes — a prepared trade is handed to your
// wallet, which is the only thing that can authorize it. "Agent decides what to
// prepare, wallet controls authorization."

import { useState } from "react";
import { useSignMessage, useSignTypedData } from "wagmi";
import type { AgentResponse, PreparedTrade } from "@/lib/types";
import type { TradeQuote, TradeSimulation } from "@/lib/rfq";
import { money, price as fmtPrice, pct, qty } from "@/lib/format";
import { isTypedData } from "@/lib/order-signing";
import { useFobsAddress, ConnectWalletButton } from "@/components/connect-wallet-button";

type Sim = { quote: TradeQuote; simulation: TradeSimulation };

type Turn = { role: "user" | "agent"; text: string; steps?: AgentResponse["steps"]; prepared?: PreparedTrade | null };

const SUGGESTIONS = ["analyze NVDA", "buy $500 of NVDA", "what's moving today?", "should I trim TSLA?"];

export function AgentPanel() {
  const address = useFobsAddress();
  const { signMessageAsync } = useSignMessage();
  const { signTypedDataAsync } = useSignTypedData();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(prompt: string) {
    if (!prompt.trim() || busy) return;
    setTurns((t) => [...t, { role: "user", text: prompt }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, address })
      });
      const data: AgentResponse = await res.json();
      setTurns((t) => [...t, { role: "agent", text: data.message, steps: data.steps, prepared: data.preparedTrade }]);
    } catch {
      setTurns((t) => [...t, { role: "agent", text: "Something went wrong reading the market. Try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="card soft">
        <h2 className="trade-title">Fobs agent</h2>
        <p className="muted">
          Contextual analysis over live market, social and wallet data. It prepares trades; your
          wallet signs them. It can never move your funds on its own.
        </p>
        <div className="preset-pills" style={{ marginTop: 10 }}>
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="preset" onClick={() => ask(s)} disabled={busy}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {turns.map((turn, i) =>
        turn.role === "user" ? (
          <div key={i} className="row" style={{ justifyContent: "flex-end" }}>
            <span className="chip">{turn.text}</span>
          </div>
        ) : (
          <div key={i} className="card">
            <p style={{ whiteSpace: "pre-wrap" }}>{turn.text}</p>

            {turn.steps && turn.steps.length > 0 ? (
              <details className="disclosure" style={{ marginTop: 8 }}>
                <summary className="muted">How I got here ({turn.steps.length} tools)</summary>
                <ul>
                  {turn.steps.map((step, j) => (
                    <li key={j} className="muted">
                      <span className="chip">{step.tool}</span> {step.summary}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {turn.prepared ? <PreparedTradeCard prepared={turn.prepared} address={address} signMessageAsync={signMessageAsync} signTypedDataAsync={signTypedDataAsync} /> : null}
          </div>
        )
      )}

      <div className="card">
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            placeholder='Ask the agent — e.g. "buy $500 of NVDA"'
            value={input}
            disabled={busy}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(input)}
          />
          <button className="fobs-button-primary" onClick={() => ask(input)} disabled={busy || !input.trim()}>
            {busy ? "Thinking…" : "Ask"}
          </button>
        </div>
        {!address ? <p className="muted" style={{ marginTop: 8 }}>Connect a wallet to prepare and sign trades.</p> : null}
      </div>
    </div>
  );
}

function PreparedTradeCard({
  prepared,
  address,
  signMessageAsync,
  signTypedDataAsync
}: {
  prepared: PreparedTrade;
  address: string | null;
  signMessageAsync: (args: { message: string }) => Promise<string>;
  signTypedDataAsync: (args: any) => Promise<string>;
}) {
  const [busy, setBusy] = useState(false);
  const [sim, setSim] = useState<Sim | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Step 2 — quote + simulate the prepared order before the wallet signs it.
  async function review() {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/trade/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, symbol: prepared.symbol, side: prepared.side, amountUsd: prepared.amountUsd, provider: prepared.provider })
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

  // Steps 3–4 — the wallet signs the simulated order; the server submits it.
  async function confirm() {
    if (!address || !sim) return;
    if (sim.simulation.willSucceed === false) {
      setError(`Simulation failed${sim.simulation.revertReason ? `: ${sim.simulation.revertReason}` : ""} — not sending.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const quote = sim.quote;

      // Wallet signs the live RFQ order — the authorization boundary. Sign the
      // real orderToSign (EIP-712 typed data or raw string). If the aggregator
      // returns neither we refuse: a summary signature can't authorize a real
      // fill, so sending one would be a fake trade.
      const orderToSign = quote.orderToSign ?? null;
      let signature: string;
      if (isTypedData(orderToSign)) {
        signature = await signTypedDataAsync({
          domain: orderToSign.domain,
          types: orderToSign.types,
          primaryType: orderToSign.primaryType,
          message: orderToSign.message
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
          symbol: prepared.symbol,
          side: prepared.side,
          amountUsd: prepared.amountUsd,
          provider: prepared.provider,
          userSignature: signature,
          quoteId: quote.quoteId ?? null,
          requestId: quote.requestId ?? null,
          vendor: quote.vendor ?? prepared.provider
        })
      });
      const result = await submitRes.json();
      if (!submitRes.ok) throw new Error(result.error ?? "Trade failed");
      setDone(result.txHash ?? "recorded");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Trade failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`card confirmed ${prepared.side}`} style={{ marginTop: 12 }}>
      <div className="row">
        <h3 className="trade-title">
          Prepared: {prepared.side} {money(prepared.amountUsd)} {prepared.symbol}
        </h3>
        <span className="chip">Needs your signature</span>
      </div>
      <p className="figures">
        ≈ {qty(prepared.estimatedQuantity)} tokens at {fmtPrice(prepared.price)}
      </p>
      {sim ? (
        <div className="quote" style={{ marginTop: 8 }}>
          {sim.simulation.willSucceed === false ? (
            <p className="danger">Simulation failed{sim.simulation.revertReason ? `: ${sim.simulation.revertReason}` : " — this order would revert"}. It won&apos;t be sent.</p>
          ) : sim.simulation.willSucceed === null ? (
            <p className="muted">Couldn&apos;t pre-simulate — figures are from the quote.</p>
          ) : (
            <p className="muted">Simulated on-chain — expected to succeed.</p>
          )}
          <p className="muted" style={{ marginTop: 4 }}>
            Fee {money(sim.simulation.feeUsd)} · impact {pct(sim.simulation.priceImpactPct)} · min {sim.simulation.minReceived === null ? "—" : `${qty(sim.simulation.minReceived)} tokens`} · gas {money(sim.simulation.gasEstimateUsd)}
          </p>
        </div>
      ) : null}
      {error ? <p className="danger">{error}</p> : null}
      {done ? (
        done !== "recorded" ? (
          <p className="muted">
            Authorized and broadcast ·{" "}
            <a href={`https://bscscan.com/tx/${done}`} target="_blank" rel="noreferrer">
              View on BscScan
            </a>
          </p>
        ) : (
          <p className="muted">Authorized — awaiting on-chain settlement.</p>
        )
      ) : !address ? (
        <ConnectWalletButton />
      ) : !sim ? (
        <button className={`button ${prepared.side}`} onClick={review} disabled={busy}>
          {busy ? "Simulating…" : "Simulate order"}
        </button>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          <button
            className={`button ${prepared.side}`}
            onClick={confirm}
            disabled={busy || sim.simulation.willSucceed === false}
          >
            {busy ? "Waiting for your wallet…" : "Review & sign in wallet"}
          </button>
          <button className="secondary" onClick={() => setSim(null)} disabled={busy}>
            Re-simulate
          </button>
        </div>
      )}
    </div>
  );
}
