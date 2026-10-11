import crypto from 'node:crypto';

const BASE_URL = 'https://web3.binance.com/build';

type Params = Record<string, string | number | undefined>;

function canonicalQuery(params: Params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

function sign(timestamp: string, method: string, path: string, body: string) {
  const secret = process.env.OC_SECRET_KEY;
  if (!secret) throw new Error('OC_SECRET_KEY is not configured');
  const preHash = timestamp + method.toUpperCase() + path + body;
  return crypto.createHmac('sha256', secret).update(preHash, 'utf8').digest('base64');
}

// Binance Web3 returns errors INSIDE an HTTP-200 body: `{code, msg, success}`
// with `success:false` / `code != 0` (code 0 / success:true = OK). Checking
// only `response.ok` lets those sail through as valid, so an error envelope gets
// read as honest-empty data. Fail loudly on both the HTTP status and the
// envelope so callers see the real message (e.g. "Parameter binanceChainId is
// required"). Responses that carry no envelope (raw data) pass through untouched.
function unwrap<T>(payload: any, status: number, ok: boolean): T {
  if (!ok) {
    const msg = (payload && (payload.msg || payload.message)) || `HTTP ${status}`;
    throw new Error(`Binance Web3 API: ${msg}`);
  }
  if (
    payload &&
    typeof payload === 'object' &&
    (payload.success === false || (typeof payload.code === 'number' && payload.code !== 0))
  ) {
    const msg = payload.msg || payload.message || `code ${payload.code}`;
    throw new Error(`Binance Web3 API: ${msg}`);
  }
  return payload as T;
}

export async function binanceWeb3Get<T = unknown>(path: string, params: Params = {}): Promise<T> {
  const apiKey = process.env.OC_API_KEY;
  if (!apiKey) throw new Error('OC_API_KEY is not configured');

  const query = canonicalQuery(params);
  const requestPath = `/build${path}${query ? `?${query}` : ''}`;
  const timestamp = new Date().toISOString();

  const response = await fetch(`${BASE_URL}${path}${query ? `?${query}` : ''}`, {
    headers: {
      'X-OC-APIKEY': apiKey,
      'X-OC-TIMESTAMP': timestamp,
      'X-OC-SIGN': sign(timestamp, 'GET', requestPath, ''),
      'X-OC-RECV-WINDOW': '5000',
    },
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => null);
  return unwrap<T>(payload, response.status, response.ok);
}

export async function binanceWeb3Post<T = unknown>(path: string, body: unknown = {}): Promise<T> {
  const apiKey = process.env.OC_API_KEY;
  if (!apiKey) throw new Error('OC_API_KEY is not configured');

  const bodyStr = JSON.stringify(body ?? {});
  const requestPath = `/build${path}`;
  const timestamp = new Date().toISOString();

  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-OC-APIKEY': apiKey,
      'X-OC-TIMESTAMP': timestamp,
      'X-OC-SIGN': sign(timestamp, 'POST', requestPath, bodyStr),
      'X-OC-RECV-WINDOW': '5000',
    },
    body: bodyStr,
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => null);
  return unwrap<T>(payload, response.status, response.ok);
}

export type RwaToken = {
  binanceChainId: string;
  tokenContractAddress: string;
  platformId: 'ondo' | 'bstock' | string;
  assetType: number;
  tokenName: string;
  tokenSymbol: string;
  tokenLogoUrl?: string;
  decimals: number;
  underlyingTicker: string;
  underlyingName: string;
  tokenToShareRatio?: string;
  tags?: string[];
  statusInfo?: {
    openState: boolean;
    marketStatus: string;
    reasonCode?: string | null;
    reasonMsg?: string | null;
    nextOpenTime?: number | null;
    nextCloseTime?: number | null;
  };
  tokenPrice?: string;
  referencePrice?: string;
  volume24H?: string;
  marketCap?: string;
  peRatioTTM?: number | string;
};

type RwaResponse<T> = { code: number; msg: string; data: T[]; timestamp: number; success: boolean };

export async function getRwaTokens(params: Params = {}) {
  return binanceWeb3Get<RwaResponse<RwaToken>>('/api/v1/dex/market/rwa/tokens', {
    binanceChainId: '56',
    ...params,
  });
}

