// wagmi config — BNB Smart Chain. Browser-injected wallets only.
//
// The injected connector (MetaMask, Binance Wallet, Trust Wallet extensions),
// together with EIP-6963 wallet discovery, is the EVM signer: the server
// prepares a quote, the user's wallet approves + sends the swap, the server
// verifies the fill on-chain. The key never leaves the wallet — the "agent
// prepares, wallet authorizes" boundary. (No WalletConnect: the QR screen is
// deliberately not offered.)

import { http, createConfig } from "wagmi";
import { bsc } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const rpcUrl = process.env.NEXT_PUBLIC_BSC_RPC_URL ?? "https://bsc-dataseed.binance.org";

export const wagmiConfig = createConfig({
  chains: [bsc],
  connectors: [injected()],
  transports: {
    [bsc.id]: http(rpcUrl)
  },
  ssr: true
});

export const BSC_CHAIN_ID = bsc.id; // 56
