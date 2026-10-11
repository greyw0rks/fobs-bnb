"use client";

// Bottom tab bar shown below `lg`. Mirrors the sidebar's destinations.

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { House, LineChart, Users, Wallet } from "lucide-react";

const items = [
  { icon: House, label: "Home", href: "/feed" as Route },
  { icon: LineChart, label: "Markets", href: "/markets" as Route },
  { icon: Wallet, label: "Portfolio", href: "/portfolio" as Route },
  { icon: Users, label: "People", href: "/friends" as Route }
] as const;

export function MobileNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#e3e2dc] bg-white/95 px-3 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-md justify-around">
        {items.map(({ icon: Icon, label, href }) => {
          const active = isActive(href);
          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-[54px] flex-col items-center gap-1 py-1 text-[10px] transition ${
                active ? "text-black" : "text-[#686963]"
              }`}
            >
              <Icon size={18} strokeWidth={1.8} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
