import { NextResponse } from "next/server";
import { getRwaCandles } from "@/lib/binance-web3";

export const dynamic = "force-dynamic";

// Binance RWA candle granularities we are willing to proxy. The client picks one
// by timeframe; anything else falls back to the 1h default rather than passing
// unvalidated input upstream.
const ALLOWED_BARS = new Set(["1m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d", "1w"]);

// Price history for the stock chart. Proxies the Binance RWA candle endpoint
// when a key is configured; otherwise returns an empty series (the chart shows
// an honest "not read yet" rather than a fabricated line).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const contract = searchParams.get("contract");
  const requested = searchParams.get("bar");
  const bar = requested && ALLOWED_BARS.has(requested) ? requested : "1h";

  if (!process.env.OC_API_KEY || !process.env.OC_SECRET_KEY || !contract) {
    return NextResponse.json({ candles: [] });
  }

  try {
    const raw = await getRwaCandles(contract, bar);
    // Binance RWA candle rows are arrays: [open, high, low, close, volume, tsMs, trades].
    // Timestamp is the large epoch-ms integer; close is index 3.
    const points = (raw.data ?? [])
      .map((c: any) => {
        if (Array.isArray(c)) {
          return { t: Number(c[5]), c: Number(c[3]) };
        }
        return { t: Number(c.t ?? c.time ?? c.ts), c: Number(c.c ?? c.close) };
      })
      .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.c) && p.c > 0)
      .sort((a, b) => a.t - b.t);

    // Thinly-traded RWA tokens occasionally emit corrupt early ticks orders of
    // magnitude off the real price. Drop points that deviate absurdly from the
    // median close so the chart axis reflects real price action (no fabrication —
    // only clearly-broken samples are removed).
    const closes = [...points].map((p) => p.c).sort((a, b) => a - b);
    const median = closes.length ? closes[Math.floor(closes.length / 2)] : 0;
    const candles = median
      ? points.filter((p) => p.c >= median * 0.33 && p.c <= median * 3)
      : points;

    return NextResponse.json({ candles });
  } catch {
    return NextResponse.json({ candles: [] });
  }
}
