# Fobs on BNB Chain

Fobs is a social trading network for tokenized US stocks on BNB Smart Chain.

The **trade is the social primitive**. Every trade-shaped card in the feed is
backed by a real, wallet-authorized order — so there is no "post" that invents a
position. Profitability, holdings and P&L are derived from actual on-chain wallet
activity, never fabricated. One figure the app can't read live is shown as an em
dash, never as a fake `0`.

## The loop

Discover a stock → understand it → trade it from your own wallet → verify the
fill on-chain → share it to the feed → someone discovers it again. That single
loop is the whole product.

## Surfaces

- **Landing** (`/`) — a live board of real tokenized-stock prices read straight
  from the Binance Web3 RWA feed; "Enter app" drops you into the feed.
- **Feed** (`/feed`) — For You / Following / Trending. Trade-backed cards with
  likes and inline comment threads, plus a text-post composer.
- **Markets** (`/markets`) — the tokenized-stock directory, provider-tagged, with
  a "Fobs buying" social-momentum bar and a 1D change that is the only red/green
  on the screen (and only when the oracle actually read it).
- **Stock** (`/stocks/[symbol]`) — price chart, per-issuer variants, the buy/sell
  panel, live social activity and on-chain token metadata.
- **Trade** (`/trade/[id]`) — a single wallet-authorized order, fully expanded,
  with its BscScan link — the permanent home of a shared trade.
- **Portfolio** (`/portfolio`) — positions and P&L from mirrored holdings + live
  prices; an unread price leaves value and P&L blank rather than guessing.
- **Profile** (`/profile/[username]`) — a public trading identity built from real
  wallet activity, with follow.
- **Watchlist** (`/watchlist`) & **Notifications** (`/notifications`) — bookmarked
  tickers and real social events (follows, likes, comments) only.
- **Agent** (`/agent`) — contextual analysis over live market, social and wallet
  data that *prepares* trades for your wallet to authorize.

## Wallet & execution boundary

Identity is wallet-first: the connected BNB Smart Chain address *is* your account
— no cookies, no passwords. Connect an injected wallet (MetaMask, Binance Wallet,
Trust Wallet) or, on mobile, over WalletConnect.

Execution never gives the app or the agent custody. The agent (or the trade
panel) only ever *prepares*; your wallet is the single thing that can authorize:

```
prepare  ->  simulate  ->  wallet signs  ->  submit  ->  settle
```

For RWA tokens this is an RFQ: the server fetches a live quote and simulates the
order (fee, price impact, minimum received, revert risk) *before* your wallet is
asked to sign. Your wallet signs the real order the aggregator returns — if it
returns nothing signable, the app refuses rather than sign a summary that can't
authorize a fill. The private key never leaves your wallet. The trade skill
manifest lives at `skills/fobs-trade/SKILL.md`.

## Live only — never mock

The app has no fake-data path. Every price, fill and figure comes from a live
source (the Binance Web3 API and BNB Smart Chain) or the database of real
activity. When a source is momentarily unreachable the surface is honestly empty
— "prices unavailable", an em dash, a 503 on a write — and when it's missing
configuration it says so loudly. Nothing is ever invented to fill a gap.

## Providers

All three live BSC tokenized-stock issuers are supported and provider-tagged:
Ondo (`…on`), Binance bStocks (`…B`) and xStocks / Backed (`…x`). Trading contract
addresses are resolved at runtime from the Binance RWA tokens API — never
hard-coded, because a wrong trading address must never be guessed. Stable
metadata (symbol, name, issuer, token symbol) lives in `lib/assets-registry.ts`.

## Not in scope

By design Fobs has no leverage, perps, prediction markets, order books, copy
trading, token or DAO. It is spot buy/sell of tokenized stocks, made social.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind (utilities atop a
hand-authored `globals.css`) · Prisma 6 / PostgreSQL · viem 2 · wagmi 2 ·
recharts · motion. The "Soft Editorial" look is a warm off-white with a
near-black primary action; blue is reserved for data.
