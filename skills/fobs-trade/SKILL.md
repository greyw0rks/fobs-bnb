# Fobs Trade — Wallet Skill

name: fobs-trade
version: 0.1.0
description: >
  Prepare and execute tokenized-stock trades on BNB Smart Chain through Fobs.
  The skill PREPARES an order and hands it to the wallet; the wallet is the only
  thing that can authorize execution. The agent is never given custody of funds.

## Authorization model

This skill follows the Agentic Wallet boundary exactly:

    preview  →  confirm  →  execute

1. **preview** — the agent calls `prepare_trade` and produces a `PreparedTrade`
   (`symbol`, `side`, `amountUsd`, estimated quantity, price, provider). It is
   marked `requiresWalletConfirmation: true` and moves no funds.
2. **confirm** — the wallet presents the prepared order to the user. Nothing is
   signed without an explicit user confirmation.
3. **execute** — on confirmation the wallet signs the RFQ order; Fobs submits it
   (`/api/trade/submit`) and polls to settlement. The private key never leaves
   the wallet.

## Capabilities (read-only unless noted)

- `get_market_data()` — live tokenized-stock markets (Ondo / bStock / xStocks).
- `get_tokenized_stock(symbol)` — provider variants, price, token metadata.
- `get_social_activity(symbol?)` — recent Fobs trades/posts.
- `get_wallet_holdings(address)` — positions and P&L (real, never invented).
- `get_trade_history(address)` — the wallet's Fobs trades.
- `prepare_trade({symbol, side, amountUsd})` — **preview only**; returns a
  `PreparedTrade`. No signing, no fund movement.
- `simulate_transaction(preparedTrade)` — dry-run via the pre-transaction
  simulate endpoint.
- `request_wallet_confirmation(preparedTrade)` — hands the preview to the wallet
  for the confirm→execute step. This is the ONLY path to execution.

## Guardrails

- No capability moves funds except through `request_wallet_confirmation`, and
  that requires an in-wallet user confirmation.
- Prices are read from the oracle; an unread price is reported as unknown, never
  as zero. The skill will not fabricate a fill price.
- Tokenized stocks are not for US persons at mint/redeem; KYC applies at the
  issuer. The skill surfaces this on any prepared order.

## Endpoints

Base: the Fobs deployment (`NEXT_PUBLIC_APP_URL`). Trade flow:
`POST /api/trade/quote` → wallet signs → `POST /api/trade/submit`.
Market/social/portfolio reads: `/api/assets`, `/api/feed`, `/api/portfolio`.
