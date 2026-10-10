"use client";

// Wallet gate for the signed-in app surfaces. Fobs is wallet-first: identity is
// your connected BNB address, so the app pages (feed, markets, portfolio, agent,
// people) are only shown once a wallet is connected. The FobsShell chrome
// (sidebar + top bar) still renders around this, so the connect control is
// always reachable; this only gates the main content.
//
// A mounted check avoids a hydration flash: wagmi resolves connection state on
// the client, so on the very first paint we render a neutral placeholder rather
// than briefly showing the connect prompt to an already-connected wallet.

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useFobsAddress, ConnectWalletButton } from "@/components/connect-wallet-button";

export function AppGate({ children }: { children: React.ReactNode }) {
  const address = useFobsAddress();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="min-h-[40vh]" aria-hidden />;
  }

  if (address) return <>{children}</>;

  return (
    <div className="mx-auto max-w-[480px] py-16">
      <div className="fobs-surface p-8 text-center">
        <h1 className="trade-title" style={{ fontSize: 22 }}>Connect your wallet</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          fobs is wallet-first — your connected BNB address is your identity. Connect
          an injected wallet (MetaMask, Binance Wallet, Trust) to enter the app.
          Your key never leaves your wallet.
        </p>
        <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          <ConnectWalletButton className="fobs-button-primary px-6 py-3" />
          <Link href={"/" as Route} className="fobs-button-secondary px-6 py-3">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
