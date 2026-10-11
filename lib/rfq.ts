// Trade flow for tokenized stocks (Ondo / bStock / xStocks) on BNB Chain.
//
// web3.binance.com/build is an OKX-style DEX aggregator. The real flow, verified
// against the live API on 2026-10-10, is a standard on-chain swap — NOT a typed-
// data RFQ signature:
//
//   quote (GET)  →  swap (GET → raw EVM tx)  →  wallet APPROVES + SENDS the tx  →  on-chain receipt
//   (server)        (server)                    (browser / wallet)                 (server verifies)
//
// The authorization boundary is the wallet broadcasting the transaction (after an
// ERC-20 approve to the router). The server only prepares the tx and later reads
// the receipt; it never holds the key and never moves funds.
//
// SCHEMA: reconciled against live responses. A quote returns `data: [ {...} ]`
// (an array of competing vendor quotes); the swap returns `data: { tx, routerResult }`.
// Prices live on each token as `tokenUnitPrice`; amounts are base units (18 dp).

import { formatUnits, parseUnits } from "viem";
import { binanceWeb3Get } from "./binance-web3";
import type { TradeSide } from "./types";

const AGG = "/api/v1/dex/aggregator";
// BSC USDT — the stable leg every tokenized-stock buy/sell routes through.
export const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955";
export const DEFAULT_SLIPPAGE_PCT = "0.5";
const DECIMALS = 18; // every supported BSC tokenized stock + USDT is 18 dp

export type QuoteInput = {
  symbol: string;
  side: TradeSide;
  amountUsd: number;
  tokenContractAddress: string; // the stock token
  walletAddress: string;
  provider: string; // platformId
  price?: number | null; // live stock price — needed to size a sell in tokens
};

export type TradeQuote = {
  quoteId: string;
  vendorName: string;
  side: TradeSide;
  symbol: string;
  amountUsd: number;
  // The leg the wallet spends and the leg it receives, plus the base-unit amount
  // handed to the aggregator. The client needs these to approve + build the tx.
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string; // base units (18 dp) of the fromToken
  // Display figures, live from the quote — null (an em dash) when absent, never faked.
  price: number | null; // stock price per token
  estimatedQuantity: number | null; // stock tokens bought (buy) or sold (sell)
  feeUsd: number | null;
  priceImpactPct: number | null;
  minReceived: number | null; // buy only: estimatedQuantity × (1 − slippage)
  approveTarget: string | null; // ERC-20 spender the wallet must approve
  expiresAt: number | null; // epoch ms; quotes are short-lived (~30s)
};

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** USDT (buy) or the stock token (sell) and the base-unit amount to send. A sell
 *  is sized from the live price; without one we can't convert USD→tokens. */
function legs(input: QuoteInput): { fromTokenAddress: string; toTokenAddress: string; amount: string } {
  if (input.side === "buy") {
    return {
      fromTokenAddress: USDT_BSC,
      toTokenAddress: input.tokenContractAddress,
      amount: parseUnits(String(input.amountUsd), DECIMALS).toString()
    };
  }
  if (!input.price || input.price <= 0) {
    throw new Error("Can't size a sell without a live price for the token.");
  }
  const tokens = input.amountUsd / input.price;
  return {
    fromTokenAddress: input.tokenContractAddress,
    toTokenAddress: USDT_BSC,
    amount: parseUnits(tokens.toFixed(DECIMALS), DECIMALS).toString()
  };
}

function aggParams(input: QuoteInput, l: ReturnType<typeof legs>) {
  return {
    binanceChainId: "56",
    fromTokenAddress: l.fromTokenAddress,
    toTokenAddress: l.toTokenAddress,
    amount: l.amount,
    userWalletAddress: input.walletAddress
  };
}

/** Pick the token entry (fromToken/toToken) matching an address, for its price. */
function tokenInfo(q: any, address: string) {
  const a = address.toLowerCase();
  for (const t of [q?.fromToken, q?.toToken]) {
    if (t?.tokenContractAddress && String(t.tokenContractAddress).toLowerCase() === a) return t;
  }
  return null;
}

/** Step 1 — ask the aggregator for the best quote. `data` is an array of vendor
 *  quotes; we take the one flagged `isBest` (falling back to the first). */
export async function quoteTrade(input: QuoteInput): Promise<TradeQuote> {
  const l = legs(input);
  const raw = await binanceWeb3Get<any>(`${AGG}/quote`, aggParams(input, l));
  const list: any[] = Array.isArray(raw?.data) ? raw.data : [];
  const q = list.find((x) => x?.isBest) ?? list[0];
  if (!q) throw new Error(raw?.msg || "No quote available for this order.");

  const stock = tokenInfo(q, input.tokenContractAddress);
  if (stock?.isHoneyPot) throw new Error("Refusing to quote — the token flags as a honeypot.");

  // Stock-token quantity: the toToken amount on a buy, the fromToken amount on a sell.
  const stockAmountBase = input.side === "buy" ? q.toTokenAmount : q.fromTokenAmount;
  const estimatedQuantity = stockAmountBase != null ? num(formatUnits(BigInt(stockAmountBase), DECIMALS)) : null;
  const slip = Number(DEFAULT_SLIPPAGE_PCT) / 100;

  return {
    quoteId: q.quoteId ?? "",
    vendorName: q.vendorName ?? input.provider,
    side: input.side,
    symbol: input.symbol,
    amountUsd: input.amountUsd,
    fromTokenAddress: l.fromTokenAddress,
    toTokenAddress: l.toTokenAddress,
    amount: l.amount,
    price: num(stock?.tokenUnitPrice),
    estimatedQuantity,
    feeUsd: num(q.tradeFee),
    priceImpactPct: num(q.priceImpactPercent),
    minReceived: input.side === "buy" && estimatedQuantity != null ? estimatedQuantity * (1 - slip) : null,
    approveTarget: q.approveTarget ?? null,
    expiresAt: Date.now() + 30_000
  };
}

export type SwapTx = { to: string; data: string; value: string };
export type PreparedSwap = {
  quoteId: string;
  tx: SwapTx;
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string; // base units the wallet must have approved
  approveTarget: string; // ERC-20 spender (equals tx.to)
  price: number | null;
  estimatedQuantity: number | null;
};

/** Step 2 — fetch a FRESH quote and the raw swap transaction the wallet will send.
 *  Called at sign time (not review time) because quotes are short-lived. */
export async function getSwapTx(input: QuoteInput): Promise<PreparedSwap> {
  const quote = await quoteTrade(input);
  if (!quote.quoteId) throw new Error("Quote expired before the swap could be built.");

  const l = legs(input);
  const raw = await binanceWeb3Get<any>(`${AGG}/swap`, {
    ...aggParams(input, l),
    quoteId: quote.quoteId,
    slippagePercent: DEFAULT_SLIPPAGE_PCT
  });
  const tx = raw?.data?.tx;
  if (!tx?.to || !tx?.data) {
    throw new Error(raw?.msg || "Aggregator returned no transaction to send — not proceeding.");
  }

  return {
    quoteId: quote.quoteId,
    tx: { to: tx.to, data: tx.data, value: tx.value ?? "0x0" },
    fromTokenAddress: l.fromTokenAddress,
    toTokenAddress: l.toTokenAddress,
    amount: l.amount,
    approveTarget: quote.approveTarget ?? tx.to,
    price: quote.price,
    estimatedQuantity: quote.estimatedQuantity
  };
}
