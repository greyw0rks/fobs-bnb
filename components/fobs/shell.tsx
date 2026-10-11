// The canonical signed-in layout: fixed sidebar (lg+), top bar, and a centred
// content column, with a bottom tab bar below lg. Identity is resolved inside
// the nav components from the connected wallet, so the shell needs no props.

import { FobsSidebar } from "./navigation";
import { FobsTopbar } from "./topbar";
import { PriceTicker } from "./price-ticker";
import { MobileNav } from "./mobile-nav";
import { AppGate } from "./app-gate";

export function FobsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fobs-page">
      <div className="flex min-h-screen">
        <FobsSidebar />
        <div className="min-w-0 flex-1">
          <FobsTopbar />
          <PriceTicker />
          <main className="mx-auto max-w-[1500px] px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:pb-8">
            <AppGate>{children}</AppGate>
          </main>
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
