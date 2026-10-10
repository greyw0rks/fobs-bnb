"use client";

// The signed-in left sidebar (lg+). Routes point at the live surfaces; the
// active item derives from the path. Identity lives in the footer as the wallet
// connect control — Fobs is wallet-first, so "who you are" is your connected
// BNB address.

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { Bot, House, LineChart, Star, Users, Wallet } from "lucide-react";
import { ConnectWalletButton } from "@/components/connect-wallet-button";

const primary = [
  { label: "Home", href: "/feed" as Route, icon: House },
  { label: "Markets", href: "/markets" as Route, icon: LineChart },
  { label: "Portfolio", href: "/portfolio" as Route, icon: Wallet }
] as const;

const secondary = [
  { label: "Agent", href: "/agent" as Route, icon: Bot },
  { label: "People", href: "/friends" as Route, icon: Users },
  { label: "Watchlist", href: "/watchlist" as Route, icon: Star }
] as const;

export function FobsSidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="hidden w-[220px] shrink-0 border-r border-[#e3e2dc] bg-[#f8f7f3] px-4 py-5 lg:flex lg:flex-col">
      <Link href={"/feed" as Route} className="mb-8 px-3 text-[21px] font-bold tracking-[-0.06em]">
        fobs
      </Link>

      <nav className="space-y-1">
        {primary.map((item) => (
          <NavItem key={item.label} {...item} active={isActive(item.href)} />
        ))}
      </nav>

      <div className="mb-2 mt-8 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a8b84]">
        Discover
      </div>

      <nav className="space-y-1">
        {secondary.map((item) => (
          <NavItem key={item.label} {...item} active={isActive(item.href)} />
        ))}
      </nav>

      <div className="mt-auto pt-4">
        <ConnectWalletButton className="fobs-button-primary block w-full text-center" />
      </div>
    </aside>
  );
}

function NavItem({
  label,
  href,
  icon: Icon,
  active
}: {
  label: string;
  href: Route;
  icon: typeof House;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px] transition ${
        active ? "bg-[#080909] text-white" : "text-[#5f615c] hover:bg-white"
      }`}
    >
      <Icon size={15} strokeWidth={1.8} />
      {label}
    </Link>
  );
}
