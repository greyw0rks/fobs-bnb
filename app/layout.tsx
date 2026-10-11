import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import "../styles/fobs.css";
import "../styles/terminal.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
// Display face for headings and headline figures. Sora is a geometric,
// slightly editorial sans that pairs with Inter without fighting it.
const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "fobs — social trading for tokenized stocks on BNB Chain",
  description:
    "The trade is the social primitive. Trade tokenized stocks on BNB Chain, follow real on-chain traders, and let a non-custodial agent prepare orders your wallet signs.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${sora.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
