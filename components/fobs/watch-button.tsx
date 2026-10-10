"use client";

// Star toggle for a symbol's watchlist membership. A watch is a bookmark, not a
// position — it implies no figure. Requires a connected wallet (that is the
// identity); when disconnected the control invites connecting rather than acting.

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useFobsAddress } from "@/components/connect-wallet-button";

export function WatchButton({ symbol, compact = false }: { symbol: string; compact?: boolean }) {
  const address = useFobsAddress();
  const [watching, setWatching] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!address) {
      setWatching(false);
      return;
    }
    let alive = true;
    fetch(`/api/watchlist?address=${address}`)
      .then((r) => (r.ok ? r.json() : { symbols: [] }))
      .then((d: { symbols?: string[] }) => {
        if (alive) setWatching((d.symbols ?? []).includes(symbol.toUpperCase()));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [address, symbol]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!address || busy) return;
    const next = !watching;
    setWatching(next); // optimistic
    setBusy(true);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, symbol, action: next ? "add" : "remove" })
      });
      if (!res.ok) setWatching(!next); // revert
    } catch {
      setWatching(!next);
    } finally {
      setBusy(false);
    }
  }

  const title = !address
    ? "Connect a wallet to watch"
    : watching
      ? "Remove from watchlist"
      : "Add to watchlist";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!address || busy}
      aria-pressed={watching}
      title={title}
      className="muted"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, color: watching ? "#c08a17" : undefined }}
    >
      <Star size={compact ? 14 : 16} fill={watching ? "#c08a17" : "none"} />
      {compact ? null : watching ? "Watching" : "Watch"}
    </button>
  );
}
