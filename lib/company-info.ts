import "server-only";
import type { UnderlyingProfile, UnderlyingMarket } from "@/lib/binance-web3";

// Keyless company profile + fundamentals, used as a fallback when the Binance
// RWA endpoints are geo-blocked or unconfigured. Every field here is REAL and
// public: Yahoo Finance's keyless chart + search JSON and Wikipedia's REST
// summary. Honest-empty: anything a source doesn't return stays undefined and
// the page renders an em dash — we never invent a figure. This pairs with the
// Yahoo RSS news feed, which is reachable from the same places.

const UA = "Mozilla/5.0 (compatible; FobsStocks/1.0)";

async function getJson<T>(url: string, timeoutMs = 9000): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type ChartMeta = {
  longName?: string;
  shortName?: string;
  fullExchangeName?: string;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
};

type SearchQuote = {
  longname?: string;
  shortname?: string;
  sector?: string;
  industry?: string;
  exchDisp?: string;
};

export type CompanyFallback = {
  profile: UnderlyingProfile | null;
  market: UnderlyingMarket | null;
};

async function yahooChart(symbol: string): Promise<ChartMeta | null> {
  const data = await getJson<{ chart?: { result?: Array<{ meta?: ChartMeta }> } }>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`,
  );
  return data?.chart?.result?.[0]?.meta ?? null;
}

async function yahooSearch(symbol: string): Promise<SearchQuote | null> {
  const data = await getJson<{ quotes?: SearchQuote[] }>(
    `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=1&newsCount=0`,
  );
  const q = data?.quotes?.find((x) => x.longname || x.shortname) ?? data?.quotes?.[0];
  return q ?? null;
}

async function wikiSummary(title: string): Promise<string | null> {
  const summary = await getJson<{ extract?: string; type?: string }>(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    7000,
  );
  if (!summary?.extract || summary.type === "disambiguation") return null;
  return summary.extract;
}

async function wikipediaExtract(name: string): Promise<string | null> {
  // Fast path: most company names resolve directly once the legal suffix is
  // stripped ("Meta Platforms, Inc." → "Meta Platforms"), one hop. Only if that
  // misses do we spend a second hop resolving the title via search.
  const clean = name.replace(/,?\s+(Inc|Corp|Corporation|Co|Company|Ltd|PLC|Holdings|Group|N\.V|S\.A)\.?$/i, "").trim();
  const direct = await wikiSummary(clean);
  if (direct) return direct;

  const search = await getJson<{ query?: { search?: Array<{ title: string }> } }>(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&srlimit=1&format=json&origin=*`,
    7000,
  );
  const title = search?.query?.search?.[0]?.title;
  return title ? wikiSummary(title) : null;
}

/**
 * Best-effort public company info for a ticker. Returns honest-null halves if
 * nothing resolved. Only fields we can source for real are populated.
 */
export async function getCompanyFallback(symbol: string): Promise<CompanyFallback> {
  const [meta, quote] = await Promise.all([yahooChart(symbol), yahooSearch(symbol)]);
  const fullName = quote?.longname ?? quote?.shortname ?? meta?.longName ?? meta?.shortName;
  const description = fullName ? await wikipediaExtract(fullName) : null;

  const profile: UnderlyingProfile = {};
  if (fullName) profile.underlyingFullName = fullName;
  if (quote?.industry) profile.industry = quote.industry;
  if (quote?.sector) profile.sector = quote.sector;
  if (description) profile.description = description;

  const market: UnderlyingMarket = {};
  if (meta?.fiftyTwoWeekHigh != null) market.high52W = String(meta.fiftyTwoWeekHigh);
  if (meta?.fiftyTwoWeekLow != null) market.low52W = String(meta.fiftyTwoWeekLow);

  return {
    profile: Object.keys(profile).length ? profile : null,
    market: Object.keys(market).length ? market : null,
  };
}
