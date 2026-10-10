import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "../styles/fobs.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "fobs — social trading for tokenized stocks on BNB Chain",
  description:
    "The trade is the social primitive. Trade tokenized stocks on BNB Chain, follow real on-chain traders, and let a non-custodial agent prepare orders your wallet signs.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
