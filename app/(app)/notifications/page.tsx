"use client";

// Notifications view. Real social events for the connected wallet only — follows,
// likes and comments that actually happened. Opening the page marks them read.
// No wallet or no DB → nothing to show (honest empty), never a fabricated feed.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Heart, MessageCircle, UserPlus } from "lucide-react";
import { ago } from "@/lib/format";
import { Avatar } from "@/components/avatar";
import { useFobsAddress, ConnectWalletButton } from "@/components/connect-wallet-button";

type Notification = {
  id: string;
  type: "follow" | "like" | "comment";
  read: boolean;
  postId: string | null;
  tradeId: string | null;
  createdAt: string;
  actor: { username: string; displayName: string; avatarUrl?: string | null };
};

const VERB: Record<Notification["type"], string> = {
  follow: "followed you",
  like: "liked your post",
  comment: "commented on your post"
};

function Icon({ type }: { type: Notification["type"] }) {
  if (type === "follow") return <UserPlus size={15} color="#3175c6" />;
  if (type === "like") return <Heart size={15} color="#c94c4c" />;
  return <MessageCircle size={15} color="#23845b" />;
}

export default function NotificationsPage() {
  const address = useFobsAddress();
  const [items, setItems] = useState<Notification[] | null>(null);
  const [loading, setLoading] = useState(false);

  const markAllRead = useCallback(() => {
    if (!address) return;
    fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address })
    }).catch(() => {});
  }, [address]);

  useEffect(() => {
    if (!address) {
      setItems(null);
      return;
    }
    setLoading(true);
    fetch(`/api/notifications?address=${address}`)
      .then((r) => (r.ok ? r.json() : { notifications: [] }))
      .then((d: { notifications?: Notification[] }) => setItems(d.notifications ?? []))
      .catch(() => setItems([]))
      .finally(() => {
        setLoading(false);
        markAllRead(); // opening the page clears the unread badge
      });
  }, [address, markAllRead]);

  if (!address) {
    return (
      <div className="card soft" style={{ maxWidth: 480 }}>
        <h1 className="trade-title">Notifications</h1>
        <p className="muted">Connect your BNB wallet to see who followed you and engaged with your trades.</p>
        <div style={{ marginTop: 12 }}>
          <ConnectWalletButton />
        </div>
      </div>
    );
  }

  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <header>
        <h1 className="trade-title" style={{ fontSize: 22 }}>Notifications</h1>
        <p className="muted">Real activity on your account — follows, likes and comments.</p>
      </header>

      <div className="fobs-surface p-5">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : !items || items.length === 0 ? (
          <p className="muted">No notifications yet.</p>
        ) : (
          <div className="stack">
            {items.map((n) => {
              const body = (
                <div
                  className="row"
                  style={{
                    borderTop: "1px solid #efeee9",
                    paddingTop: 10,
                    opacity: n.read ? 0.7 : 1
                  }}
                >
                  <div className="user">
                    <Avatar name={n.actor.displayName} avatar={n.actor.avatarUrl} />
                    <span style={{ fontSize: 13 }}>
                      <strong>{n.actor.displayName}</strong> {VERB[n.type]}
                      <br />
                      <span className="muted" style={{ fontSize: 11 }}>@{n.actor.username} · {ago(n.createdAt)}</span>
                    </span>
                  </div>
                  <Icon type={n.type} />
                </div>
              );
              return (
                <Link
                  key={n.id}
                  // Like/comment on a trade-backed post → the trade; otherwise
                  // (follows, or text posts with no detail route) → the actor.
                  href={(n.type !== "follow" && n.tradeId ? `/trade/${n.tradeId}` : `/profile/${n.actor.username}`) as Route}
                  style={{ display: "block", color: "inherit" }}
                >
                  {body}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
