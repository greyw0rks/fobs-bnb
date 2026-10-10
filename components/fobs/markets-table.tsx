// The markets list. "Fobs buying" is a real social signal — the number of
// distinct Fobs accounts that have traded the asset — as a blue data bar. The
// 1D column is the only green/red, and a null change renders as an em dash.

import Link from "next/link";
import type { Route } from "next";
import type { Asset } from "@/lib/types";
import { pct, price as fmtPrice } from "@/lib/format";
import { providerLabel } from "@/lib/assets-registry";

export function MarketsTable({
  assets,
  title = "Markets",
  subtitle = "Tokenized stocks on BNB Chain"
}: {
  assets: Asset[];
  title?: string;
  subtitle?: string;
}) {
  const maxTraders = Math.max(1, ...assets.map((a) => a.traders));

  return (
    <div className="fobs-surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#e5e3dd] p-5">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-[11px] text-[#85867f]">{subtitle}</p>
        </div>
      </div>

      <div className="hidden grid-cols-5 border-b border-[#e5e3dd] px-5 py-3 text-[10px] uppercase tracking-wide text-[#8b8c85] sm:grid">
        <span>Stock</span>
        <span>Price</span>
        <span>1D</span>
        <span>Fobs buying</span>
        <span />
      </div>

      {assets.length === 0 ? (
        <div className="px-5 py-10 text-center text-xs text-[#85867f]">No markets yet.</div>
      ) : null}

      {assets.map((asset) => (
        <Link
          key={`${asset.symbol}-${asset.provider}`}
          href={`/stocks/${asset.symbol}` as Route}
          className="grid grid-cols-2 gap-3 border-b border-[#efeee9] px-5 py-4 transition-colors hover:bg-[#f2f1ec] sm:grid-cols-5 sm:items-center"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f0efe9] text-[10px] font-bold">
              {asset.symbol.slice(0, 2)}
            </div>
            <div>
              <div className="text-xs font-semibold">{asset.symbol}</div>
              <div className="text-[10px] text-[#92938c]">{asset.name}</div>
              <div className="mt-0.5 text-[9px] uppercase tracking-wide text-[#a7a89f]">{providerLabel(asset.provider)}</div>
            </div>
          </div>

          <span className="num text-xs font-medium">{fmtPrice(asset.price)}</span>

          <span
            className={`num text-xs font-semibold ${
              asset.change24h === null
                ? "text-[#999a93]"
                : asset.change24h >= 0
                  ? "text-[#23845b]"
                  : "text-[#c94c4c]"
            }`}
          >
            {pct(asset.change24h)}
          </span>

          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#e7e7e2]">
              <div
                className="h-full rounded-full bg-[#3175c6]"
                style={{ width: `${Math.min((asset.traders / maxTraders) * 100, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-[#777872]">{asset.traders}</span>
          </div>

          <span className="hidden justify-self-end text-xs font-medium text-[#3175c6] sm:block">
            Trade →
          </span>
        </Link>
      ))}
    </div>
  );
}
