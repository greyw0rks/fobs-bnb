// wagmi config — BNB Smart Chain. Browser-injected wallets, plus WalletConnect
// for mobile when a project id is configured.
//
// The injected connector (MetaMask, Binance Wallet, Trust Wallet extensions) is
// the EVM signer for the RFQ flow: the server prepares a quote, the user's
// wallet signs the order, the server submits it. When NEXT_PUBLIC_WALLETCONNECT_
// PROJECT_ID is set we also offer WalletConnect so phone wallets can sign. The
// key never leaves the wallet — the "agent prepares, wallet authorizes" boundary.

import { http, createConfig } from "wagmi";
import { bsc } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const rpcUrl = process.env.NEXT_PUBLIC_BSC_RPC_URL ?? "https://bsc-dataseed.binance.org";
const wcProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

const connectors = [
  injected(),
  // Only register WalletConnect when configured — walletConnect() throws without
  // a project id, and we never want a half-configured mobile path.
  ...(wcProjectId ? [walletConnect({ projectId: wcProjectId, showQrModal: true })] : [])
];

export const wagmiConfig = createConfig({
  chains: [bsc],
  connectors,
  transports: {
    [bsc.id]: http(rpcUrl)
  },
  ssr: true
});

export const BSC_CHAIN_ID = bsc.id; // 56
