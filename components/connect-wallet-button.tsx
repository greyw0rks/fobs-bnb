"use client";

// Connect / identity control for BNB Chain wallets. Browser-injected wallets
// (MetaMask, Binance Wallet, Trust Wallet) plus WalletConnect for mobile when a
// project id is configured. This is Fobs's auth: identity IS the connected
// address. The key never leaves the wallet — the app only ever reads the
// address and asks the wallet to sign.

import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import type { Connector } from "wagmi";
import { shortAddress } from "@/lib/format";

export function useFobsAddress(): string | null {
  const { address, isConnected } = useAccount();
  return isConnected && address ? address : null;
}

function connectorLabel(c: Connector): string {
  if (c.type === "walletConnect") return "WalletConnect — mobile";
  return c.name || "Browser wallet";
}

// Browser wallets announce themselves over EIP-6963 — one named connector each
// (MetaMask, Binance Wallet, Trust…). wagmi ALSO keeps a generic "injected"
// catch-all, which duplicates whichever wallet owns window.ethereum, so the
// picker was showing e.g. both "Browser wallet" and "MetaMask" for one wallet.
// Drop the catch-all once named wallets were discovered (keep it as the only
// fallback when none were), then fold any same-named duplicates.
function dedupeConnectors(connectors: readonly Connector[]): Connector[] {
  const hasNamedInjected = connectors.some((c) => c.type === "injected" && c.id !== "injected");
  const seen = new Set<string>();
  const out: Connector[] = [];
  for (const c of connectors) {
    if (c.type === "injected" && c.id === "injected" && hasNamedInjected) continue;
    const key = `${c.type}:${(c.name || "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

export function ConnectWalletButton({ className }: { className?: string }) {
  const { isConnected, address } = useAccount();
  const { connect, connectors: rawConnectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const connectors = dedupeConnectors(rawConnectors);

  if (isConnected && address) {
    return (
      <button
        type="button"
        onClick={() => disconnect()}
        className={className ?? "fobs-button-secondary"}
        title="Disconnect wallet"
      >
        {shortAddress(address)}
      </button>
    );
  }

  // One connector → connect it directly. Multiple (injected + WalletConnect) →
  // let the user pick, so the mobile path is actually reachable, not just wired.
  if (connectors.length <= 1) {
    const only = connectors[0];
    return (
      <button
        type="button"
        disabled={isPending || !only}
        onClick={() => only && connect({ connector: only })}
        className={className ?? "fobs-button-primary"}
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        disabled={isPending}
        onClick={() => setOpen((v) => !v)}
        className={className ?? "fobs-button-primary"}
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
      {open ? (
        <div
          className="card"
          style={{ position: "absolute", zIndex: 20, marginTop: 6, minWidth: 210, padding: 6, display: "grid", gap: 4 }}
        >
          {connectors.map((c) => (
            <button
              key={c.uid}
              type="button"
              className="secondary"
              style={{ textAlign: "left" }}
              onClick={() => {
                setOpen(false);
                connect({ connector: c });
              }}
            >
              {connectorLabel(c)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
