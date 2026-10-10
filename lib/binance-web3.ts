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
  if (!response.ok) throw new Error(`Binance Web3 API HTTP ${response.status}`);
  return payload as T;
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
  if (!response.ok) {
    const msg = (payload && (payload.msg || payload.message)) || `HTTP ${response.status}`;
    throw new Error(`Binance Web3 API: ${msg}`);
  }
  return payload as T;
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
