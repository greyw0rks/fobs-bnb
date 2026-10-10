// Asset service — the one place that turns Binance RWA tokens into `Asset`s and
// merges the social "Fobs buying" count from the DB. Server-only.
//
// Live only: there is NO mock fallback. When the Binance Web3 RWA feed is
// unreachable we return an empty list, never fabricated prices.

import "server-only";
import { getRwaTokens, getRwaCandleCloses, type RwaToken } from "./binance-web3";
import { DEFAULT_PROVIDER, UNDERLYINGS, underlyingName } from "./assets-registry";
import { tryDb } from "./db";
import type { Asset } from "./types";

const SUPPORTED = new Set(UNDERLYINGS.map((u) => u.symbol));

function num(value: string | number | undefined | null): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapToken(token: RwaToken): Asset {
  const price = num(token.tokenPrice) ?? num(token.referencePrice);
  const reference = num(token.referencePrice);
  return {
    symbol: token.underlyingTicker,
    name: token.underlyingName || underlyingName(token.underlyingTicker),
    provider: token.platformId,
    contractAddress: token.tokenContractAddress,
    tokenSymbol: token.tokenSymbol,
    logoUrl: token.tokenLogoUrl,
    price,
    referencePrice: reference,
    // A true 24h delta is computed from candles in getAssets — NOT the token's
    // premium/discount to its underlying reference (that is a different figure and
    // labelling it "24h change" would be a quiet fabrication). Null until read.
    change24h: null,
    volume24h: num(token.volume24H),
    marketCap: num(token.marketCap),
    openState: token.statusInfo?.openState,
    marketStatus: token.statusInfo?.marketStatus,
    traders: 0,
    source: "binance"
  };
}

/**
 * Real 24h price change from the hourly candle series: (latest close − the close
 * at/just-before 24h ago) / that close. Null when the series is too short or
 * unreadable — never inferred from a single spot price.
 */
export async function change24hFor(contractAddress: string): Promise<number | null> {
  try {
    const series = await getRwaCandleCloses(contractAddress, "1h");
    if (series.length < 2) return null;
    const last = series[series.length - 1];
    const cutoff = last.t - 24 * 60 * 60 * 1000;
    const prior = [...series].reverse().find((p) => p.t <= cutoff) ?? series[0];
    if (!prior.c) return null;
    return ((last.c - prior.c) / prior.c) * 100;
  } catch {
    return null;
  }
}

/** Every supported live token across all three providers, or null on failure. */
export async function getLiveTokens(): Promise<Asset[] | null> {
  if (!process.env.OC_API_KEY || !process.env.OC_SECRET_KEY) return null;
  try {
    const response = await getRwaTokens();
    const tokens = (response.data ?? [])
      .filter((t) => t.binanceChainId === "56" && SUPPORTED.has(t.underlyingTicker))
      .map(mapToken);
    return tokens.length > 0 ? tokens : null;
  } catch (error) {
    console.error("[assets] live token fetch failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

/** Distinct Fobs accounts that have traded each symbol ("Fobs buying"). */
async function traderCounts(): Promise<Record<string, number>> {
  const rows = await tryDb((db) =>
    db.trade.groupBy({ by: ["symbol"], _count: { userId: true } })
  );
  if (!rows) return {};
  const out: Record<string, number> = {};
  for (const row of rows) out[row.symbol] = row._count.userId;
  return out;
}

function collapseToDefault(tokens: Asset[]): Asset[] {
  // One row per underlying for the markets list, preferring the default
  // provider; the stock page still exposes every provider variant.
  const bySymbol = new Map<string, Asset>();
  for (const token of tokens) {
    const existing = bySymbol.get(token.symbol);
    if (!existing || token.provider === DEFAULT_PROVIDER) bySymbol.set(token.symbol, token);
  }
  return UNDERLYINGS.map((u) => bySymbol.get(u.symbol)).filter((a): a is Asset => Boolean(a));
}

export async function getAssets(): Promise<{ assets: Asset[]; source: "binance" }> {
  const live = await getLiveTokens();
  const counts = await traderCounts();
  // Live only — no mock fallback. An empty list means the feed was unreachable.
  const base = live ? collapseToDefault(live) : [];
  // Real 24h change from candles, fetched in parallel for the (bounded) markets
  // set. Each is independently null-safe, so a candle blip just yields an em dash.
  const changes = await Promise.all(
    base.map((a) => (a.contractAddress ? change24hFor(a.contractAddress) : Promise.resolve(null)))
  );
  const assets = base.map((a, i) => ({
    ...a,
    change24h: changes[i],
    traders: counts[a.symbol] ?? a.traders
  }));
  return { assets, source: "binance" };
}

/** All provider variants for one underlying (for the stock page selector). */
export async function getAssetVariants(symbol: string): Promise<Asset[]> {
  const live = await getLiveTokens();
  if (live) {
    const variants = live.filter((a) => a.symbol === symbol);
    if (variants.length > 0) return variants;
  }
  return [];
}

export async function getAssetBySymbol(symbol: string): Promise<Asset | null> {
  const { assets } = await getAssets();
  return assets.find((a) => a.symbol === symbol) ?? null;
}
