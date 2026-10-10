// RFQ trade flow for tokenized stocks (Ondo / bStock) on BNB Chain.
//
// Tokenized-stock tokens do NOT trade through a plain AMM swap — they use the
// Binance aggregator's RFQ (request-for-quote) path, which maps 1:1 onto Fobs's
// non-custodial model:
//
//   quote  →  user's wallet SIGNS the order  →  submit  →  poll status
//   (server) (browser / agentic wallet)         (server)   (server)
//
// The server prepares and submits; it never holds the key. The signature is the
// authorization boundary — the agent can prepare a quote, but only the wallet
// can produce the signature that lets `submit` execute.
//
// NOTE ON SCHEMA: the exact request/response field names for these aggregator
// endpoints could not be verified against a live key in the research env
// (geo-blocked). The shapes below follow the documented flow and the SDK's
// naming; `normalize*` funnels every response through one place, so if a field
// differs it is a one-line fix here rather than a hunt across callers.

import { binanceWeb3Get, binanceWeb3Post } from "./binance-web3";
import type { TradeSide } from "./types";

const AGG = "/api/v1/dex/aggregator";
const PRE = "/api/v1/dex/pre-transaction";

export type QuoteInput = {
  symbol: string;
  side: TradeSide;
  amountUsd: number;
  tokenContractAddress: string;
  walletAddress: string;
  provider: string;
};

export type TradeQuote = {
  quoteId: string;
  requestId: string;
  vendor: string;
  price: number | null;
  estimatedQuantity: number | null;
  amountUsd: number;
  side: TradeSide;
  symbol: string;
  // Cost transparency — parsed from the quote when the aggregator returns it,
  // null (an em dash in the UI) when it doesn't. Never invented.
  feeUsd: number | null;
  priceImpactPct: number | null;
  minReceived: number | null;
  // The payload the wallet must sign to authorize the fill. Opaque here; the
  // client hands it to the wallet and returns the signature.
  orderToSign: unknown;
  expiresAt: number | null; // epoch ms; quotes are ~30s TTL
};

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Step 1 — ask the aggregator for an RFQ quote. Server-side (signed). */
export async function quoteTrade(input: QuoteInput): Promise<TradeQuote> {
  const raw = await binanceWeb3Post<any>(`${AGG}/quote`, {
    binanceChainId: "56",
    fromTokenAddress: input.side === "buy" ? "USDT" : input.tokenContractAddress,
    toTokenAddress: input.side === "buy" ? input.tokenContractAddress : "USDT",
    amount: input.amountUsd,
    userWalletAddress: input.walletAddress,
    platformId: input.provider,
    rwa: true
  });
  const data = raw?.data ?? raw ?? {};
  return {
    quoteId: data.quoteId ?? data.quote_id ?? "",
    requestId: data.requestId ?? data.request_id ?? "",
    vendor: data.vendor ?? input.provider,
    price: num(data.price ?? data.tokenPrice),
    estimatedQuantity: num(data.toTokenAmount ?? data.estimatedQuantity ?? data.quantity),
    amountUsd: input.amountUsd,
    side: input.side,
    symbol: input.symbol,
    feeUsd: num(data.feeUsd ?? data.fee ?? data.totalFee ?? data.feeAmount),
    priceImpactPct: num(data.priceImpact ?? data.priceImpactPct ?? data.slippage),
    minReceived: num(data.minReceived ?? data.minimumReceived ?? data.minAmountOut ?? data.minToTokenAmount),
    orderToSign: data.order ?? data.orderToSign ?? data.typedData ?? null,
    expiresAt: num(data.expiresAt ?? data.expireAt) ?? Date.now() + 30_000
  };
}

// Step 2 — SIMULATE the order before the wallet signs it. This is the checklist's
// pre-flight: it catches a revert (insufficient liquidity, market closed, bad
// route) and surfaces the concrete cost (fee, price impact, minimum received)
// so the signer sees exactly what they're authorizing. HONESTY RULE: `willSucceed`
// is only `true`/`false` when the aggregator says so — `null` means "could not
// simulate", never a fabricated OK. A `false` blocks signing; a `null` surfaces a
// warning but doesn't fake a pass.
export type TradeSimulation = {
  willSucceed: boolean | null;
  estimatedQuantity: number | null;
  price: number | null;
  feeUsd: number | null;
  priceImpactPct: number | null;
  minReceived: number | null;
  gasEstimateUsd: number | null;
  revertReason: string | null;
};

