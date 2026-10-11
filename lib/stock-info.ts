import "server-only";
import {
  getUnderlyingProfile,
  getUnderlyingMarket,
  type UnderlyingProfile,
  type UnderlyingMarket,
} from "@/lib/binance-web3";
import { getCompanyFallback } from "@/lib/company-info";

export type StockInfo = {
  profile: UnderlyingProfile | null;
  market: UnderlyingMarket | null;
};

// Merge b into a per field, preferring a (Binance) and filling gaps from b
// (keyless fallback). Returns null only if both are empty.
function merge<T extends Record<string, unknown>>(a: T | null, b: T | null): T | null {
  if (!a) return b;
  if (!b) return a;
  const out = { ...b, ...a } as T;
  for (const k of Object.keys(out) as (keyof T)[]) {
    if (out[k] == null || out[k] === "") {
      const fb = b[k];
      if (fb != null && fb !== "") out[k] = fb;
    }
  }
  return out;
}

/**
 * Company profile + fundamentals for the stock behind a token. Binance's RWA
 * API is the primary source (richest: CEO, website, market cap, P/E). When it's
 * unconfigured or geo-blocked, a keyless public fallback (Yahoo Finance + Wiki-
 * pedia) fills what it can — company name, description, sector/industry, 52-week
 * range. Honest-empty throughout: any field no source returns stays null and
 * the page renders an em dash. We never fabricate a figure.
 */
export async function getStockInfo(
  tokenContractAddress: string | null | undefined,
  symbol?: string | null,
): Promise<StockInfo> {
  const [primary, fallback] = await Promise.all([
    getPrimary(tokenContractAddress),
    symbol ? getCompanyFallback(symbol) : Promise.resolve({ profile: null, market: null }),
  ]);

  return {
    profile: merge(primary.profile, fallback.profile),
    market: merge(primary.market, fallback.market),
  };
}

async function getPrimary(tokenContractAddress: string | null | undefined): Promise<StockInfo> {
  if (!tokenContractAddress) return { profile: null, market: null };
  const [profileRes, marketRes] = await Promise.allSettled([
    getUnderlyingProfile(tokenContractAddress),
    getUnderlyingMarket(tokenContractAddress),
  ]);
  return {
    profile: profileRes.status === "fulfilled" ? profileRes.value.data ?? null : null,
    market: marketRes.status === "fulfilled" ? marketRes.value.data ?? null : null,
  };
}
