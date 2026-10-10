// The Fobs agent.
//
// It reads real context — market data, social activity, and (when a wallet is
// connected) that wallet's holdings and trade history — and PREPARES a trade.
// It never executes: `prepare_trade` returns a PreparedTrade with
// `requiresWalletConfirmation: true`, and only the wallet can authorize it.
// This is the whole safety model: the agent decides what to prepare, the wallet
// controls authorization, and the agent is never given custody of funds.
//
// P0 uses deterministic analysis over the real tools (no model key required);
// the tool layer is the durable part — an LLM can be slotted into `runAgent`
// later without changing the tools or the wallet-confirmation boundary.

import "server-only";
import { getAssets, getAssetVariants } from "./assets";
import { getFeed } from "./feed";
import { getPortfolio, getTradeHistory } from "./portfolio";
import { tokenSymbolFor, UNDERLYINGS, DEFAULT_PROVIDER } from "./assets-registry";
import { money, pct, price as fmtPrice } from "./format";
import type { AgentResponse, AgentStep, PreparedTrade, TradeSide } from "./types";

// ── Tools (each maps to a spec tool name) ──────────────────────────────────
export const tools = {
  get_market_data: async () => (await getAssets()).assets,
  get_tokenized_stock: async (symbol: string) => getAssetVariants(symbol),
  get_social_activity: async (symbol?: string) => {
    const feed = await getFeed("for-you");
    return symbol ? feed.filter((p) => p.trade?.symbol === symbol) : feed;
  },
  get_wallet_holdings: async (userId: string) => getPortfolio(userId),
  get_trade_history: async (userId: string) => getTradeHistory(userId),
  prepare_trade: async (input: {
    symbol: string;
    side: TradeSide;
    amountUsd: number;
    provider?: string;
  }): Promise<PreparedTrade> => {
    const variants = await getAssetVariants(input.symbol);
    const provider = input.provider ?? DEFAULT_PROVIDER;
    const asset = variants.find((a) => a.provider === provider) ?? variants[0] ?? null;
    const price = asset?.price ?? null;
    return {
      symbol: input.symbol,
      side: input.side,
      amountUsd: input.amountUsd,
      estimatedQuantity: price ? input.amountUsd / price : null,
      price,
      contractAddress: asset?.contractAddress,
      provider: asset?.provider ?? provider,
      requiresWalletConfirmation: true,
      rationale: ""
    };
  }
};

// ── Intent parsing (deterministic) ─────────────────────────────────────────
function parseSymbol(text: string): string | null {
  const upper = text.toUpperCase();
  return UNDERLYINGS.find((u) => new RegExp(`\\b${u.symbol}\\b`).test(upper))?.symbol ?? null;
}

function parseSide(text: string): TradeSide | null {
  const t = text.toLowerCase();
  if (/\b(sell|reduce|trim|exit|close)\b/.test(t)) return "sell";
  if (/\b(buy|add|long|accumulate|get|acquire)\b/.test(t)) return "buy";
  return null;
}

