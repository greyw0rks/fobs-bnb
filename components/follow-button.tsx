"use client";

import { useEffect, useState } from "react";
import { useFobsAddress } from "@/components/connect-wallet-button";

export function FollowButton({
  targetUsername,
  initialFollowing
}: {
  targetUsername: string;
  initialFollowing: boolean;
}) {
  const address = useFobsAddress();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  // The server renders this with no viewer session, so initialFollowing is a
  // best guess. Once the wallet is connected, hydrate the real state.
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    fetch(`/api/follow?address=${address}&targetUsername=${encodeURIComponent(targetUsername)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { following?: boolean } | null) => {
        if (!cancelled && d && typeof d.following === "boolean") setFollowing(d.following);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [address, targetUsername]);

  async function toggle() {
    if (!address || busy) return;
    setBusy(true);
    const next = !following;
    setFollowing(next);
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, targetUsername, action: next ? "follow" : "unfollow" })
      });
      if (!res.ok) setFollowing(!next);
    } catch {
      setFollowing(!next);
    } finally {
      setBusy(false);
    }
  }

  if (!address) return null;

  return (
    <button
      type="button"
      className={following ? "fobs-button-secondary" : "fobs-button-primary"}
      onClick={toggle}
      disabled={busy}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
