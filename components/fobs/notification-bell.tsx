"use client";

// Top-bar notifications bell. Shows the unread count for the connected wallet and
// links to the notifications view. Counts come from the DB via /api/notifications
// — when there is no wallet or no DB, there is simply nothing to show (no badge),
// never a fabricated number.

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Bell } from "lucide-react";
import { useFobsAddress } from "@/components/connect-wallet-button";

export function NotificationBell() {
  const address = useFobsAddress();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!address) {
      setUnread(0);
      return;
    }
    let alive = true;
    const load = () =>
      fetch(`/api/notifications?address=${address}`)
        .then((r) => (r.ok ? r.json() : { unread: 0 }))
        .then((d: { unread?: number }) => {
          if (alive) setUnread(d.unread ?? 0);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000); // gentle poll; real counts only
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [address]);

  if (!address) return null;

  return (
    <Link
      href={"/notifications" as Route}
      aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e3e2dc] bg-[#f2f1ec] text-[#5f615c] transition-colors hover:bg-white"
    >
      <Bell size={16} strokeWidth={1.8} />
      {unread > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#c94c4c] px-1 text-[10px] font-semibold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