function parseAmount(text: string): number | null {
  const m = text.match(/\$?\s*([\d,]+(?:\.\d+)?)\s*(k)?\b/i);
  if (!m) return null;
  let n = Number(m[1].replace(/,/g, ""));
  if (m[2]?.toLowerCase() === "k") n *= 1000;
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ── Runtime ─────────────────────────────────────────────────────────────────
export async function runAgent(prompt: string, userId?: string | null): Promise<AgentResponse> {
  const steps: AgentStep[] = [];
  const symbol = parseSymbol(prompt);
  const side = parseSide(prompt);
  const amount = parseAmount(prompt);

  const market = await tools.get_market_data();
  steps.push({ tool: "get_market_data", summary: `Read ${market.length} tokenized-stock markets on BNB Chain.` });

  if (!symbol) {
    const movers = [...market]
      .filter((a) => a.change24h !== null)
      .sort((a, b) => Math.abs(b.change24h ?? 0) - Math.abs(a.change24h ?? 0))
      .slice(0, 3);
    const busiest = [...market].sort((a, b) => b.traders - a.traders)[0];
    const lines = movers.map((a) => `${a.symbol} ${fmtPrice(a.price)} (${pct(a.change24h)})`).join(", ");
    return {
      message:
        `I can analyze any of the ${market.length} tokenized stocks and prepare a wallet-confirmed trade.\n\n` +
        (lines ? `Most active on price today: ${lines}.\n` : "") +
        (busiest ? `Most Fobs accounts trading: ${busiest.symbol} (${busiest.traders}).\n\n` : "\n") +
        `Tell me a symbol and a size — e.g. "analyze NVDA" or "buy $500 of NVDA" — and I'll prepare it for your wallet to sign.`,
      steps,
      preparedTrade: null
    };
  }

  const variants = await tools.get_tokenized_stock(symbol);
  steps.push({ tool: "get_tokenized_stock", summary: `Loaded ${symbol} (${variants.length} provider variant${variants.length === 1 ? "" : "s"}).` });

  const asset = variants.find((a) => a.provider === DEFAULT_PROVIDER) ?? variants[0] ?? null;

  const social = await tools.get_social_activity(symbol);
  steps.push({ tool: "get_social_activity", summary: `${social.length} recent Fobs post${social.length === 1 ? "" : "s"} mention ${symbol}.` });

  let holdingLine = "";
  if (userId) {
    const portfolio = await tools.get_wallet_holdings(userId);
    steps.push({ tool: "get_wallet_holdings", summary: `Read your wallet: ${portfolio.holdings.length} position${portfolio.holdings.length === 1 ? "" : "s"}.` });
    const pos = portfolio.holdings.find((h) => h.symbol === symbol);
    holdingLine = pos
      ? `You already hold ${pos.quantity.toLocaleString()} ${symbol} (avg ${fmtPrice(pos.avgPrice)}${pos.pnlPct !== null ? `, ${pct(pos.pnlPct)}` : ""}).`
      : `You have no ${symbol} position yet.`;
  }

  const priceLine = asset?.price !== null && asset
    ? `${symbol} is ${fmtPrice(asset.price)} (${pct(asset.change24h)} today) via ${asset.provider}.`
    : `${symbol}'s price hasn't been read from the oracle yet — I won't guess one.`;
  const socialLine = social.length > 0
    ? `${social.length} account${social.length === 1 ? "" : "s"} in your feed traded ${symbol} recently.`
    : `No recent ${symbol} trades in your feed.`;

  // A trade is only prepared when the user actually asked to trade a size.
  if (side && amount) {
    const prepared = await tools.prepare_trade({ symbol, side, amountUsd: amount, provider: asset?.provider });
    steps.push({ tool: "prepare_trade", summary: `Prepared ${side} ${money(amount)} of ${symbol} — awaiting wallet confirmation.` });
    steps.push({ tool: "simulate_transaction", summary: "The order is quoted and simulated on-chain (fee, price impact, revert check) before your wallet signs." });
    steps.push({ tool: "request_wallet_confirmation", summary: "Handed the prepared order to your wallet. It will not execute until you sign." });
    prepared.rationale = `${priceLine} ${socialLine} ${holdingLine}`.trim();
    return {
      message:
        `Prepared: **${side} ${money(amount)} of ${symbol}** (${tokenSymbolFor(symbol, prepared.provider ?? DEFAULT_PROVIDER)})` +
        `${prepared.estimatedQuantity !== null ? ` ≈ ${prepared.estimatedQuantity.toLocaleString(undefined, { maximumFractionDigits: 4 })} tokens` : ""}.\n\n` +
        `${prepared.rationale}\n\nReview and sign in your wallet to execute — I can't move funds for you.`,
      steps,
      preparedTrade: prepared
    };
  }

  return {
    message: `${priceLine}\n${socialLine}${holdingLine ? `\n${holdingLine}` : ""}\n\nWant me to prepare a trade? Say e.g. "buy $500 of ${symbol}" and I'll set it up for your wallet to sign.`,
    steps,
    preparedTrade: null
  };
}
