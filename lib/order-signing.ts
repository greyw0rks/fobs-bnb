// Shared client helper for the RFQ signing step.
//
// The Binance Web3 aggregator hands back the payload the wallet must sign in one
// of a few shapes. When it is EIP-712 typed data we MUST sign the typed data —
// a human-readable summary-string signature can never authorize a real fill.
// This predicate lets both trade entry points (the trade panel and the agent
// panel) branch on the shape identically, so they can't drift.

export type OrderTypedData = {
  domain: Record<string, unknown>;
  types: Record<string, unknown>;
  primaryType: string;
  message: Record<string, unknown>;
};

export function isTypedData(v: unknown): v is OrderTypedData {
  return (
    typeof v === "object" &&
    v !== null &&
    "types" in v &&
    "message" in v &&
    "primaryType" in v
  );
}
