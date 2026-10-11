import Link from "next/link";
import type { Route } from "next";
import { getFeed } from "@/lib/feed";
import { getAssets } from "@/lib/assets";
import { FeedView } from "@/components/feed/feed-view";
import { price as fmtPrice, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const [posts, { assets }] = await Promise.all([getFeed("for-you"), getAssets()]);
  const rail = assets.slice(0, 6);

  return (
    <div className="feed-layout">
      <section className="min-w-0">
        <header style={{ marginBottom: 16 }}>
          <h1 className="trade-title" style={{ fontSize: 22 }}>Feed</h1>
          <p className="muted">The trade is the post. Follow real on-chain traders on BNB Chain.</p>
        </header>
        <FeedView initial={posts} />
      </section>

      <aside className="feed-rail">
        <div className="fobs-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Markets</h3>
            <Link href={"/markets" as Route} className="text-xs font-medium text-[#3175c6]">
              All →
            </Link>
          </div>
          <div className="space-y-3.5">
            {rail.map((asset) => (
              <Link
                key={asset.symbol}
                href={`/stocks/${asset.symbol}` as Route}
                className="flex items-center justify-between gap-2 rounded-lg -mx-2 px-2 py-1 transition hover:bg-[#f2f1ec]"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f0efe9] text-[9px] font-bold">
                    {asset.symbol.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold">{asset.symbol}</div>
                    <div className="truncate text-[10px] text-[#92938c]">{asset.traders} holding</div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="num text-xs font-medium">{fmtPrice(asset.price)}</div>
                  <div
                    className={`num text-[10px] ${
                      asset.change24h === null ? "text-[#9b9c95]" : asset.change24h >= 0 ? "text-[#23845b]" : "text-[#c94c4c]"
                    }`}
                  >
                    {pct(asset.change24h)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <p className="mt-4 text-[10px] leading-4 text-[#9b9c95]">
            Holder counts are real Fobs accounts holding the asset.
          </p>
        </div>
      </aside>
    </div>
  );
}