function simOutcome(data: any): boolean | null {
  const explicit = data.success ?? data.willSucceed ?? data.simulated ?? data.ok;
  if (typeof explicit === "boolean") return explicit;
  const status = String(data.status ?? data.result ?? "").toUpperCase();
  if (["SUCCESS", "OK", "SIMULATED", "PASS", "PASSED"].includes(status)) return true;
  if (["FAILED", "REVERT", "REVERTED", "REJECTED", "ERROR"].includes(status)) return false;
  return null;
}

/** Step 2 — pre-transaction simulate. Server-side (signed). */
export async function simulateTrade(quote: TradeQuote): Promise<TradeSimulation> {
  const raw = await binanceWeb3Post<any>(`${PRE}/simulate`, {
    binanceChainId: "56",
    quoteId: quote.quoteId,
    requestId: quote.requestId,
    vendor: quote.vendor,
    evmTx: quote.orderToSign ?? undefined,
    rwa: true
  });
  const data = raw?.data ?? raw ?? {};
  return {
    willSucceed: simOutcome(data),
    estimatedQuantity: num(data.toTokenAmount ?? data.estimatedQuantity ?? data.quantity) ?? quote.estimatedQuantity,
    price: num(data.price ?? data.fillPrice) ?? quote.price,
    feeUsd: num(data.feeUsd ?? data.fee ?? data.totalFee ?? data.feeAmount) ?? quote.feeUsd,
    priceImpactPct: num(data.priceImpact ?? data.priceImpactPct ?? data.slippage) ?? quote.priceImpactPct,
    minReceived: num(data.minReceived ?? data.minimumReceived ?? data.minAmountOut) ?? quote.minReceived,
    gasEstimateUsd: num(data.gasFeeUsd ?? data.estimatedGasUsd ?? data.gasUsd ?? data.gasFee),
    revertReason: data.revertReason ?? data.failReason ?? data.error ?? data.msg ?? null
  };
}

export type SubmitInput = {
  requestId: string;
  quoteId: string;
  vendor: string;
  userSignature: string;
};

export type SubmitResult = { orderId: string };

/** Step 3 — submit the wallet-signed order for execution. Server-side (signed). */
export async function submitTrade(input: SubmitInput): Promise<SubmitResult> {
  const raw = await binanceWeb3Post<any>(`${AGG}/order/submit`, {
    requestId: input.requestId,
    quoteId: input.quoteId,
    vendor: input.vendor,
    userSignature: input.userSignature
  });
  const data = raw?.data ?? raw ?? {};
  return { orderId: data.orderId ?? data.order_id ?? "" };
}

export type OrderStatus = {
  orderId: string;
  status: "quoted" | "submitted" | "confirmed" | "failed";
  txHash: string | null;
  price: number | null;
  quantity: number | null;
};

function mapStatus(raw: string | undefined): OrderStatus["status"] {
  const s = (raw ?? "").toUpperCase();
  if (["SUCCESS", "FILLED", "CONFIRMED", "COMPLETED"].includes(s)) return "confirmed";
  if (["FAILED", "REJECTED", "EXPIRED", "CANCELLED"].includes(s)) return "failed";
  if (["SUBMITTED", "PENDING", "PROCESSING"].includes(s)) return "submitted";
  return "submitted";
}

/** Step 4 — poll the order until it settles. Server-side (signed). */
export async function getOrderStatus(orderId: string): Promise<OrderStatus> {
  const raw = await binanceWeb3Get<any>(`${AGG}/order/${encodeURIComponent(orderId)}`);
  const data = raw?.data ?? raw ?? {};
  return {
    orderId,
    status: mapStatus(data.status ?? data.orderStatus),
    txHash: data.txHash ?? data.txnHash ?? data.transactionHash ?? null,
    price: num(data.price ?? data.fillPrice),
    quantity: num(data.quantity ?? data.filledQuantity)
  };
}
