// The canonical tokenized-stock universe Fobs supports on BNB Smart Chain.
//
// Decision (locked with the user): support all three live issuer families,
// provider-tagged. Exact contract addresses are resolved at runtime from the
// Binance RWA tokens API (matched on underlyingTicker + platformId) rather than
// hard-coded — the research environment could not verify them on-chain, and a
// wrong address is the one thing a trading app must never guess. Everything
// else (symbol, name, provider, on-chain token symbol) is stable metadata.

import type { AssetProvider } from "./types";

export type ProviderMeta = {
  id: AssetProvider;
  label: string;
  suffix: string; // on-chain token symbol suffix, e.g. NVDA + "on" = NVDAon
  blurb: string;
};

export const PROVIDERS: Record<string, ProviderMeta> = {
  ondo: {
    id: "ondo",
    label: "Ondo",
    suffix: "on",
    blurb: "Ondo Global Markets — 1:1 real shares, 24/5 mint/redeem, DeFi-usable."
  },
  bstock: {
    id: "bstock",
    label: "bStocks",
    suffix: "B",
    blurb: "Binance bStocks (BTech Holdings) — BEP-677, Proof of Collateral, self-custody."
  },
  xstocks: {
    id: "xstocks",
    label: "xStocks",
    suffix: "x",
    blurb: "xStocks / Backed Finance — 50+ equities, deterministic cross-chain deploy."
  }
};

export function providerLabel(id: AssetProvider): string {
  return PROVIDERS[id]?.label ?? String(id);
}

export function tokenSymbolFor(symbol: string, provider: AssetProvider): string {
  const suffix = PROVIDERS[provider]?.suffix ?? "";
  return `${symbol}${suffix}`;
}

export type UnderlyingMeta = { symbol: string; name: string };

// The 7 P0 underlyings (spec: 5–8 real assets).
export const UNDERLYINGS: UnderlyingMeta[] = [
  { symbol: "NVDA", name: "NVIDIA Corporation" },
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "TSLA", name: "Tesla, Inc." },
  { symbol: "MSFT", name: "Microsoft Corporation" },
  { symbol: "GOOGL", name: "Alphabet Inc." },
  { symbol: "AMZN", name: "Amazon.com, Inc." },
  { symbol: "META", name: "Meta Platforms, Inc." }
];

export function underlyingName(symbol: string): string {
  return UNDERLYINGS.find((u) => u.symbol === symbol)?.name ?? symbol;
}

// Default provider for a given underlying when the UI shows a single card per
// symbol (markets/feed). Ondo is the most DeFi-liquid family, so it leads;
// per-provider variants remain reachable on the stock page.
export const DEFAULT_PROVIDER: AssetProvider = "ondo";
