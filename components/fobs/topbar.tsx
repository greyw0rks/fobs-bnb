"use client";

// The app top bar: asset search (left), network + identity (right). The network
// pill reads "BNB Chain" with a live-green dot. Search is a GET form to
// /markets. Identity is the wallet connect control.

import { Search } from "lucide-react";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { NetworkPill } from "@/components/fobs/network-pill";
import { NotificationBell } from "@/components/fobs/notification-bell";

export function FobsTopbar() {
  return (
    <header className="flex h-[64px] items-center justify-between border-b border-[#e3e2dc] px-5 lg:px-7">
      <form
        action="/markets"
        method="get"
        className="group flex h-10 w-full max-w-[380px] items-center gap-2.5 rounded-full border border-[#e3e2dc] bg-[#f2f1ec] px-4 transition-colors focus-within:border-[#c7c6bf] focus-within:bg-white focus-within:shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
      >
        <Search
          size={15}
          className="shrink-0 text-[#9b9c95] transition-colors group-focus-within:text-[#3175c6]"
        />
        <input
          name="q"
          placeholder="Search stocks…"
          className="w-full bg-transparent text-xs outline-none placeholder:text-[#9b9c95]"
        />
        <kbd className="hidden shrink-0 rounded-md border border-[#dcdbd4] bg-white px-1.5 py-0.5 text-[9px] font-medium text-[#9b9c95] transition-opacity group-focus-within:opacity-0 sm:block">
          ↵
        </kbd>
      </form>

      <div className="ml-4 flex shrink-0 items-center gap-3">
        <NetworkPill />
        <NotificationBell />
        <ConnectWalletButton />
      </div>
    </header>
  );
}
