"use client";

// Network status pill: reflects the CONNECTED wallet's actual chain, not a
// hardcoded label. On the wrong network it becomes a one-click "Switch to BNB"
// action. When no wallet is connected it shows a neutral target-chain hint.

import { useAccount, useSwitchChain } from "wagmi";
import { BSC_CHAIN_ID } from "@/lib/wagmi";

export function NetworkPill() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  // Not connected: neutral hint, no live claim about the wallet's chain.
  if (!isConnected) {
    return (
      <div className="hidden items-center gap-2 rounded-full border border-[#dfe3dd] bg-white px-3 py-1.5 text-[11px] text-[#6b6c65] sm:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-[#c7c6bf]" />
        BNB Chain
      </div>
    );
  }

  const onBsc = chainId === BSC_CHAIN_ID;

  if (onBsc) {
    return (
      <div className="hidden items-center gap-2 rounded-full border border-[#dfe3dd] bg-white px-3 py-1.5 text-[11px] sm:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-[#28a267]" />
        BNB Chain
      </div>
    );
  }

  // Connected but on the wrong network — prompt to switch.
  return (
    <button
      type="button"
      onClick={() => switchChain({ chainId: BSC_CHAIN_ID })}
      disabled={isPending}
      title="Fobs trades settle on BNB Smart Chain"
      className="flex items-center gap-2 rounded-full border border-[#e0b24c] bg-[#fbf3df] px-3 py-1.5 text-[11px] font-medium text-[#8a6d1f] transition-colors hover:bg-[#f7ead0] disabled:opacity-60"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#d69e2e]" />
      {isPending ? "Switching…" : "Wrong network — switch to BNB"}
    </button>
  );
}
