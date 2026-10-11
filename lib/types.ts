// Shared view types for Fobs (BNB Chain).
//
// Product rule encoded in the types: a price can be genuinely unknown. `price`
// and `change24h` are `number | null` — null means "the indexer/oracle did not
// read it", which the UI renders as an em dash, never as a fake 0.

export type TradeSide = "buy" | "sell";

// RFQ lifecycle for tokenized-stock orders (quote -> submit -> poll).
export type TradeStatus = "quoted" | "submitted" | "confirmed" | "failed";

export type AssetProvider = "ondo" | "bstock" | "xstocks" | string;

export type FeedView = "for-you" | "following" | "trending";

/** A tradable tokenized stock, resolved from the RWA registry + live prices. */
export type Asset = {
  symbol: string; // underlying ticker, e.g. NVDA
  name: string;
  provider: AssetProvider;
  contractAddress?: string;
  tokenSymbol?: string; // on-chain symbol, e.g. NVDAon
  logoUrl?: string;
  price: number | null;
  referencePrice?: number | null;
  change24h: number | null;
  volume24h?: number | null;
  marketCap?: number | null;
  openState?: boolean;
  marketStatus?: string;
  traders: number; // distinct Fobs accounts that have traded it ("Fobs buying")
  source: "binance"; // always live — the app has no mock data path
};

export type FeedUser = {
  username: string;
  displayName: string;
  avatarUrl?: string | null;
};

/** A trade — the social primitive. Every feed card is backed by one. */
export type FeedTrade = {
  id: string;
  user: FeedUser;
  side: TradeSide;
  symbol: string;
  assetName?: string;
  amountUsd: number;
  quantity: number | null;
  price: number | null;
  txHash?: string | null;
  status: TradeStatus;
  createdAt: string; // ISO
};

/** A post in the feed. A trade post references a real trade; a text post does not. */
export type FeedPost = {
  id: string;
  kind: "trade" | "text";
  content: string;
  createdAt: string; // ISO
  user: FeedUser;
  trade: FeedTrade | null;
  likeCount: number;
  commentCount: number;
  viewerLiked: boolean;
};

export type Comment = {
  id: string;
  user: FeedUser;
  content: string;
  createdAt: string;
};

/** A single trade, fully expanded — the backing view for the per-trade page. */
export type TradeDetail = {
  id: string;
  user: FeedUser;
  side: TradeSide;
  symbol: string;
  assetName: string | null;
  provider: string | null;
  tokenSymbol: string | null;
  contractAddress: string | null;
  amountUsd: number;
  quantity: number | null;
  price: number | null;
  txHash: string | null;
  orderId: string | null;
  status: TradeStatus;
  createdAt: string;
  postId: string | null;
  content: string | null;
  likeCount: number;
  commentCount: number;
};

export type SessionUserView = {
  id: string;
  username: string;
  displayName: string;
  walletAddress: string;
  avatarUrl?: string | null;
};

export type ProfileView = {
  user: FeedUser & { bio?: string | null; walletAddress: string; xHandle?: string | null };
  followerCount: number;
  followingCount: number;
  tradeCount: number;
  viewerFollows: boolean;
  holdings: PortfolioHolding[];
  trades: FeedTrade[];
};

export type PortfolioHolding = {
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  price: number | null; // live, null when unread
  valueUsd: number | null; // quantity * price, null when price unread
  costBasisUsd: number;
  pnlUsd: number | null;
  pnlPct: number | null;
};

export type PortfolioView = {
  holdings: PortfolioHolding[];
  totalValueUsd: number | null;
  totalCostUsd: number;
  totalPnlUsd: number | null;
};

/** A raw on-chain token balance read directly from BNB Smart Chain. No cost
 *  basis or P&L — those are unknown from balance alone and never invented. */
export type WalletBalance = {
  symbol: string;
  name: string;
  provider: AssetProvider;
  providerLabel: string;
  tokenSymbol: string;
  contractAddress: string;
  quantity: number;
  price: number | null;
  valueUsd: number | null;
};
