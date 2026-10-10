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

export function ConnectWalletButton({ className }: { className?: string }) {
  const { isConnected, address } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);

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
