import Link from "next/link";
import type { Route } from "next";
import type { SymbolMomentum } from "@/lib/discovery";

// "Trending on Fobs" — symbols ranked by real recent activity (distinct traders,
// engagement, trade count) over the last 7 days. The ranking uses those counts;
// the only figures shown are the counts themselves. Renders nothing when there
// is no activity, rather than inventing a trend.
export function TrendingStrip({ rows }: { rows: SymbolMomentum[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="fobs-surface p-5">
      <div className="row" style={{ marginBottom: 12 }}>
        <h2 className="text-sm font-semibold">Trending on fobs</h2>
        <span className="muted" style={{ fontSize: 11 }}>last 7 days</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {rows.map((r) => (
          <Link
            key={r.symbol}
            href={`/stocks/${r.symbol}` as Route}
            className="chip"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
            title={`${r.traders} trader${r.traders === 1 ? "" : "s"} · ${r.trades} trade${r.trades === 1 ? "" : "s"} · ${r.engagement} interactions`}
          >
            <strong>{r.symbol}</strong>
            <span className="muted" style={{ fontSize: 11 }}>
              {r.traders} {r.traders === 1 ? "trader" : "traders"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
