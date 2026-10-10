// Layout for the signed-in app surfaces (feed, markets, portfolio, agent,
// people, profiles, stock pages). It wraps them in the FobsShell (sidebar +
// top bar + mobile tab bar). The public landing page at `/` sits OUTSIDE this
// group, so it renders without the app chrome.

import { FobsShell } from "@/components/fobs/shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <FobsShell>{children}</FobsShell>;
}
