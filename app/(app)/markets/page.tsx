import { getAssets } from "@/lib/assets";
import { getTrendingSymbols } from "@/lib/discovery";
import { MarketsTable } from "@/components/fobs/markets-table";
import { TrendingStrip } from "@/components/fobs/trending-strip";

export const dynamic = "force-dynamic";

export default async function MarketsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [{ assets }, trending] = await Promise.all([getAssets(), getTrendingSymbols()]);
  const filtered = q
    ? assets.filter(
        (a) =>
          a.symbol.toLowerCase().includes(q.toLowerCase()) ||
          a.name.toLowerCase().includes(q.toLowerCase())
      )
    : assets;

  return (
    <div className="stack">
      <header style={{ marginBottom: 4 }}>
        <h1 className="trade-title" style={{ fontSize: 22 }}>Markets</h1>
        <p className="muted">Tokenized US stocks on BNB Smart Chain.</p>
      </header>
      {q ? null : <TrendingStrip rows={trending} />}
      {assets.length === 0 ? (
        <div className="fobs-surface p-5">
          <p className="muted">Live prices are unavailable right now — try again shortly.</p>
        </div>
      ) : (
        <MarketsTable
          assets={filtered}
          subtitle={q ? `Results for “${q}”` : "What people are trading"}
        />
      )}
    </div>
  );
}