/** Candles for a token. `bar` is 1s..1M (e.g. 1h, 1d). */
export async function getRwaCandles(tokenContractAddress: string, bar = '1h') {
  return binanceWeb3Get<RwaResponse<any>>('/api/v1/dex/market/candles', {
    binanceChainId: '56',
    tokenContractAddress,
    bar,
  });
}

/**
 * Parsed, sorted close series for a token. Binance RWA candle rows are arrays
 * `[open, high, low, close, volume, tsMs, trades]` (close at index 3, ts at 5),
 * with an object shape as a fallback. Returns ascending-by-time `{ t, c }`
 * points; empty on failure. One place parses candles so callers don't repeat it.
 */
export async function getRwaCandleCloses(
  tokenContractAddress: string,
  bar = '1h'
): Promise<{ t: number; c: number }[]> {
  const raw = await getRwaCandles(tokenContractAddress, bar);
  return (raw.data ?? [])
    .map((c: any) =>
      Array.isArray(c)
        ? { t: Number(c[5]), c: Number(c[3]) }
        : { t: Number(c.t ?? c.time ?? c.ts), c: Number(c.c ?? c.close) }
    )
    .filter((p: { t: number; c: number }) => Number.isFinite(p.t) && Number.isFinite(p.c) && p.c > 0)
    .sort((a: { t: number }, b: { t: number }) => a.t - b.t);
}

// RWA endpoints return a single object (not a list) for profile/market, so the
// envelope wraps `data` directly rather than in an array.
type RwaObject<T> = { code: number; msg: string; data: T | null; timestamp: number; success: boolean };

/** The real company behind a tokenized stock. Fields are optional — the API
 *  omits what it hasn't got, and we render an em dash rather than invent one. */
export type UnderlyingProfile = {
  underlyingFullName?: string;
  underlyingTicker?: string;
  ceo?: string;
  website?: string;
  industry?: string;
  sector?: string;
  description?: string;
  descriptionZh?: string;
  employees?: number | string;
  headquarters?: string;
  country?: string;
};

/** Fundamentals for the underlying company. All strings as the API sends them. */
export type UnderlyingMarket = {
  high52W?: string;
  low52W?: string;
  marketCap?: string;
  peRatioTTM?: string;
  pbRatio?: string;
  dividendYield?: string;
  latestDividend?: string;
  eps?: string;
  statusInfo?: {
    openState?: boolean;
    marketStatus?: string;
    nextOpenTime?: number | null;
    nextCloseTime?: number | null;
  };
};

// The RWA profile/market endpoints nest the useful fields one level down: the
// profile's company facts live under `companyInfo` (ceo/website/industry/
// description/descriptionZh/…) and the fundamentals under `marketData`
// (high52W/low52W/marketCap/peRatioTTM/pbRatio/dividendYield/…). Our flat types
// read the top level, so without lifting these up extraction yields nothing and
// callers fall through to the keyless fallback even on a successful response.
// Flatten here: nested keys win, top-level fields (underlyingTicker, statusInfo)
// are preserved. Honest-empty is kept — a missing nested object lifts nothing.
function flatten<T>(data: Record<string, any> | null, nestedKey: string): T | null {
  if (!data) return null;
  const { [nestedKey]: nested, ...rest } = data;
  return { ...rest, ...(nested ?? {}) } as T;
}

/** Company profile for the stock behind a token. */
export async function getUnderlyingProfile(
  tokenContractAddress: string,
): Promise<RwaObject<UnderlyingProfile>> {
  const res = await binanceWeb3Get<RwaObject<Record<string, any>>>(
    '/api/v1/dex/market/rwa/underlying-profile',
    { binanceChainId: '56', tokenContractAddress },
  );
  return { ...res, data: flatten<UnderlyingProfile>(res.data, 'companyInfo') };
}

/** Fundamentals (52w range, market cap, P/E, dividend) for the underlying stock. */
export async function getUnderlyingMarket(
  tokenContractAddress: string,
): Promise<RwaObject<UnderlyingMarket>> {
  const res = await binanceWeb3Get<RwaObject<Record<string, any>>>(
    '/api/v1/dex/market/rwa/underlying-market',
    { binanceChainId: '56', tokenContractAddress },
  );
  return { ...res, data: flatten<UnderlyingMarket>(res.data, 'marketData') };
}
