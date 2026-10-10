# Fobs on BNB Chain

Fobs is a social trading network for tokenized stocks on BNB Smart Chain. The
**trade is the social primitive**: every trade-shaped card in the feed is backed
by a real, wallet-authorized order — profitability and holdings are derived from
actual wallet activity, never invented.

## Surfaces

- **Feed** (`/`) — For You / Following / Trending, trade-shaped cards with likes
  and inline comments, plus a text-post composer.
- **Markets** (`/markets`) — tokenized-stock directory with a "Fobs buying"
  social-momentum bar and 1D change (green/red only on real oracle figures).
- **Stock** (`/stocks/[symbol]`) — price chart, per-provider variants, buy/sell
  panel, social activity and on-chain token metadata.
- **Portfolio** (`/portfolio`) — positions and P&L read from mirrored holdings +
  live prices; any unread price shows an em dash, never a fake `0`.
- **Profile** (`/profile/[username]`) — public trading identity from real wallet
  activity, with follow.
- **Agent** (`/agent`) — contextual analysis over market + social + wallet data
  that *prepares* wallet-confirmed trades.

## Wallet & execution boundary

Wallet-first identity (wagmi, injected connector) — the connected BNB address
*is* the account; no cookies or passwords. Execution follows the Agentic Wallet
boundary:

```
prepare (agent)  ->  confirm (wallet)  ->  execute
```

RFQ flow for RWA tokens: `POST /api/trade/quote` -> the wallet signs the order ->
`POST /api/trade/submit` -> poll to settlement. The private key never leaves the
wallet and the agent never has custody of funds. The wallet skill manifest lives
at `skills/fobs-trade/SKILL.md`.

## Providers

All three live BSC tokenized-stock issuers are supported, provider-tagged: Ondo
(`…on`), Binance bStocks (`…B`) and xStocks / Backed (`…x`). Contract addresses
are resolved at runtime from the Binance RWA tokens API — never hard-coded, since
a wrong trading address must never be guessed. Stable metadata (symbol, name,
provider, token symbol) lives in `lib/assets-registry.ts`.

## Environment

```bash
cp .env.example .env.local   # OC_API_KEY / OC_SECRET_KEY, DATABASE_URL, BSC vars
npm install
npx prisma generate
npx prisma db push           # when a DATABASE_URL is set
npm run dev
```

Graceful degradation:
- **No `OC_API_KEY` / `OC_SECRET_KEY`** → clearly labelled mock market data and
  demo quotes (priced from the market snapshot, never a fabricated fill).
- **No `DATABASE_URL`** → mock feed; write routes report they cannot persist.

API credentials stay server-side. Never expose `OC_SECRET_KEY` in browser code.

## Binance Web3 API

Signing is HMAC-SHA256 (base64) over `timestamp + METHOD + /build-path + body`,
sent as `X-OC-APIKEY` / `X-OC-TIMESTAMP` / `X-OC-SIGN` / `X-OC-RECV-WINDOW`.
The app reads the RWA tokens / prices / candles endpoints with `binanceChainId=56`.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind (utilities-only, atop a
hand-authored `globals.css`) · Prisma 6 / PostgreSQL · viem 2 · wagmi 2 · recharts ·
motion. The "Soft Editorial" design system is warm off-white with a near-black
primary action; blue is data-only.
