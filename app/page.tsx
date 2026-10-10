import Link from "next/link";
import type { Route } from "next";
import { getAssets } from "@/lib/assets";
import { price as fmtPrice, pct } from "@/lib/format";
import { Reveal, Stagger, StaggerItem } from "@/components/fobs/motion";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import type { Asset } from "@/lib/types";

// fobs — the public landing page (the app's front door at `/`).
//
// Unlike a teaser, this is a LIVE mainnet product: every price on this page is
// read from the Binance Web3 RWA feed, not invented. The hero board shows real
// tokenized-stock prices on BNB Smart Chain, and the CTA drops you straight into
// the app once your wallet is connected. When the live feed is momentarily
// unreachable the board shows an honest "prices unavailable" state — never mock.

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const { assets } = await getAssets();
  const rail = assets.slice(0, 5);

  return (
    <main id="top" className="min-h-screen bg-[#f4f3ef] text-[#111312]">
      <header className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-5 lg:px-10">
        <span className="text-[22px] font-bold tracking-[-0.06em]">fobs</span>
        <nav className="hidden items-center gap-7 text-sm text-[#5f615c] sm:flex">
          <a href="#markets" className="hover:text-[#111312]">Markets</a>
          <a href="#how" className="hover:text-[#111312]">How it works</a>
          <Link href={"/feed" as Route} className="hover:text-[#111312]">Feed</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link href={"/feed" as Route} className="fobs-button-secondary px-4 py-2 text-sm">
            Enter app
          </Link>
          <ConnectWalletButton className="fobs-button-primary px-4 py-2 text-sm" />
        </div>
      </header>

      {/* Hero */}
      <Reveal>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute right-[4%] top-[-40px] h-[520px] w-[520px] rounded-full bg-[#f6e39b] blur-3xl opacity-70" />
          <div className="pointer-events-none absolute right-[14%] top-[160px] h-[320px] w-[320px] rounded-full bg-[#dfeafa] blur-3xl" />

          <div className="relative mx-auto grid max-w-[1400px] items-center gap-16 px-6 pb-20 pt-10 lg:grid-cols-[0.95fr_1.05fr] lg:px-10 lg:pt-16">
            <div className="max-w-[620px]">
              <p className="mb-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#c08a17]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#23845b]" />
                Live on BNB Smart Chain
              </p>

              <h1 className="text-[52px] font-semibold leading-[0.96] tracking-[-0.065em] sm:text-[68px] lg:text-[80px]">
                The trade
                <br />
                is the post.
              </h1>

              <p className="mt-7 max-w-[500px] text-base leading-7 text-[#6e6f69] sm:text-lg">
                Trade tokenized US stocks on BNB Chain, follow real on-chain
                traders, and let a non-custodial agent prepare orders your wallet
                signs. Every figure here is read on-chain — nothing is invented.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={"/feed" as Route} className="fobs-button-primary px-6 py-3">
                  Enter app →
                </Link>
                <a href="#markets" className="fobs-button-secondary px-6 py-3">
                  Explore markets
                </a>
              </div>

              <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-[#8b8c85]">Network</dt>
                  <dd className="mt-1 text-2xl font-semibold tracking-[-0.04em]">BNB Chain</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-[#8b8c85]">Custody</dt>
                  <dd className="mt-1 text-2xl font-semibold tracking-[-0.04em]">Your wallet</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-[#8b8c85]">Prices</dt>
                  <dd className="mt-1 text-2xl font-semibold tracking-[-0.04em]">Live</dd>
                </div>
              </dl>
            </div>

            <HeroProduct assets={rail} />
          </div>
        </section>
      </Reveal>

      {/* Feature row */}
      <Reveal delay={0.05}>
        <section className="mx-auto max-w-[1400px] px-6 pb-16 lg:px-10">
          <Stagger className="grid gap-3 sm:grid-cols-3">
            {[
              ["Real data, or nothing", "Prices and balances are read from BNB Chain and the Binance Web3 RWA feed. When a figure can't be read, you see an em dash — never a fake 0."],
              ["Follow real traders", "The feed is backed by real on-chain trades. Follow people, see what they hold, and verify every trade on BscScan."],
              ["Agent prepares, wallet authorizes", "Ask the agent for a trade and it prepares an order. Only your wallet can sign it — the app never holds your key."]
            ].map(([title, text]) => (
              <StaggerItem key={title} className="rounded-[18px] border border-[#e3e2dc] bg-white p-6">
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-[#777872]">{text}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      </Reveal>

      {/* Markets sample — live */}
      <Reveal delay={0.1}>
        <section id="markets" className="mx-auto max-w-[1400px] px-6 pb-16 lg:px-10">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div className="max-w-[620px]">
              <h2 className="text-xl font-semibold tracking-[-0.04em]">Live markets</h2>
              <p className="mt-2 text-sm leading-6 text-[#6e6f69]">
                Tokenized US stocks trading on BNB Smart Chain right now. Prices
                are read live — tap any asset to trade it.
              </p>
            </div>
            <Link href={"/markets" as Route} className="text-sm font-medium text-[#3175c6]">
              All markets →
            </Link>
          </div>

          {rail.length === 0 ? (
            <div className="rounded-[18px] border border-[#e3e2dc] bg-white p-8 text-center text-sm text-[#85867f]">
              Live prices are unavailable right now — try again shortly.
            </div>
          ) : (
            <div className="overflow-hidden rounded-[18px] border border-[#e3e2dc] bg-white">
              {rail.map((asset, i) => (
                <Link
                  key={asset.symbol}
                  href={`/stocks/${asset.symbol}` as Route}
                  className={`flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-[#f7f6f2] ${
                    i > 0 ? "border-t border-[#efeee9]" : ""
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f0efe9] text-[11px] font-bold">
                      {asset.symbol.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{asset.symbol}</div>
                      <div className="truncate text-xs text-[#92938c]">{asset.name}</div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="num text-sm font-medium tabular-nums">{fmtPrice(asset.price)}</div>
                    <div
                      className={`num text-xs tabular-nums ${
                        asset.change24h === null
                          ? "text-[#9b9c95]"
                          : asset.change24h >= 0
                          ? "text-[#23845b]"
                          : "text-[#c94c4c]"
                      }`}
                    >
                      {pct(asset.change24h)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </Reveal>

      {/* How it works */}
      <Reveal delay={0.15}>
        <section id="how" className="mx-auto max-w-[1400px] px-6 pb-16 lg:px-10">
          <div className="mb-6 max-w-[620px]">
            <h2 className="text-xl font-semibold tracking-[-0.04em]">The loop</h2>
            <p className="mt-2 text-sm leading-6 text-[#6e6f69]">
              Discover, understand, trade, verify, share — and discover again.
              Every step is backed by real on-chain activity.
            </p>
          </div>

          <ol className="grid list-none gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Discover", "See what real traders are buying in the feed."],
              ["Understand", "Read live prices and the on-chain story of each asset."],
              ["Trade", "Your wallet signs the order — non-custodial, on BNB Chain."],
              ["Verify", "Every trade links to its transaction on BscScan."],
              ["Share", "Your trade becomes the post others discover next."]
            ].map(([title, text], i) => (
              <li key={title} className="rounded-[18px] border border-[#e3e2dc] bg-white p-5">
                <span className="text-[11px] font-semibold tabular-nums text-[#3175c6]">
                  0{i + 1}
                </span>
                <h3 className="mt-3 text-sm font-semibold">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-[#777872]">{text}</p>
              </li>
            ))}
          </ol>
        </section>
      </Reveal>

      {/* CTA */}
      <Reveal delay={0.2}>
        <section id="start" className="mx-auto max-w-[1400px] px-6 pb-20 lg:px-10">
          <div className="overflow-hidden rounded-[24px] border border-[#e3e2dc] bg-white p-8 sm:p-12">
            <div className="max-w-[560px]">
              <h2 className="text-2xl font-semibold tracking-[-0.05em] sm:text-3xl">
                Connect your wallet to start.
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#6e6f69]">
                fobs is wallet-first: your connected BNB address is your identity.
                No sign-up, no custody. Connect to trade, or step inside and look
                around first.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <ConnectWalletButton className="fobs-button-primary px-6 py-3" />
                <Link href={"/feed" as Route} className="fobs-button-secondary px-6 py-3">
                  Enter app →
                </Link>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* Footer */}
      <footer className="border-t border-[#e3e2dc]">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-6 py-8 text-xs text-[#777872] sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <span className="max-w-[560px]">
            fobs — social trading for tokenized stocks on BNB Smart Chain.
            Tokenized stocks are not available to US persons.
          </span>
          <nav className="flex flex-wrap gap-5">
            <a href="#markets" className="hover:text-[#111312]">Markets</a>
            <a href="#how" className="hover:text-[#111312]">How it works</a>
            <Link href={"/feed" as Route} className="hover:text-[#111312]">Feed</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

/**
 * A floating product card — the live market board a visitor can read before
 * connecting, framed as the app's own surface hovering in the soft canvas.
 * Prices are live; an empty list shows an honest "not read yet" state.
 */
function HeroProduct({ assets }: { assets: Asset[] }) {
  return (
    <div className="relative min-h-[420px] lg:min-h-[500px]">
      <div className="absolute inset-6 rounded-[40px] bg-gradient-to-br from-[#f6e39b] via-[#f3e6c9] to-[#dceafa] blur-xl" />

      <div className="relative mx-auto max-w-[500px] rotate-[2deg] rounded-[28px] border border-white bg-white/90 p-5 shadow-[0_30px_80px_rgba(0,0,0,.08)] backdrop-blur">
        <div className="mb-6 flex items-center justify-between">
          <span className="text-lg font-bold tracking-[-0.05em]">fobs</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#edf5ef] px-3 py-1 text-[10px] text-[#23845b]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#23845b]" />
            Live
          </span>
        </div>

        <div className="rounded-2xl bg-[#f5f4ef] p-4">
          <span className="text-[10px] uppercase tracking-wide text-[#8b8c85]">
            Tokenized stocks · BNB Chain
          </span>
          <div className="mt-3 space-y-3">
            {assets.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#85867f]">
                No live prices read yet.
              </p>
            ) : (
              assets.map((asset) => (
                <div key={asset.symbol} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[10px] font-bold">
                      {asset.symbol.slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-xs font-semibold">{asset.symbol}</div>
                      <div className="text-[10px] text-[#92938c]">{asset.name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-medium tabular-nums">{fmtPrice(asset.price)}</div>
                    <div
                      className={`text-[10px] tabular-nums ${
                        asset.change24h === null
                          ? "text-[#9b9c95]"
                          : asset.change24h >= 0
                          ? "text-[#23845b]"
                          : "text-[#c94c4c]"
                      }`}
                    >
                      {pct(asset.change24h)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
