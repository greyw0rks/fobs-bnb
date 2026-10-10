// Discovery — social-momentum ranking derived entirely from real activity.
//
// "Momentum" here is not a price signal; it is how much genuine Fobs activity a
// symbol is drawing right now: recent trades, distinct traders, and engagement
// (likes + comments) on the posts that back those trades, over a rolling window.
// Every number is counted from the DB — when the DB is unreachable the ranking
// is empty, never fabricated.

import "server-only";
import { tryDb } from "./db";

export type SymbolMomentum = {
  symbol: string;
  trades: number; // trades in the window
  traders: number; // distinct accounts trading it
  engagement: number; // likes + comments on trade-backed posts in the window
  score: number; // combined momentum score (higher = hotter)
};

const WINDOW_DAYS = 7;

/** Rank symbols by recent Fobs activity. Empty when the DB is unreachable. */
export async function getTrendingSymbols(limit = 8): Promise<SymbolMomentum[]> {
  const rows = await tryDb(async (db) => {
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const trades = await db.trade.findMany({
      where: { createdAt: { gte: since } },
      select: {
        symbol: true,
        userId: true,
        post: { select: { _count: { select: { likes: true, comments: true } } } }
      }
    });

    const bySymbol = new Map<string, { trades: number; traders: Set<string>; engagement: number }>();
    for (const t of trades) {
      const entry = bySymbol.get(t.symbol) ?? { trades: 0, traders: new Set<string>(), engagement: 0 };
      entry.trades += 1;
      entry.traders.add(t.userId);
      if (t.post) entry.engagement += t.post._count.likes + t.post._count.comments;
      bySymbol.set(t.symbol, entry);
    }

    return [...bySymbol.entries()].map(([symbol, e]) => ({
      symbol,
      trades: e.trades,
      traders: e.traders.size,
      engagement: e.engagement
    }));
  });

  if (rows === null || rows.length === 0) return [];

  // Distinct traders weigh heaviest (breadth of interest), then engagement, then
  // raw trade count. This is a ranking heuristic over real counts — no invented
  // figure is surfaced to the user; only the ordering uses the composite.
  return rows
    .map((r) => ({ ...r, score: r.traders * 3 + r.engagement * 2 + r.trades }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
